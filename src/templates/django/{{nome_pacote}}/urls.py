"""Rotas do projeto Django {{nome}}."""
from django.http import JsonResponse
from django.urls import path


def indice(request):
    """Página inicial: só um JSON de resposta."""
    return JsonResponse({'mensagem': 'Projeto {{nome}} no ar'})


urlpatterns = [
    path('', indice, name='indice'),
]
