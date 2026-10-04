import { Router } from 'express'
import { z } from 'zod'
import { autenticar, usuarioDa } from './middlewares/auth.ts'
import type { AuthService } from './services/auth.ts'
import type { PresencaService } from './services/presencas.ts'

const latitude = z.number({ error: 'Informe a latitude.' }).min(-90, 'Latitude inválida.').max(90, 'Latitude inválida.')
const longitude = z.number({ error: 'Informe a longitude.' }).min(-180, 'Longitude inválida.').max(180, 'Longitude inválida.')
const idNumerico = z.coerce.number({ error: 'Identificador inválido.' }).int().positive()

const loginSchema = z.object({
  email: z.string({ error: 'Informe o e-mail.' }).trim().min(1, 'Informe o e-mail.'),
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

const novaPresencaSchema = z.object({
  chamadaId: z.string({ error: 'QR Code inválido.' }).min(1, 'QR Code inválido.'),
  token: z.string({ error: 'QR Code inválido.' }).min(1, 'QR Code inválido.'),
  latitude,
  longitude,
})

export function criarRotas(auth: AuthService, presencas: PresencaService) {
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

  rotas.get('/auth/me', autenticar(auth), async (_req, res) => {
    res.json(await auth.usuarioAtual(usuarioDa(res)))
  })

  // ---------- Aplicação web do professor ----------

  rotas.get('/turmas', professor, async (_req, res) => {
    res.json(await presencas.listarTurmas(usuarioDa(res).id))
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
