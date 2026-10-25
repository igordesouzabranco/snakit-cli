// Controllers: traduzem a requisição em chamadas ao model e a resposta.
// Aqui mora a coordenação, não a regra de negócio.

import { listar, salvar } from '../models/taskModel.js';

export function listarTarefas(req, res) {
  res.json(listar());
}

export function criarTarefa(req, res) {
  if (!req.body || !req.body.titulo) {
    return res.status(400).json({ erro: 'Informe o campo "titulo".' });
  }

  const tarefa = salvar(req.body.titulo);
  return res.status(201).json(tarefa);
}
