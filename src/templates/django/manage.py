#!/usr/bin/env python
"""Comandos de linha do Django para o projeto {{nome}}."""
import os
import sys


def main():
    """Executa tarefas administrativas."""
    os.environ.setdefault('DJANGO_SETTINGS_MODULE', '{{nome_pacote}}.settings')
    try:
        from django.core.management import execute_from_command_line
    except ImportError as exc:
        raise ImportError(
            "Não foi possível importar o Django. Ele está instalado e "
            "disponível no PYTHONPATH? Você ativou a virtualenv?"
        ) from exc
    execute_from_command_line(sys.argv)


if __name__ == '__main__':
    main()
