from functools import lru_cache

from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    database_url: str
    s3_endpoint_url: str
    s3_access_key: str
    s3_secret_key: str
    s3_bucket_name: str
    gemini_api_key: str
    gemini_model_primary: str = "gemini-3.5-flash"
    gemini_model_fallback: str = "gemini-3.1-flash-lite"
    gemini_max_retries: int = 3
    port: int = 3003

    model_config = SettingsConfigDict(env_file=".env", env_file_encoding="utf-8")


@lru_cache
def get_settings() -> Settings:
    return Settings()
