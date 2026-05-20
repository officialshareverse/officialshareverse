from .common import *

class AddMoneyView(APIView):
    permission_classes = [IsAuthenticated]

    def post(self, request):
        serializer = WalletTopupOrderCreateSerializer(data=request.data)
        if not serializer.is_valid():
            return Response(serializer.errors, status=400)

        payment_config = build_wallet_payment_config()
        if not payment_config["topup_enabled"]:
            return Response(
                {
                    "error": "Wallet top-ups are not configured on this server yet.",
                    "payment": payment_config,
                },
                status=503,
            )

        amount = serializer.validated_data["amount"].quantize(Decimal("0.01"))
        amount_subunits = convert_decimal_amount_to_subunits(amount)
        currency = settings.RAZORPAY_CURRENCY
        receipt = f"topup_{secrets.token_hex(12)}"

        try:
            gateway_order = create_razorpay_order(
                amount_subunits=amount_subunits,
                currency=currency,
                receipt=receipt,
                notes={
                    "user_id": str(request.user.id),
                    "username": request.user.username,
                    "purpose": "wallet_topup",
                },
            )
        except PaymentGatewayError as exc:
            log_operation_event(
                "wallet_topup_order_create_failed",
                user_id=request.user.id,
                username=request.user.username,
                amount=amount,
                currency=currency,
                reason=str(exc),
            )
            return Response({"error": str(exc)}, status=503)

        topup_order = WalletTopupOrder.objects.create(
            user=request.user,
            amount=amount,
            amount_subunits=amount_subunits,
            currency=currency,
            receipt=receipt,
            provider="razorpay",
            provider_order_id=gateway_order["id"],
        )

        log_operation_event(
            "wallet_topup_order_created",
            topup_order_id=topup_order.id,
            user_id=request.user.id,
            username=request.user.username,
            amount=amount,
            currency=currency,
            amount_subunits=amount_subunits,
            provider_order_id=gateway_order["id"],
            receipt=receipt,
        )

        full_name = (
            f"{request.user.first_name} {request.user.last_name}".strip()
            or request.user.username
        )

        return Response(
            {
                "message": "Checkout order created successfully.",
                "checkout": {
                    "key": settings.RAZORPAY_KEY_ID,
                    "name": settings.RAZORPAY_COMPANY_NAME,
                    "description": "Wallet top-up",
                    "amount": amount_subunits,
                    "currency": currency,
                    "order_id": gateway_order["id"],
                    "prefill": {
                        "name": full_name,
                        "email": request.user.email or "",
                        "contact": request.user.phone or "",
                    },
                },
                "topup": build_wallet_topup_response_payload(topup_order),
                "payment": payment_config,
            },
            status=201,
        )


class VerifyWalletTopupView(APIView):
    permission_classes = [IsAuthenticated]

    def post(self, request):
        serializer = WalletTopupVerifySerializer(data=request.data)
        if not serializer.is_valid():
            return Response(serializer.errors, status=400)

        order_id = serializer.validated_data["razorpay_order_id"]
        payment_id = serializer.validated_data["razorpay_payment_id"]
        signature = serializer.validated_data["razorpay_signature"]

        try:
            topup_order = WalletTopupOrder.objects.get(
                provider="razorpay",
                provider_order_id=order_id,
                user=request.user,
            )
        except WalletTopupOrder.DoesNotExist:
            log_operation_event(
                "wallet_topup_verify_missing_order",
                user_id=request.user.id,
                username=request.user.username,
                provider_order_id=order_id,
                payment_id=payment_id,
            )
            return Response({"error": "Top-up order not found."}, status=404)

        if topup_order.status == "paid" and topup_order.credited_at:
            wallet, _ = Wallet.objects.get_or_create(user=request.user)
            return Response(
                {
                    "message": "Wallet top-up was already verified.",
                    "balance": str(wallet.balance),
                    "topup": build_wallet_topup_response_payload(topup_order),
                }
            )

        try:
            signature_valid = verify_razorpay_signature(order_id, payment_id, signature)
        except PaymentGatewayError as exc:
            log_operation_event(
                "wallet_topup_verify_gateway_error",
                topup_order_id=topup_order.id,
                user_id=request.user.id,
                username=request.user.username,
                provider_order_id=order_id,
                payment_id=payment_id,
                reason=str(exc),
            )
            return Response({"error": str(exc)}, status=503)

        if not signature_valid:
            mark_wallet_topup_failed(topup_order, "Signature verification failed.", payment_id, signature)
            return Response({"error": "Payment signature verification failed."}, status=400)

        try:
            payment_details = fetch_razorpay_payment(payment_id)
        except PaymentGatewayError as exc:
            log_operation_event(
                "wallet_topup_fetch_payment_failed",
                topup_order_id=topup_order.id,
                user_id=request.user.id,
                username=request.user.username,
                provider_order_id=order_id,
                payment_id=payment_id,
                reason=str(exc),
            )
            return Response({"error": str(exc)}, status=503)

        validation_error = validate_wallet_topup_payment_details(topup_order, payment_details)
        if validation_error:
            mark_wallet_topup_failed(topup_order, validation_error, payment_id, signature)
            return Response({"error": validation_error}, status=400)

        try:
            payment_details, payment_captured = ensure_wallet_topup_payment_captured(
                topup_order,
                payment_details,
            )
        except PaymentGatewayError as exc:
            log_operation_event(
                "wallet_topup_capture_failed",
                topup_order_id=topup_order.id,
                user_id=request.user.id,
                username=request.user.username,
                provider_order_id=order_id,
                payment_id=payment_id,
                reason=str(exc),
            )
            return Response({"error": str(exc)}, status=503)

        if not payment_captured:
            mark_wallet_topup_failed(
                topup_order,
                "Payment is not captured yet.",
                payment_id,
                signature,
            )
            return Response({"error": "Payment is not captured yet. Please try again shortly."}, status=400)

        credited_now, final_topup, final_wallet = credit_wallet_topup_order(
            topup_order.id,
            payment_id,
            signature=signature,
        )
        return Response(
            {
                "message": "Wallet top-up credited successfully."
                if credited_now
                else "Wallet top-up was already verified.",
                "balance": str(final_wallet.balance),
                "topup": build_wallet_topup_response_payload(final_topup),
            }
        )


class RazorpayWebhookView(APIView):
    authentication_classes = []
    permission_classes = [AllowAny]

    def post(self, request):
        raw_body = request.body or b""
        signature = (request.META.get("HTTP_X_RAZORPAY_SIGNATURE") or "").strip()
        header_event_id = (request.META.get("HTTP_X_RAZORPAY_EVENT_ID") or "").strip()

        if not signature:
            return Response({"error": "Missing webhook signature."}, status=400)

        try:
            signature_valid = verify_razorpay_webhook_signature(raw_body, signature)
        except PaymentGatewayError as exc:
            return Response({"error": str(exc)}, status=503)

        if not signature_valid:
            return Response({"error": "Invalid webhook signature."}, status=400)

        try:
            event_payload = json.loads(raw_body.decode("utf-8"))
        except json.JSONDecodeError:
            return Response({"error": "Invalid webhook payload."}, status=400)

        event_type = (event_payload.get("event") or "").strip()
        payment_entity = ((event_payload.get("payload") or {}).get("payment") or {}).get("entity") or {}
        order_entity = ((event_payload.get("payload") or {}).get("order") or {}).get("entity") or {}
        payment_id = (payment_entity.get("id") or "").strip()
        provider_order_id = (payment_entity.get("order_id") or order_entity.get("id") or "").strip()
        event_id = build_razorpay_webhook_event_id(
            raw_body,
            event_type=event_type,
            payment_id=payment_id,
            provider_order_id=provider_order_id,
            provided_id=header_event_id,
        )

        if RazorpayWebhookEvent.objects.filter(event_id=event_id).exists():
            log_operation_event(
                "wallet_topup_webhook_duplicate",
                event_id=event_id,
                event_type=event_type,
                provider_order_id=provider_order_id,
                payment_id=payment_id,
            )
            return Response({"message": "Webhook already processed."}, status=200)

        if event_type not in {"payment.authorized", "payment.captured", "order.paid"}:
            RazorpayWebhookEvent.objects.create(
                event_id=event_id,
                event_type=event_type or "unknown",
                payment_id=payment_id,
                provider_order_id=provider_order_id,
                status="ignored",
                notes="Webhook event is not handled by wallet top-up processing.",
            )
            log_operation_event(
                "wallet_topup_webhook_ignored",
                event_id=event_id,
                event_type=event_type or "unknown",
                provider_order_id=provider_order_id,
                payment_id=payment_id,
            )
            return Response({"message": "Webhook ignored."}, status=200)

        if not provider_order_id or not payment_id:
            RazorpayWebhookEvent.objects.create(
                event_id=event_id,
                event_type=event_type,
                payment_id=payment_id,
                provider_order_id=provider_order_id,
                status="failed",
                notes="Webhook payload did not include the required payment/order identifiers.",
            )
            log_operation_event(
                "wallet_topup_webhook_invalid_payload",
                event_id=event_id,
                event_type=event_type,
                provider_order_id=provider_order_id,
                payment_id=payment_id,
            )
            return Response({"message": "Webhook received without a matching top-up payload."}, status=200)

        topup_order = WalletTopupOrder.objects.filter(
            provider="razorpay",
            provider_order_id=provider_order_id,
        ).first()
        if not topup_order:
            RazorpayWebhookEvent.objects.create(
                event_id=event_id,
                event_type=event_type,
                payment_id=payment_id,
                provider_order_id=provider_order_id,
                status="ignored",
                notes="No matching wallet top-up order was found.",
            )
            log_operation_event(
                "wallet_topup_webhook_missing_order",
                event_id=event_id,
                event_type=event_type,
                provider_order_id=provider_order_id,
                payment_id=payment_id,
            )
            return Response({"message": "Webhook acknowledged."}, status=200)

        payment_details = dict(payment_entity)
        payment_details.setdefault("order_id", provider_order_id)
        validation_error = validate_wallet_topup_payment_details(topup_order, payment_details)
        if validation_error:
            mark_wallet_topup_failed(topup_order, validation_error, payment_id)
            RazorpayWebhookEvent.objects.create(
                event_id=event_id,
                event_type=event_type,
                payment_id=payment_id,
                provider_order_id=provider_order_id,
                status="failed",
                notes=validation_error,
            )
            return Response({"message": "Webhook acknowledged."}, status=200)

        try:
            payment_details, payment_captured = ensure_wallet_topup_payment_captured(
                topup_order,
                payment_details,
            )
        except PaymentGatewayError as exc:
            RazorpayWebhookEvent.objects.create(
                event_id=event_id,
                event_type=event_type,
                payment_id=payment_id,
                provider_order_id=provider_order_id,
                status="failed",
                notes=str(exc),
            )
            return Response({"message": "Webhook acknowledged."}, status=200)

        if not payment_captured:
            message = "Payment is not captured yet."
            mark_wallet_topup_failed(topup_order, message, payment_id)
            RazorpayWebhookEvent.objects.create(
                event_id=event_id,
                event_type=event_type,
                payment_id=payment_id,
                provider_order_id=provider_order_id,
                status="failed",
                notes=message,
            )
            return Response({"message": "Webhook acknowledged."}, status=200)

        credited_now, _, _ = credit_wallet_topup_order(topup_order.id, payment_id)
        RazorpayWebhookEvent.objects.create(
            event_id=event_id,
            event_type=event_type,
            payment_id=payment_id,
            provider_order_id=provider_order_id,
            status="processed",
            notes="Wallet top-up credited via webhook." if credited_now else "Webhook received after wallet was already credited.",
        )
        log_operation_event(
            "wallet_topup_webhook_processed",
            event_id=event_id,
            event_type=event_type,
            topup_order_id=topup_order.id,
            user_id=topup_order.user_id,
            username=topup_order.user.username,
            provider_order_id=provider_order_id,
            payment_id=payment_id,
            credited_now=credited_now,
        )
        return Response({"message": "Webhook processed successfully."}, status=200)


class PayoutAccountView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        payout_account = PayoutAccount.objects.filter(user=request.user).first()
        return Response({
            "payout_config": build_wallet_payout_config(),
            "payout_account": PayoutAccountSerializer(payout_account).data if payout_account else None,
        })

    def put(self, request):
        serializer = PayoutAccountUpsertSerializer(data=request.data)
        if not serializer.is_valid():
            return Response(serializer.errors, status=400)

        payout_config = build_wallet_payout_config()
        if not payout_config["payout_enabled"]:
            existing_account = PayoutAccount.objects.filter(user=request.user).first()
            payout_account = save_manual_payout_account(
                request.user,
                serializer.validated_data,
                existing_account=existing_account,
            )
            return Response(
                {
                    "message": "Withdrawal destination saved for payout requests.",
                    "payout_account": PayoutAccountSerializer(payout_account).data,
                    "payout_config": payout_config,
                },
                status=200,
            )

        existing_account = PayoutAccount.objects.filter(user=request.user).first()

        try:
            payout_account = sync_payout_account_with_provider(
                request.user,
                serializer.validated_data,
                existing_account=existing_account,
            )
        except PaymentGatewayError as exc:
            if existing_account:
                existing_account.last_error = str(exc)
                existing_account.save(update_fields=["last_error", "updated_at"])
            log_operation_event(
                "payout_account_sync_failed",
                user_id=request.user.id,
                username=request.user.username,
                payout_account_id=existing_account.id if existing_account else None,
                account_type=serializer.validated_data.get("account_type"),
                reason=str(exc),
            )
            return Response({"error": str(exc)}, status=503)

        log_operation_event(
            "payout_account_saved",
            user_id=request.user.id,
            username=request.user.username,
            payout_account_id=payout_account.id,
            account_type=payout_account.account_type,
            destination_label=build_payout_destination_label(payout_account),
            provider="razorpayx",
        )

        return Response(
            {
                "message": "Payout account saved successfully.",
                "payout_account": PayoutAccountSerializer(payout_account).data,
                "payout_config": payout_config,
            },
            status=200,
        )


class WithdrawMoneyView(APIView):
    permission_classes = [IsAuthenticated]

    def post(self, request):
        serializer = WalletPayoutCreateSerializer(data=request.data)
        if not serializer.is_valid():
            return Response(serializer.errors, status=400)

        payout_account = PayoutAccount.objects.filter(user=request.user, is_active=True).first()
        if not payout_account:
            return Response(
                {"error": "Add a payout method before requesting a withdrawal."},
                status=400,
            )

        amount = serializer.validated_data["amount"].quantize(Decimal("0.01"))
        payout_mode = serializer.validated_data["payout_mode"]
        payout_config = build_wallet_payout_config()
        if not payout_config["payout_enabled"]:
            try:
                wallet_payout = create_manual_wallet_payout_request(
                    user=request.user,
                    amount=amount,
                    payout_account=payout_account,
                    mode=payout_mode,
                )
            except ValidationError as exc:
                return Response({"error": exc.message}, status=400)

            wallet, _ = Wallet.objects.get_or_create(user=request.user)
            return Response(
                {
                    "message": "Withdrawal request submitted. Payouts are usually processed within 24 hours.",
                    "balance": str(wallet.balance),
                    "payout": WalletPayoutSerializer(wallet_payout).data,
                    "payout_config": payout_config,
                },
                status=201,
            )

        if not payout_account.provider_fund_account_id:
            return Response(
                {"error": "Add a payout method before requesting a withdrawal."},
                status=400,
            )

        if payout_account.account_type == "vpa":
            payout_mode = "UPI"
        elif payout_mode == "UPI":
            return Response({"error": "UPI mode is only available for a saved UPI payout method."}, status=400)

        amount_subunits = convert_decimal_amount_to_subunits(amount)
        destination_label = build_payout_destination_label(payout_account)
        source_account_number = (getattr(settings, "RAZORPAYX_SOURCE_ACCOUNT_NUMBER", "") or "").strip()
        reference_id = f"wd_{secrets.token_hex(12)}"[:40]
        idempotency_key = secrets.token_hex(24)
        narration = sanitize_payout_narration(f"ShareVerse {request.user.username}")

        with transaction.atomic():
            wallet, _ = Wallet.objects.select_for_update().get_or_create(user=request.user)
            if wallet.balance < amount:
                return Response({"error": "Insufficient wallet balance"}, status=400)

            wallet.balance -= amount
            wallet.save()

            payout_transaction = Transaction.objects.create(
                user=request.user,
                group=None,
                amount=amount,
                type="debit",
                status="pending",
                payment_method="wallet_payout",
            )

            wallet_payout = WalletPayout.objects.create(
                user=request.user,
                payout_account=payout_account,
                transaction=payout_transaction,
                amount=amount,
                amount_subunits=amount_subunits,
                currency=settings.RAZORPAY_CURRENCY,
                provider="razorpayx",
                provider_contact_id=payout_account.provider_contact_id,
                provider_fund_account_id=payout_account.provider_fund_account_id,
                provider_reference_id=reference_id,
                idempotency_key=idempotency_key,
                source_account_number=source_account_number,
                mode=payout_mode,
                purpose="payout",
                narration=narration,
                destination_label=destination_label,
                status="created",
                provider_status_source="api",
            )

        try:
            payout_response = create_razorpayx_payout(
                source_account_number=source_account_number,
                fund_account_id=payout_account.provider_fund_account_id,
                amount_subunits=amount_subunits,
                currency=settings.RAZORPAY_CURRENCY,
                mode=payout_mode,
                purpose="payout",
                narration=narration,
                reference_id=reference_id,
                notes={
                    "user_id": str(request.user.id),
                    "username": request.user.username,
                    "destination": destination_label,
                },
                idempotency_key=idempotency_key,
            )
        except PaymentGatewayError as exc:
            failed_payload = {
                "status": "failed",
                "failure_reason": str(exc),
                "status_details": {"description": str(exc)},
            }
            wallet_payout = apply_wallet_payout_state(wallet_payout.id, failed_payload, status_source="api_error")
            log_operation_event(
                "wallet_payout_create_failed",
                payout_id=wallet_payout.id,
                user_id=request.user.id,
                username=request.user.username,
                amount=amount,
                mode=payout_mode,
                provider="razorpayx",
                destination_label=destination_label,
                reason=str(exc),
            )
            wallet, _ = Wallet.objects.get_or_create(user=request.user)
            return Response(
                {
                    "error": str(exc),
                    "balance": str(wallet.balance),
                    "payout": WalletPayoutSerializer(wallet_payout).data,
                },
                status=503,
            )

        wallet_payout = apply_wallet_payout_state(wallet_payout.id, payout_response, status_source="api")
        log_operation_event(
            "wallet_payout_created",
            payout_id=wallet_payout.id,
            user_id=request.user.id,
            username=request.user.username,
            amount=amount,
            mode=payout_mode,
            provider="razorpayx",
            destination_label=destination_label,
            provider_reference_id=reference_id,
            provider_payout_id=wallet_payout.provider_payout_id,
            status=wallet_payout.status,
        )
        wallet, _ = Wallet.objects.get_or_create(user=request.user)
        return Response(
            {
                "message": "Withdrawal request created successfully.",
                "balance": str(wallet.balance),
                "payout": WalletPayoutSerializer(wallet_payout).data,
            },
            status=201,
        )


class WalletPayoutSyncView(APIView):
    permission_classes = [IsAuthenticated]

    def post(self, request, payout_id):
        try:
            wallet_payout = WalletPayout.objects.get(id=payout_id, user=request.user)
        except WalletPayout.DoesNotExist:
            return Response({"error": "Payout request not found."}, status=404)

        if not wallet_payout.provider_payout_id:
            return Response(
                {
                    "message": "This payout was never accepted by the provider.",
                    "payout": WalletPayoutSerializer(wallet_payout).data,
                }
            )

        try:
            payout_response = fetch_razorpayx_payout(wallet_payout.provider_payout_id)
        except PaymentGatewayError as exc:
            return Response({"error": str(exc)}, status=503)

        wallet_payout = apply_wallet_payout_state(wallet_payout.id, payout_response, status_source="sync")
        wallet, _ = Wallet.objects.get_or_create(user=request.user)
        return Response(
            {
                "message": "Payout status refreshed.",
                "balance": str(wallet.balance),
                "payout": WalletPayoutSerializer(wallet_payout).data,
            }
        )


class RazorpayXPayoutWebhookView(APIView):
    authentication_classes = []
    permission_classes = [AllowAny]

    def post(self, request):
        raw_body = request.body or b""
        signature = (request.META.get("HTTP_X_RAZORPAY_SIGNATURE") or "").strip()
        header_event_id = (request.META.get("HTTP_X_RAZORPAY_EVENT_ID") or "").strip()

        if not signature:
            return Response({"error": "Missing webhook signature."}, status=400)

        try:
            signature_valid = verify_razorpayx_webhook_signature(raw_body, signature)
        except PaymentGatewayError as exc:
            return Response({"error": str(exc)}, status=503)

        if not signature_valid:
            return Response({"error": "Invalid webhook signature."}, status=400)

        try:
            event_payload = json.loads(raw_body.decode("utf-8"))
        except json.JSONDecodeError:
            return Response({"error": "Invalid webhook payload."}, status=400)

        event_type = (event_payload.get("event") or "").strip()
        payout_entity = ((event_payload.get("payload") or {}).get("payout") or {}).get("entity") or {}
        payout_id = (payout_entity.get("id") or "").strip()
        reference_id = (payout_entity.get("reference_id") or "").strip()
        event_id = build_razorpayx_webhook_event_id(
            raw_body,
            event_type=event_type,
            payout_id=payout_id,
            provided_id=header_event_id,
        )

        if RazorpayXPayoutWebhookEvent.objects.filter(event_id=event_id).exists():
            return Response({"message": "Webhook already processed."}, status=200)

        if not event_type.startswith("payout."):
            RazorpayXPayoutWebhookEvent.objects.create(
                event_id=event_id,
                event_type=event_type or "unknown",
                payout_id=payout_id,
                status="ignored",
                notes="Webhook event is not handled by payout processing.",
            )
            return Response({"message": "Webhook ignored."}, status=200)

        if not payout_id:
            RazorpayXPayoutWebhookEvent.objects.create(
                event_id=event_id,
                event_type=event_type or "unknown",
                payout_id="",
                status="failed",
                notes="Webhook payload did not include a payout id.",
            )
            return Response({"message": "Webhook acknowledged."}, status=200)

        wallet_payout = WalletPayout.objects.filter(provider_payout_id=payout_id).first()
        if not wallet_payout and reference_id:
            wallet_payout = WalletPayout.objects.filter(provider_reference_id=reference_id).first()

        if not wallet_payout:
            RazorpayXPayoutWebhookEvent.objects.create(
                event_id=event_id,
                event_type=event_type,
                payout_id=payout_id,
                status="ignored",
                notes="No matching wallet payout was found.",
            )
            return Response({"message": "Webhook acknowledged."}, status=200)

        wallet_payout = apply_wallet_payout_state(wallet_payout.id, payout_entity, status_source="webhook")
        RazorpayXPayoutWebhookEvent.objects.create(
            event_id=event_id,
            event_type=event_type,
            payout_id=payout_id,
            status="processed",
            notes=f"Wallet payout updated to {wallet_payout.status}.",
        )
        return Response({"message": "Webhook processed successfully."}, status=200)


