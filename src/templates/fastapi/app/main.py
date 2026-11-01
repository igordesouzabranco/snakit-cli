"""API FastAPI do projeto {{nome}}."""
from fastapi import FastAPI

app = FastAPI(title='API {{nome}}')


@app.get('/')
async def raiz():
    """Rota raiz."""
    return {'mensagem': 'API {{nome}} no ar'}


@app.get('/saude')
async def saude():
    """Rota de saúde para monitoramento."""
    return {'status': 'ok'}
