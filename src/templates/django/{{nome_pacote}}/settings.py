"""Configurações do projeto Django {{nome}}."""
import os
from pathlib import Path

BASE_DIR = Path(__file__).resolve().parent.parent

# Em produção, defina DJANGO_SECRET_KEY no ambiente. O padrão serve só
# para desenvolvimento local.
SECRET_KEY = os.environ.get(
    'DJANGO_SECRET_KEY',
    'chave-padrao-so-para-desenvolvimento',
)

DEBUG = os.environ.get('DJANGO_DEBUG', '1') == '1'

ALLOWED_HOSTS = [
    h.strip()
    for h in os.environ.get('DJANGO_ALLOWED_HOSTS', 'localhost,127.0.0.1').split(',')
    if h.strip()
]

INSTALLED_APPS = [
    'django.contrib.contenttypes',
    'django.contrib.staticfiles',
]

MIDDLEWARE = []

ROOT_URLCONF = '{{nome_pacote}}.urls'

TEMPLATES = []

WSGI_APPLICATION = '{{nome_pacote}}.wsgi.application'

DATABASES = {
    'default': {
        'ENGINE': 'django.db.backends.sqlite3',
        'NAME': BASE_DIR / 'db.sqlite3',
    }
}

STATIC_URL = 'static/'

DEFAULT_AUTO_FIELD = 'django.db.models.BigAutoField'
