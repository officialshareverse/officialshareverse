from .models import User


def normalize_login_identifier(value):
    return (value or "").strip()


def find_user_by_login_identifier(identifier):
    normalized = normalize_login_identifier(identifier)
    if not normalized:
        return None

    username_match = User.objects.filter(username__iexact=normalized).order_by("id").first()
    if username_match:
        return username_match

    if "@" in normalized:
        return User.objects.filter(email__iexact=normalized).order_by("id").first()

    return None
