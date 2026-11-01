# {{nome}}

Projeto Django criado com [snakit](https://www.npmjs.com/package/snakit).

## Como rodar

```bash
# 1. virtualenv (recomendado)
python -m venv .venv
source .venv/bin/activate        # Windows: .venv\Scripts\activate

# 2. dependências
pip install -r requirements.txt

# 3. servidor de desenvolvimento
python manage.py runserver
```

A rota `http://127.0.0.1:8000/` devolve `{"mensagem": "Projeto {{nome}} no ar"}`.

## Variáveis de ambiente

| Variável | Padrão | O que faz |
| --- | --- | --- |
| `DJANGO_SECRET_KEY` | chave só de dev | chave secreta do Django |
| `DJANGO_DEBUG` | `1` | liga/desliga o modo debug |
| `DJANGO_ALLOWED_HOSTS` | `localhost,127.0.0.1` | hosts aceitos (separados por vírgula) |
