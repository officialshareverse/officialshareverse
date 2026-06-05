from .common import *

def _view_exports():
    import core.views as views

    return views


def _log_group_chat_failure(request, endpoint, stage, exc, group_id=None):
    _view_exports().log_operation_event(
        f"{endpoint}_{stage}_failed",
        level="error",
        endpoint=endpoint,
        stage=stage,
        user_id=getattr(getattr(request, "user", None), "id", None),
        group_id=group_id,
        exception_type=type(exc).__name__,
        exception_message=str(exc),
    )


class GroupChatView(APIView):
    permission_classes = [IsAuthenticated]

    def dispatch(self, request, *args, **kwargs):
        try:
            return super().dispatch(request, *args, **kwargs)
        except Exception as exc:
            group = None
            group_id = kwargs.get("group_id")
            _log_group_chat_failure(
                request,
                endpoint="group_chat_detail",
                stage="dispatch",
                exc=exc,
                group_id=group_id,
            )
            if group_id is not None:
                try:
                    group = Group.objects.select_related("subscription", "owner").get(id=group_id)
                except Exception:
                    group = None
            response = Response(
                _view_exports().build_empty_group_chat_response(
                    group=group,
                    group_id=group_id,
                    current_user=getattr(request, "user", None),
                )
            )
            return self.finalize_response(request, response, *args, **kwargs)

    def _get_group_for_user(self, request, group_id):
        try:
            group = Group.objects.select_related("subscription", "owner").get(id=group_id)
        except Group.DoesNotExist:
            return None, Response({"error": "Group not found"}, status=404)

        if not can_user_join_group_chat(request.user, group):
            return None, Response({"error": "You are not allowed to access this group chat."}, status=403)

        return group, None

    def get(self, request, group_id):
        group, error_response = self._get_group_for_user(request, group_id)
        if error_response:
            return error_response

        try:
            try:
                messages = visible_group_chat_messages_for_user(request.user, group=group).select_related("sender")
                serialized_messages = GroupChatMessageSerializer(
                    messages,
                    many=True,
                    context={"request": request},
                ).data
            except Exception as exc:
                _log_group_chat_failure(
                    request,
                    endpoint="group_chat_detail",
                    stage="messages_load",
                    exc=exc,
                    group_id=group.id,
                )
                serialized_messages = []

            mark_group_chat_read(request.user, group)
            push_badge_update_to_user(request.user.id, reason="chat_read")
            touch_group_chat_presence(request.user, group)
            try:
                presence_map = {
                    presence.user_id: presence
                    for presence in GroupChatPresence.objects.filter(group=group).select_related("user")
                }
                activity_snapshot = _view_exports().build_group_chat_activity_snapshot(
                    group,
                    current_user=request.user,
                    presence_map=presence_map,
                )
            except Exception as exc:
                _log_group_chat_failure(
                    request,
                    endpoint="group_chat_detail",
                    stage="activity_snapshot",
                    exc=exc,
                    group_id=group.id,
                )
                activity_snapshot = _view_exports().build_group_chat_fallback_snapshot(
                    group,
                    current_user=request.user,
                )

            return Response({
                "group": _view_exports().build_safe_group_chat_group_payload(group),
                "participants": activity_snapshot["participants"],
                "messages": serialized_messages,
                "unread_chat_count": 0,
                "online_participant_count": activity_snapshot["online_participant_count"],
                "active_typing_users": activity_snapshot["active_typing_users"],
                "has_someone_typing": activity_snapshot["has_someone_typing"],
            })
        except Exception as exc:
            _log_group_chat_failure(
                request,
                endpoint="group_chat_detail",
                stage="response_fallback",
                exc=exc,
                group_id=group.id,
            )
            fallback_snapshot = _view_exports().build_group_chat_fallback_snapshot(
                group,
                current_user=request.user,
            )
            return Response({
                "group": _view_exports().build_emergency_group_chat_group_payload(group),
                "participants": fallback_snapshot["participants"],
                "messages": [],
                "unread_chat_count": 0,
                "online_participant_count": 0,
                "active_typing_users": [],
                "has_someone_typing": False,
            })

    def post(self, request, group_id):
        group, error_response = self._get_group_for_user(request, group_id)
        if error_response:
            return error_response

        serializer = SendGroupChatMessageSerializer(data=request.data)
        if not serializer.is_valid():
            return Response(serializer.errors, status=400)

        message = GroupChatMessage.objects.create(
            group=group,
            sender=request.user,
            message=serializer.validated_data["message"],
        )

        mark_group_chat_read(request.user, group)
        touch_group_chat_presence(request.user, group, is_typing=False)

        for participant_id in get_group_chat_participants(group):
            if participant_id == request.user.id:
                continue
            if UserBlock.objects.filter(blocker_id=participant_id, blocked=request.user).exists():
                continue
            create_notification(
                user_id=participant_id,
                message=(
                    f"New group chat message in {group.subscription.name} from {request.user.username}."
                ),
            )

        serialized_message = GroupChatMessageSerializer(
            message,
            context={"request": request},
        ).data
        push_group_chat_message_to_group(
            group.id,
            {
                **serialized_message,
                "sender_id": request.user.id,
            },
        )
        push_badge_update_to_user(request.user.id, reason="chat_message")

        return Response({
            "message": "Chat message sent successfully.",
            "chat_message": serialized_message,
        }, status=201)

    def patch(self, request, group_id):
        group, error_response = self._get_group_for_user(request, group_id)
        if error_response:
            return error_response

        serializer = GroupChatPresenceSerializer(data=request.data)
        if not serializer.is_valid():
            return Response(serializer.errors, status=400)

        presence = touch_group_chat_presence(
            request.user,
            group,
            is_typing=serializer.validated_data["is_typing"],
        )
        push_group_chat_typing_to_group(
            group.id,
            request.user.username,
            serializer.validated_data["is_typing"],
        )

        return Response(
            {
                "presence": get_group_chat_presence_state(presence),
                "username": request.user.username,
            }
        )


class GroupChatInboxView(APIView):
    permission_classes = [IsAuthenticated]

    def dispatch(self, request, *args, **kwargs):
        try:
            return super().dispatch(request, *args, **kwargs)
        except Exception as exc:
            _log_group_chat_failure(
                request,
                endpoint="group_chat_inbox",
                stage="dispatch",
                exc=exc,
            )
            response = Response(
                {
                    "total_unread_count": 0,
                    "total_chats": 0,
                    "chats": [],
                }
            )
            return self.finalize_response(request, response, *args, **kwargs)

    def get(self, request):
        user = request.user
        blocked_user_ids = get_blocked_user_ids(user)
        try:
            try:
                visible_messages_for_last = GroupChatMessage.objects.filter(moderation_status="visible")
                if blocked_user_ids:
                    visible_messages_for_last = visible_messages_for_last.exclude(sender_id__in=blocked_user_ids)
                last_message_subquery = (
                    visible_messages_for_last.filter(group_id=OuterRef("pk"))
                    .order_by("-created_at", "-id")
                )
                groups = list(
                    Group.objects.filter(Q(owner=user) | Q(groupmember__user=user))
                    .select_related("subscription", "owner")
                    .prefetch_related(
                        Prefetch(
                            "groupmember_set",
                            queryset=GroupMember.objects.select_related("user"),
                            to_attr="prefetched_group_members",
                        )
                    )
                    .annotate(
                        last_message_id=Subquery(last_message_subquery.values("id")[:1]),
                        last_activity_at=Subquery(last_message_subquery.values("created_at")[:1]),
                    )
                    .distinct()
                )
            except Exception as exc:
                _log_group_chat_failure(
                    request,
                    endpoint="group_chat_inbox",
                    stage="group_query",
                    exc=exc,
                )
                groups = list(
                    Group.objects.filter(Q(owner=user) | Q(groupmember__user=user))
                    .select_related("subscription", "owner")
                    .prefetch_related(
                        Prefetch(
                            "groupmember_set",
                            queryset=GroupMember.objects.select_related("user"),
                            to_attr="prefetched_group_members",
                        )
                    )
                    .distinct()
                )
            group_ids = [group.id for group in groups]
            if not group_ids:
                return Response(
                    {
                        "total_unread_count": 0,
                        "total_chats": 0,
                        "chats": [],
                    }
                )

            try:
                presence_rows = (
                    GroupChatPresence.objects.filter(group_id__in=group_ids)
                    .select_related("user")
                    .order_by("group_id", "user_id", "-updated_at", "-id")
                )
            except Exception as exc:
                _log_group_chat_failure(
                    request,
                    endpoint="group_chat_inbox",
                    stage="presence_load",
                    exc=exc,
                )
                presence_rows = []
            presence_by_group = {}
            for presence in presence_rows:
                group_presence = presence_by_group.setdefault(presence.group_id, {})
                if presence.user_id not in group_presence:
                    group_presence[presence.user_id] = presence

            try:
                read_state_by_group = {
                    row["group_id"]: row["last_read_at"]
                    for row in (
                        GroupChatReadState.objects.filter(group_id__in=group_ids, user=user)
                        .values("group_id")
                        .annotate(last_read_at=Max("last_read_at"))
                    )
                }
            except Exception:
                read_state_by_group = {}

            try:
                visible_messages = GroupChatMessage.objects.filter(moderation_status="visible")
                if blocked_user_ids:
                    visible_messages = visible_messages.exclude(sender_id__in=blocked_user_ids)
                message_count_by_group = {
                    row["group_id"]: row["message_count"]
                    for row in (
                        visible_messages.filter(group_id__in=group_ids)
                        .values("group_id")
                        .annotate(message_count=Count("id"))
                    )
                }
                unread_count_by_group = {group_id: 0 for group_id in group_ids}
                unread_rows = (
                    visible_messages.filter(group_id__in=group_ids)
                    .exclude(sender=user)
                    .values_list("group_id", "created_at")
                )
                for group_id, created_at in unread_rows:
                    last_read_at = read_state_by_group.get(group_id)
                    if last_read_at is None or created_at > last_read_at:
                        unread_count_by_group[group_id] += 1

                last_message_ids = [group.last_message_id for group in groups if getattr(group, "last_message_id", None)]
                last_message_by_id = {
                    message.id: message
                    for message in visible_messages.filter(id__in=last_message_ids).select_related("sender")
                }
            except Exception as exc:
                _log_group_chat_failure(
                    request,
                    endpoint="group_chat_inbox",
                    stage="message_summary",
                    exc=exc,
                )
                message_count_by_group = {group_id: 0 for group_id in group_ids}
                unread_count_by_group = {group_id: 0 for group_id in group_ids}
                last_message_by_id = {}

            chat_items = []
            total_unread_count = 0

            for group in groups:
                try:
                    last_message = last_message_by_id.get(getattr(group, "last_message_id", None))
                    unread_count = unread_count_by_group.get(group.id, 0)
                    total_unread_count += unread_count
                    activity_snapshot = _view_exports().build_group_chat_activity_snapshot(
                        group,
                        current_user=user,
                        presence_map=presence_by_group.get(group.id, {}),
                        members=getattr(group, "prefetched_group_members", None),
                    )
                    chat_items.append(
                        {
                            "group": _view_exports().build_safe_group_chat_group_payload(group),
                            "is_owner": getattr(group, "owner_id", None) == user.id,
                            "unread_chat_count": unread_count,
                            "participant_count": activity_snapshot["participant_count"],
                            "participant_preview": activity_snapshot["participants"][:4],
                            "online_participant_count": activity_snapshot["online_participant_count"],
                            "active_typing_users": activity_snapshot["active_typing_users"],
                            "has_someone_typing": activity_snapshot["has_someone_typing"],
                            "message_count": message_count_by_group.get(group.id, 0),
                            "last_message": (
                                {
                                    "id": last_message.id,
                                    "sender_username": getattr(getattr(last_message, "sender", None), "username", "Unknown"),
                                    "message": getattr(last_message, "message", ""),
                                    "created_at": getattr(last_message, "created_at", None),
                                    "is_own": getattr(last_message, "sender_id", None) == user.id,
                                }
                                if last_message
                                else None
                            ),
                            "last_activity_at": getattr(group, "last_activity_at", None) or getattr(group, "created_at", None),
                            }
                        )
                except Exception as exc:
                    _log_group_chat_failure(
                        request,
                        endpoint="group_chat_inbox",
                        stage="group_item_build",
                        exc=exc,
                        group_id=group.id,
                    )
                    activity_snapshot = _view_exports().build_group_chat_fallback_snapshot(
                        group,
                        current_user=user,
                        members=getattr(group, "prefetched_group_members", None),
                    )
                    chat_items.append(
                        {
                            "group": _view_exports().build_emergency_group_chat_group_payload(group),
                            "is_owner": getattr(group, "owner_id", None) == user.id,
                            "unread_chat_count": 0,
                            "participant_count": activity_snapshot["participant_count"],
                            "participant_preview": activity_snapshot["participants"][:4],
                            "online_participant_count": activity_snapshot["online_participant_count"],
                            "active_typing_users": activity_snapshot["active_typing_users"],
                            "has_someone_typing": activity_snapshot["has_someone_typing"],
                            "message_count": 0,
                            "last_message": None,
                            "last_activity_at": getattr(group, "created_at", None),
                        }
                    )

            chat_items.sort(
                key=lambda item: (item["last_activity_at"], item["group"]["id"]),
                reverse=True,
            )

            return Response(
                {
                    "total_unread_count": total_unread_count,
                    "total_chats": len(chat_items),
                    "chats": chat_items,
                }
            )
        except Exception as exc:
            _log_group_chat_failure(
                request,
                endpoint="group_chat_inbox",
                stage="response_fallback",
                exc=exc,
            )
            return Response(
                {
                    "total_unread_count": 0,
                    "total_chats": 0,
                    "chats": [],
                }
            )


