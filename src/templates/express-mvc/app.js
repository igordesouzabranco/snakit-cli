// Ponto de entrada da API {{nome}}.
// Camada de composição: aqui só montamos as peças, sem regra de negócio.

import express from 'express';
import tasksRouter from './routes/tasks.js';

const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.json());
app.use('/tasks', tasksRouter);

app.get('/', (req, res) => {
  res.json({ mensagem: 'API {{nome}} no ar. Rota útil: /tasks' });
});

app.listen(PORT, () => {
  console.log(`API {{nome}} rodando em http://localhost:${PORT}`);
});
