import httpx
from app.config import settings


class SupabaseAdmin:
    """Interact with Supabase Auth Admin API using the service role key."""

    def __init__(self):
        self.base_url = settings.SUPABASE_URL
        self.headers = {
            "apikey": settings.SUPABASE_SERVICE_KEY,
            "Authorization": f"Bearer {settings.SUPABASE_SERVICE_KEY}",
            "Content-Type": "application/json",
        }

    async def create_user(
        self,
        email: str,
        password: str | None = None,
        full_name: str | None = None,
    ) -> dict:
        """Create a user in Supabase Auth."""
        async with httpx.AsyncClient() as client:
            body = {
                "email": email,
                "email_confirm": True,
                # ← Pass full_name in user_metadata so the profiles trigger
                # can populate the full_name column (NOT NULL constraint)
                "user_metadata": {
                    "role": "client",
                    "full_name": full_name or email.split('@')[0],
                },
                # Also pass in data so Supabase raw_user_meta_data is set
                "data": {
                    "full_name": full_name or email.split('@')[0],
                },
            }
            if password:
                body["password"] = password

            response = await client.post(
                f"{self.base_url}/auth/v1/admin/users",
                headers=self.headers,
                json=body,
            )
            response.raise_for_status()
            return response.json()

    async def delete_user(self, supabase_user_id: str) -> None:
        async with httpx.AsyncClient() as client:
            response = await client.delete(
                f"{self.base_url}/auth/v1/admin/users/{supabase_user_id}",
                headers=self.headers,
            )
            response.raise_for_status()

    async def invite_user_by_email(self, email: str) -> dict:
        async with httpx.AsyncClient() as client:
            response = await client.post(
                f"{self.base_url}/auth/v1/invite",
                headers=self.headers,
                json={"email": email},
            )
            response.raise_for_status()
            return response.json()

    async def get_user(self, supabase_user_id: str) -> dict:
        async with httpx.AsyncClient() as client:
            response = await client.get(
                f"{self.base_url}/auth/v1/admin/users/{supabase_user_id}",
                headers=self.headers,
            )
            response.raise_for_status()
            return response.json()

    async def update_user_metadata(
        self, supabase_user_id: str, metadata: dict
    ) -> dict:
        """Update a user's metadata in Supabase Auth."""
        async with httpx.AsyncClient() as client:
            response = await client.put(
                f"{self.base_url}/auth/v1/admin/users/{supabase_user_id}",
                headers=self.headers,
                json={"user_metadata": metadata, "data": metadata},
            )
            response.raise_for_status()
            return response.json()


supabase_admin = SupabaseAdmin()