# Stage 1: Discovery & Group Formation Improvements for Buy-Together

## Overview
Four improvements to the buy-together feature's group-formation stage:
1. **Fill deadline** — optional date; if the group hasn't filled by then, auto-refund held members and close.
2. **"Almost full" boosting** — surface 75%+ fill groups in the marketplace with an urgency badge + sort boost.
3. **Partial-fill proceed** — creator sets a `min_fill_slots` (e.g., 3 of 4); once that threshold is met, the creator can choose to proceed early.
4. **Waitlist** — when a group is full, users can join a waitlist; if a member leaves during `collecting`, the next waitlisted user auto-joins.

All changes are **additive and backward-compatible**: new model fields are nullable, new behavior only triggers when the new fields are set. Existing buy-together groups (created before this change) behave as before (no fill deadline, must fill completely, no waitlist). Sharing groups are completely unaffected.

---

## Change 1 — `backend/core/models.py` — add fields to `Group` + new `GroupWaitlistEntry` model

### 1a. Add fields to the `Group` model

Add these three fields to the `Group` model (after `funds_released_at`, before `created_at` ):

```python
    funds_released_at = models.DateTimeField(null=True, blank=True)

    # Stage 1.1: fill deadline for buy-together groups. If the group
    # hasn't filled by this datetime, the cron auto-refunds held members
    # and marks the group as "failed". Nullable so existing groups and
    # sharing groups are unaffected. Set by the creator at group creation.
    fill_deadline_at = models.DateTimeField(null=True, blank=True)

    # Stage 1.3: minimum slots required before the creator can proceed.
    # For a 4-slot group, min_fill_slots=3 means the creator can proceed
    # once 3 members have joined (covering the 4th slot themselves or
    # accepting a smaller plan). Defaults to total_slots (must fill
    # completely) for backward compatibility.
    min_fill_slots = models.IntegerField(null=True, blank=True)

    # Stage 1.3: once min_fill_slots is met and the creator opts to
    # proceed early, this flag is set so the join flow stops accepting
    # new members and moves to awaiting_purchase. The creator must still
    # upload proof within the purchase deadline.
    proceed_early_at = models.DateTimeField(null=True, blank=True)

    created_at = models.DateTimeField(auto_now_add=True)
```

### 1b. Add the `GroupWaitlistEntry` model

Add this new model after `GroupMember` (find `class GroupMember` and add below it):

```python
class GroupWaitlistEntry(models.Model):
    """
    Stage 1.4: waitlist for full buy-together groups. When a group is
    full (filled_slots >= total_slots), users can join the waitlist. If a
    member leaves during the "collecting" phase (before the purchase
    deadline starts), the next waitlisted user is auto-promoted: they're
    charged and added as a GroupMember.

    Ordering is first-come-first-served (by created_at). Entries are
    deleted on promotion (they become a GroupMember) or on explicit
    cancellation by the user.
    """
    group = models.ForeignKey(Group, on_delete=models.CASCADE, related_name="waitlist_entries")
    user = models.ForeignKey(User, on_delete=models.CASCADE, related_name="waitlist_entries")
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        unique_together = ("group", "user")
        ordering = ["created_at", "id"]
        indexes = [
            models.Index(fields=["group", "created_at"]),
        ]

    def __str__(self):
        return f"{self.user.username} waitlisted for {self.group_id}"
```

### 1c. Add helper methods to `Group`

Add these methods to the `Group` model (near the existing `__str__` method):

```python
    def get_filled_slots(self):
        """Current count of members (including unpaid — use sparingly)."""
        return self.groupmember_set.count()

    def get_remaining_slots(self):
        return max(self.total_slots - self.get_filled_slots(), 0)

    def is_full(self):
        return self.get_filled_slots() >= self.total_slots

    def can_proceed_early(self):
        """
        Stage 1.3: True if the group has met its min_fill_slots
        threshold and the creator hasn't yet proceeded. Only meaningful
        for buy-together groups in "collecting" status.
        """
        if self.mode != "group_buy":
            return False
        if self.status != "collecting":
            return False
        if self.proceed_early_at is not None:
            return False
        threshold = self.min_fill_slots or self.total_slots
        return self.get_filled_slots() >= threshold and self.get_filled_slots() < self.total_slots

    def get_waitlist_count(self):
        return self.waitlist_entries.count()
```

---

## Change 2 — Migration

Generate the migration after editing the model:

```bash
cd backend
python manage.py makemigrations core --name stage1_buy_together_formation
```

This will produce a migration that:
- Adds `fill_deadline_at`, `min_fill_slots`, `proceed_early_at` to `Group` (all nullable).
- Creates the `GroupWaitlistEntry` table.

Verify the generated migration looks correct before applying. Then:

```bash
python manage.py migrate
```

> **Backward compatibility:** all three new `Group` fields are nullable, so existing rows and sharing groups are unaffected. `min_fill_slots` defaults to `None`, which the `can_proceed_early()` method treats as "must fill completely" (the current behavior). Existing buy-together groups continue to behave exactly as before.

---

## Change 3 — `backend/core/serializers/group_create.py` — accept the new fields

### File: `backend/core/serializers/group_create.py`

OLD (line ~14445):
```python
class CreateGroupSerializer(serializers.Serializer):
    subscription_name = serializers.CharField(max_length=100)
    mode = serializers.ChoiceField(choices=Group.MODE_CHOICES, default="sharing")
    total_slots = serializers.IntegerField(min_value=1)
    price_per_slot = serializers.DecimalField(max_digits=10, decimal_places=2, min_value=Decimal("0.01"))
    start_date = serializers.DateField()
    end_date = serializers.DateField()
    access_identifier = serializers.CharField(required=False, allow_blank=True)
    access_password = serializers.CharField(required=False, allow_blank=True, trim_whitespace=False)
    access_notes = serializers.CharField(required=False, allow_blank=True)
    category = serializers.CharField(required=False, allow_blank=True, default="general")
    subscription_price = serializers.IntegerField(required=False, min_value=0, default=100)

    def validate_subscription_name(self, value):
        # ... existing ...
```

NEW:
```python
class CreateGroupSerializer(serializers.Serializer):
    subscription_name = serializers.CharField(max_length=100)
    mode = serializers.ChoiceField(choices=Group.MODE_CHOICES, default="sharing")
    total_slots = serializers.IntegerField(min_value=1)
    price_per_slot = serializers.DecimalField(max_digits=10, decimal_places=2, min_value=Decimal("0.01"))
    start_date = serializers.DateField()
    end_date = serializers.DateField()
    access_identifier = serializers.CharField(required=False, allow_blank=True)
    access_password = serializers.CharField(required=False, allow_blank=True, trim_whitespace=False)
    access_notes = serializers.CharField(required=False, allow_blank=True)
    category = serializers.CharField(required=False, allow_blank=True, default="general")
    subscription_price = serializers.IntegerField(required=False, min_value=0, default=100)

    # Stage 1.1: optional fill deadline for buy-together groups.
    # ISO datetime string. If provided and the group hasn't filled by
    # this time, the cron auto-refunds held members and marks the group
    # as failed.
    fill_deadline_at = serializers.DateTimeField(required=False, allow_null=True)

    # Stage 1.3: minimum slots before the creator can proceed early.
    # Must be >= 1 and <= total_slots. If not provided, defaults to
    # total_slots (must fill completely — the current behavior).
    min_fill_slots = serializers.IntegerField(required=False, allow_null=True, min_value=1)

    def validate_subscription_name(self, value):
        # ... existing unchanged ...

    def validate(self, attrs):
        # ... existing validate() body unchanged (it handles the
        # access_identifier/password/notes cross-validation) ...

        # Stage 1.1 & 1.3: validate the new fields against mode + slots.
        mode = attrs["mode"]
        total_slots = attrs["total_slots"]
        fill_deadline_at = attrs.get("fill_deadline_at")
        min_fill_slots = attrs.get("min_fill_slots")

        if mode == "group_buy":
            # Fill deadline is optional but must be in the future if provided.
            if fill_deadline_at is not None:
                from django.utils import timezone
                if hasattr(fill_deadline_at, "isoformat"):
                    if fill_deadline_at <= timezone.now():
                        raise serializers.ValidationError({
                            "fill_deadline_at": "Fill deadline must be in the future."
                        })

            # min_fill_slots must be <= total_slots.
            if min_fill_slots is not None:
                if min_fill_slots > total_slots:
                    raise serializers.ValidationError({
                        "min_fill_slots": "Minimum fill slots cannot exceed total slots."
                    })
        else:
            # Sharing groups don't use these fields; reject if provided to
            # avoid confusion.
            if fill_deadline_at is not None:
                raise serializers.ValidationError({
                    "fill_deadline_at": "Fill deadline is only for buy-together groups."
                })
            if min_fill_slots is not None:
                raise serializers.ValidationError({
                    "min_fill_slots": "Minimum fill slots is only for buy-together groups."
                })

        return attrs
```

---

## Change 4 — `backend/core/views/groups_public.py` — `CreateGroupView` saves the new fields

Find the `CreateGroupView.post` method and ensure the new fields are passed to the `Group.objects.create(...)` call.

OLD (the group creation block inside `CreateGroupView.post`):
```python
group = Group.objects.create(
    owner=request.user,
    subscription=subscription,
    total_slots=total_slots,
    price_per_slot=price_per_slot,
    start_date=start_date,
    end_date=end_date,
    mode=mode,
    # ... access fields ...
)
```

NEW:
```python
group = Group.objects.create(
    owner=request.user,
    subscription=subscription,
    total_slots=total_slots,
    price_per_slot=price_per_slot,
    start_date=start_date,
    end_date=end_date,
    mode=mode,
    # Stage 1.1 & 1.3: save the new formation fields (only relevant
    # for group_buy; the serializer rejects them for sharing).
    fill_deadline_at=serializer.validated_data.get("fill_deadline_at"),
    min_fill_slots=serializer.validated_data.get("min_fill_slots"),
    # ... access fields ...
)
```

> **Adaptation note for Gemini:** read the actual `CreateGroupView.post` body and add the two new fields to the existing `Group.objects.create(...)` call. Don't rewrite the whole view.

---

## Change 5 — `backend/core/views/common.py` — extend `process_expired_buy_together_refunds` to handle fill deadlines

### File: `backend/core/views/common.py` — `process_expired_buy_together_refunds` 

Add a third category of expired groups: those whose `fill_deadline_at` has passed without filling.

OLD:
```python
def process_expired_buy_together_refunds(group_ids=None):
    # ... docstring ...
    refunded_total = Decimal("0.00")
    released_total = Decimal("0.00")
    released_groups = 0
    refund_ids = []
    release_ids = []

    with transaction.atomic():
        expired_refund_groups = (
            Group.objects.select_for_update()
            .filter(
                mode="group_buy",
                status="awaiting_purchase",
                auto_refund_at__isnull=False,
                auto_refund_at__lte=timezone.now(),
            )
        )
        expired_release_groups = (
            Group.objects.select_for_update()
            .filter(
                mode="group_buy",
                status="proof_submitted",
                auto_refund_at__isnull=False,
                auto_refund_at__lte=timezone.now(),
            )
        )

        if group_ids is not None:
            expired_refund_groups = expired_refund_groups.filter(id__in=group_ids)
            expired_release_groups = expired_release_groups.filter(id__in=group_ids)

        refund_ids = list(expired_refund_groups.values_list("id", flat=True))
        release_ids = list(expired_release_groups.values_list("id", flat=True))

    for group_id in refund_ids:
        refunded_total += refund_group_buy_held_funds(group_id, reason="deadline_expired")

    for group_id in release_ids:
        release_amount, released = release_group_buy_held_funds(
            group_id,
            allow_timeout_release=True,
        )
        if released:
            released_groups += 1
            released_total += release_amount

    return {
        "processed_groups": len(refund_ids) + released_groups,
        "refunded_amount": refunded_total,
        "released_amount": released_total,
        "released_groups": released_groups,
    }
```

NEW:
```python
def process_expired_buy_together_refunds(group_ids=None):
    """
    Settle expired buy-together groups. Three categories:
      1. Fill deadline expired (group didn't fill in time) → refund held members, mark "failed".
      2. Purchase deadline expired (group filled, creator didn't buy in time) → refund held members.
      3. Confirmation window expired (clean timeout) → release escrow to creator.

    Stage 1.1: added category 1 (fill deadline).
    """
    refunded_total = Decimal("0.00")
    released_total = Decimal("0.00")
    released_groups = 0
    refund_ids = []
    release_ids = []
    fill_deadline_refund_ids = []  # Stage 1.1

    with transaction.atomic():
        # Category 1: fill deadline expired (group still in "forming"/"collecting",
        # hasn't filled, fill_deadline_at has passed).
        fill_deadline_expired = (
            Group.objects.select_for_update()
            .filter(
                mode="group_buy",
                status__in=["forming", "collecting"],
                fill_deadline_at__isnull=False,
                fill_deadline_at__lte=timezone.now(),
            )
        )

        # Category 2: purchase deadline expired (group filled, creator didn't buy).
        expired_refund_groups = (
            Group.objects.select_for_update()
            .filter(
                mode="group_buy",
                status="awaiting_purchase",
                auto_refund_at__isnull=False,
                auto_refund_at__lte=timezone.now(),
            )
        )

        # Category 3: confirmation window expired (clean timeout, release).
        expired_release_groups = (
            Group.objects.select_for_update()
            .filter(
                mode="group_buy",
                status="proof_submitted",
                auto_refund_at__isnull=False,
                auto_refund_at__lte=timezone.now(),
            )
        )

        if group_ids is not None:
            fill_deadline_expired = fill_deadline_expired.filter(id__in=group_ids)
            expired_refund_groups = expired_refund_groups.filter(id__in=group_ids)
            expired_release_groups = expired_release_groups.filter(id__in=group_ids)

        fill_deadline_refund_ids = list(fill_deadline_expired.values_list("id", flat=True))
        refund_ids = list(expired_refund_groups.values_list("id", flat=True))
        release_ids = list(expired_release_groups.values_list("id", flat=True))

    # Category 1: fill deadline expired → refund + mark failed.
    for group_id in fill_deadline_refund_ids:
        refunded_total += refund_group_buy_held_funds(group_id, reason="fill_deadline_expired")
        # Mark the group as failed so it leaves the marketplace.
        Group.objects.filter(id=group_id).update(status="failed")
        # Notify the owner and all held members.
        try:
            group = Group.objects.select_related("subscription", "owner").get(id=group_id)
            create_notification(
                user=group.owner,
                message=(
                    f"Your {group.subscription.name} buy-together group did not fill by the "
                    f"deadline. All held member contributions have been refunded and the group "
                    f"is now closed."
                ),
            )
            for member in GroupMember.objects.filter(group=group).select_related("user"):
                create_notification(
                    user=member.user,
                    message=(
                        f"The {group.subscription.name} buy-together group did not fill by the "
                        f"deadline. Your held contribution of Rs {member.charged_amount} has been "
                        f"refunded to your wallet."
                    ),
                )
        except Group.DoesNotExist:
            pass

    # Category 2: purchase deadline expired → refund (existing behavior).
    for group_id in refund_ids:
        refunded_total += refund_group_buy_held_funds(group_id, reason="deadline_expired")

    # Category 3: confirmation window expired → release (existing behavior).
    for group_id in release_ids:
        release_amount, released = release_group_buy_held_funds(
            group_id,
            allow_timeout_release=True,
        )
        if released:
            released_groups += 1
            released_total += release_amount

    return {
        "processed_groups": len(fill_deadline_refund_ids) + len(refund_ids) + released_groups,
        "refunded_amount": refunded_total,
        "released_amount": released_total,
        "released_groups": released_groups,
        # Stage 1.1: include fill-deadline stats for observability.
        "fill_deadline_refunds": len(fill_deadline_refund_ids),
    }
```

---

## Change 6 — `backend/core/views/common.py` — update `validate_group_join_request` for waitlist signaling

### File: `backend/core/views/common.py` — `validate_group_join_request` 

When a buy-together group is full and in the collecting phase, return 409 (instead of 400) so the frontend knows to offer the waitlist UI.

OLD:
```python
    if GroupMember.objects.filter(group=group).count() >= group.total_slots:
        return {"error": "Group is full"}, 400, None
```

NEW:
```python
    if GroupMember.objects.filter(group=group).count() >= group.total_slots:
        # Stage 1.4: if the group supports a waitlist (buy-together
        # in forming/collecting phase), tell the user they can join the waitlist.
        if group.mode == "group_buy" and group.status in {"forming", "collecting"}:
            return {"error": "This group is full. You can join the waitlist in case a spot opens up."}, 409, None
        return {"error": "Group is full"}, 400, None
```

> **Why 409?** 409 Conflict signals "the request conflicts with the current state of the resource" — the group exists but is full. The frontend can use this status to offer the waitlist join UI.

---

## Change 7 — `backend/core/views/groups_public.py` — `LeaveGroupView` promotes waitlist

### File: `backend/core/views/groups_public.py` — `LeaveGroupView.post` 

After the member is deleted and refunded, check if there's a waitlist entry to promote.

Find the end of the `with transaction.atomic():` block in `LeaveGroupView.post` (after `locked_member.delete()` at line ~18459) and add the waitlist promotion BEFORE the transaction commits.

OLD (end of the atomic block, line ~18459):
```python
            locked_member.delete()

        create_notification(
            user=group.owner,
            message=f"{request.user.username} left your {group.subscription.name} group.",
        )
```

NEW:
```python
            locked_member.delete()

            # Stage 1.4: promote the next waitlisted user if the group
            # is in the collecting phase and now has an open slot.
            if (
                locked_group.mode == "group_buy"
                and locked_group.status == "collecting"
                and locked_group.get_remaining_slots() > 0
            ):
                _promote_next_waitlist_entry(locked_group)

        create_notification(
            user=group.owner,
            message=f"{request.user.username} left your {group.subscription.name} group.",
        )
```

And add the helper function `_promote_next_waitlist_entry` near the top of `groups_public.py` (or in `common.py` if you prefer to keep helpers centralized):

```python
def _promote_next_waitlist_entry(group):
    """
    Stage 1.4: promote the next waitlisted user to a full member.
    Charges their wallet for the join price and creates a GroupMember
    with held escrow. If the user's wallet is insufficient or the
    promotion fails for any reason, the entry is removed and the next
    entry is tried.

    This function must be called inside a transaction.atomic() block
    with the group already locked via select_for_update().
    """
    from .common import perform_group_join

    while True:
        next_entry = (
            GroupWaitlistEntry.objects.select_for_update()
            .filter(group=group)
            .order_by("created_at", "id")
            .first()
        )
        if not next_entry:
            return  # No one on the waitlist.

        user = next_entry.user
        # Remove the entry first so it's not retried if promotion fails.
        next_entry.delete()

        # Attempt to join the user. perform_group_join handles wallet
        # deduction, escrow, notifications, and the "group full" check.
        # Since we just freed a slot, the join should succeed unless the
        # user's wallet is insufficient.
        response_payload, error_payload, error_status = perform_group_join(user, group)

        if error_payload:
            # Promotion failed (likely insufficient balance). Notify the
            # user and try the next waitlist entry.
            create_notification(
                user=user,
                message=(
                    f"A spot opened in {group.subscription.name}, but we couldn't "
                    f"auto-join you because: {error_payload.get('error', 'Unknown error')}. "
                    f"Top up your wallet and try joining again."
                ),
            )
            continue

        # Promotion succeeded. Notify the user.
        create_notification(
            user=user,
            message=(
                f"Great news! A spot opened in {group.subscription.name} and you've been "
                f"auto-joined from the waitlist. Rs {response_payload.get('charged_amount', '0')} "
                f"was charged from your wallet."
            ),
        )
        return
```

> **Import check:** `GroupWaitlistEntry` and `create_notification` must be imported in the file where `_promote_next_waitlist_entry` lives. If you put it in `common.py`, the `from .common import *` in `groups_public.py` will pick it up. If you put it in `groups_public.py`, add `from ..models import GroupWaitlistEntry` if not already imported (it won't be, since it's a new model).

> **Why a `while True` loop?** If the first waitlisted user has insufficient balance, we try the next one, and so on, until we find someone who can join or the waitlist is empty. Each failed attempt notifies the user so they know why they weren't promoted.

> **Why `select_for_update` on the waitlist entry?** Two members could leave simultaneously, each triggering a promotion. The lock ensures only one promotion runs at a time per group (the second waits, then sees the slot is full again and no-ops).

---

## Change 8 — New views: `JoinWaitlistView`, `LeaveWaitlistView`, `ProceedEarlyView`

### File: `backend/core/views/groups_public.py`

Add these three new views:

```python
class JoinWaitlistView(APIView):
    """Stage 1.4: join the waitlist for a full buy-together group."""
    permission_classes = [IsAuthenticated]

    def post(self, request, group_id):
        try:
            group = Group.objects.get(id=group_id)
        except Group.DoesNotExist:
            return Response({"error": "Group not found"}, status=404)

        if group.mode != "group_buy":
            return Response({"error": "Waitlist is only for buy-together groups."}, status=400)

        if group.status not in {"forming", "collecting"}:
            return Response({"error": "This group is no longer accepting waitlist entries."}, status=400)

        if not group.is_full():
            return Response(
                {"error": "This group still has open spots. Join directly instead of waitlisting."},
                status=400,
            )

        if group.owner_id == request.user.id:
            return Response({"error": "You cannot waitlist for your own group."}, status=400)

        if GroupMember.objects.filter(group=group, user=request.user).exists():
            return Response({"error": "You are already a member of this group."}, status=400)

        entry, created = GroupWaitlistEntry.objects.get_or_create(group=group, user=request.user)
        if not created:
            return Response({"error": "You are already on the waitlist for this group."}, status=400)

        position = GroupWaitlistEntry.objects.filter(
            group=group, created_at__lte=entry.created_at
        ).count()

        return Response({
            "message": "Added to the waitlist. You'll be auto-joined if a spot opens up.",
            "waitlist_position": position,
        }, status=201)


class LeaveWaitlistView(APIView):
    """Stage 1.4: leave the waitlist for a group."""
    permission_classes = [IsAuthenticated]

    def post(self, request, group_id):
        deleted, _ = GroupWaitlistEntry.objects.filter(group_id=group_id, user=request.user).delete()
        if not deleted:
            return Response({"error": "You are not on the waitlist for this group."}, status=404)
        return Response({"message": "Removed from the waitlist."})


class ProceedEarlyView(APIView):
    """
    Stage 1.3: creator opts to proceed with the current fill count
    (must be >= min_fill_slots). Moves the group to awaiting_purchase
    and starts the purchase deadline clock, same as a full fill.
    """
    permission_classes = [IsAuthenticated]

    def post(self, request, group_id):
        try:
            group = Group.objects.get(id=group_id, owner=request.user)
        except Group.DoesNotExist:
            return Response({"error": "Group not found"}, status=404)

        if group.mode != "group_buy":
            return Response({"error": "Only buy-together groups can proceed early."}, status=400)

        if group.status != "collecting":
            return Response({"error": "This group is not in the collecting phase."}, status=400)

        if not group.can_proceed_early():
            return Response({
                "error": "Cannot proceed early. Either the threshold hasn't been met, "
                         "or the group is already full (proceed normally)."
            }, status=400)

        with transaction.atomic():
            locked_group = Group.objects.select_for_update().get(id=group.id)
            # Re-check under lock.
            if not locked_group.can_proceed_early():
                return Response({"error": "Cannot proceed early at this time."}, status=400)

            deadline = timezone.now() + timedelta(hours=BUY_TOGETHER_PURCHASE_DEADLINE_HOURS)
            locked_group.status = "awaiting_purchase"
            locked_group.purchase_deadline_at = deadline
            locked_group.auto_refund_at = deadline
            locked_group.proceed_early_at = timezone.now()
            locked_group.save(update_fields=[
                "status", "purchase_deadline_at", "auto_refund_at", "proceed_early_at"
            ])

        # Notify the owner + all members.
        create_notification(
            user=locked_group.owner,
            message=(
                f"You chose to proceed with {locked_group.get_filled_slots()} of "
                f"{locked_group.total_slots} slots for {locked_group.subscription.name}. "
                f"Buy the subscription and upload proof before the deadline."
            ),
        )
        for member in GroupMember.objects.filter(group=locked_group).select_related("user"):
            create_notification(
                user=member.user,
                message=(
                    f"The creator is proceeding with {locked_group.subscription.name} at "
                    f"{locked_group.get_filled_slots()} of {locked_group.total_slots} slots. "
                    f"The purchase is starting soon."
                ),
            )

        return Response({
            "message": "Proceeding early. Purchase deadline started.",
            "status": locked_group.status,
            "purchase_deadline_at": locked_group.purchase_deadline_at,
        })
```

### File: `backend/core/urls.py` — register the new endpoints

Add these routes near the existing group routes:

```python
    # Stage 1.4: waitlist endpoints.
    path("groups/<int:group_id>/waitlist/join/", JoinWaitlistView.as_view()),
    path("groups/<int:group_id>/waitlist/leave/", LeaveWaitlistView.as_view()),
    # Stage 1.3: proceed-early endpoint.
    path("my-groups/<int:group_id>/proceed-early/", ProceedEarlyView.as_view()),
```

---

## Change 9 — `backend/core/views/groups_public.py` — `GroupListView` "almost full" boosting

### File: `backend/core/views/groups_public.py` — `GroupListView.get_queryset` 

Boost groups at 75%+ fill to the top of the marketplace, and annotate the fill ratio so the serializer can render the urgency badge.

OLD:
```python
    def get_queryset(self):
        qs = (
            Group.objects.select_related("subscription", "owner")
            .annotate(filled_slots=Count("groupmember"))
            .filter(
                end_date__gte=timezone.localdate(),
                filled_slots__lt=F("total_slots"),
            )
            .exclude(status__in=["closed", "refunding", "refunded", "failed"])
        )
        if self.request.user.is_authenticated:
            qs = qs.exclude(owner=self.request.user)
        return qs
```

NEW:
```python
    def get_queryset(self):
        qs = (
            Group.objects.select_related("subscription", "owner")
            .annotate(filled_slots=Count("groupmember"))
            .annotate(
                # Stage 1.2: compute fill ratio for "almost full" boosting.
                # Integer percentage (0-100). Used for sorting and for the
                # serializer's urgency badge.
                fill_ratio=ExpressionWrapper(
                    F("filled_slots") * 100 / F("total_slots"),
                    output_field=IntegerField(),
                )
            )
            .filter(
                end_date__gte=timezone.localdate(),
                filled_slots__lt=F("total_slots"),
            )
            .exclude(status__in=["closed", "refunding", "refunded", "failed"])
        )
        if self.request.user.is_authenticated:
            qs = qs.exclude(owner=self.request.user)

        # Stage 1.2: boost 75%+ fill groups to the top, sorted by
        # fill_ratio descending (most-full first), then by created_at
        # (newest first) as a tiebreaker. Groups below 75% keep the
        # original created_at ordering.
        qs = qs.order_by(
            # Case: fill_ratio >= 75 → 0 (top), else 1 (bottom).
            Case(
                When(fill_ratio__gte=75, then=0),
                default=1,
                output_field=IntegerField(),
            ),
            "-fill_ratio",
            "-created_at",
            "-id",
        )
        return qs
```

> **Import check:** `ExpressionWrapper`, `IntegerField`, `Case`, `When` must be imported. Add to the existing `from django.db.models import ...` line at the top of the file (or in `common.py` if that's where the imports are re-exported from).

> **Note on the existing `ordering = ["-created_at", "-id"]` on the class:** the class-level `ordering` is overridden by the `get_queryset().order_by(...)`. But `OrderingFilter` (from `filter_backends`) may also apply. Test that the custom ordering isn't overridden by query params like `?ordering=-created_at`. If it is, you may need to remove `OrderingFilter` from `filter_backends` or make the boost a default that users can override.

---

## Change 10 — `backend/core/serializers/groups.py` — add formation fields to `GroupListSerializer`

### File: `backend/core/serializers/groups.py` — `GroupListSerializer`

Add the new fields to the serializer so the frontend can render them.

Add to the class body (near the existing `SerializerMethodField`s):

```python
    # Stage 1.1 & 1.3: expose formation fields.
    fill_deadline_at = serializers.DateTimeField(read_only=True)
    min_fill_slots = serializers.IntegerField(read_only=True)
    can_proceed_early = serializers.SerializerMethodField()
    fill_ratio = serializers.IntegerField(read_only=True)  # from the queryset annotation
    is_almost_full = serializers.SerializerMethodField()
    remaining_slots = serializers.SerializerMethodField()
    waitlist_count = serializers.SerializerMethodField()

    def get_can_proceed_early(self, obj):
        return obj.can_proceed_early()

    def get_is_almost_full(self, obj):
        # Stage 1.2: "almost full" = 75%+ fill. Uses the annotated
        # fill_ratio if available, else computes on the fly.
        ratio = getattr(obj, "fill_ratio", None)
        if ratio is None:
            filled = obj.groupmember_set.count()
            ratio = int((filled / obj.total_slots) * 100) if obj.total_slots else 0
        return ratio >= 75

    def get_remaining_slots(self, obj):
        filled = getattr(obj, "filled_slots", None)
        if filled is None:
            filled = obj.groupmember_set.count()
        return max(obj.total_slots - filled, 0)

    def get_waitlist_count(self, obj):
        # Stage 1.4: expose waitlist size so the UI can show "12 on waitlist".
        return obj.waitlist_entries.count()
```

> **Note on `fill_ratio`:** the queryset annotation from Change 9 makes `fill_ratio` available as an attribute on each instance, so `serializers.IntegerField(read_only=True)` will pick it up automatically without a `SerializerMethodField`. If the serializer is used in a context where the annotation isn't present (e.g., `MyGroupDetailView`), `fill_ratio` will be `None` — handle that in the frontend.

> **Add the field names to `Meta.fields`** (or `Meta.exclude` if that's the pattern) so they're included in the response. Read the existing `Meta` block and add the new field names.

---

## Change 11 — `frontend/src/pages/CreateGroup.js` — add UI for fill deadline + min fill slots

### File: `frontend/src/pages/CreateGroup.js`

In the wizard step where the creator sets `total_slots` and `price_per_slot` (the "details" step), add two new fields that appear only when `form.mode === "group_buy"`:

```jsx
{form.mode === "group_buy" && (
  <div className="sv-cg-formation-options">
    {/* Fill deadline */}
    <label className="sv-cg-field">
      <span className="sv-cg-field-label">Fill deadline (optional)</span>
      <input
        type="datetime-local"
        value={form.fill_deadline_at || ""}
        onChange={(e) => updateField("fill_deadline_at", e.target.value || null)}
        className="sv-cg-input"
      />
      <span className="sv-cg-field-hint">
        If the group hasn't filled by this time, all held contributions are auto-refunded.
        Leave blank for no deadline.
      </span>
    </label>

    {/* Min fill slots */}
    <label className="sv-cg-field">
      <span className="sv-cg-field-label">Minimum slots to proceed (optional)</span>
      <input
        type="number"
        min={1}
        max={Number(form.total_slots) || 1}
        value={form.min_fill_slots || ""}
        onChange={(e) => updateField("min_fill_slots", e.target.value ? Number(e.target.value) : null)}
        className="sv-cg-input"
      />
      <span className="sv-cg-field-hint">
        Set below {form.total_slots} to let yourself proceed early if the group is
        taking a while to fill. You'll cover any shortfall. Leave blank to require
        a full group.
      </span>
    </label>
  </div>
)}
```

Add the fields to the form's initial state and the submit payload:

```js
// In buildInitialForm():
return {
  // ... existing ...
  fill_deadline_at: null,
  min_fill_slots: null,
};

// In the submit handler, ensure the payload includes them:
const payload = {
  // ... existing ...
  fill_deadline_at: form.fill_deadline_at || null,
  min_fill_slots: form.min_fill_slots || null,
};
```

> **Adaptation note for Gemini:** read the actual `CreateGroup.js` submit handler and `buildInitialForm` to place these correctly. The `updateField` helper already exists.

---

## Change 12 — `frontend/src/pages/Groups.js` — render "almost full" badge + waitlist UI

### 12a. "Almost full" urgency badge on marketplace cards

In the marketplace card render (around line ~50991 where the "Buy Together" badge is):

```jsx
{group.is_almost_full && (
  <div className="absolute top-3 left-3 rounded-full bg-rose-500 px-2 py-0.5 text-[9px] font-bold tracking-wider uppercase text-white shadow-sm z-10 animate-pulse">
    🔥 {group.remaining_slots} left
  </div>
)}
```

> The `animate-pulse` is a Tailwind class that makes the badge subtly pulse, drawing attention. Remove if it feels too aggressive.

### 12b. Waitlist UI on the group detail page (`GroupDetails.js`)

When the join API returns 409 (group full, waitlist available), show a "Join waitlist" button instead of the "Join" button:

```jsx
{joinError?.includes("waitlist") ? (
  <button
    onClick={handleJoinWaitlist}
    disabled={waitlisting}
    className="sv-join-waitlist-btn"
  >
    {waitlisting ? "Adding..." : "Join waitlist"}
  </button>
) : (
  <button onClick={handleJoin} disabled={joinDisabled}>
    {joinLabel}
  </button>
)}
```

```js
const handleJoinWaitlist = async () => {
  try {
    setWaitlisting(true);
    await API.post(`groups/${group.id}/waitlist/join/`, {});
    toast.success("Added to the waitlist. You'll be auto-joined if a spot opens up.");
    // Refresh the group to update waitlist_count.
    await fetchGroup();
  } catch (err) {
    toast.error(err.response?.data?.error || "Could not join the waitlist.");
  } finally {
    setWaitlisting(false);
  }
};
```

> **Adaptation note for Gemini:** read `GroupDetails.js` to find the existing join button and error handling. The `joinError` state should be set when the join API returns 409. Add a `waitlisting` state and the `handleJoinWaitlist` function.

### 12c. "Proceed early" button on the owner's group detail (`MyShared.js` or `GroupDetails.js` owner view)

For the owner, when `group.can_proceed_early` is true, show a "Proceed with N of M slots" button:

```jsx
{group.can_proceed_early && (
  <button
    onClick={handleProceedEarly}
    disabled={proceeding}
    className="sv-proceed-early-btn"
  >
    {proceeding ? "Proceeding..." : `Proceed with ${group.filled_slots} of ${group.total_slots} slots`}
  </button>
)}
```

```js
const handleProceedEarly = async () => {
  if (!window.confirm(
    `Proceed with ${group.filled_slots} of ${group.total_slots} slots? ` +
    `You'll cover the shortfall. The purchase deadline will start immediately.`
  )) {
    return;
  }
  try {
    setProceeding(true);
    await API.post(`my-groups/${group.id}/proceed-early/`, {});
    toast.success("Proceeding early. Purchase deadline started.");
    await fetchGroup();
  } catch (err) {
    toast.error(err.response?.data?.error || "Could not proceed early.");
  } finally {
    setProceeding(false);
  }
};
```

---

## Change 13 — Mobile parity (optional, same patterns)

Apply the same UI additions to `mobile/src/screens/app/CreateSplitScreen.js`, `MarketplaceScreen.js`, and `GroupDetailScreen.js` / `MySplitDetailScreen.js`. The patterns are identical to the web frontend — add the form fields, the badge, the waitlist button, and the proceed-early button. Skip if mobile is lower priority.

---

## Change 14 — Tests

### File: `backend/core/tests.py`

Add a test class covering all four features:

```python
class BuyTogetherStage1Test(TestCase):
    """Stage 1: fill deadline, almost-full boosting, partial-fill, waitlist."""

    def setUp(self):
        # ... standard setUp: owner, member, outsider, subscription, wallet with balance ...
        super().setUp()

    def _authenticate_as(self, user):
        from rest_framework.test import APIClient
        from rest_framework_simplejwt.tokens import RefreshToken
        client = APIClient()
        refresh = RefreshToken.for_user(user)
        client.credentials(HTTP_AUTHORIZATION=f"Bearer {refresh.access_token}")
        return client

    def test_fill_deadline_expired_auto_refunds(self):
        """Stage 1.1: a group with a past fill_deadline_at is auto-refunded by the cron."""
        from django.utils import timezone
        from datetime import timedelta
        from core.views.common import process_expired_buy_together_refunds
        from decimal import Decimal

        group = self.create_group(
            mode="group_buy",
            total_slots=4,
            status="collecting",
            fill_deadline_at=timezone.now() - timedelta(minutes=5),
        )
        member = self.create_member(group=group, user=self.member, has_paid=True, escrow_status="held")

        result = process_expired_buy_together_refunds()
        self.assertEqual(result["fill_deadline_refunds"], 1)

        group.refresh_from_db()
        self.assertEqual(group.status, "failed")

        member.refresh_from_db()
        self.assertEqual(member.escrow_status, "refunded")

    def test_almost_full_boosting(self):
        """Stage 1.2: 75%+ fill groups appear first in the marketplace."""
        from django.utils import timezone
        from datetime import timedelta

        # Create a 4-slot group with 3 members (75% fill).
        full_group = self.create_group(mode="group_buy", total_slots=4, status="collecting")
        for i in range(3):
            self.create_member(group=full_group, has_paid=True, escrow_status="held")

        # Create a 4-slot group with 1 member (25% fill), created EARLIER.
        earlier = timezone.now() - timedelta(hours=1)
        sparse_group = self.create_group(mode="group_buy", total_slots=4, status="collecting")
        Group.objects.filter(id=sparse_group.id).update(created_at=earlier)
        self.create_member(group=sparse_group, has_paid=True, escrow_status="held")

        client = self._authenticate_as(self.outsider)
        resp = client.get("/api/groups/")
        groups = resp.data.get("results", resp.data)
        self.assertEqual(groups[0]["id"], full_group.id)  # 75% group first
        self.assertTrue(groups[0]["is_almost_full"])
        self.assertEqual(groups[0]["remaining_slots"], 1)

    def test_proceed_early(self):
        """Stage 1.3: creator can proceed when min_fill_slots is met."""
        group = self.create_group(
            mode="group_buy",
            total_slots=4,
            status="collecting",
            min_fill_slots=3,
        )
        for i in range(3):
            self.create_member(group=group, has_paid=True, escrow_status="held")

        client = self._authenticate_as(self.owner)
        resp = client.post(f"/api/my-groups/{group.id}/proceed-early/", {}, format="json")
        self.assertEqual(resp.status_code, 200, resp.content)

        group.refresh_from_db()
        self.assertEqual(group.status, "awaiting_purchase")
        self.assertIsNotNone(group.proceed_early_at)
        self.assertIsNotNone(group.purchase_deadline_at)

    def test_proceed_early_rejected_below_threshold(self):
        """Stage 1.3: cannot proceed early if below min_fill_slots."""
        group = self.create_group(
            mode="group_buy",
            total_slots=4,
            status="collecting",
            min_fill_slots=3,
        )
        for i in range(2):
            self.create_member(group=group, has_paid=True, escrow_status="held")

        client = self._authenticate_as(self.owner)
        resp = client.post(f"/api/my-groups/{group.id}/proceed-early/", {}, format="json")
        self.assertEqual(resp.status_code, 400)

    def test_waitlist_join_and_auto_promote(self):
        """Stage 1.4: waitlisted user is auto-promoted when a member leaves."""
        group = self.create_group(mode="group_buy", total_slots=2, status="collecting")
        self.create_member(group=group, user=self.member, has_paid=True, escrow_status="held")
        # Group is now full (2/2 — owner slot counts? check GroupMember setup;
        # if owner isn't a GroupMember, use total_slots=1 above).

        # Outsider joins the waitlist.
        client = self._authenticate_as(self.outsider)
        resp = client.post(f"/api/groups/{group.id}/waitlist/join/", {}, format="json")
        self.assertEqual(resp.status_code, 201, resp.content)

        # Member leaves → outsider should be auto-promoted.
        member_client = self._authenticate_as(self.member)
        leave_resp = member_client.post(f"/api/groups/{group.id}/leave/", {}, format="json")
        self.assertEqual(leave_resp.status_code, 200, leave_resp.content)

        from core.models import GroupMember
        self.assertTrue(
            GroupMember.objects.filter(group=group, user=self.outsider).exists(),
            "Waitlisted user was not auto-promoted after a member left."
        )

    def test_waitlist_join_rejected_when_not_full(self):
        """Stage 1.4: cannot join waitlist if the group still has open slots."""
        group = self.create_group(mode="group_buy", total_slots=4, status="collecting")
        self.create_member(group=group, user=self.member, has_paid=True, escrow_status="held")

        client = self._authenticate_as(self.outsider)
        resp = client.post(f"/api/groups/{group.id}/waitlist/join/", {}, format="json")
        self.assertEqual(resp.status_code, 400)
```

> **Adaptation notes for Gemini:**
> - `_authenticate_as` is a helper — match the existing test suite's pattern (some use `self.authenticate(user)`).
> - `self.create_group` and `self.create_member` are existing helpers in the test suite. If they don't accept `fill_deadline_at` / `min_fill_slots` kwargs, update them or construct the `Group`/`GroupMember` directly in the test.
> - For `test_waitlist_join_and_auto_promote`, verify whether the owner is automatically a `GroupMember` in the existing `create_group` helper. If not, set `total_slots=1` so the group is full after one member joins. If yes, use `total_slots=2`.

---

## Acceptance criteria

### Backend
1. `python manage.py makemigrations core` generates a migration adding `fill_deadline_at`, `min_fill_slots`, `proceed_early_at` to `Group` and creating `GroupWaitlistEntry`.
2. `python manage.py migrate` applies cleanly.
3. `POST /api/groups/` with `mode: "group_buy"`, `fill_deadline_at: <future>`, `min_fill_slots: 3` → 201, group created with the fields set.
4. `POST /api/groups/` with `fill_deadline_at` in the past → 400 with "Fill deadline must be in the future."
5. `POST /api/groups/` with `min_fill_slots: 5` but `total_slots: 4` → 400 with "Minimum fill slots cannot exceed total slots."
6. `GET /api/groups/` → 75%+ fill groups appear first; each has `is_almost_full: true`, `remaining_slots: N`, `fill_ratio: NN`.
7. `POST /api/groups/<full_group_id>/waitlist/join/` → 201 with waitlist position.
8. `POST /api/groups/<full_group_id>/waitlist/join/` for a non-full group → 400.
9. `POST /api/my-groups/<id>/proceed-early/` when `min_fill_slots` met → 200, group moves to `awaiting_purchase`.
10. `POST /api/my-groups/<id>/proceed-early/` when below threshold → 400.
11. When a member leaves a full `collecting` group with a waitlist, the next waitlisted user is auto-joined (verify via `GroupMember` existence + wallet balance decrease).
12. `python manage.py process_expired_group_buy_refunds` settles fill-deadline-expired groups (refunds members, marks group `failed`).
13. `python manage.py test core.tests.BuyTogetherStage1Test --verbosity=2` passes all 6 tests.

### Frontend
14. `/create` with `mode: group_buy` shows the fill deadline + min fill slots fields.
15. `/create` with `mode: sharing` does NOT show the new fields.
16. Marketplace (`/groups`) shows the "🔥 N left" badge on 75%+ groups, and they appear at the top.
17. Group detail page for a full group shows "Join waitlist" instead of "Join".
18. Owner's group detail shows "Proceed with N of M slots" when `can_proceed_early` is true.

## Files touched
- `backend/core/models.py` (3 fields on `Group` + new `GroupWaitlistEntry` model + helper methods)
- `backend/core/migrations/00XX_stage1_buy_together_formation.py` (auto-generated)
- `backend/core/serializers/group_create.py` (accept + validate new fields)
- `backend/core/serializers/groups.py` (expose new fields in `GroupListSerializer`)
- `backend/core/views/common.py` (extend `process_expired_buy_together_refunds`; update `validate_group_join_request`; add `_promote_next_waitlist_entry`)
- `backend/core/views/groups_public.py` (`CreateGroupView` saves new fields; `GroupListView` boosting; `LeaveGroupView` promotes waitlist; new `JoinWaitlistView`, `LeaveWaitlistView`, `ProceedEarlyView`)
- `backend/core/urls.py` (3 new routes)
- `frontend/src/pages/CreateGroup.js` (fill deadline + min fill slots form fields)
- `frontend/src/pages/Groups.js` (almost-full badge)
- `frontend/src/pages/GroupDetails.js` (waitlist join button + proceed-early button)
- `backend/core/tests.py` (`BuyTogetherStage1Test` with 6 tests)

## Commit message
```
feat(buy-together): Stage 1 — discovery & group formation improvements

Four improvements to the buy-together group-formation stage:

1. Fill deadline (Stage 1.1): optional fill_deadline_at field on Group.
   If the group hasn't filled by this time, the cron auto-refunds held
   members and marks the group as failed. Extends
   process_expired_buy_together_refunds with a third category.

2. "Almost full" boosting (Stage 1.2): GroupListView now annotates
   fill_ratio and sorts 75%+ fill groups to the top. GroupListSerializer
   exposes is_almost_full and remaining_slots so the frontend can render
   an urgency badge.

3. Partial-fill proceed (Stage 1.3): optional min_fill_slots field on
   Group (defaults to total_slots). New ProceedEarlyView lets the creator
   move to awaiting_purchase once the threshold is met, covering the
   shortfall themselves.

4. Waitlist (Stage 1.4): new GroupWaitlistEntry model. JoinWaitlistView /
   LeaveWaitlistView endpoints. When a member leaves a full collecting
   group, LeaveGroupView promotes the next waitlisted user via
   _promote_next_waitlist_entry (handles insufficient-balance skips).

All changes are additive and backward-compatible (new fields are
nullable, new behavior only triggers when the new fields are set).
Sharing groups are unaffected. Existing buy-together groups (created
before this change) behave as before (no fill deadline, must fill
completely, no waitlist).

Added BuyTogetherStage1Test with 6 tests covering all four features.
```
