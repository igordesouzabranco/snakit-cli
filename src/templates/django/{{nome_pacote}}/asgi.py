"""Entrada ASGI do projeto Django {{nome}}."""
import os

from django.core.asgi import get_asgi_application

os.environ.setdefault('DJANGO_SETTINGS_MODULE', '{{nome_pacote}}.settings')

application = get_asgi_application()
