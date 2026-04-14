from datetime import datetime
from decimal import Decimal, ROUND_HALF_UP
from zoneinfo import ZoneInfo

from django.utils import timezone


MONEY_QUANTIZER = Decimal("0.01")
OPERATIONAL_TIMEZONE = ZoneInfo("Asia/Kolkata")


def normalize_money(amount):
    if amount is None:
        amount = Decimal("0.00")
    if not isinstance(amount, Decimal):
        amount = Decimal(str(amount))
    return amount.quantize(MONEY_QUANTIZER, rounding=ROUND_HALF_UP)


def get_member_charged_amount(member):
    amount = getattr(member, "charged_amount", None)
    if amount is None or amount <= Decimal("0.00"):
        amount = member.group.price_per_slot
    return normalize_money(amount)


def sum_member_charged_amounts(members):
    total = Decimal("0.00")
    for member in members:
        total += get_member_charged_amount(member)
    return normalize_money(total)


def get_group_total_cycle_days(group):
    if not group.start_date or not group.end_date:
        return 0
    return max((group.end_date - group.start_date).days + 1, 0)


def get_group_remaining_cycle_days(group, reference_date=None):
    if not group.start_date or not group.end_date:
        return 0

    reference_date = normalize_reference_date(reference_date)
    if reference_date < group.start_date:
        return get_group_total_cycle_days(group)
    if reference_date > group.end_date:
        return 0
    return (group.end_date - reference_date).days + 1


def normalize_reference_date(reference_date=None):
    if reference_date is None:
        return timezone.localtime(timezone.now(), OPERATIONAL_TIMEZONE).date()

    if isinstance(reference_date, datetime):
        if timezone.is_naive(reference_date):
            return reference_date.date()
        return timezone.localtime(reference_date, OPERATIONAL_TIMEZONE).date()

    return reference_date


def get_group_join_pricing(group, reference_date=None):
    base_price = normalize_money(group.price_per_slot)
    total_cycle_days = get_group_total_cycle_days(group)
    remaining_cycle_days = get_group_remaining_cycle_days(group, reference_date=reference_date)

    if group.mode != "sharing" or total_cycle_days <= 0:
        return {
            "base_price": base_price,
            "join_price": base_price,
            "is_prorated": False,
            "remaining_cycle_days": remaining_cycle_days or total_cycle_days,
            "total_cycle_days": total_cycle_days,
            "pricing_note": "",
            "is_expired": remaining_cycle_days == 0 and total_cycle_days > 0,
        }

    if remaining_cycle_days == 0:
        join_price = Decimal("0.00")
    elif remaining_cycle_days >= total_cycle_days:
        join_price = base_price
    else:
        join_price = normalize_money(
            base_price * Decimal(remaining_cycle_days) / Decimal(total_cycle_days)
        )

    is_prorated = 0 < remaining_cycle_days < total_cycle_days and join_price < base_price
    pricing_note = (
        f"Charged only for the remaining {remaining_cycle_days} of {total_cycle_days} days in this cycle."
        if is_prorated
        else ""
    )

    return {
        "base_price": base_price,
        "join_price": join_price,
        "is_prorated": is_prorated,
        "remaining_cycle_days": remaining_cycle_days,
        "total_cycle_days": total_cycle_days,
        "pricing_note": pricing_note,
        "is_expired": remaining_cycle_days == 0,
    }
