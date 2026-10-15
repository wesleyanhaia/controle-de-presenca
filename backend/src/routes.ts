import { Router } from 'express'
import { z } from 'zod'
import { autenticar, usuarioDa } from './middlewares/auth.ts'
import type { AuthService } from './services/auth.ts'
import type { CadastroService } from './services/cadastros.ts'
import type { PresencaService } from './services/presencas.ts'

const latitude = z.number({ error: 'Informe a latitude.' }).min(-90, 'Latitude inválida.').max(90, 'Latitude inválida.')
const longitude = z.number({ error: 'Informe a longitude.' }).min(-180, 'Longitude inválida.').max(180, 'Longitude inválida.')
const idNumerico = z.coerce.number({ error: 'Identificador inválido.' }).int().positive()

const loginSchema = z.object({
  email: z.string({ error: 'Informe o e-mail.' }).trim().min(1, 'Informe o e-mail.'),
  senha: z.string({ error: 'Informe a senha.' }).min(1, 'Informe a senha.'),
})

const loginAlunoSchema = z.object({
  matricula: z.string({ error: 'Informe a matrícula.' }).trim().min(1, 'Informe a matrícula.'),
  senha: z.string({ error: 'Informe a senha.' }).min(1, 'Informe a senha.'),
})

const novaChamadaSchema = z.object({
  turmaId: z.number({ error: 'Selecione uma turma.' }).int().positive(),
  latitude,
  longitude,
})

const presencaManualSchema = z.object({
  alunoId: z.number({ error: 'Selecione um aluno.' }).int().positive(),
})

const texto = (campo: string) =>
  z.string({ error: `Informe ${campo}.` }).trim().min(1, `Informe ${campo}.`).max(200, `${campo} muito longo.`)
const email = z.string({ error: 'Informe o e-mail.' }).trim().toLowerCase().pipe(z.email('E-mail inválido.'))
const senha = z.string({ error: 'Informe a senha.' }).min(6, 'A senha deve ter ao menos 6 caracteres.').max(72, 'Senha muito longa.')

const professorSchema = z.object({ nome: texto('o nome'), email, senha })
const alunoSchema = z.object({ nome: texto('o nome'), matricula: texto('a matrícula'), email, senha })
const turmaSchema = z.object({
  codigo: texto('o código'),
  nome: texto('o nome'),
  disciplina: texto('a disciplina'),
  semestre: texto('o semestre'),
  local: z.string().trim().max(200, 'Local muito longo.').optional(),
  latitude: latitude.nullable().optional(),
  longitude: longitude.nullable().optional(),
})
const matriculaSchema = z.object({
  alunoId: z.number({ error: 'Selecione um aluno.' }).int().positive(),
})

const novaPresencaSchema = z.object({
  chamadaId: z.string({ error: 'QR Code inválido.' }).min(1, 'QR Code inválido.'),
  token: z.string({ error: 'QR Code inválido.' }).min(1, 'QR Code inválido.'),
  latitude,
  longitude,
})

export function criarRotas(auth: AuthService, cadastros: CadastroService, presencas: PresencaService) {
  const rotas = Router()
  const professor = autenticar(auth, 'PROFESSOR')
  const aluno = autenticar(auth, 'ALUNO')

  rotas.get('/health', (_req, res) => {
    res.json({ status: 'ok' })
  })

  // ---------- Autenticação (professor e aluno) ----------

  rotas.post('/auth/login', async (req, res) => {
    const { email, senha } = loginSchema.parse(req.body)
    res.json(await auth.login(email, senha))
  })

  rotas.post('/auth/login/aluno', async (req, res) => {
    const { matricula, senha } = loginAlunoSchema.parse(req.body)
    res.json(await auth.loginAluno(matricula, senha))
  })

  rotas.get('/auth/me', autenticar(auth), async (_req, res) => {
    res.json(await auth.usuarioAtual(usuarioDa(res)))
  })

  // ---------- Aplicação web do professor ----------

  // Professores
  rotas.get('/professores', professor, async (_req, res) => {
    res.json(await cadastros.listarProfessores())
  })

  rotas.get('/professores/:id', professor, async (req, res) => {
    res.json(await cadastros.buscarProfessor(idNumerico.parse(req.params.id)))
  })

  rotas.post('/professores', professor, async (req, res) => {
    res.status(201).json(await cadastros.criarProfessor(professorSchema.parse(req.body)))
  })

  rotas.put('/professores/:id', professor, async (req, res) => {
    const dados = professorSchema.partial().parse(req.body)
    res.json(await cadastros.atualizarProfessor(idNumerico.parse(req.params.id), usuarioDa(res).id, dados))
  })

  rotas.delete('/professores/:id', professor, async (req, res) => {
    await cadastros.excluirProfessor(idNumerico.parse(req.params.id), usuarioDa(res).id)
    res.status(204).end()
  })

  // Alunos
  rotas.get('/alunos', professor, async (req, res) => {
    res.json(await cadastros.listarAlunos(typeof req.query.busca === 'string' ? req.query.busca : undefined))
  })

  rotas.get('/alunos/:id', professor, async (req, res) => {
    res.json(await cadastros.buscarAluno(idNumerico.parse(req.params.id)))
  })

  rotas.post('/alunos', professor, async (req, res) => {
    res.status(201).json(await cadastros.criarAluno(alunoSchema.parse(req.body)))
  })

  rotas.put('/alunos/:id', professor, async (req, res) => {
    res.json(await cadastros.atualizarAluno(idNumerico.parse(req.params.id), alunoSchema.partial().parse(req.body)))
  })

  rotas.delete('/alunos/:id', professor, async (req, res) => {
    await cadastros.excluirAluno(idNumerico.parse(req.params.id))
    res.status(204).end()
  })

  // Turmas do professor e matrículas
  rotas.get('/turmas', professor, async (_req, res) => {
    res.json(await cadastros.listarTurmas(usuarioDa(res).id))
  })

  rotas.get('/turmas/:id', professor, async (req, res) => {
    res.json(await cadastros.buscarTurma(idNumerico.parse(req.params.id), usuarioDa(res).id))
  })

  rotas.post('/turmas', professor, async (req, res) => {
    res.status(201).json(await cadastros.criarTurma(usuarioDa(res).id, turmaSchema.parse(req.body)))
  })

  rotas.put('/turmas/:id', professor, async (req, res) => {
    const dados = turmaSchema.partial().parse(req.body)
    res.json(await cadastros.atualizarTurma(idNumerico.parse(req.params.id), usuarioDa(res).id, dados))
  })

  rotas.delete('/turmas/:id', professor, async (req, res) => {
    await cadastros.excluirTurma(idNumerico.parse(req.params.id), usuarioDa(res).id)
    res.status(204).end()
  })

  rotas.get('/turmas/:id/alunos', professor, async (req, res) => {
    res.json(await cadastros.listarAlunosDaTurma(idNumerico.parse(req.params.id), usuarioDa(res).id))
  })

  rotas.post('/turmas/:id/alunos', professor, async (req, res) => {
    const { alunoId } = matriculaSchema.parse(req.body)
    res.status(201).json(await cadastros.matricularAluno(idNumerico.parse(req.params.id), usuarioDa(res).id, alunoId))
  })

  rotas.delete('/turmas/:id/alunos/:alunoId', professor, async (req, res) => {
    await cadastros.desmatricularAluno(idNumerico.parse(req.params.id), usuarioDa(res).id, idNumerico.parse(req.params.alunoId))
    res.status(204).end()
  })

  rotas.get('/turmas/:id/frequencia', professor, async (req, res) => {
    res.json(await presencas.frequenciaDaTurma(idNumerico.parse(req.params.id), usuarioDa(res).id))
  })

  rotas.get('/chamadas', professor, async (_req, res) => {
    res.json(await presencas.listarChamadas(usuarioDa(res).id))
  })

  rotas.get('/chamadas/ativa', professor, async (_req, res) => {
    res.json(await presencas.chamadaAtiva(usuarioDa(res).id))
  })

  rotas.post('/chamadas', professor, async (req, res) => {
    const dados = novaChamadaSchema.parse(req.body)
    res.status(201).json(
      await presencas.iniciarChamada(usuarioDa(res).id, dados.turmaId, dados.latitude, dados.longitude),
    )
  })

  rotas.post('/chamadas/:id/encerrar', professor, async (req, res) => {
    res.json(await presencas.encerrarChamada(String(req.params.id), usuarioDa(res).id))
  })

  rotas.post('/chamadas/:id/presencas/manual', professor, async (req, res) => {
    const { alunoId } = presencaManualSchema.parse(req.body)
    await presencas.registrarPresencaManual(String(req.params.id), usuarioDa(res).id, alunoId)
    res.status(201).json(await presencas.chamadaAtiva(usuarioDa(res).id))
  })

  rotas.delete('/chamadas/:id', professor, async (req, res) => {
    await presencas.excluirChamada(String(req.params.id), usuarioDa(res).id)
    res.status(204).end()
  })

  rotas.delete('/chamadas/:id/presencas/:alunoId', professor, async (req, res) => {
    await presencas.removerPresenca(String(req.params.id), usuarioDa(res).id, idNumerico.parse(req.params.alunoId))
    res.json(await presencas.chamadaAtiva(usuarioDa(res).id))
  })

  rotas.get('/relatorios/tentativas', professor, async (_req, res) => {
    res.json(await presencas.relatorioDeTentativas(usuarioDa(res).id))
  })

  rotas.get('/presencas', professor, async (_req, res) => {
    res.json(await presencas.listarRegistros(usuarioDa(res).id))
  })

  // ---------- Aplicativo do aluno ----------

  rotas.post('/presencas', aluno, async (req, res) => {
    const dados = novaPresencaSchema.parse(req.body)
    res.status(201).json(await presencas.registrarPresenca(usuarioDa(res).id, dados))
  })

  rotas.get('/alunos/me/presencas', aluno, async (_req, res) => {
    res.json(await presencas.historicoDoAluno(usuarioDa(res).id))
  })

  return rotas
}
