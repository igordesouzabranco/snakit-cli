# {{nome}}

API FastAPI criada com [snakit](https://www.npmjs.com/package/snakit).

## Como rodar

```bash
# 1. virtualenv (recomendado)
python -m venv .venv
source .venv/bin/activate        # Windows: .venv\Scripts\activate

# 2. dependências
pip install -r requirements.txt

# 3. servidor de desenvolvimento
uvicorn app.main:app --reload
```

Rotas:

- `GET /` — `{"mensagem": "API {{nome}} no ar"}`
- `GET /saude` — `{"status": "ok"}`
- Documentação interativa em `http://127.0.0.1:8000/docs`
