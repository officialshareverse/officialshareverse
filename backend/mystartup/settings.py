
import importlib.util
import os
import sys
from pathlib import Path
from urllib.parse import urlparse
from datetime import timedelta
from django.core.exceptions import ImproperlyConfigured

# Build paths inside the project like this: BASE_DIR / 'subdir'.
BASE_DIR = Path(__file__).resolve().parent.parent
_HAS_DJ_DATABASE_URL = importlib.util.find_spec("dj_database_url") is not None
_HAS_WHITENOISE = importlib.util.find_spec("whitenoise") is not None
_HAS_CHANNELS = importlib.util.find_spec("channels") is not None
_HAS_DAPHNE = importlib.util.find_spec("daphne") is not None
_HAS_SENTRY_SDK = importlib.util.find_spec("sentry_sdk") is not None

if _HAS_DJ_DATABASE_URL:
    import dj_database_url


def _parse_env_value(value):
    normalized = value.strip()
    if len(normalized) >= 2 and normalized[0] == normalized[-1] and normalized[0] in {'"', "'"}:
        normalized = normalized[1:-1]
    return normalized


def _get_env_bool(name, default=False):
    value = os.environ.get(name)
    if value is None:
        return default
    return _parse_env_value(value).lower() == "true"


def _get_env_float(name, default=0.0):
    value = os.environ.get(name)
    if value is None:
        return default

    try:
        return float(_parse_env_value(value))
    except (TypeError, ValueError):
        return default


def _get_env_list(name, default_values=None):
    value = os.environ.get(name)
    if value is None:
        return list(default_values or [])

    values = []
    for raw_item in value.split(','):
        normalized = _parse_env_value(raw_item).strip()
        if normalized and normalized not in values:
            values.append(normalized)
    return values


def _load_env_file(env_path):
    if not env_path.exists():
        return

    for raw_line in env_path.read_text(encoding="utf-8").splitlines():
        line = raw_line.strip()
        if not line or line.startswith("#") or "=" not in line:
            continue

        key, value = line.split("=", 1)
        key = key.strip()
        if not key or key in os.environ:
            continue

        os.environ[key] = _parse_env_value(value)


for candidate_env_path in (BASE_DIR.parent / ".env", BASE_DIR / ".env"):
    _load_env_file(candidate_env_path)


# Quick-start development settings - unsuitable for production
# See https://docs.djangoproject.com/en/5.1/howto/deployment/checklist/

IS_TEST_ENV = any(arg == "test" or "pytest" in arg for arg in sys.argv)
ENVIRONMENT = os.environ.get("DJANGO_ENV", "test" if IS_TEST_ENV else "production").strip().lower() or ("test" if IS_TEST_ENV else "production")
IS_DEV_ENV = ENVIRONMENT in {"dev", "development", "local"}
IS_PRODUCTION_ENV = not IS_DEV_ENV and not IS_TEST_ENV

DEFAULT_ALLOWED_HOSTS = ["127.0.0.1", "localhost"]
DEFAULT_PRODUCTION_ALLOWED_HOSTS = ["api.shareverse.in"]
DEFAULT_CORS_ALLOWED_ORIGINS = ["http://localhost:3000", "http://127.0.0.1:3000"]
DEFAULT_PRODUCTION_CORS_ALLOWED_ORIGINS = [
    "https://shareverse.in",
    "https://www.shareverse.in",
]
DEFAULT_PRODUCTION_CSRF_TRUSTED_ORIGINS = [
    "https://shareverse.in",
    "https://www.shareverse.in",
    "https://api.shareverse.in",
]
# Razorpay India webhook egress IPs:
# https://razorpay.com/docs/security/whitelists/?preferred-country=IN
DEFAULT_RAZORPAY_WEBHOOK_ALLOWED_IPS = [
    "52.66.75.174",
    "52.66.76.63",
    "52.66.151.218",
    "35.154.217.40",
    "35.154.22.73",
    "35.154.143.15",
    "13.126.199.247",
    "13.126.238.192",
    "13.232.194.134",
    "18.96.225.0/26",
    "18.99.161.0/26",
]

# SECURITY WARNING: keep the secret key used in production secret!
SECRET_KEY = os.environ.get('DJANGO_SECRET_KEY', '').strip()
if not SECRET_KEY:
    if IS_DEV_ENV or IS_TEST_ENV:
        SECRET_KEY = 'django-insecure-dev-key-change-me'
    else:
        raise ImproperlyConfigured("DJANGO_SECRET_KEY must be set outside development and tests.")

# SECURITY WARNING: don't run with debug turned on in production!
DEBUG = _get_env_bool('DJANGO_DEBUG', IS_DEV_ENV)

# A3 fix: credentials use an explicit, rotatable key ring. Production must
# supply a persistent active key; development/test defaults never use SECRET_KEY.
CREDENTIAL_ENCRYPTION_KEY = os.environ.get("CREDENTIAL_ENCRYPTION_KEY", "").strip()
if not CREDENTIAL_ENCRYPTION_KEY:
    if IS_PRODUCTION_ENV:
        raise ImproperlyConfigured("CREDENTIAL_ENCRYPTION_KEY is required in production.")
    CREDENTIAL_ENCRYPTION_KEY = "shareverse-development-credential-key"

CREDENTIAL_ENCRYPTION_KEYS = {"v1": CREDENTIAL_ENCRYPTION_KEY}
for pair in os.environ.get("CREDENTIAL_ENCRYPTION_KEYS", "").split(","):
    key_id, separator, key_value = pair.partition(":")
    if separator and key_id.strip() and key_value.strip():
        CREDENTIAL_ENCRYPTION_KEYS[key_id.strip()] = key_value.strip()
CREDENTIAL_ENCRYPTION_ACTIVE_KEY_ID = os.environ.get(
    "CREDENTIAL_ENCRYPTION_ACTIVE_KEY_ID", "v1"
).strip() or "v1"
EXPOSE_DEV_OTP = _get_env_bool('DJANGO_EXPOSE_DEV_OTP', IS_DEV_ENV or IS_TEST_ENV)
if IS_PRODUCTION_ENV and EXPOSE_DEV_OTP:
    raise ImproperlyConfigured("DJANGO_EXPOSE_DEV_OTP cannot be enabled outside development and tests.")

SENTRY_DSN = (
    os.environ.get("DJANGO_SENTRY_DSN", "").strip()
    or os.environ.get("SENTRY_DSN", "").strip()
)
SENTRY_ENVIRONMENT = (
    os.environ.get("DJANGO_SENTRY_ENVIRONMENT", "").strip()
    or os.environ.get("SENTRY_ENVIRONMENT", "").strip()
    or ENVIRONMENT
)
SENTRY_RELEASE = (
    os.environ.get("DJANGO_SENTRY_RELEASE", "").strip()
    or os.environ.get("SENTRY_RELEASE", "").strip()
)
SENTRY_TRACES_SAMPLE_RATE = _get_env_float("DJANGO_SENTRY_TRACES_SAMPLE_RATE", 0.0)
SENTRY_PROFILES_SAMPLE_RATE = _get_env_float("DJANGO_SENTRY_PROFILES_SAMPLE_RATE", 0.0)
SENTRY_SEND_DEFAULT_PII = _get_env_bool("DJANGO_SENTRY_SEND_DEFAULT_PII", False)

if SENTRY_DSN:
    if not _HAS_SENTRY_SDK:
        raise ImproperlyConfigured("Install sentry-sdk[django] before setting DJANGO_SENTRY_DSN.")

    import sentry_sdk
    from sentry_sdk.integrations.django import DjangoIntegration

    sentry_sdk.init(
        dsn=SENTRY_DSN,
        integrations=[DjangoIntegration()],
        environment=SENTRY_ENVIRONMENT,
        release=SENTRY_RELEASE or None,
        traces_sample_rate=SENTRY_TRACES_SAMPLE_RATE,
        profiles_sample_rate=SENTRY_PROFILES_SAMPLE_RATE,
        send_default_pii=SENTRY_SEND_DEFAULT_PII,
    )

RENDER_EXTERNAL_HOSTNAME = os.environ.get('RENDER_EXTERNAL_HOSTNAME', '').strip()
SERVE_MEDIA_FILES = DEBUG or _get_env_bool('DJANGO_SERVE_MEDIA', False)
EMAIL_BACKEND = os.environ.get(
    'DJANGO_EMAIL_BACKEND',
    'django.core.mail.backends.console.EmailBackend',
)
EMAIL_HOST = os.environ.get('DJANGO_EMAIL_HOST', '').strip()
EMAIL_PORT = int(os.environ.get('DJANGO_EMAIL_PORT', '587'))
EMAIL_HOST_USER = os.environ.get('DJANGO_EMAIL_HOST_USER', '').strip()
EMAIL_HOST_PASSWORD = os.environ.get('DJANGO_EMAIL_HOST_PASSWORD', '').strip()
EMAIL_USE_TLS = _get_env_bool('DJANGO_EMAIL_USE_TLS', True)
EMAIL_USE_SSL = _get_env_bool('DJANGO_EMAIL_USE_SSL', False)
DEFAULT_FROM_EMAIL = os.environ.get('DJANGO_DEFAULT_FROM_EMAIL', 'ShareVerse <no-reply@shareverse.in>').strip()
MSG91_AUTH_KEY = os.environ.get('MSG91_AUTH_KEY', '').strip()
MSG91_SIGNUP_FLOW_ID = os.environ.get('MSG91_SIGNUP_FLOW_ID', '').strip()
MSG91_PASSWORD_RESET_FLOW_ID = os.environ.get('MSG91_PASSWORD_RESET_FLOW_ID', '').strip()
MSG91_SENDER_ID = os.environ.get('MSG91_SENDER_ID', '').strip()
MSG91_OTP_VARIABLE_NAME = os.environ.get('MSG91_OTP_VARIABLE_NAME', 'OTP').strip() or 'OTP'
MSG91_SMS_FLOW_API_URL = os.environ.get('MSG91_SMS_FLOW_API_URL', 'https://api.msg91.com/api/v5/flow/').strip() or 'https://api.msg91.com/api/v5/flow/'
GOOGLE_OAUTH_CLIENT_IDS = [
    value.strip()
    for value in os.environ.get(
        'DJANGO_GOOGLE_CLIENT_IDS',
        os.environ.get('DJANGO_GOOGLE_CLIENT_ID', ''),
    ).split(',')
    if value.strip()
]

ALLOWED_HOSTS = _get_env_list(
    'DJANGO_ALLOWED_HOSTS',
    DEFAULT_PRODUCTION_ALLOWED_HOSTS if IS_PRODUCTION_ENV else DEFAULT_ALLOWED_HOSTS,
)

if RENDER_EXTERNAL_HOSTNAME and RENDER_EXTERNAL_HOSTNAME not in ALLOWED_HOSTS:
    ALLOWED_HOSTS.append(RENDER_EXTERNAL_HOSTNAME)


# Application definition

INSTALLED_APPS = [
]

if _HAS_DAPHNE:
    INSTALLED_APPS.append('daphne')

INSTALLED_APPS += [
    'django.contrib.admin',
    'django.contrib.auth',
    'django.contrib.contenttypes',
    'django.contrib.sessions',
    'django.contrib.messages',
    'django.contrib.staticfiles',
    'core',
    'rest_framework',
    'rest_framework_simplejwt.token_blacklist',
    'django_filters',
    'corsheaders',
]

if _HAS_CHANNELS:
    INSTALLED_APPS.append('channels')

MIDDLEWARE = [
    'corsheaders.middleware.CorsMiddleware',
    'core.middleware.EnsureCorsCredentialsMiddleware',
    'django.middleware.security.SecurityMiddleware',
    'core.middleware.APIContentSecurityPolicyMiddleware',
    'core.middleware.RazorpayWebhookIPAllowlistMiddleware',
]

if _HAS_WHITENOISE:
    MIDDLEWARE.append('whitenoise.middleware.WhiteNoiseMiddleware')

MIDDLEWARE += [
    'django.contrib.sessions.middleware.SessionMiddleware',
    'django.middleware.common.CommonMiddleware',
    'django.middleware.csrf.CsrfViewMiddleware',
    'django.contrib.auth.middleware.AuthenticationMiddleware',
    'django.contrib.messages.middleware.MessageMiddleware',
    'django.middleware.clickjacking.XFrameOptionsMiddleware',
]

CORS_ALLOW_ALL_ORIGINS = _get_env_bool('DJANGO_CORS_ALLOW_ALL_ORIGINS', False)
CORS_ALLOW_CREDENTIALS = True

# Hard guard: a credentialed CORS wildcard is a security hole. Refuse to start in prod with it on.
if IS_PRODUCTION_ENV and CORS_ALLOW_ALL_ORIGINS:
    raise ImproperlyConfigured(
        "CORS_ALLOW_ALL_ORIGINS=True is forbidden in production with CORS_ALLOW_CREDENTIALS=True. "
        "Set DJANGO_CORS_ALLOWED_ORIGINS explicitly instead."
    )
CORS_ALLOWED_ORIGINS = _get_env_list(
    'DJANGO_CORS_ALLOWED_ORIGINS',
    DEFAULT_PRODUCTION_CORS_ALLOWED_ORIGINS if IS_PRODUCTION_ENV else DEFAULT_CORS_ALLOWED_ORIGINS,
)
CORS_ALLOWED_ORIGIN_REGEXES = _get_env_list('DJANGO_CORS_ALLOWED_ORIGIN_REGEXES', [])
CSRF_TRUSTED_ORIGINS = _get_env_list(
    'DJANGO_CSRF_TRUSTED_ORIGINS',
    DEFAULT_PRODUCTION_CSRF_TRUSTED_ORIGINS if IS_PRODUCTION_ENV else CORS_ALLOWED_ORIGINS,
)
ROOT_URLCONF = 'mystartup.urls'

TEMPLATES = [
    {
        'BACKEND': 'django.template.backends.django.DjangoTemplates',
        'DIRS': [],
        'APP_DIRS': True,
        'OPTIONS': {
            'context_processors': [
                'django.template.context_processors.debug',
                'django.template.context_processors.request',
                'django.contrib.auth.context_processors.auth',
                'django.contrib.messages.context_processors.messages',
            ],
        },
    },
]

WSGI_APPLICATION = 'mystartup.wsgi.application'
ASGI_APPLICATION = 'mystartup.asgi.application'


# Database
# https://docs.djangoproject.com/en/5.1/ref/settings/#databases

if os.environ.get('DATABASE_URL') and _HAS_DJ_DATABASE_URL:
    DATABASES = {
        'default': dj_database_url.parse(
            os.environ.get('DATABASE_URL', ''),
            conn_max_age=600,
            ssl_require=not DEBUG,
        )
    }
elif os.environ.get('POSTGRES_DB'):
    DATABASES = {
        'default': {
            'ENGINE': 'django.db.backends.postgresql',
            'NAME': os.environ.get('POSTGRES_DB'),
            'USER': os.environ.get('POSTGRES_USER', ''),
            'PASSWORD': os.environ.get('POSTGRES_PASSWORD', ''),
            'HOST': os.environ.get('POSTGRES_HOST', 'localhost'),
            'PORT': os.environ.get('POSTGRES_PORT', '5432'),
        }
    }
else:
    DATABASES = {
        'default': {
            'ENGINE': 'django.db.backends.sqlite3',
            'NAME': BASE_DIR / 'db.sqlite3',
        }
    }


# Password validation
# https://docs.djangoproject.com/en/5.1/ref/settings/#auth-password-validators

AUTH_PASSWORD_VALIDATORS = [
    {
        'NAME': 'django.contrib.auth.password_validation.UserAttributeSimilarityValidator',
    },
    {
        'NAME': 'django.contrib.auth.password_validation.MinimumLengthValidator',
    },
    {
        'NAME': 'django.contrib.auth.password_validation.CommonPasswordValidator',
    },
    {
        'NAME': 'django.contrib.auth.password_validation.NumericPasswordValidator',
    },
]

# C8 fix: OTPs use Django's adaptive password hashers via make_password.
PASSWORD_HASHERS = (
    "django.contrib.auth.hashers.PBKDF2PasswordHasher",
    "django.contrib.auth.hashers.PBKDF2SHA1PasswordHasher",
)
if importlib.util.find_spec("argon2"):
    PASSWORD_HASHERS = (
        "django.contrib.auth.hashers.Argon2PasswordHasher",
        *PASSWORD_HASHERS,
    )


# Internationalization
# https://docs.djangoproject.com/en/5.1/topics/i18n/

LANGUAGE_CODE = 'en-us'

TIME_ZONE = 'UTC'

USE_I18N = True

USE_TZ = True


# Static files (CSS, JavaScript, Images)
# https://docs.djangoproject.com/en/5.1/howto/static-files/

STATIC_URL = 'static/'
STATIC_ROOT = BASE_DIR / 'staticfiles'
MEDIA_URL = '/media/'
MEDIA_ROOT = BASE_DIR / 'media'

AWS_STORAGE_BUCKET_NAME = os.environ.get('AWS_STORAGE_BUCKET_NAME', '').strip()
if AWS_STORAGE_BUCKET_NAME:
    AWS_S3_REGION_NAME = os.environ.get('AWS_S3_REGION_NAME', 'ap-south-1').strip()
    AWS_S3_ACCESS_KEY_ID = os.environ.get('AWS_ACCESS_KEY_ID', '').strip()
    AWS_S3_SECRET_ACCESS_KEY = os.environ.get('AWS_SECRET_ACCESS_KEY', '').strip()
    AWS_S3_CUSTOM_DOMAIN = f"{AWS_STORAGE_BUCKET_NAME}.s3.amazonaws.com"
    # Private by default. Serve user-uploaded proof/payout docs via signed URLs only.
    AWS_DEFAULT_ACL = 'private'
    AWS_QUERYSTRING_AUTH = True
    AWS_QUERYSTRING_EXPIRE = 60 * 15  # 15-minute signed URLs
    AWS_S3_FILE_OVERWRITE = False

    STORAGES = {
        "default": {
            "BACKEND": "storages.backends.s3boto3.S3Boto3Storage",
        },
        "staticfiles": {
            "BACKEND": "whitenoise.storage.CompressedManifestStaticFilesStorage" if _HAS_WHITENOISE else "django.contrib.staticfiles.storage.StaticFilesStorage",
        },
    }
elif _HAS_WHITENOISE:
    STORAGES = {
        "default": {
            "BACKEND": "django.core.files.storage.FileSystemStorage",
        },
        "staticfiles": {
            "BACKEND": "whitenoise.storage.CompressedManifestStaticFilesStorage",
        },
    }

DATA_UPLOAD_MAX_MEMORY_SIZE = 5 * 1024 * 1024
FILE_UPLOAD_MAX_MEMORY_SIZE = 5 * 1024 * 1024

# Default primary key field type
# https://docs.djangoproject.com/en/5.1/ref/settings/#default-auto-field

DEFAULT_AUTO_FIELD = 'django.db.models.BigAutoField'

AUTH_USER_MODEL = 'core.User'

REST_FRAMEWORK = {
    'DEFAULT_AUTHENTICATION_CLASSES': (
        'rest_framework_simplejwt.authentication.JWTAuthentication',
    ),
    'DEFAULT_PERMISSION_CLASSES': (
        'rest_framework.permissions.IsAuthenticated',
    ),
}

SIMPLE_JWT = {
    'ACCESS_TOKEN_LIFETIME': timedelta(minutes=15),
    'REFRESH_TOKEN_LIFETIME': timedelta(days=14),
    'ROTATE_REFRESH_TOKENS': True,
    'BLACKLIST_AFTER_ROTATION': True,
    'CHECK_REVOKE_TOKEN': True,
}

AUTH_REFRESH_COOKIE_NAME = os.environ.get('DJANGO_AUTH_REFRESH_COOKIE_NAME', 'sv_refresh_token').strip() or 'sv_refresh_token'
AUTH_REFRESH_COOKIE_SECURE = _get_env_bool('DJANGO_AUTH_REFRESH_COOKIE_SECURE', not DEBUG)
AUTH_REFRESH_COOKIE_SAMESITE = os.environ.get('DJANGO_AUTH_REFRESH_COOKIE_SAMESITE', 'Lax').strip() or 'Lax'
AUTH_REFRESH_COOKIE_PATH = os.environ.get('DJANGO_AUTH_REFRESH_COOKIE_PATH', '/api/').strip() or '/api/'
AUTH_REFRESH_COOKIE_DOMAIN = os.environ.get('DJANGO_AUTH_REFRESH_COOKIE_DOMAIN', '').strip() or None

DJANGO_LOG_LEVEL = os.environ.get('DJANGO_LOG_LEVEL', 'INFO').upper()

LOGGING = {
    'version': 1,
    'disable_existing_loggers': False,
    'formatters': {
        'standard': {
            'format': '%(asctime)s %(levelname)s %(name)s %(message)s',
        },
    },
    'handlers': {
        'console': {
            'class': 'logging.StreamHandler',
            'formatter': 'standard',
        },
    },
    'loggers': {
        'core.operations': {
            'handlers': ['console'],
            'level': DJANGO_LOG_LEVEL,
            'propagate': False,
        },
    },
}

DJANGO_REDIS_URL = (
    os.environ.get('DJANGO_REDIS_URL', '').strip()
    or os.environ.get('REDIS_URL', '').strip()
)
_HAS_REDIS_CLIENT = importlib.util.find_spec("redis") is not None

if DJANGO_REDIS_URL and _HAS_REDIS_CLIENT:
    CACHES = {
        'default': {
            'BACKEND': 'django.core.cache.backends.redis.RedisCache',
            'LOCATION': DJANGO_REDIS_URL,
            'TIMEOUT': None,
        }
    }
    RATE_LIMIT_CACHE_BACKEND = 'redis'
else:
    CACHES = {
        'default': {
            'BACKEND': 'django.core.cache.backends.locmem.LocMemCache',
            'LOCATION': 'mystartup-local-cache',
        }
    }
    RATE_LIMIT_CACHE_BACKEND = 'locmem'

if DJANGO_REDIS_URL:
    CHANNEL_LAYERS = {
        'default': {
            'BACKEND': 'channels_redis.core.RedisChannelLayer',
            'CONFIG': {
                'hosts': [DJANGO_REDIS_URL],
            },
        }
    }
else:
    CHANNEL_LAYERS = {
        'default': {
            'BACKEND': 'channels.layers.InMemoryChannelLayer',
        }
    }

RAZORPAY_KEY_ID = os.environ.get('RAZORPAY_KEY_ID', '').strip()
RAZORPAY_KEY_SECRET = os.environ.get('RAZORPAY_KEY_SECRET', '').strip()
RAZORPAY_WEBHOOK_SECRET = os.environ.get('RAZORPAY_WEBHOOK_SECRET', '').strip()
RAZORPAY_API_BASE_URL = os.environ.get('RAZORPAY_API_BASE_URL', 'https://api.razorpay.com/v1').strip()
RAZORPAY_COMPANY_NAME = os.environ.get('RAZORPAY_COMPANY_NAME', 'ShareVerse').strip() or 'ShareVerse'
RAZORPAY_CURRENCY = os.environ.get('RAZORPAY_CURRENCY', 'INR').strip().upper() or 'INR'
RAZORPAYX_KEY_ID = os.environ.get('RAZORPAYX_KEY_ID', '').strip()
RAZORPAYX_KEY_SECRET = os.environ.get('RAZORPAYX_KEY_SECRET', '').strip()
RAZORPAYX_WEBHOOK_SECRET = os.environ.get('RAZORPAYX_WEBHOOK_SECRET', '').strip()
RAZORPAYX_SOURCE_ACCOUNT_NUMBER = os.environ.get('RAZORPAYX_SOURCE_ACCOUNT_NUMBER', '').strip()
# C7 fix: allowlisting is on by default; retain the legacy env var as fallback.
RAZORPAY_WEBHOOK_IP_ALLOWLIST_ENABLED = _get_env_bool(
    'DJANGO_RAZORPAY_WEBHOOK_IP_ALLOWLIST_ENABLED',
    _get_env_bool('RAZORPAY_WEBHOOK_IP_ALLOWLIST_ENABLED', True),
)
RAZORPAY_WEBHOOK_ALLOWED_IPS = _get_env_list(
    'RAZORPAY_WEBHOOK_ALLOWED_IPS',
    DEFAULT_RAZORPAY_WEBHOOK_ALLOWED_IPS,
)
# IPs of your reverse proxy / load balancer. Leave empty in dev (REMOTE_ADDR is used directly).
AUTH_TRUSTED_PROXY_IPS = _get_env_list('DJANGO_AUTH_TRUSTED_PROXY_IPS', [])

RAZORPAY_WEBHOOK_TRUSTED_PROXY_IPS = _get_env_list(
    'RAZORPAY_WEBHOOK_TRUSTED_PROXY_IPS',
    ['127.0.0.1', '::1'],
)
RAZORPAY_WEBHOOK_PATHS = [
    '/api/payments/razorpay/webhook/',
    '/api/payments/razorpayx/webhook/',
]
API_SECURITY_HEADER_PATH_PREFIXES = ['/api/']
API_CONTENT_SECURITY_POLICY = (
    "default-src 'none'; "
    "frame-ancestors 'none'; "
    "base-uri 'none'; "
    "form-action 'none'"
)
API_SECURITY_HEADERS = {
    'Referrer-Policy': 'no-referrer',
    'X-Content-Type-Options': 'nosniff',
    'Permissions-Policy': 'camera=(), microphone=(), geolocation=(), payment=()',
}

if not DEBUG and not IS_TEST_ENV:
    SECURE_PROXY_SSL_HEADER = ('HTTP_X_FORWARDED_PROTO', 'https')
    USE_X_FORWARDED_HOST = True
    SECURE_SSL_REDIRECT = _get_env_bool('DJANGO_SECURE_SSL_REDIRECT', True)
    SESSION_COOKIE_SECURE = True
    CSRF_COOKIE_SECURE = True
    SECURE_HSTS_SECONDS = int(os.environ.get('DJANGO_SECURE_HSTS_SECONDS', '31536000') or '31536000')
    SECURE_HSTS_INCLUDE_SUBDOMAINS = True
    SECURE_HSTS_PRELOAD = True

# --- Web Push (VAPID) ---
VAPID_PUBLIC_KEY = os.environ.get('VAPID_PUBLIC_KEY', '')
VAPID_PRIVATE_KEY = os.environ.get('VAPID_PRIVATE_KEY', '')
VAPID_CLAIM_EMAIL = os.environ.get('VAPID_CLAIM_EMAIL', 'mailto:officialshareverse@gmail.com')
