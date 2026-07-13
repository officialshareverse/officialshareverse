from .models import User


def normalize_login_identifier(value):
    return (value or "").strip()


def find_user_by_login_identifier(identifier):
    """Find a user by username or email without case sensitivity.

    A2 fix: the database enforces ``unique_email_ci`` and
    ``unique_username_ci`` (migration 0041), so these case-insensitive
    lookups cannot select an arbitrary duplicate account.
    """
    normalized = normalize_login_identifier(identifier)
    if not normalized:
        return None

    username_match = User.objects.filter(username__iexact=normalized).order_by("id").first()
    if username_match:
        return username_match

    if "@" in normalized:
        return User.objects.filter(email__iexact=normalized).order_by("id").first()

    return None
