import express from 'express';

const app = express();
const port = 3000;

app.get('/', (_req, res) => {
  res.send('API {{nome}}');
});

app.listen(port, () => {
  console.log(`Servidor rodando em http://localhost:${port}`);
});
