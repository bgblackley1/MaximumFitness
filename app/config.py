from pydantic_settings import BaseSettings
from typing import List


class Settings(BaseSettings):
    DATABASE_URL: str
    SUPABASE_URL: str
    SUPABASE_ANON_KEY: str
    SUPABASE_SERVICE_KEY: str

    # ── Storage bucket names ─────────────────────────────────────────
    # Must match EXACTLY what appears in Supabase Dashboard → Storage → Buckets
    SUPABASE_PROGRESS_BUCKET: str = "progress-photos"

    STRIPE_SECRET_KEY: str
    STRIPE_WEBHOOK_SECRET: str
    JWT_SECRET: str
    JWT_ALGORITHM: str = "HS256"
    CORS_ORIGINS: str = "http://localhost:8081,http://localhost:19006"

    @property
    def cors_origins_list(self) -> List[str]:
        return [origin.strip() for origin in self.CORS_ORIGINS.split(",")]

    class Config:
        env_file = ".env"
        env_file_encoding = "utf-8"
        extra = "ignore"


settings = Settings()