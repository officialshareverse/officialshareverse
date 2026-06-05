from datetime import timedelta

from django.db import DatabaseError
from django.utils import timezone

from ..models import (
    GroupChatMessage,
    GroupChatPresence,
    GroupChatReadState,
    GroupMember,
    UserBlock,
)
from ..operation_logging import log_operation_event
from ..serializers import get_mode_copy, get_status_copy, public_user_display_name


GROUP_CHAT_ONLINE_WINDOW_MINUTES = 6
GROUP_CHAT_RECENT_WINDOW_MINUTES = 30
GROUP_CHAT_TYPING_WINDOW_SECONDS = 12


def can_user_join_group_chat(user, group):
    if group.owner_id == user.id:
        return True

    return GroupMember.objects.filter(group=group, user=user).exists()


def get_blocked_user_ids(user):
    if not getattr(user, "is_authenticated", False):
        return set()

    return set(UserBlock.objects.filter(blocker=user).values_list("blocked_id", flat=True))


def has_blocked_user(blocker, blocked):
    if not getattr(blocker, "is_authenticated", False) or not blocked:
        return False

    blocked_id = getattr(blocked, "id", blocked)
    return UserBlock.objects.filter(blocker=blocker, blocked_id=blocked_id).exists()


def visible_group_chat_messages_for_user(user, group=None, group_ids=None):
    queryset = GroupChatMessage.objects.filter(moderation_status="visible")
    if group is not None:
        queryset = queryset.filter(group=group)
    if group_ids is not None:
        queryset = queryset.filter(group_id__in=group_ids)

    blocked_user_ids = get_blocked_user_ids(user)
    if blocked_user_ids:
        queryset = queryset.exclude(sender_id__in=blocked_user_ids)

    return queryset


def get_group_chat_participants(group):
    participants = [group.owner_id]
    participants.extend(
        GroupMember.objects.filter(group=group)
        .values_list("user_id", flat=True)
    )
    return set(participants)


def get_group_chat_unread_count(user, group):
    try:
        read_state = (
            GroupChatReadState.objects.filter(group=group, user=user)
            .order_by("-last_read_at", "-id")
            .first()
        )
        unread_messages = visible_group_chat_messages_for_user(user, group=group).exclude(sender=user)
        if read_state:
            unread_messages = unread_messages.filter(created_at__gt=read_state.last_read_at)
        return unread_messages.count()
    except DatabaseError:
        read_state = None
    return 0


def mark_group_chat_read(user, group):
    now = timezone.now()
    try:
        existing_states = list(
            GroupChatReadState.objects.filter(group=group, user=user).order_by("-last_read_at", "-id")
        )
        if existing_states:
            primary_state = existing_states[0]
            duplicate_ids = [state.id for state in existing_states[1:]]
            if duplicate_ids:
                GroupChatReadState.objects.filter(id__in=duplicate_ids).delete()

            GroupChatReadState.objects.filter(id=primary_state.id).update(last_read_at=now)
            primary_state.last_read_at = now
            return primary_state

        return GroupChatReadState.objects.create(
            group=group,
            user=user,
            last_read_at=now,
        )
    except DatabaseError:
        return None


def build_name_initials(value):
    return "".join(part[0].upper() for part in str(value or "").split()[:2] if part) or "SV"


def get_group_chat_presence_state(presence, now=None):
    reference_time = now or timezone.now()
    online_threshold = reference_time - timedelta(minutes=GROUP_CHAT_ONLINE_WINDOW_MINUTES)
    recent_threshold = reference_time - timedelta(minutes=GROUP_CHAT_RECENT_WINDOW_MINUTES)
    typing_threshold = reference_time - timedelta(seconds=GROUP_CHAT_TYPING_WINDOW_SECONDS)

    last_seen_at = getattr(presence, "last_seen_at", None)
    typing_updated_at = getattr(presence, "typing_updated_at", None)
    is_typing = bool(
        presence
        and presence.is_typing
        and typing_updated_at
        and typing_updated_at >= typing_threshold
    )

    if last_seen_at and last_seen_at >= online_threshold:
        status = "online"
        label = "Online"
    elif last_seen_at and last_seen_at >= recent_threshold:
        status = "recent"
        label = "Active recently"
    else:
        status = "offline"
        label = "Offline"

    return {
        "status": status,
        "label": label,
        "is_online": status == "online",
        "is_typing": is_typing,
        "last_seen_at": last_seen_at,
    }


def touch_group_chat_presence(user, group, is_typing=None):
    now = timezone.now()
    try:
        existing_rows = list(
            GroupChatPresence.objects.filter(group=group, user=user).order_by("-updated_at", "-id")
        )
        if existing_rows:
            primary_presence = existing_rows[0]
            duplicate_ids = [presence.id for presence in existing_rows[1:]]
            if duplicate_ids:
                GroupChatPresence.objects.filter(id__in=duplicate_ids).delete()

            update_kwargs = {"last_seen_at": now}
            primary_presence.last_seen_at = now
            if is_typing is not None:
                update_kwargs["is_typing"] = bool(is_typing)
                update_kwargs["typing_updated_at"] = now
                primary_presence.is_typing = bool(is_typing)
                primary_presence.typing_updated_at = now

            GroupChatPresence.objects.filter(id=primary_presence.id).update(**update_kwargs)
            return primary_presence

        create_kwargs = {
            "group": group,
            "user": user,
            "last_seen_at": now,
        }
        if is_typing is not None:
            create_kwargs["is_typing"] = bool(is_typing)
            create_kwargs["typing_updated_at"] = now
        return GroupChatPresence.objects.create(**create_kwargs)
    except DatabaseError:
        return None


def serialize_group_chat_participant(user, role, presence, now=None, current_user=None):
    presence_state = get_group_chat_presence_state(presence, now=now)
    return {
        "user_id": user.id,
        "username": user.username,
        "display_name": public_user_display_name(user),
        "role": role,
        "initials": build_name_initials(user.username),
        "is_self": bool(current_user and user.id == current_user.id),
        "presence": presence_state,
    }


def build_group_chat_activity_snapshot(group, current_user=None, presence_map=None, now=None, members=None):
    reference_time = now or timezone.now()
    participant_users = [group.owner]
    if members is None:
        members = GroupMember.objects.filter(group=group).select_related("user")
    participant_users.extend(member.user for member in members)

    seen_user_ids = set()
    blocked_user_ids = get_blocked_user_ids(current_user) if current_user else set()
    serialized_participants = []
    active_typing_users = []
    online_participant_count = 0

    for participant in participant_users:
        if participant.id in seen_user_ids:
            continue
        if current_user and participant.id != current_user.id and participant.id in blocked_user_ids:
            continue
        seen_user_ids.add(participant.id)
        presence = (presence_map or {}).get(participant.id)
        serialized_participant = serialize_group_chat_participant(
            participant,
            "owner" if participant.id == group.owner_id else "member",
            presence,
            now=reference_time,
            current_user=current_user,
        )
        serialized_participants.append(serialized_participant)

        if serialized_participant["presence"]["is_online"]:
            online_participant_count += 1

        if (
            serialized_participant["presence"]["is_typing"]
            and current_user
            and participant.id != current_user.id
        ):
            active_typing_users.append(participant.username)

    return {
        "participants": serialized_participants,
        "participant_count": len(serialized_participants),
        "online_participant_count": online_participant_count,
        "active_typing_users": active_typing_users[:3],
        "has_someone_typing": bool(active_typing_users),
    }


def build_group_chat_fallback_snapshot(group, current_user=None, members=None):
    participant_users = [group.owner]
    if members is not None:
        participant_users.extend(member.user for member in members)
    elif current_user and current_user.id != group.owner_id:
        participant_users.append(current_user)

    serialized_participants = []
    seen_user_ids = set()
    blocked_user_ids = get_blocked_user_ids(current_user) if current_user else set()
    for participant in participant_users:
        if participant.id in seen_user_ids:
            continue
        if current_user and participant.id != current_user.id and participant.id in blocked_user_ids:
            continue
        seen_user_ids.add(participant.id)
        serialized_participants.append(
            serialize_group_chat_participant(
                participant,
                "owner" if participant.id == group.owner_id else "member",
                None,
                current_user=current_user,
            )
        )

    return {
        "participants": serialized_participants,
        "participant_count": len(serialized_participants),
        "online_participant_count": 0,
        "active_typing_users": [],
        "has_someone_typing": False,
    }


def build_safe_group_chat_group_payload(group):
    mode = (getattr(group, "mode", "") or "sharing").strip() or "sharing"
    status = (getattr(group, "status", "") or "forming").strip() or "forming"

    try:
        mode_copy = get_mode_copy(mode)
    except Exception:
        mode_copy = {
            "label": "Share existing plan" if mode != "group_buy" else "Buy together",
        }

    try:
        status_label = get_status_copy(group)
    except Exception:
        status_label = status.replace("_", " ").title()

    subscription_name = "Unknown split"
    try:
        subscription_name = getattr(getattr(group, "subscription", None), "name", None) or subscription_name
    except Exception:
        pass

    owner_name = "Unknown owner"
    try:
        owner_name = public_user_display_name(getattr(group, "owner", None)) or owner_name
    except Exception:
        pass
    owner_username = ""
    try:
        owner_username = getattr(getattr(group, "owner", None), "username", "") or ""
    except Exception:
        pass

    return {
        "id": getattr(group, "id", None),
        "subscription_name": subscription_name,
        "mode": mode,
        "mode_label": mode_copy.get("label", "Share existing plan"),
        "status": status,
        "status_label": status_label,
        "owner_id": getattr(group, "owner_id", None),
        "owner_name": owner_name,
        "owner_username": owner_username,
        "created_at": getattr(group, "created_at", None),
    }


def build_emergency_group_chat_group_payload(group):
    return {
        "id": getattr(group, "id", None),
        "subscription_name": "Unknown split",
        "mode": (getattr(group, "mode", "") or "sharing").strip() or "sharing",
        "mode_label": "Buy together" if getattr(group, "mode", "") == "group_buy" else "Share existing plan",
        "status": (getattr(group, "status", "") or "forming").strip() or "forming",
        "status_label": "Unavailable right now",
        "owner_id": getattr(group, "owner_id", None),
        "owner_name": "Unknown owner",
        "owner_username": "",
        "created_at": getattr(group, "created_at", None),
    }


def build_empty_group_chat_response(group=None, group_id=None, current_user=None):
    fallback_group = (
        build_emergency_group_chat_group_payload(group)
        if group is not None
        else {
            "id": group_id,
            "subscription_name": "Unknown split",
            "mode": "sharing",
            "mode_label": "Share existing plan",
            "status": "forming",
            "status_label": "Unavailable right now",
            "owner_name": "Unknown owner",
            "created_at": None,
        }
    )
    fallback_snapshot = (
        build_group_chat_fallback_snapshot(group, current_user=current_user)
        if group is not None
        else {
            "participants": [],
            "participant_count": 0,
            "online_participant_count": 0,
            "active_typing_users": [],
            "has_someone_typing": False,
        }
    )
    return {
        "group": fallback_group,
        "participants": fallback_snapshot["participants"],
        "messages": [],
        "unread_chat_count": 0,
        "online_participant_count": fallback_snapshot["online_participant_count"],
        "active_typing_users": fallback_snapshot["active_typing_users"],
        "has_someone_typing": fallback_snapshot["has_someone_typing"],
    }


def log_group_chat_failure(request, endpoint, stage, exc, group_id=None):
    log_operation_event(
        f"{endpoint}_{stage}_failed",
        level="error",
        endpoint=endpoint,
        stage=stage,
        user_id=getattr(getattr(request, "user", None), "id", None),
        group_id=group_id,
        exception_type=type(exc).__name__,
        exception_message=str(exc),
    )


__all__ = [
    "GROUP_CHAT_ONLINE_WINDOW_MINUTES",
    "GROUP_CHAT_RECENT_WINDOW_MINUTES",
    "GROUP_CHAT_TYPING_WINDOW_SECONDS",
    "can_user_join_group_chat",
    "get_blocked_user_ids",
    "has_blocked_user",
    "visible_group_chat_messages_for_user",
    "get_group_chat_participants",
    "get_group_chat_unread_count",
    "mark_group_chat_read",
    "build_name_initials",
    "get_group_chat_presence_state",
    "touch_group_chat_presence",
    "serialize_group_chat_participant",
    "build_group_chat_activity_snapshot",
    "build_group_chat_fallback_snapshot",
    "build_safe_group_chat_group_payload",
    "build_emergency_group_chat_group_payload",
    "build_empty_group_chat_response",
    "log_group_chat_failure",
]
