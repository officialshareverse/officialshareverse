from asgiref.sync import async_to_sync
from channels.db import database_sync_to_async
from channels.generic.websocket import AsyncJsonWebsocketConsumer
from channels.layers import get_channel_layer
from django.contrib.auth.models import AnonymousUser
from django.db.models import Q

from .models import Group, GroupChatMessage, Notification, User

WS_CLOSE_TOKEN_EXPIRED = 4001
WS_CLOSE_FORBIDDEN = 4003


def _chat_group_name(group_id):
    return f"chat_{group_id}"


def _notification_group_name(user_id):
    return f"notifications_{user_id}"


def _badge_group_name(user_id):
    return f"badges_{user_id}"


def build_group_chat_message_payload(message):
    return {
        "id": message.id,
        "sender_id": message.sender_id,
        "sender_username": message.sender.username,
        "message": message.message,
        "created_at": message.created_at.isoformat(),
    }


def get_badge_counts_for_user(user):
    from .views import get_group_chat_unread_count

    groups = Group.objects.filter(Q(owner=user) | Q(groupmember__user=user)).distinct()
    unread_chats = sum(get_group_chat_unread_count(user, group) for group in groups)
    unread_notifications = Notification.objects.filter(user=user, is_read=False).count()
    return {
        "unread_notifications": unread_notifications,
        "unread_chats": unread_chats,
    }


def push_group_chat_message_to_group(group_id, message_payload):
    channel_layer = get_channel_layer()
    if not channel_layer:
        return

    async_to_sync(channel_layer.group_send)(
        _chat_group_name(group_id),
        {
            "type": "chat_message_event",
            "payload": message_payload,
        },
    )


def push_group_chat_typing_to_group(group_id, username, is_typing):
    channel_layer = get_channel_layer()
    if not channel_layer:
        return

    async_to_sync(channel_layer.group_send)(
        _chat_group_name(group_id),
        {
            "type": "typing_update_event",
            "payload": {
                "type": "typing_update",
                "username": username,
                "is_typing": bool(is_typing),
            },
        },
    )


def push_group_chat_presence_to_group(group_id, event_name, username, presence):
    channel_layer = get_channel_layer()
    if not channel_layer:
        return

    async_to_sync(channel_layer.group_send)(
        _chat_group_name(group_id),
        {
            "type": "presence_event",
            "payload": {
                "type": event_name,
                "username": username,
                "presence": presence,
            },
        },
    )


def push_notification_to_user(user_id, notification_data):
    channel_layer = get_channel_layer()
    if not channel_layer:
        return

    async_to_sync(channel_layer.group_send)(
        _notification_group_name(user_id),
        {
            "type": "new_notification_event",
            "notification": notification_data,
        },
    )


def push_notification_read_to_user(user_id, notification_id, unread_count):
    channel_layer = get_channel_layer()
    if not channel_layer:
        return

    async_to_sync(channel_layer.group_send)(
        _notification_group_name(user_id),
        {
            "type": "notification_read_event",
            "payload": {
                "type": "notification_read",
                "notification_id": notification_id,
                "unread_count": unread_count,
            },
        },
    )


def push_notifications_cleared_to_user(user_id, updated_count):
    channel_layer = get_channel_layer()
    if not channel_layer:
        return

    async_to_sync(channel_layer.group_send)(
        _notification_group_name(user_id),
        {
            "type": "notifications_cleared_event",
            "payload": {
                "type": "notifications_cleared",
                "updated_count": updated_count,
                "unread_count": 0,
            },
        },
    )


def push_badge_update_to_user(user_id, reason="refresh"):
    channel_layer = get_channel_layer()
    if not channel_layer:
        return

    try:
        user = User.objects.filter(id=user_id).first()
        if user is None:
            return
        counts = get_badge_counts_for_user(user)
    except Exception:
        counts = {
            "unread_notifications": 0,
            "unread_chats": 0,
        }

    async_to_sync(channel_layer.group_send)(
        _badge_group_name(user_id),
        {
            "type": "badge_update_event",
            "payload": {
                "type": "badge_update",
                **counts,
                "reason": reason,
            },
        },
    )


def create_notification(*, user=None, user_id=None, message):
    from .views import build_notification_payload

    create_kwargs = {"message": message}
    if user is not None:
        create_kwargs["user"] = user
    elif user_id is not None:
        create_kwargs["user_id"] = user_id
    else:
        raise ValueError("create_notification requires either user or user_id.")

    notification = Notification.objects.create(**create_kwargs)
    push_notification_to_user(notification.user_id, build_notification_payload(notification))
    push_badge_update_to_user(notification.user_id, reason="notification")
    return notification


class GroupChatConsumer(AsyncJsonWebsocketConsumer):
    async def connect(self):
        self.user = self.scope.get("user", AnonymousUser())
        if not getattr(self.user, "is_authenticated", False):
            await self.close(code=WS_CLOSE_TOKEN_EXPIRED)
            return

        self.group_id = int(self.scope["url_route"]["kwargs"]["group_id"])
        self.group = await self.get_group_for_user(self.user, self.group_id)
        if not self.group:
            await self.close(code=WS_CLOSE_FORBIDDEN)
            return

        self.channel_group_name = _chat_group_name(self.group_id)
        await self.channel_layer.group_add(self.channel_group_name, self.channel_name)
        await self.accept()

        presence = await self.touch_presence(is_typing=False)
        await self.channel_layer.group_send(
            self.channel_group_name,
            {
                "type": "presence_event",
                "payload": {
                    "type": "user_joined",
                    "username": self.user.username,
                    "presence": presence,
                },
            },
        )

    async def disconnect(self, close_code):
        if not hasattr(self, "channel_group_name"):
            return

        presence = await self.touch_presence(is_typing=False)
        await self.channel_layer.group_send(
            self.channel_group_name,
            {
                "type": "presence_event",
                "payload": {
                    "type": "user_left",
                    "username": self.user.username,
                    "presence": presence,
                },
            },
        )
        await self.channel_layer.group_discard(self.channel_group_name, self.channel_name)

    async def receive_json(self, content, **kwargs):
        event_type = (content or {}).get("type")

        if event_type == "chat_message":
            payload = await self.create_message((content or {}).get("message"))
            if payload:
                await self.channel_layer.group_send(
                    self.channel_group_name,
                    {
                        "type": "chat_message_event",
                        "payload": payload,
                    },
                )
            return

        if event_type == "typing":
            presence = await self.touch_presence(is_typing=bool(content.get("is_typing")))
            await self.channel_layer.group_send(
                self.channel_group_name,
                {
                    "type": "typing_update_event",
                    "payload": {
                        "type": "typing_update",
                        "username": self.user.username,
                        "is_typing": presence.get("is_typing", False),
                    },
                },
            )
            return

        if event_type == "mark_read":
            await self.mark_read()

    async def chat_message_event(self, event):
        payload = dict(event["payload"])
        sender_id = payload.pop("sender_id", None)
        await self.send_json(
            {
                "type": "chat_message",
                **payload,
                "is_own": sender_id == self.user.id,
            }
        )

    async def typing_update_event(self, event):
        await self.send_json(event["payload"])

    async def presence_event(self, event):
        await self.send_json(event["payload"])

    @database_sync_to_async
    def get_group_for_user(self, user, group_id):
        from .views import can_user_join_group_chat

        try:
            group = Group.objects.select_related("subscription", "owner").get(id=group_id)
        except Group.DoesNotExist:
            return None

        return group if can_user_join_group_chat(user, group) else None

    @database_sync_to_async
    def touch_presence(self, is_typing=None):
        from .views import get_group_chat_presence_state, touch_group_chat_presence

        presence = touch_group_chat_presence(self.user, self.group, is_typing=is_typing)
        return get_group_chat_presence_state(presence)

    @database_sync_to_async
    def mark_read(self):
        from .views import mark_group_chat_read

        mark_group_chat_read(self.user, self.group)
        push_badge_update_to_user(self.user.id, reason="chat_read")
        return True

    @database_sync_to_async
    def create_message(self, raw_message):
        from .views import get_group_chat_participants, mark_group_chat_read, touch_group_chat_presence

        normalized = (raw_message or "").strip()
        if not normalized:
            return None

        message = GroupChatMessage.objects.create(
            group=self.group,
            sender=self.user,
            message=normalized,
        )

        mark_group_chat_read(self.user, self.group)
        touch_group_chat_presence(self.user, self.group, is_typing=False)

        participant_ids = list(get_group_chat_participants(self.group))
        for participant_id in participant_ids:
            if participant_id != self.user.id:
                create_notification(
                    user_id=participant_id,
                    message=f"New group chat message in {self.group.subscription.name} from {self.user.username}.",
                )
                continue

            push_badge_update_to_user(participant_id, reason="chat_message")

        return build_group_chat_message_payload(message)


class NotificationConsumer(AsyncJsonWebsocketConsumer):
    async def connect(self):
        self.user = self.scope.get("user", AnonymousUser())
        if not getattr(self.user, "is_authenticated", False):
            await self.close(code=WS_CLOSE_TOKEN_EXPIRED)
            return

        self.channel_group_name = _notification_group_name(self.user.id)
        await self.channel_layer.group_add(self.channel_group_name, self.channel_name)
        await self.accept()

    async def disconnect(self, close_code):
        if hasattr(self, "channel_group_name"):
            await self.channel_layer.group_discard(self.channel_group_name, self.channel_name)

    async def receive_json(self, content, **kwargs):
        event_type = (content or {}).get("type")

        if event_type == "mark_read":
            notification_id = content.get("notification_id")
            if notification_id:
                await self.mark_notification_read(notification_id)
            return

        if event_type == "mark_all_read":
            await self.mark_all_read()

    async def new_notification_event(self, event):
        await self.send_json({"type": "new_notification", **event["notification"]})

    async def notification_read_event(self, event):
        await self.send_json(event["payload"])

    async def notifications_cleared_event(self, event):
        await self.send_json(event["payload"])

    @database_sync_to_async
    def mark_notification_read(self, notification_id):
        notification = Notification.objects.filter(id=notification_id, user=self.user).first()
        if not notification:
            return False

        if not notification.is_read:
            notification.is_read = True
            notification.save(update_fields=["is_read"])

        unread_count = Notification.objects.filter(user=self.user, is_read=False).count()
        push_notification_read_to_user(self.user.id, notification.id, unread_count)
        push_badge_update_to_user(self.user.id, reason="notification_read")
        return True

    @database_sync_to_async
    def mark_all_read(self):
        updated_count = Notification.objects.filter(user=self.user, is_read=False).update(is_read=True)
        push_notifications_cleared_to_user(self.user.id, updated_count)
        push_badge_update_to_user(self.user.id, reason="notifications_cleared")
        return updated_count


class BadgeConsumer(AsyncJsonWebsocketConsumer):
    async def connect(self):
        self.user = self.scope.get("user", AnonymousUser())
        if not getattr(self.user, "is_authenticated", False):
            await self.close(code=WS_CLOSE_TOKEN_EXPIRED)
            return

        self.channel_group_name = _badge_group_name(self.user.id)
        await self.channel_layer.group_add(self.channel_group_name, self.channel_name)
        await self.accept()

        payload = await self.get_initial_badge_payload()
        await self.send_json(payload)

    async def disconnect(self, close_code):
        if hasattr(self, "channel_group_name"):
            await self.channel_layer.group_discard(self.channel_group_name, self.channel_name)

    async def badge_update_event(self, event):
        await self.send_json(event["payload"])

    @database_sync_to_async
    def get_initial_badge_payload(self):
        counts = get_badge_counts_for_user(self.user)
        return {
            "type": "badge_update",
            **counts,
            "reason": "initial",
        }
