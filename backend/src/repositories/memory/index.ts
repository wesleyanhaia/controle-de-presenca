import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { ErroDeDuplicidade, type Repositorios } from '../contracts.ts'
import { dadosDeDemonstracao, type Dados } from './seed.ts'

function carregarDados(arquivo: string | null): Dados {
  if (arquivo && existsSync(arquivo)) {
    try {
      return JSON.parse(readFileSync(arquivo, 'utf8')) as Dados
    } catch {
      console.warn(`[dados] Não foi possível ler ${arquivo}; recriando os dados de demonstração.`)
    }
  }
  return dadosDeDemonstracao()
}

const mesmoEmail = (a: string, b: string) => a.trim().toLowerCase() === b.trim().toLowerCase()

/**
 * Repositórios em memória. Quando `arquivoDados` é informado, o conteúdo é
 * gravado em um arquivo JSON a cada alteração, para sobreviver a reinícios
 * do servidor durante o desenvolvimento.
 */
export function criarRepositoriosEmMemoria(arquivoDados?: string): Repositorios {
  const arquivo = arquivoDados ? resolve(arquivoDados) : null
  const dados = carregarDados(arquivo)

  function salvar() {
    if (!arquivo) return
    // Uma falha ao gravar o arquivo não pode derrubar a requisição: os dados
    // continuam válidos em memória e são gravados de novo na próxima alteração.
    try {
      mkdirSync(dirname(arquivo), { recursive: true })
      writeFileSync(arquivo, JSON.stringify(dados, null, 2))
    } catch (erro) {
      console.warn(`[dados] Não foi possível gravar ${arquivo}:`, erro)
    }
  }

  salvar()

  return {
    professores: {
      async buscarPorId(id) {
        return dados.professores.find((professor) => professor.id === id) ?? null
      },
      async buscarPorEmail(email) {
        return dados.professores.find((professor) => mesmoEmail(professor.email, email)) ?? null
      },
    },

    alunos: {
      async buscarPorId(id) {
        return dados.alunos.find((aluno) => aluno.id === id) ?? null
      },
      async buscarPorEmail(email) {
        return dados.alunos.find((aluno) => mesmoEmail(aluno.email, email)) ?? null
      },
      async listarPorTurma(turmaId) {
        const ids = new Set(
          dados.matriculas.filter((matricula) => matricula.turmaId === turmaId).map((matricula) => matricula.alunoId),
        )
        return dados.alunos
          .filter((aluno) => ids.has(aluno.id))
          .sort((a, b) => a.nome.localeCompare(b.nome, 'pt-BR'))
      },
    },

    turmas: {
      async buscarPorId(id) {
        return dados.turmas.find((turma) => turma.id === id) ?? null
      },
      async listarPorProfessor(professorId) {
        return dados.turmas.filter((turma) => turma.professorId === professorId)
      },
      async listarPorAluno(alunoId) {
        const ids = new Set(
          dados.matriculas.filter((matricula) => matricula.alunoId === alunoId).map((matricula) => matricula.turmaId),
        )
        return dados.turmas.filter((turma) => ids.has(turma.id))
      },
      async alunoMatriculado(turmaId, alunoId) {
        return dados.matriculas.some((matricula) => matricula.turmaId === turmaId && matricula.alunoId === alunoId)
      },
      async atualizarLocalizacao(turmaId, latitude, longitude) {
        const turma = dados.turmas.find((item) => item.id === turmaId)
        if (!turma) return
        turma.latitude = latitude
        turma.longitude = longitude
        salvar()
      },
    },

    chamadas: {
      async criar(chamada) {
        if (dados.chamadas.some((item) => item.professorId === chamada.professorId && !item.encerradaEm)) {
          throw new ErroDeDuplicidade('O professor já possui uma chamada aberta.')
        }
        dados.chamadas.push({ ...chamada })
        salvar()
        return chamada
      },
      async buscarPorId(id) {
        return dados.chamadas.find((chamada) => chamada.id === id) ?? null
      },
      async buscarAtivaPorProfessor(professorId) {
        return dados.chamadas.find((chamada) => chamada.professorId === professorId && !chamada.encerradaEm) ?? null
      },
      async listarPorProfessor(professorId) {
        return dados.chamadas.filter((chamada) => chamada.professorId === professorId)
      },
      async listarPorTurmas(turmaIds) {
        return dados.chamadas.filter((chamada) => turmaIds.includes(chamada.turmaId))
      },
      async encerrar(id, encerradaEm) {
        const chamada = dados.chamadas.find((item) => item.id === id)
        if (!chamada) return
        chamada.encerradaEm = encerradaEm
        salvar()
      },
    },

    presencas: {
      async criar(presenca) {
        if (dados.presencas.some((item) => item.chamadaId === presenca.chamadaId && item.alunoId === presenca.alunoId)) {
          throw new ErroDeDuplicidade('Presença já registrada para este aluno.')
        }
        const id = dados.presencas.reduce((maior, item) => Math.max(maior, item.id), 0) + 1
        const nova = { ...presenca, id }
        dados.presencas.push(nova)
        salvar()
        return nova
      },
      async buscarPorChamadaEAluno(chamadaId, alunoId) {
        return dados.presencas.find((presenca) => presenca.chamadaId === chamadaId && presenca.alunoId === alunoId) ?? null
      },
      async listarPorChamadas(chamadaIds) {
        return dados.presencas.filter((presenca) => chamadaIds.includes(presenca.chamadaId))
      },
    },
  }
}
