import assert from 'node:assert/strict'
import type { AddressInfo } from 'node:net'
import { after, before, test } from 'node:test'

process.env.NODE_ENV = 'test'

const { criarApp } = await import('../src/app.ts')
const { config } = await import('../src/config.ts')
const { criarRepositoriosEmMemoria } = await import('../src/repositories/memory/index.ts')

/*
  Cenários de teste previstos na proposta: login válido e inválido, QR Code
  válido, inválido e expirado, geolocalização válida e inválida, registro
  duplicado e consulta posterior dos registros.
*/

const SALA = { latitude: -28.6775, longitude: -49.3697 }
const LONGE = { latitude: -28.68, longitude: -49.3697 } // ~280 m da sala

let base = ''
let servidor: ReturnType<ReturnType<typeof criarApp>['listen']>

async function api(caminho: string, opcoes: { token?: string; corpo?: unknown; metodo?: string } = {}) {
  const resposta = await fetch(`${base}${caminho}`, {
    method: opcoes.metodo ?? (opcoes.corpo ? 'POST' : 'GET'),
    headers: {
      'Content-Type': 'application/json',
      ...(opcoes.token ? { Authorization: `Bearer ${opcoes.token}` } : {}),
    },
    body: opcoes.corpo ? JSON.stringify(opcoes.corpo) : undefined,
  })
  return { status: resposta.status, corpo: await resposta.json() }
}

async function login(email: string, senha = '123456') {
  const { corpo } = await api('/auth/login', { corpo: { email, senha } })
  return corpo.token as string
}

before(async () => {
  servidor = criarApp(criarRepositoriosEmMemoria()).listen(0)
  await new Promise((resolve) => servidor.once('listening', resolve))
  base = `http://localhost:${(servidor.address() as AddressInfo).port}/api`
})

after(() => {
  servidor.close()
})

test('login válido devolve token e dados do professor', async () => {
  const { status, corpo } = await api('/auth/login', { corpo: { email: 'professor@unesc.br', senha: '123456' } })
  assert.equal(status, 200)
  assert.equal(corpo.usuario.perfil, 'PROFESSOR')
  assert.ok(corpo.token)
  assert.equal(corpo.usuario.senhaHash, undefined)
})

test('login inválido é recusado', async () => {
  const { status, corpo } = await api('/auth/login', { corpo: { email: 'professor@unesc.br', senha: 'errada' } })
  assert.equal(status, 401)
  assert.equal(corpo.erro.codigo, 'NAO_AUTENTICADO')
})

test('rotas protegidas exigem token e respeitam o perfil', async () => {
  assert.equal((await api('/turmas')).status, 401)
  assert.equal((await api('/turmas', { token: await login('aluno1@unesc.net') })).status, 403)
  assert.equal((await api('/alunos/me/presencas', { token: await login('professor@unesc.br') })).status, 403)
})

test('fluxo completo da chamada', async (t) => {
  const professor = await login('professor@unesc.br')
  const aluno1 = await login('aluno1@unesc.net') // matriculado na turma 1
  const aluno2 = await login('aluno2@unesc.net') // matriculado na turma 1
  const aluno9 = await login('aluno9@unesc.net') // não matriculado na turma 1

  const inicio = await api('/chamadas', { token: professor, corpo: { turmaId: 1, ...SALA } })
  assert.equal(inicio.status, 201)
  const chamada = inicio.corpo.chamada
  assert.equal(chamada.raioMetros, 20)
  assert.equal(chamada.totalAlunos, 8)
  assert.ok(chamada.qr.validoPorMs <= config.qrValidadeMs)

  const qr = () => ({ chamadaId: chamada.id, token: chamada.qr.token })

  await t.test('não permite duas chamadas abertas', async () => {
    const { status, corpo } = await api('/chamadas', { token: professor, corpo: { turmaId: 2, ...SALA } })
    assert.equal(status, 409)
    assert.equal(corpo.erro.codigo, 'CHAMADA_EM_ANDAMENTO')
  })

  await t.test('QR Code inválido é recusado', async () => {
    const { status, corpo } = await api('/presencas', { token: aluno1, corpo: { ...qr(), token: 'token-falso', ...SALA } })
    assert.equal(status, 400)
    assert.equal(corpo.erro.codigo, 'QR_INVALIDO')
  })

  await t.test('localização fora do raio de 20 m é recusada', async () => {
    const { status, corpo } = await api('/presencas', { token: aluno1, corpo: { ...qr(), ...LONGE } })
    assert.equal(status, 422)
    assert.equal(corpo.erro.codigo, 'FORA_DO_RAIO')
  })

  await t.test('aluno de outra turma é recusado', async () => {
    const { status } = await api('/presencas', { token: aluno9, corpo: { ...qr(), ...SALA } })
    assert.equal(status, 403)
  })

  await t.test('QR Code e localização válidos registram a presença', async () => {
    const { status, corpo } = await api('/presencas', { token: aluno1, corpo: { ...qr(), ...SALA } })
    assert.equal(status, 201)
    assert.equal(corpo.distanciaMetros, 0)
  })

  await t.test('registro duplicado é recusado', async () => {
    const { status, corpo } = await api('/presencas', { token: aluno1, corpo: { ...qr(), ...SALA } })
    assert.equal(status, 409)
    assert.equal(corpo.erro.codigo, 'PRESENCA_DUPLICADA')
  })

  await t.test('QR Code expirado é recusado', async () => {
    t.mock.timers.enable({ apis: ['Date'], now: Date.now() + config.qrValidadeMs + 1000 })
    const { status, corpo } = await api('/presencas', { token: aluno2, corpo: { ...qr(), ...SALA } })
    t.mock.timers.reset()
    assert.equal(status, 400)
    assert.equal(corpo.erro.codigo, 'QR_EXPIRADO')
  })

  await t.test('professor registra presença manualmente', async () => {
    const { status, corpo } = await api(`/chamadas/${chamada.id}/presencas/manual`, { token: professor, corpo: { alunoId: 2 } })
    assert.equal(status, 201)
    assert.equal(corpo.chamada.totalPresentes, 2)
    assert.equal(corpo.registros.filter((registro: { status: string }) => registro.status === 'PENDENTE').length, 6)
  })

  await t.test('encerrar a chamada transforma pendentes em ausentes', async () => {
    const encerrada = await api(`/chamadas/${chamada.id}/encerrar`, { token: professor, metodo: 'POST' })
    assert.equal(encerrada.status, 200)
    assert.ok(encerrada.corpo.encerradaEm)
    assert.equal((await api('/chamadas/ativa', { token: professor })).corpo.chamada, null)

    const { corpo: registros } = await api('/presencas', { token: professor })
    const daChamada = registros.filter((registro: { chamadaId: string }) => registro.chamadaId === chamada.id)
    assert.equal(daChamada.length, 8)
    assert.equal(daChamada.filter((registro: { status: string }) => registro.status === 'PRESENTE').length, 2)
    assert.equal(daChamada.filter((registro: { status: string }) => registro.status === 'AUSENTE').length, 6)
  })

  await t.test('presença após o encerramento é recusada', async () => {
    const { status, corpo } = await api('/presencas', { token: aluno2, corpo: { ...qr(), ...SALA } })
    assert.equal(status, 409)
    assert.equal(corpo.erro.codigo, 'CHAMADA_ENCERRADA')
  })

  await t.test('consulta posterior: frequência da turma e histórico do aluno', async () => {
    const { corpo: frequencia } = await api('/turmas/1/frequencia', { token: professor })
    const ana = frequencia.find((item: { alunoId: number }) => item.alunoId === 1)
    assert.deepEqual([ana.totalAulas, ana.presencas, ana.percentualPresenca], [2, 2, 100])

    const { corpo: historico } = await api('/alunos/me/presencas', { token: aluno1 })
    assert.ok(historico.registros.some((registro: { chamadaId: string; status: string }) =>
      registro.chamadaId === chamada.id && registro.status === 'PRESENTE'))
  })
})
