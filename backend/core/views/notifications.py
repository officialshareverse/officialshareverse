from .common import *

class NotificationView(ListAPIView):
    permission_classes = [IsAuthenticated]
    pagination_class = ShareVersePageNumberPagination

    def get(self, request):
        notifications = Notification.objects.filter(user=request.user).order_by("-created_at", "-id")
        is_read = request.query_params.get("is_read")
        if is_read is not None:
            normalized_is_read = str(is_read).strip().lower()
            if normalized_is_read in {"true", "1", "yes"}:
                notifications = notifications.filter(is_read=True)
            elif normalized_is_read in {"false", "0", "no"}:
                notifications = notifications.filter(is_read=False)

        page = self.paginate_queryset(notifications)
        if page is not None:
            data = [build_notification_payload(notification) for notification in page]
            return self.get_paginated_response(data)

        data = [build_notification_payload(notification) for notification in notifications]
        return Response(data)


class MobilePushRegistrationView(APIView):
    permission_classes = [IsAuthenticated]

    def post(self, request):
        serializer = MobilePushRegistrationSerializer(data=request.data)
        if not serializer.is_valid():
            return Response(serializer.errors, status=400)

        validated = serializer.validated_data
        device, created = MobilePushDevice.objects.update_or_create(
            expo_push_token=validated["expo_push_token"],
            defaults={
                "user": request.user,
                "platform": validated.get("platform") or "android",
                "project_id": validated.get("project_id", ""),
                "device_name": validated.get("device_name", ""),
                "is_active": True,
                "last_registered_at": timezone.now(),
                "last_error": "",
            },
        )

        return Response(
            {
                "message": "Push notifications are enabled on this device.",
                "device": {
                    "id": device.id,
                    "platform": device.platform,
                    "project_id": device.project_id,
                    "device_name": device.device_name,
                    "is_active": device.is_active,
                    "created": created,
                },
            },
            status=status.HTTP_201_CREATED if created else status.HTTP_200_OK,
        )


class MobilePushUnregisterView(APIView):
    permission_classes = [IsAuthenticated]

    def post(self, request):
        serializer = MobilePushUnregisterSerializer(data=request.data)
        if not serializer.is_valid():
            return Response(serializer.errors, status=400)

        token = serializer.validated_data["expo_push_token"]
        updated = MobilePushDevice.objects.filter(
            user=request.user,
            expo_push_token=token,
        ).update(
            is_active=False,
            last_error="",
        )

        return Response(
            {
                "message": "Push notifications were disconnected from this device.",
                "updated_count": updated,
            }
        )


class MarkNotificationReadView(APIView):
    permission_classes = [IsAuthenticated]

    def post(self, request, notification_id):
        try:
            notification = Notification.objects.get(id=notification_id, user=request.user)
        except Notification.DoesNotExist:
            return Response({"error": "Notification not found"}, status=404)

        if not notification.is_read:
            notification.is_read = True
            notification.save(update_fields=["is_read"])
            unread_count = Notification.objects.filter(user=request.user, is_read=False).count()
            push_notification_read_to_user(request.user.id, notification.id, unread_count)
            push_badge_update_to_user(request.user.id, reason="notification_read")

        return Response({"message": "Notification marked as read", "notification": build_notification_payload(notification)})


class MarkAllNotificationsReadView(APIView):
    permission_classes = [IsAuthenticated]

    def post(self, request):
        updated_count = Notification.objects.filter(user=request.user, is_read=False).update(is_read=True)
        push_notifications_cleared_to_user(request.user.id, updated_count)
        push_badge_update_to_user(request.user.id, reason="notifications_cleared")
        return Response({"message": "All notifications marked as read", "updated_count": updated_count})


class UserBlockListCreateView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        blocks = UserBlock.objects.filter(blocker=request.user).select_related("blocked")
        return Response({"blocked_users": UserBlockSerializer(blocks, many=True).data})

    def post(self, request):
        serializer = UserBlockCreateSerializer(data=request.data)
        if not serializer.is_valid():
            return Response(serializer.errors, status=400)

        blocked_user_id = serializer.validated_data["blocked_user_id"]
        if blocked_user_id == request.user.id:
            return Response({"error": "You cannot block yourself."}, status=400)

        try:
            blocked_user = User.objects.get(id=blocked_user_id)
        except User.DoesNotExist:
            return Response({"error": "User not found."}, status=404)

        block, created = UserBlock.objects.update_or_create(
            blocker=request.user,
            blocked=blocked_user,
            defaults={"reason": serializer.validated_data.get("reason", "")},
        )
        return Response(
            {
                "message": "User blocked." if created else "User block updated.",
                "block": UserBlockSerializer(block).data,
            },
            status=status.HTTP_201_CREATED if created else status.HTTP_200_OK,
        )


class UserBlockDetailView(APIView):
    permission_classes = [IsAuthenticated]

    def delete(self, request, blocked_user_id):
        deleted_count, _ = UserBlock.objects.filter(
            blocker=request.user,
            blocked_id=blocked_user_id,
        ).delete()
        if not deleted_count:
            return Response({"error": "Blocked user not found."}, status=404)
        return Response({"message": "User unblocked."})


class ContentReportCreateView(APIView):
    permission_classes = [IsAuthenticated]

    def post(self, request):
        serializer = ContentReportCreateSerializer(data=request.data)
        if not serializer.is_valid():
            return Response(serializer.errors, status=400)

        target_type = serializer.validated_data["target_type"]
        target_id = serializer.validated_data["target_id"]
        reason = serializer.validated_data["reason"]
        details = serializer.validated_data.get("details", "")

        reported_user = None
        group = None
        chat_message = None

        if target_type == "user":
            if target_id == request.user.id:
                return Response({"error": "You cannot report yourself."}, status=400)
            try:
                reported_user = User.objects.get(id=target_id)
            except User.DoesNotExist:
                return Response({"error": "User not found."}, status=404)

        elif target_type == "group":
            try:
                group = Group.objects.select_related("subscription", "owner").get(id=target_id)
            except Group.DoesNotExist:
                return Response({"error": "Group not found."}, status=404)
            reported_user = group.owner

        elif target_type == "chat_message":
            try:
                chat_message = (
                    GroupChatMessage.objects.select_related("group", "group__subscription", "sender")
                    .get(id=target_id, moderation_status="visible")
                )
            except GroupChatMessage.DoesNotExist:
                return Response({"error": "Chat message not found."}, status=404)

            group = chat_message.group
            reported_user = chat_message.sender
            if not can_user_join_group_chat(request.user, group):
                return Response({"error": "You are not allowed to report this message."}, status=403)

        report = ContentReport.objects.create(
            reporter=request.user,
            target_type=target_type,
            reported_user=reported_user,
            group=group,
            chat_message=chat_message,
            reason=reason,
            details=details,
        )
        return Response(
            {
                "message": "Report submitted. ShareVerse will review it.",
                "report": ContentReportSerializer(report).data,
            },
            status=201,
        )


