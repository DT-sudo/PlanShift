import os
from pathlib import Path

from .env import env_bool, env_list, load_dotenv

BASE_DIR = Path(__file__).resolve().parent.parent
PROJECT_ROOT = BASE_DIR.parent

load_dotenv(PROJECT_ROOT / ".env")

SECRET_KEY = os.environ.get("SECRET_KEY", "dev-secret-key-change-me")
DEBUG = env_bool("DEBUG", True)
ALLOWED_HOSTS = env_list("ALLOWED_HOSTS", ["localhost", "127.0.0.1"])

INSTALLED_APPS = [
    "daphne",
    "django.contrib.auth",
    "django.contrib.contenttypes",
    "django.contrib.sessions",
    "django.contrib.messages",
    "django.contrib.staticfiles",
    "apps.accounts",
    "apps.legal",
    "apps.privacy",
    "apps.scheduling",
    "apps.realtime",
    "apps.notifications",
    "apps.profiles",
    "apps.twofactor",
    "apps.i18n",
]

MIDDLEWARE = [
    "django.middleware.security.SecurityMiddleware",
    "django.contrib.sessions.middleware.SessionMiddleware",
    "django.middleware.locale.LocaleMiddleware",
    "django.middleware.common.CommonMiddleware",
    "django.middleware.csrf.CsrfViewMiddleware",
    "django.contrib.auth.middleware.AuthenticationMiddleware",
    "apps.i18n.middleware.UserLanguageMiddleware",
    "django.contrib.messages.middleware.MessageMiddleware",
    "apps.accounts.middleware.SessionSecurityMiddleware",
    "django.middleware.clickjacking.XFrameOptionsMiddleware",
]

ROOT_URLCONF = "config.urls"

TEMPLATES = [
    {
        "BACKEND": "django.template.backends.django.DjangoTemplates",
        "DIRS": [PROJECT_ROOT / "frontend" / "templates"],
    }
]

ASGI_APPLICATION = "config.asgi.application"

REDIS_URL = os.environ.get("REDIS_URL", "")
if REDIS_URL:
    CHANNEL_LAYERS = {
        "default": {
            "BACKEND": "channels_redis.core.RedisChannelLayer",
            "CONFIG": {"hosts": [{"address": REDIS_URL, "socket_timeout": 15}]},
        }
    }
else:
    CHANNEL_LAYERS = {"default": {"BACKEND": "channels.layers.InMemoryChannelLayer"}}

DATABASES = {
    "default": {
        "ENGINE": "django.db.backends.sqlite3",
        "NAME": os.environ.get("DB_NAME", str(BASE_DIR / "db.sqlite3")),
        "OPTIONS": {"transaction_mode": "IMMEDIATE", "timeout": 20},
    }
}

AUTH_USER_MODEL = "accounts.User"
LOGIN_URL = "login"

AUTH_PASSWORD_VALIDATORS = [
    {"NAME": "django.contrib.auth.password_validation.UserAttributeSimilarityValidator"},
    {"NAME": "django.contrib.auth.password_validation.MinimumLengthValidator"},
    {"NAME": "django.contrib.auth.password_validation.CommonPasswordValidator"},
    {"NAME": "django.contrib.auth.password_validation.NumericPasswordValidator"},
]

LANGUAGE_CODE = "en"
LANGUAGES = [("en", "English"), ("cs", "Čeština"), ("ar", "العربية")]
LOCALE_PATHS = [BASE_DIR / "locale"]
LANGUAGE_COOKIE_AGE = 365 * 24 * 60 * 60
LANGUAGE_COOKIE_SAMESITE = "Lax"
TIME_ZONE = os.environ.get("TIME_ZONE", "UTC")
USE_TZ = True

DEFAULT_AUTO_FIELD = "django.db.models.BigAutoField"

FRONTEND_DIST_DIR = PROJECT_ROOT / "frontend" / "dist"

STATIC_URL = "/static/"
STATICFILES_DIRS = [FRONTEND_DIST_DIR]

MEDIA_ROOT = Path(os.environ.get("MEDIA_ROOT", PROJECT_ROOT / "media"))

SECURE_PROXY_SSL_HEADER = ("HTTP_X_FORWARDED_PROTO", "https")

HTTPS_PORT = os.environ.get("HTTPS_PORT", "8443")
CSRF_TRUSTED_ORIGINS = env_list(
    "CSRF_TRUSTED_ORIGINS",
    [f"https://{host}:{HTTPS_PORT}" for host in ALLOWED_HOSTS if host != "*"],
)

SECURE_COOKIES = env_bool("SECURE_COOKIES", True)
SESSION_COOKIE_SECURE = SECURE_COOKIES
CSRF_COOKIE_SECURE = SECURE_COOKIES
LANGUAGE_COOKIE_SECURE = SECURE_COOKIES

if not DEBUG:
    SECURE_HSTS_SECONDS = int(os.environ.get("SECURE_HSTS_SECONDS", "31536000"))
    SECURE_HSTS_INCLUDE_SUBDOMAINS = True

ENABLE_DEMO_LOGIN = env_bool("ENABLE_DEMO_LOGIN", DEBUG)

LOGGING = {
    "version": 1,
    "disable_existing_loggers": False,
    "formatters": {"security": {"format": "%(asctime)s %(levelname)s security %(message)s"}},
    "handlers": {
        "security": {"class": "logging.StreamHandler", "formatter": "security"},
    },
    "loggers": {
        "transcendence.security": {"handlers": ["security"], "level": "INFO", "propagate": False},
    },
}

EMAIL_BACKEND = os.environ.get("EMAIL_BACKEND") or "django.core.mail.backends.console.EmailBackend"
EMAIL_HOST = os.environ.get("EMAIL_HOST", "")
EMAIL_PORT = int(os.environ.get("EMAIL_PORT", "587"))
EMAIL_HOST_USER = os.environ.get("EMAIL_HOST_USER", "")
EMAIL_HOST_PASSWORD = os.environ.get("EMAIL_HOST_PASSWORD", "")
EMAIL_USE_TLS = env_bool("EMAIL_USE_TLS", True)
DEFAULT_FROM_EMAIL = os.environ.get("DEFAULT_FROM_EMAIL", "privacy@ft-transcendence.example")
