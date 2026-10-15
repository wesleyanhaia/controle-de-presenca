import assert from 'node:assert/strict'
import type { AddressInfo } from 'node:net'
import { after, before, test } from 'node:test'

process.env.NODE_ENV = 'test'

const { criarApp } = await import('../src/app.ts')
const { config } = await import('../src/config.ts')
const { criarRepositoriosEmMemoria } = await import('../src/repositories/memory/index.ts')
const { criarPool, criarRepositoriosPostgres } = await import('../src/repositories/postgres/index.ts')
const { prepararBanco } = await import('../src/repositories/postgres/setup.ts')

/*
  Cenários de teste previstos na proposta: login válido e inválido, QR Code
  válido, inválido e expirado, geolocalização válida e inválida, registro
  duplicado e consulta posterior dos registros. Também cobre os cadastros (CRUD).

  Sem TEST_DATABASE_URL os testes usam o repositório em memória. Com ela
  (no ambiente ou no .env), usam o PostgreSQL: o banco informado é APAGADO e
  recriado com os dados de demonstração, então use um banco só para testes.
*/

const bancoDeTeste = process.env.TEST_DATABASE_URL
if (bancoDeTeste && bancoDeTeste === process.env.DATABASE_URL) {
  throw new Error('TEST_DATABASE_URL deve apontar para um banco diferente de DATABASE_URL: ele é apagado nos testes.')
}

const SALA = { latitude: -28.6775, longitude: -49.3697 }
const LONGE = { latitude: -28.68, longitude: -49.3697 } // ~280 m da sala

let base = ''
let servidor: ReturnType<ReturnType<typeof criarApp>['listen']>
let repositorios: ReturnType<typeof criarRepositoriosEmMemoria>

async function api(caminho: string, opcoes: { token?: string; corpo?: unknown; metodo?: string } = {}) {
  const resposta = await fetch(`${base}${caminho}`, {
    method: opcoes.metodo ?? (opcoes.corpo ? 'POST' : 'GET'),
    headers: {
      'Content-Type': 'application/json',
      ...(opcoes.token ? { Authorization: `Bearer ${opcoes.token}` } : {}),
    },
    body: opcoes.corpo ? JSON.stringify(opcoes.corpo) : undefined,
  })
  const texto = await resposta.text() // 204 (exclusões) vem sem corpo
  return { status: resposta.status, corpo: texto ? JSON.parse(texto) : null }
}

async function login(email: string, senha = email.endsWith('@unesc.net') ? '123' : '123456') {
  const { corpo } = await api('/auth/login', { corpo: { email, senha } })
  return corpo.token as string
}

before(async () => {
  if (bancoDeTeste) {
    await prepararBanco(bancoDeTeste, { recriar: true })
    repositorios = criarRepositoriosPostgres(criarPool(bancoDeTeste))
  } else {
    repositorios = criarRepositoriosEmMemoria()
  }
  servidor = criarApp(repositorios).listen(0)
  await new Promise((resolve) => servidor.once('listening', resolve))
  base = `http://localhost:${(servidor.address() as AddressInfo).port}/api`
})

after(async () => {
  servidor.close()
  await repositorios.encerrar()
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

test('aluno entra no aplicativo com matrícula e senha', async () => {
  const valido = await api('/auth/login/aluno', { corpo: { matricula: '1', senha: '123' } })
  assert.equal(valido.status, 200)
  assert.equal(valido.corpo.usuario.perfil, 'ALUNO')
  assert.equal(valido.corpo.usuario.matricula, '1')

  const senhaErrada = await api('/auth/login/aluno', { corpo: { matricula: '1', senha: 'errada' } })
  assert.equal(senhaErrada.status, 401)
  // A matrícula de aluno não serve para entrar como professor, nem o contrário.
  assert.equal((await api('/auth/login/aluno', { corpo: { matricula: 'professor@unesc.br', senha: '123' } })).status, 401)
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
    assert.deepEqual([ana.totalAulas, ana.presencas, ana.percentualPresenca], [1, 1, 100])

    const { corpo: historico } = await api('/alunos/me/presencas', { token: aluno1 })
    assert.ok(historico.registros.some((registro: { chamadaId: string; status: string }) =>
      registro.chamadaId === chamada.id && registro.status === 'PRESENTE'))
  })
})

test('tentativas de registro alimentam o relatório de avaliação', async () => {
  const professor = await login('professor@unesc.br')
  const { corpo } = await api('/relatorios/tentativas', { token: professor })
  // Do fluxo completo: QR inválido, fora do raio, sem permissão, registrada, duplicada, expirado e após o encerramento.
  assert.deepEqual(corpo.porResultado, {
    QR_INVALIDO: 1,
    FORA_DO_RAIO: 1,
    SEM_PERMISSAO: 1,
    REGISTRADA: 1,
    PRESENCA_DUPLICADA: 1,
    QR_EXPIRADO: 1,
    CHAMADA_ENCERRADA: 1,
  })
  assert.deepEqual([corpo.total, corpo.aceitas, corpo.percentualSucesso], [7, 1, 14])
})

test('CRUD de alunos', async () => {
  const professor = await login('professor@unesc.br')
  const novo = { nome: 'Novo Aluno', matricula: '20249999', email: 'novo@unesc.net', senha: 'segredo1' }

  const criado = await api('/alunos', { token: professor, corpo: novo })
  assert.equal(criado.status, 201)
  assert.equal(criado.corpo.senhaHash, undefined)
  const id = criado.corpo.id

  const duplicado = await api('/alunos', { token: professor, corpo: { ...novo, email: 'outro@unesc.net' } })
  assert.equal(duplicado.corpo.erro.codigo, 'CADASTRO_DUPLICADO')
  const emailDeProfessor = await api('/alunos', { token: professor, corpo: { ...novo, matricula: '1', email: 'professor@unesc.br' } })
  assert.equal(emailDeProfessor.status, 409)
  const emailInvalido = await api('/alunos', { token: professor, corpo: { ...novo, email: 'sem-arroba' } })
  assert.equal(emailInvalido.corpo.erro.codigo, 'DADOS_INVALIDOS')

  const busca = await api('/alunos?busca=20249999', { token: professor })
  assert.deepEqual(busca.corpo.map((aluno: { id: number }) => aluno.id), [id])

  const alterado = await api(`/alunos/${id}`, { token: professor, metodo: 'PUT', corpo: { nome: 'Nome Alterado', senha: 'nova-senha' } })
  assert.equal(alterado.status, 200)
  assert.equal(alterado.corpo.nome, 'Nome Alterado')
  assert.equal(alterado.corpo.matricula, '20249999')
  assert.ok(await login('novo@unesc.net', 'nova-senha'))

  assert.equal((await api(`/alunos/${id}`, { token: professor, metodo: 'DELETE' })).status, 204)
  assert.equal((await api(`/alunos/${id}`, { token: professor })).status, 404)

  // Aluno com presenças registradas não pode ser excluído.
  const comPresencas = await api('/alunos/1', { token: professor, metodo: 'DELETE' })
  assert.equal(comPresencas.status, 409)
  assert.equal(comPresencas.corpo.erro.codigo, 'POSSUI_VINCULOS')
})

test('CRUD de turmas e matrículas', async () => {
  const professor = await login('professor@unesc.br')
  const nova = { codigo: 'CCO-999', nome: 'Turma de teste', disciplina: 'Testes', semestre: '2026/2', local: 'Sala 1' }

  const criada = await api('/turmas', { token: professor, corpo: nova })
  assert.equal(criada.status, 201)
  assert.equal(criada.corpo.quantidadeAlunos, 0)
  const id = criada.corpo.id

  assert.equal((await api('/turmas', { token: professor, corpo: nova })).corpo.erro.codigo, 'CADASTRO_DUPLICADO')

  const alterada = await api(`/turmas/${id}`, { token: professor, metodo: 'PUT', corpo: { disciplina: 'Testes de Software' } })
  assert.equal(alterada.corpo.disciplina, 'Testes de Software')
  assert.equal(alterada.corpo.local, 'Sala 1')

  const matriculados = await api(`/turmas/${id}/alunos`, { token: professor, corpo: { alunoId: 3 } })
  assert.equal(matriculados.status, 201)
  assert.deepEqual(matriculados.corpo.map((aluno: { id: number }) => aluno.id), [3])
  assert.equal((await api(`/turmas/${id}/alunos`, { token: professor, corpo: { alunoId: 999 } })).status, 404)

  const aluno3 = await login('aluno3@unesc.net')
  const { corpo: historico } = await api('/alunos/me/presencas', { token: aluno3 })
  assert.ok(historico.turmas.some((turma: { id: number }) => turma.id === id))

  assert.equal((await api(`/turmas/${id}/alunos/3`, { token: professor, metodo: 'DELETE' })).status, 204)
  assert.equal((await api(`/turmas/${id}/alunos/3`, { token: professor, metodo: 'DELETE' })).status, 404)

  // Turma com chamadas não pode ser excluída; a recém-criada pode.
  assert.equal((await api('/turmas/1', { token: professor, metodo: 'DELETE' })).corpo.erro.codigo, 'POSSUI_VINCULOS')
  assert.equal((await api(`/turmas/${id}`, { token: professor, metodo: 'DELETE' })).status, 204)
  assert.equal((await api(`/turmas/${id}`, { token: professor })).status, 404)
})

test('CRUD de professores', async () => {
  const professor = await login('professor@unesc.br')
  const criado = await api('/professores', { token: professor, corpo: { nome: 'Colega', email: 'colega@unesc.br', senha: '123456' } })
  assert.equal(criado.status, 201)
  const id = criado.corpo.id

  assert.equal((await api('/professores', { token: professor })).corpo.length, 2)
  // Só o próprio cadastro pode ser alterado.
  assert.equal((await api(`/professores/${id}`, { token: professor, metodo: 'PUT', corpo: { nome: 'X' } })).status, 403)

  const colega = await login('colega@unesc.br')
  const alterado = await api(`/professores/${id}`, { token: colega, metodo: 'PUT', corpo: { nome: 'Colega Alterado' } })
  assert.equal(alterado.corpo.nome, 'Colega Alterado')

  assert.equal((await api('/professores/1', { token: colega, metodo: 'DELETE' })).corpo.erro.codigo, 'POSSUI_VINCULOS')
  assert.equal((await api(`/professores/${id}`, { token: professor, metodo: 'DELETE' })).status, 204)
})

test('professor remove presença e exclui chamada aberta por engano', async () => {
  const professor = await login('professor@unesc.br')
  const { corpo } = await api('/chamadas', { token: professor, corpo: { turmaId: 4, ...SALA } })
  const chamadaId = corpo.chamada.id

  await api(`/chamadas/${chamadaId}/presencas/manual`, { token: professor, corpo: { alunoId: 2 } })
  const removida = await api(`/chamadas/${chamadaId}/presencas/2`, { token: professor, metodo: 'DELETE' })
  assert.equal(removida.status, 200)
  assert.equal(removida.corpo.chamada.totalPresentes, 0)
  assert.equal((await api(`/chamadas/${chamadaId}/presencas/2`, { token: professor, metodo: 'DELETE' })).status, 404)

  assert.equal((await api(`/chamadas/${chamadaId}`, { token: professor, metodo: 'DELETE' })).status, 204)
  assert.equal((await api('/chamadas/ativa', { token: professor })).corpo.chamada, null)
  assert.equal((await api('/chamadas/nao-existe', { token: professor, metodo: 'DELETE' })).status, 404)
})
