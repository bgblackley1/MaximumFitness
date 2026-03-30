import stripe
from app.config import settings

stripe.api_key = settings.STRIPE_SECRET_KEY


class StripeService:

    @staticmethod
    async def create_customer(email: str, name: str) -> stripe.Customer:
        return stripe.Customer.create(email=email, name=name)

    @staticmethod
    async def create_subscription(
        customer_id: str, price_id: str
    ) -> stripe.Subscription:
        return stripe.Subscription.create(
            customer=customer_id,
            items=[{"price": price_id}],
            payment_behavior="default_incomplete",
            expand=["latest_invoice.payment_intent"],
        )

    @staticmethod
    async def cancel_subscription(subscription_id: str) -> stripe.Subscription:
        return stripe.Subscription.modify(
            subscription_id, cancel_at_period_end=True
        )

    @staticmethod
    async def pause_subscription(subscription_id: str) -> stripe.Subscription:
        return stripe.Subscription.modify(
            subscription_id, pause_collection={"behavior": "void"}
        )

    @staticmethod
    async def resume_subscription(subscription_id: str) -> stripe.Subscription:
        return stripe.Subscription.modify(
            subscription_id, pause_collection=""
        )

    @staticmethod
    async def create_setup_intent(customer_id: str) -> stripe.SetupIntent:
        return stripe.SetupIntent.create(
            customer=customer_id,
            payment_method_types=["card"],
        )

    @staticmethod
    def construct_webhook_event(payload: bytes, sig_header: str) -> stripe.Event:
        return stripe.Webhook.construct_event(
            payload, sig_header, settings.STRIPE_WEBHOOK_SECRET
        )


stripe_service = StripeService()