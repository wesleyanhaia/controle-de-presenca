import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import type { ResultadoTentativa } from '../../domain/types.ts'
import { ErroDeDuplicidade, ErroDeVinculo, type Repositorios } from '../contracts.ts'
import { dadosDeDemonstracao, type Dados } from './seed.ts'

function carregarDados(arquivo: string | null): Dados {
  if (arquivo && existsSync(arquivo)) {
    try {
      const dados = JSON.parse(readFileSync(arquivo, 'utf8')) as Dados
      // Arquivos gravados por versões anteriores não têm as tentativas.
      dados.tentativas ??= []
      return dados
    } catch {
      console.warn(`[dados] Não foi possível ler ${arquivo}; recriando os dados de demonstração.`)
    }
  }
  return dadosDeDemonstracao()
}

const mesmoEmail = (a: string, b: string) => a.trim().toLowerCase() === b.trim().toLowerCase()
const proximoId = (lista: { id: number }[]) => lista.reduce((maior, item) => Math.max(maior, item.id), 0) + 1

/** Campos não informados (undefined) não alteram o registro. */
const definidos = <T extends object>(dados: T) =>
  Object.fromEntries(Object.entries(dados).filter(([, valor]) => valor !== undefined)) as Partial<T>

/** Remove o item da lista; devolve false se ele não existia. */
function remover<T>(lista: T[], encontrar: (item: T) => boolean) {
  const indice = lista.findIndex(encontrar)
  if (indice < 0) return false
  lista.splice(indice, 1)
  return true
}

/**
 * Repositórios em memória. Quando `arquivoDados` é informado, o conteúdo é
 * gravado em um arquivo JSON a cada alteração, para sobreviver a reinícios
 * do servidor durante o desenvolvimento.
 *
 * As verificações de unicidade e de vínculo reproduzem os índices únicos e as
 * chaves estrangeiras de database/schema.sql.
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

  function removerMatriculas(encontrar: (matricula: Dados['matriculas'][number]) => boolean) {
    dados.matriculas = dados.matriculas.filter((matricula) => !encontrar(matricula))
  }

  salvar()

  return {
    professores: {
      async listar() {
        return [...dados.professores].sort((a, b) => a.nome.localeCompare(b.nome, 'pt-BR'))
      },
      async buscarPorId(id) {
        return dados.professores.find((professor) => professor.id === id) ?? null
      },
      async buscarPorEmail(email) {
        return dados.professores.find((professor) => mesmoEmail(professor.email, email)) ?? null
      },
      async criar(novo) {
        if (dados.professores.some((professor) => mesmoEmail(professor.email, novo.email))) {
          throw new ErroDeDuplicidade('E-mail já cadastrado.')
        }
        const professor = { ...novo, id: proximoId(dados.professores) }
        dados.professores.push(professor)
        salvar()
        return professor
      },
      async atualizar(id, alteracoes) {
        const professor = dados.professores.find((item) => item.id === id)
        if (!professor) return null
        if (alteracoes.email && dados.professores.some((item) => item.id !== id && mesmoEmail(item.email, alteracoes.email!))) {
          throw new ErroDeDuplicidade('E-mail já cadastrado.')
        }
        Object.assign(professor, definidos(alteracoes))
        salvar()
        return professor
      },
      async excluir(id) {
        if (dados.turmas.some((turma) => turma.professorId === id) || dados.chamadas.some((chamada) => chamada.professorId === id)) {
          throw new ErroDeVinculo('O professor possui turmas ou chamadas.')
        }
        const removido = remover(dados.professores, (professor) => professor.id === id)
        if (removido) salvar()
        return removido
      },
    },

    alunos: {
      async listar() {
        return [...dados.alunos].sort((a, b) => a.nome.localeCompare(b.nome, 'pt-BR'))
      },
      async buscarPorId(id) {
        return dados.alunos.find((aluno) => aluno.id === id) ?? null
      },
      async buscarPorEmail(email) {
        return dados.alunos.find((aluno) => mesmoEmail(aluno.email, email)) ?? null
      },
      async buscarPorMatricula(matricula) {
        return dados.alunos.find((aluno) => aluno.matricula === matricula.trim()) ?? null
      },
      async listarPorTurma(turmaId) {
        const ids = new Set(
          dados.matriculas.filter((matricula) => matricula.turmaId === turmaId).map((matricula) => matricula.alunoId),
        )
        return dados.alunos
          .filter((aluno) => ids.has(aluno.id))
          .sort((a, b) => a.nome.localeCompare(b.nome, 'pt-BR'))
      },
      async criar(novo) {
        if (dados.alunos.some((aluno) => aluno.matricula === novo.matricula || mesmoEmail(aluno.email, novo.email))) {
          throw new ErroDeDuplicidade('Matrícula ou e-mail já cadastrado.')
        }
        const aluno = { ...novo, id: proximoId(dados.alunos) }
        dados.alunos.push(aluno)
        salvar()
        return aluno
      },
      async atualizar(id, alteracoes) {
        const aluno = dados.alunos.find((item) => item.id === id)
        if (!aluno) return null
        const conflito = dados.alunos.some((item) =>
          item.id !== id &&
          ((alteracoes.matricula !== undefined && item.matricula === alteracoes.matricula) ||
            (alteracoes.email !== undefined && mesmoEmail(item.email, alteracoes.email))),
        )
        if (conflito) throw new ErroDeDuplicidade('Matrícula ou e-mail já cadastrado.')
        Object.assign(aluno, definidos(alteracoes))
        salvar()
        return aluno
      },
      async excluir(id) {
        if (dados.presencas.some((presenca) => presenca.alunoId === id)) {
          throw new ErroDeVinculo('O aluno possui presenças registradas.')
        }
        const removido = remover(dados.alunos, (aluno) => aluno.id === id)
        if (removido) {
          removerMatriculas((matricula) => matricula.alunoId === id)
          dados.tentativas = dados.tentativas.filter((tentativa) => tentativa.alunoId !== id)
          salvar()
        }
        return removido
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
      async criar(nova) {
        if (dados.turmas.some((turma) => turma.codigo === nova.codigo && turma.semestre === nova.semestre)) {
          throw new ErroDeDuplicidade('Já existe uma turma com este código no semestre.')
        }
        const turma = { ...nova, id: proximoId(dados.turmas) }
        dados.turmas.push(turma)
        salvar()
        return turma
      },
      async atualizar(id, alteracoes) {
        const turma = dados.turmas.find((item) => item.id === id)
        if (!turma) return null
        const codigo = alteracoes.codigo ?? turma.codigo
        const semestre = alteracoes.semestre ?? turma.semestre
        if (dados.turmas.some((item) => item.id !== id && item.codigo === codigo && item.semestre === semestre)) {
          throw new ErroDeDuplicidade('Já existe uma turma com este código no semestre.')
        }
        Object.assign(turma, definidos(alteracoes))
        salvar()
        return turma
      },
      async excluir(id) {
        if (dados.chamadas.some((chamada) => chamada.turmaId === id)) {
          throw new ErroDeVinculo('A turma possui chamadas.')
        }
        const removido = remover(dados.turmas, (turma) => turma.id === id)
        if (removido) {
          removerMatriculas((matricula) => matricula.turmaId === id)
          salvar()
        }
        return removido
      },
      async alunoMatriculado(turmaId, alunoId) {
        return dados.matriculas.some((matricula) => matricula.turmaId === turmaId && matricula.alunoId === alunoId)
      },
      async matricular(turmaId, alunoId) {
        if (dados.matriculas.some((matricula) => matricula.turmaId === turmaId && matricula.alunoId === alunoId)) return
        dados.matriculas.push({ turmaId, alunoId })
        salvar()
      },
      async desmatricular(turmaId, alunoId) {
        const removido = remover(dados.matriculas, (matricula) => matricula.turmaId === turmaId && matricula.alunoId === alunoId)
        if (removido) salvar()
        return removido
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
      async excluir(id) {
        const removido = remover(dados.chamadas, (chamada) => chamada.id === id)
        if (removido) {
          dados.presencas = dados.presencas.filter((presenca) => presenca.chamadaId !== id)
          dados.tentativas = dados.tentativas.filter((tentativa) => tentativa.chamadaId !== id)
          salvar()
        }
        return removido
      },
    },

    presencas: {
      async criar(presenca) {
        if (dados.presencas.some((item) => item.chamadaId === presenca.chamadaId && item.alunoId === presenca.alunoId)) {
          throw new ErroDeDuplicidade('Presença já registrada para este aluno.')
        }
        const nova = { ...presenca, id: proximoId(dados.presencas) }
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
      async excluir(chamadaId, alunoId) {
        const removido = remover(dados.presencas, (presenca) => presenca.chamadaId === chamadaId && presenca.alunoId === alunoId)
        if (removido) salvar()
        return removido
      },
    },

    tentativas: {
      async registrar(tentativa) {
        dados.tentativas.push({ ...tentativa, id: proximoId(dados.tentativas) })
        salvar()
      },
      async contarPorResultado(chamadaIds) {
        const contagem: Partial<Record<ResultadoTentativa, number>> = {}
        for (const tentativa of dados.tentativas) {
          if (tentativa.chamadaId && chamadaIds.includes(tentativa.chamadaId)) {
            contagem[tentativa.resultado] = (contagem[tentativa.resultado] ?? 0) + 1
          }
        }
        return contagem
      },
    },

    async encerrar() {},
  }
}
