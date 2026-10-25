// Rotas: decidem o caminho da URL e chamam o controller.
// Não guardam regra de negócio nem acessam dados diretamente.

import { Router } from 'express';
import { listarTarefas, criarTarefa } from '../controllers/taskController.js';

const router = Router();

router.get('/', listarTarefas);
router.post('/', criarTarefa);

export default router;
