import httpx
from typing import List


class NotificationService:
    """Send push notifications via the Expo Push API."""

    EXPO_PUSH_URL = "https://exp.host/--/api/v2/push/send"

    async def send_push(
        self, tokens: List[str], title: str, body: str, data: dict | None = None
    ) -> dict:
        messages = [
            {
                "to": token,
                "sound": "default",
                "title": title,
                "body": body,
                "data": data or {},
            }
            for token in tokens
        ]

        async with httpx.AsyncClient() as client:
            response = await client.post(
                self.EXPO_PUSH_URL,
                json=messages,
                headers={
                    "Accept": "application/json",
                    "Content-Type": "application/json",
                },
            )
            return response.json()

    async def send_to_user(
        self, push_token: str | None, title: str, body: str, data: dict | None = None
    ) -> dict | None:
        if not push_token:
            return None
        return await self.send_push([push_token], title, body, data)


notification_service = NotificationService()