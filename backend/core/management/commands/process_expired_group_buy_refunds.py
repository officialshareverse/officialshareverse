from decimal import Decimal

from django.core.management.base import BaseCommand

from core.views import process_expired_buy_together_refunds


class Command(BaseCommand):
    help = "Process expired buy-together deadlines by refunding missed purchases or auto-releasing clean confirmation windows."

    def handle(self, *args, **options):
        result = process_expired_buy_together_refunds()
        processed_groups = result.get("processed_groups", 0)
        refunded_total = result.get("refunded_amount", Decimal("0.00"))
        released_total = result.get("released_amount", Decimal("0.00"))
        released_groups = result.get("released_groups", 0)

        self.stdout.write(
            self.style.SUCCESS(
                "Processed buy-together deadlines: "
                f"{processed_groups} group(s), refunded Rs {refunded_total}, "
                f"auto-released Rs {released_total} across {released_groups} group(s)"
            )
        )
