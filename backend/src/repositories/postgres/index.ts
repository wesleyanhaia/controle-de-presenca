import pg from 'pg'
import type { Aluno, Chamada, Presenca, Professor, ResultadoTentativa, Turma } from '../../domain/types.ts'
import { ErroDeDuplicidade, ErroDeVinculo, type Repositorios } from '../contracts.ts'

/*
  Repositórios PostgreSQL (driver "pg"). As tabelas são criadas por
  database/schema.sql (npm run db:setup).

  Unicidade e vínculos são garantidos pelo banco: os erros 23505 (unique) e
  23001/23503 (chave estrangeira) viram ErroDeDuplicidade e ErroDeVinculo.
*/

const UNIQUE_VIOLATION = '23505'
// ON DELETE RESTRICT gera 23001; NO ACTION (padrão) gera 23503.
const VINCULOS = new Set(['23001', '23503'])

// O id da chamada vem do QR Code lido pelo aluno; um texto que não é UUID
// faria o PostgreSQL rejeitar a consulta em vez de simplesmente não achar nada.
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
const ehUuid = (id: string) => UUID.test(id)

type Linha = Record<string, unknown>

const iso = (valor: unknown) => (valor as Date).toISOString()
const isoOuNulo = (valor: unknown) => (valor == null ? null : iso(valor))

function paraProfessor(linha: Linha): Professor {
  return {
    id: linha.id as number,
    nome: linha.nome as string,
    email: linha.email as string,
    senhaHash: linha.senha_hash as string,
  }
}

function paraAluno(linha: Linha): Aluno {
  return {
    id: linha.id as number,
    nome: linha.nome as string,
    matricula: linha.matricula as string,
    email: linha.email as string,
    senhaHash: linha.senha_hash as string,
  }
}

function paraTurma(linha: Linha): Turma {
  return {
    id: linha.id as number,
    professorId: linha.professor_id as number,
    codigo: linha.codigo as string,
    nome: linha.nome as string,
    disciplina: linha.disciplina as string,
    semestre: linha.semestre as string,
    local: linha.local as string,
    latitude: linha.latitude as number | null,
    longitude: linha.longitude as number | null,
  }
}

function paraChamada(linha: Linha): Chamada {
  return {
    id: linha.id as string,
    turmaId: linha.turma_id as number,
    professorId: linha.professor_id as number,
    iniciadaEm: iso(linha.iniciada_em),
    encerradaEm: isoOuNulo(linha.encerrada_em),
    latitude: linha.latitude as number,
    longitude: linha.longitude as number,
    raioMetros: linha.raio_metros as number,
  }
}

function paraPresenca(linha: Linha): Presenca {
  return {
    id: linha.id as number,
    chamadaId: linha.chamada_id as string,
    alunoId: linha.aluno_id as number,
    registradaEm: iso(linha.registrada_em),
    origem: linha.origem as Presenca['origem'],
    latitude: linha.latitude as number | null,
    longitude: linha.longitude as number | null,
    distanciaMetros: linha.distancia_metros as number | null,
  }
}

/** Converte violações de restrição do PostgreSQL nos erros dos contratos. */
function traduzirErro(erro: unknown, mensagens: { duplicidade?: string; vinculo?: string }): never {
  const codigo = (erro as { code?: string }).code
  if (codigo === UNIQUE_VIOLATION && mensagens.duplicidade) throw new ErroDeDuplicidade(mensagens.duplicidade)
  if (VINCULOS.has(codigo ?? '') && mensagens.vinculo) throw new ErroDeVinculo(mensagens.vinculo)
  throw erro
}

/**
 * Monta "coluna = $n, ..." apenas com os campos informados, para os UPDATEs
 * parciais. `colunas` mapeia o nome da propriedade para o nome da coluna.
 */
function montarAtualizacao(dados: Record<string, unknown>, colunas: Record<string, string>) {
  const atribuicoes: string[] = []
  const valores: unknown[] = []
  for (const [campo, coluna] of Object.entries(colunas)) {
    if (dados[campo] === undefined) continue
    valores.push(dados[campo])
    atribuicoes.push(`${coluna} = $${valores.length}`)
  }
  return { atribuicoes, valores }
}

const COLUNAS_PROFESSOR = { nome: 'nome', email: 'email', senhaHash: 'senha_hash' }
const COLUNAS_ALUNO = { nome: 'nome', matricula: 'matricula', email: 'email', senhaHash: 'senha_hash' }
const COLUNAS_TURMA = {
  professorId: 'professor_id',
  codigo: 'codigo',
  nome: 'nome',
  disciplina: 'disciplina',
  semestre: 'semestre',
  local: 'local',
  latitude: 'latitude',
  longitude: 'longitude',
}

export function criarPool(connectionString: string) {
  return new pg.Pool({ connectionString })
}

export function criarRepositoriosPostgres(pool: pg.Pool): Repositorios {
  async function consultar(sql: string, valores: unknown[] = []) {
    return (await pool.query(sql, valores)).rows as Linha[]
  }

  async function atualizar<T>(
    tabela: string,
    id: number,
    dados: Record<string, unknown>,
    colunas: Record<string, string>,
    converter: (linha: Linha) => T,
  ): Promise<T | null> {
    const { atribuicoes, valores } = montarAtualizacao(dados, colunas)
    const sql = atribuicoes.length
      ? `UPDATE ${tabela} SET ${atribuicoes.join(', ')} WHERE id = $${valores.length + 1} RETURNING *`
      : `SELECT * FROM ${tabela} WHERE id = $1`
    const [linha] = await consultar(sql, [...valores, id])
    return linha ? converter(linha) : null
  }

  async function excluir(sql: string, valores: unknown[]) {
    return ((await pool.query(sql, valores)).rowCount ?? 0) > 0
  }

  return {
    professores: {
      async listar() {
        return (await consultar('SELECT * FROM professores ORDER BY nome')).map(paraProfessor)
      },
      async buscarPorId(id) {
        const [linha] = await consultar('SELECT * FROM professores WHERE id = $1', [id])
        return linha ? paraProfessor(linha) : null
      },
      async buscarPorEmail(email) {
        const [linha] = await consultar('SELECT * FROM professores WHERE LOWER(email) = LOWER($1)', [email.trim()])
        return linha ? paraProfessor(linha) : null
      },
      async criar(novo) {
        try {
          const [linha] = await consultar(
            'INSERT INTO professores (nome, email, senha_hash) VALUES ($1, $2, $3) RETURNING *',
            [novo.nome, novo.email, novo.senhaHash],
          )
          return paraProfessor(linha)
        } catch (erro) {
          traduzirErro(erro, { duplicidade: 'E-mail já cadastrado.' })
        }
      },
      async atualizar(id, dados) {
        try {
          return await atualizar('professores', id, dados, COLUNAS_PROFESSOR, paraProfessor)
        } catch (erro) {
          traduzirErro(erro, { duplicidade: 'E-mail já cadastrado.' })
        }
      },
      async excluir(id) {
        try {
          return await excluir('DELETE FROM professores WHERE id = $1', [id])
        } catch (erro) {
          traduzirErro(erro, { vinculo: 'O professor possui turmas ou chamadas.' })
        }
      },
    },

    alunos: {
      async listar() {
        return (await consultar('SELECT * FROM alunos ORDER BY nome')).map(paraAluno)
      },
      async buscarPorId(id) {
        const [linha] = await consultar('SELECT * FROM alunos WHERE id = $1', [id])
        return linha ? paraAluno(linha) : null
      },
      async buscarPorEmail(email) {
        const [linha] = await consultar('SELECT * FROM alunos WHERE LOWER(email) = LOWER($1)', [email.trim()])
        return linha ? paraAluno(linha) : null
      },
      async buscarPorMatricula(matricula) {
        const [linha] = await consultar('SELECT * FROM alunos WHERE matricula = $1', [matricula.trim()])
        return linha ? paraAluno(linha) : null
      },
      async listarPorTurma(turmaId) {
        const linhas = await consultar(
          `SELECT a.* FROM alunos a
             JOIN matriculas m ON m.aluno_id = a.id
            WHERE m.turma_id = $1
            ORDER BY a.nome`,
          [turmaId],
        )
        return linhas.map(paraAluno)
      },
      async criar(novo) {
        try {
          const [linha] = await consultar(
            'INSERT INTO alunos (nome, matricula, email, senha_hash) VALUES ($1, $2, $3, $4) RETURNING *',
            [novo.nome, novo.matricula, novo.email, novo.senhaHash],
          )
          return paraAluno(linha)
        } catch (erro) {
          traduzirErro(erro, { duplicidade: 'Matrícula ou e-mail já cadastrado.' })
        }
      },
      async atualizar(id, dados) {
        try {
          return await atualizar('alunos', id, dados, COLUNAS_ALUNO, paraAluno)
        } catch (erro) {
          traduzirErro(erro, { duplicidade: 'Matrícula ou e-mail já cadastrado.' })
        }
      },
      async excluir(id) {
        try {
          return await excluir('DELETE FROM alunos WHERE id = $1', [id])
        } catch (erro) {
          traduzirErro(erro, { vinculo: 'O aluno possui presenças registradas.' })
        }
      },
    },

    turmas: {
      async buscarPorId(id) {
        const [linha] = await consultar('SELECT * FROM turmas WHERE id = $1', [id])
        return linha ? paraTurma(linha) : null
      },
      async listarPorProfessor(professorId) {
        return (await consultar('SELECT * FROM turmas WHERE professor_id = $1 ORDER BY id', [professorId])).map(paraTurma)
      },
      async listarPorAluno(alunoId) {
        const linhas = await consultar(
          `SELECT t.* FROM turmas t
             JOIN matriculas m ON m.turma_id = t.id
            WHERE m.aluno_id = $1
            ORDER BY t.id`,
          [alunoId],
        )
        return linhas.map(paraTurma)
      },
      async criar(nova) {
        try {
          const [linha] = await consultar(
            `INSERT INTO turmas (professor_id, codigo, nome, disciplina, semestre, local, latitude, longitude)
             VALUES ($1, $2, $3, $4, $5, $6, $7, $8) RETURNING *`,
            [nova.professorId, nova.codigo, nova.nome, nova.disciplina, nova.semestre, nova.local, nova.latitude, nova.longitude],
          )
          return paraTurma(linha)
        } catch (erro) {
          traduzirErro(erro, { duplicidade: 'Já existe uma turma com este código no semestre.' })
        }
      },
      async atualizar(id, dados) {
        try {
          return await atualizar('turmas', id, dados, COLUNAS_TURMA, paraTurma)
        } catch (erro) {
          traduzirErro(erro, { duplicidade: 'Já existe uma turma com este código no semestre.' })
        }
      },
      async excluir(id) {
        try {
          return await excluir('DELETE FROM turmas WHERE id = $1', [id])
        } catch (erro) {
          traduzirErro(erro, { vinculo: 'A turma possui chamadas.' })
        }
      },
      async alunoMatriculado(turmaId, alunoId) {
        const linhas = await consultar('SELECT 1 FROM matriculas WHERE turma_id = $1 AND aluno_id = $2', [turmaId, alunoId])
        return linhas.length > 0
      },
      async matricular(turmaId, alunoId) {
        await pool.query(
          'INSERT INTO matriculas (turma_id, aluno_id) VALUES ($1, $2) ON CONFLICT DO NOTHING',
          [turmaId, alunoId],
        )
      },
      async desmatricular(turmaId, alunoId) {
        return excluir('DELETE FROM matriculas WHERE turma_id = $1 AND aluno_id = $2', [turmaId, alunoId])
      },
      async atualizarLocalizacao(turmaId, latitude, longitude) {
        await pool.query('UPDATE turmas SET latitude = $2, longitude = $3 WHERE id = $1', [turmaId, latitude, longitude])
      },
    },

    chamadas: {
      async criar(chamada) {
        try {
          const [linha] = await consultar(
            `INSERT INTO chamadas (id, turma_id, professor_id, iniciada_em, encerrada_em, latitude, longitude, raio_metros)
             VALUES ($1, $2, $3, $4, $5, $6, $7, $8) RETURNING *`,
            [
              chamada.id,
              chamada.turmaId,
              chamada.professorId,
              chamada.iniciadaEm,
              chamada.encerradaEm,
              chamada.latitude,
              chamada.longitude,
              chamada.raioMetros,
            ],
          )
          return paraChamada(linha)
        } catch (erro) {
          traduzirErro(erro, { duplicidade: 'O professor já possui uma chamada aberta.' })
        }
      },
      async buscarPorId(id) {
        if (!ehUuid(id)) return null
        const [linha] = await consultar('SELECT * FROM chamadas WHERE id = $1', [id])
        return linha ? paraChamada(linha) : null
      },
      async buscarAtivaPorProfessor(professorId) {
        const [linha] = await consultar(
          'SELECT * FROM chamadas WHERE professor_id = $1 AND encerrada_em IS NULL',
          [professorId],
        )
        return linha ? paraChamada(linha) : null
      },
      async listarPorProfessor(professorId) {
        const linhas = await consultar(
          'SELECT * FROM chamadas WHERE professor_id = $1 ORDER BY iniciada_em DESC',
          [professorId],
        )
        return linhas.map(paraChamada)
      },
      async listarPorTurmas(turmaIds) {
        if (!turmaIds.length) return []
        const linhas = await consultar(
          'SELECT * FROM chamadas WHERE turma_id = ANY($1::int[]) ORDER BY iniciada_em DESC',
          [turmaIds],
        )
        return linhas.map(paraChamada)
      },
      async encerrar(id, encerradaEm) {
        await pool.query('UPDATE chamadas SET encerrada_em = $2 WHERE id = $1', [id, encerradaEm])
      },
      async excluir(id) {
        if (!ehUuid(id)) return false
        return excluir('DELETE FROM chamadas WHERE id = $1', [id])
      },
    },

    presencas: {
      async criar(presenca) {
        try {
          const [linha] = await consultar(
            `INSERT INTO presencas (chamada_id, aluno_id, registrada_em, origem, latitude, longitude, distancia_metros)
             VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING *`,
            [
              presenca.chamadaId,
              presenca.alunoId,
              presenca.registradaEm,
              presenca.origem,
              presenca.latitude,
              presenca.longitude,
              presenca.distanciaMetros,
            ],
          )
          return paraPresenca(linha)
        } catch (erro) {
          traduzirErro(erro, { duplicidade: 'Presença já registrada para este aluno.' })
        }
      },
      async buscarPorChamadaEAluno(chamadaId, alunoId) {
        if (!ehUuid(chamadaId)) return null
        const [linha] = await consultar(
          'SELECT * FROM presencas WHERE chamada_id = $1 AND aluno_id = $2',
          [chamadaId, alunoId],
        )
        return linha ? paraPresenca(linha) : null
      },
      async listarPorChamadas(chamadaIds) {
        const ids = chamadaIds.filter(ehUuid)
        if (!ids.length) return []
        const linhas = await consultar('SELECT * FROM presencas WHERE chamada_id = ANY($1::uuid[])', [ids])
        return linhas.map(paraPresenca)
      },
      async excluir(chamadaId, alunoId) {
        if (!ehUuid(chamadaId)) return false
        return excluir('DELETE FROM presencas WHERE chamada_id = $1 AND aluno_id = $2', [chamadaId, alunoId])
      },
    },

    tentativas: {
      async registrar(tentativa) {
        await pool.query(
          `INSERT INTO tentativas_registro (aluno_id, chamada_id, resultado, distancia_metros, tentada_em)
           VALUES ($1, $2, $3, $4, $5)`,
          [tentativa.alunoId, tentativa.chamadaId, tentativa.resultado, tentativa.distanciaMetros, tentativa.tentadaEm],
        )
      },
      async contarPorResultado(chamadaIds) {
        const ids = chamadaIds.filter(ehUuid)
        if (!ids.length) return {}
        const linhas = await consultar(
          `SELECT resultado, COUNT(*)::int AS quantidade
             FROM tentativas_registro
            WHERE chamada_id = ANY($1::uuid[])
            GROUP BY resultado`,
          [ids],
        )
        return Object.fromEntries(linhas.map((linha) => [linha.resultado as ResultadoTentativa, linha.quantidade as number]))
      },
    },

    async encerrar() {
      await pool.end()
    },
  }
}
