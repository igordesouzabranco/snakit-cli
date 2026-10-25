// Models: guardam os dados e as regras sobre eles.
// Nesta versão os dados ficam em memória; troque por um banco quando precisar.

const tarefas = [
  { id: 1, titulo: 'Estudar {{nome}}', feita: false },
];

export function listar() {
  return tarefas;
}

export function salvar(titulo) {
  const tarefa = { id: tarefas.length + 1, titulo, feita: false };
  tarefas.push(tarefa);
  return tarefa;
}
