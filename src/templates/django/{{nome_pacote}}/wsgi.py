"""Entrada WSGI do projeto Django {{nome}}."""
import os

from django.core.wsgi import get_wsgi_application

os.environ.setdefault('DJANGO_SETTINGS_MODULE', '{{nome_pacote}}.settings')

application = get_wsgi_application()
