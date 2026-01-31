from functools import lru_cache
from typing import List

from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    supabase_url: str
    supabase_service_role_key: str
    supabase_anon_key: str
    supabase_jwt_secret: str  # Secret used to verify JWT tokens
    database_url: str
    backend_host: str = '0.0.0.0'
    backend_port: int = 8000
    allowed_origins: str | List[str] = 'http://localhost:5173,http://localhost:5174'
    frontend_url: str = 'http://localhost:5173'
    backend_url: str = 'http://localhost:8000'
    qr_ip_hash_salt: str
    social_login_salt: str
    social_state_secret: str
    yandex_client_id: str | None = None
    yandex_client_secret: str | None = None
    yandex_redirect_uri: str | None = None
    environment: str = 'development'
    session_cookie_name: str = 'session_id'
    session_max_age: int = 86400  # 24 hours
    # Email (SMTP) settings
    smtp_host: str | None = None
    smtp_port: int = 587
    smtp_user: str | None = None
    smtp_password: str | None = None
    smtp_from_email: str | None = None
    smtp_from_name: str = 'Работаем Честно!'
    smtp_use_tls: bool = True
    # Telegram Bot settings
    telegram_bot_token: str | None = None
    telegram_default_chat_id: str | None = None
    # Web Push (VAPID) settings
    vapid_public_key: str | None = None
    vapid_private_key: str | None = None
    vapid_subject: str = 'mailto:noreply@chestno.ru'
    # GeoIP settings
    geoip_db_path: str | None = None  # Path to GeoLite2-City.mmdb
    # YooKassa (Payment) settings
    yukassa_shop_id: str | None = None
    yukassa_secret_key: str | None = None
    yukassa_webhook_secret: str | None = None
    yukassa_sandbox_mode: bool = True
    payment_currency: str = 'RUB'
    payment_return_url: str | None = None
    payment_cancel_url: str | None = None

    model_config = SettingsConfigDict(
        env_file=('.env', 'backend/.env'),
        env_file_encoding='utf-8',
        extra='ignore',
    )

    @property
    def allowed_origins_list(self) -> List[str]:
        if isinstance(self.allowed_origins, list):
            return self.allowed_origins
        return [origin.strip() for origin in self.allowed_origins.split(',') if origin.strip()]

    @property
    def supabase_auth_url(self) -> str:
        return self.supabase_url.rstrip('/') + '/auth/v1'

    @property
    def frontend_base(self) -> str:
        return self.frontend_url.rstrip('/')

    @property
    def yandex_oauth_enabled(self) -> bool:
        return bool(self.yandex_client_id and self.yandex_client_secret and self.yandex_redirect_uri)

    @property
    def yukassa_enabled(self) -> bool:
        return bool(self.yukassa_shop_id and self.yukassa_secret_key)

    @property
    def payment_return_url_full(self) -> str:
        if self.payment_return_url:
            return self.payment_return_url
        return f'{self.frontend_base}/subscription/success'

    @property
    def payment_cancel_url_full(self) -> str:
        if self.payment_cancel_url:
            return self.payment_cancel_url
        return f'{self.frontend_base}/subscription/canceled'


@lru_cache
def get_settings() -> Settings:
    return Settings()

