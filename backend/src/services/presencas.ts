import { randomUUID } from 'node:crypto'
import { config } from '../config.ts'
import type { Aluno, Chamada, OrigemPresenca, Presenca, StatusPresenca, Turma } from '../domain/types.ts'
import { erros } from '../errors.ts'
import { ErroDeDuplicidade, type Repositorios } from '../repositories/contracts.ts'
import { coordenadasValidas, distanciaEmMetros } from './geo.ts'
import { qrAtual, validarToken } from './qr.ts'

export interface RegistroDTO {
  id: string
  chamadaId: string
  turmaId: number
  alunoId: number
  alunoNome: string
  matricula: string
  dataAula: string
  dataHoraRegistro?: string
  status: StatusPresenca
  origem?: OrigemPresenca
  distanciaMetros?: number
}

function porcentagem(parte: number, total: number) {
  return total ? Math.round((parte / total) * 100) : 0
}

export function criarPresencaService(repositorios: Repositorios) {
  const { alunos, turmas, chamadas, presencas } = repositorios

  async function turmaDoProfessor(turmaId: number, professorId: number) {
    const turma = await turmas.buscarPorId(turmaId)
    if (!turma || turma.professorId !== professorId) throw erros.naoEncontrado('Turma não encontrada.')
    return turma
  }

  async function chamadaDoProfessor(chamadaId: string, professorId: number) {
    const chamada = await chamadas.buscarPorId(chamadaId)
    if (!chamada || chamada.professorId !== professorId) throw erros.naoEncontrado('Chamada não encontrada.')
    return chamada
  }

  /**
   * Uma linha por aluno matriculado em cada chamada: presente se houver
   * registro; caso contrário, pendente (chamada aberta) ou ausente (encerrada).
   */
  async function montarRegistros(lista: Chamada[], apenasAlunoId?: number): Promise<RegistroDTO[]> {
    const todasPresencas = await presencas.listarPorChamadas(lista.map((chamada) => chamada.id))
    const presencaPorChave = new Map(todasPresencas.map((presenca) => [`${presenca.chamadaId}:${presenca.alunoId}`, presenca]))
    const alunosPorTurma = new Map<number, Aluno[]>()
    const registros: RegistroDTO[] = []

    for (const chamada of lista) {
      if (!alunosPorTurma.has(chamada.turmaId)) {
        alunosPorTurma.set(chamada.turmaId, await alunos.listarPorTurma(chamada.turmaId))
      }

      for (const aluno of alunosPorTurma.get(chamada.turmaId)!) {
        if (apenasAlunoId !== undefined && aluno.id !== apenasAlunoId) continue
        const presenca = presencaPorChave.get(`${chamada.id}:${aluno.id}`)

        registros.push({
          id: `${chamada.id}:${aluno.id}`,
          chamadaId: chamada.id,
          turmaId: chamada.turmaId,
          alunoId: aluno.id,
          alunoNome: aluno.nome,
          matricula: aluno.matricula,
          dataAula: chamada.iniciadaEm,
          dataHoraRegistro: presenca?.registradaEm,
          status: presenca ? 'PRESENTE' : chamada.encerradaEm ? 'AUSENTE' : 'PENDENTE',
          origem: presenca?.origem,
          distanciaMetros: presenca?.distanciaMetros ?? undefined,
        })
      }
    }

    return registros.sort((a, b) =>
      b.dataAula.localeCompare(a.dataAula) || a.alunoNome.localeCompare(b.alunoNome, 'pt-BR'),
    )
  }

  async function resumoDaChamada(chamada: Chamada) {
    const [matriculados, registradas] = await Promise.all([
      alunos.listarPorTurma(chamada.turmaId),
      presencas.listarPorChamadas([chamada.id]),
    ])
    return {
      id: chamada.id,
      turmaId: chamada.turmaId,
      iniciadaEm: chamada.iniciadaEm,
      encerradaEm: chamada.encerradaEm,
      latitude: chamada.latitude,
      longitude: chamada.longitude,
      raioMetros: chamada.raioMetros,
      totalAlunos: matriculados.length,
      totalPresentes: registradas.length,
    }
  }

  async function turmaDTO(turma: Turma) {
    const { professorId: _professorId, ...dados } = turma
    return { ...dados, quantidadeAlunos: (await alunos.listarPorTurma(turma.id)).length }
  }

  async function criarPresenca(presenca: Omit<Presenca, 'id'>) {
    try {
      return await presencas.criar(presenca)
    } catch (erro) {
      if (erro instanceof ErroDeDuplicidade) {
        throw erros.conflito('PRESENCA_DUPLICADA', 'A presença deste aluno já foi registrada nesta chamada.')
      }
      throw erro
    }
  }

  async function chamadaAtiva(professorId: number) {
    const chamada = await chamadas.buscarAtivaPorProfessor(professorId)
    if (!chamada) return { chamada: null, registros: [] }

    return {
      chamada: { ...(await resumoDaChamada(chamada)), qr: qrAtual(chamada) },
      registros: await montarRegistros([chamada]),
    }
  }

  return {
    // ---------- Professor ----------

    async listarTurmas(professorId: number) {
      return Promise.all((await turmas.listarPorProfessor(professorId)).map(turmaDTO))
    },

    /** Frequência de cada aluno da turma, considerando as chamadas encerradas. */
    async frequenciaDaTurma(turmaId: number, professorId: number) {
      const turma = await turmaDoProfessor(turmaId, professorId)
      const encerradas = (await chamadas.listarPorTurmas([turma.id])).filter((chamada) => chamada.encerradaEm)
      const registros = await montarRegistros(encerradas)

      return (await alunos.listarPorTurma(turma.id)).map((aluno) => {
        const presentes = registros.filter((registro) => registro.alunoId === aluno.id && registro.status === 'PRESENTE').length
        return {
          alunoId: aluno.id,
          alunoNome: aluno.nome,
          matricula: aluno.matricula,
          totalAulas: encerradas.length,
          presencas: presentes,
          faltas: encerradas.length - presentes,
          percentualPresenca: porcentagem(presentes, encerradas.length),
        }
      })
    },

    chamadaAtiva,

    async iniciarChamada(professorId: number, turmaId: number, latitude: number, longitude: number) {
      const turma = await turmaDoProfessor(turmaId, professorId)

      if (!coordenadasValidas(latitude, longitude)) {
        throw erros.invalido('COORDENADAS_INVALIDAS', 'Informe coordenadas válidas para o local da aula.')
      }

      try {
        await chamadas.criar({
          id: randomUUID(),
          turmaId: turma.id,
          professorId,
          iniciadaEm: new Date().toISOString(),
          encerradaEm: null,
          latitude,
          longitude,
          raioMetros: config.raioPermitidoMetros,
        })
      } catch (erro) {
        if (erro instanceof ErroDeDuplicidade) {
          throw erros.conflito('CHAMADA_EM_ANDAMENTO', 'Encerre a chamada atual antes de iniciar outra.')
        }
        throw erro
      }

      await turmas.atualizarLocalizacao(turma.id, latitude, longitude)
      return chamadaAtiva(professorId)
    },

    async encerrarChamada(chamadaId: string, professorId: number) {
      const chamada = await chamadaDoProfessor(chamadaId, professorId)
      if (chamada.encerradaEm) return resumoDaChamada(chamada)

      const encerradaEm = new Date().toISOString()
      await chamadas.encerrar(chamada.id, encerradaEm)
      return resumoDaChamada({ ...chamada, encerradaEm })
    },

    async listarChamadas(professorId: number) {
      const lista = await chamadas.listarPorProfessor(professorId)
      lista.sort((a, b) => b.iniciadaEm.localeCompare(a.iniciadaEm))
      return Promise.all(lista.map(resumoDaChamada))
    },

    async listarRegistros(professorId: number) {
      return montarRegistros(await chamadas.listarPorProfessor(professorId))
    },

    /** Registro feito pelo professor, para alunos sem celular ou com falha no aparelho. */
    async registrarPresencaManual(chamadaId: string, professorId: number, alunoId: number) {
      const chamada = await chamadaDoProfessor(chamadaId, professorId)
      if (chamada.encerradaEm) throw erros.conflito('CHAMADA_ENCERRADA', 'Esta chamada já foi encerrada.')
      if (!(await turmas.alunoMatriculado(chamada.turmaId, alunoId))) {
        throw erros.naoEncontrado('Aluno não encontrado nesta turma.')
      }

      await criarPresenca({
        chamadaId: chamada.id,
        alunoId,
        registradaEm: new Date().toISOString(),
        origem: 'MANUAL',
        latitude: null,
        longitude: null,
        distanciaMetros: null,
      })
    },

    // ---------- Aluno ----------

    /** Valida QR Code, matrícula, duplicidade e localização antes de registrar a presença. */
    async registrarPresenca(alunoId: number, entrada: { chamadaId: string; token: string; latitude: number; longitude: number }) {
      const chamada = await chamadas.buscarPorId(entrada.chamadaId)
      if (!chamada) throw erros.invalido('QR_INVALIDO', 'QR Code inválido.')
      if (chamada.encerradaEm) throw erros.conflito('CHAMADA_ENCERRADA', 'Esta chamada já foi encerrada.')

      const resultado = validarToken(chamada, entrada.token)
      if (resultado === 'EXPIRADO') {
        throw erros.invalido('QR_EXPIRADO', 'O QR Code expirou. Leia o código atualizado e tente novamente.')
      }
      if (resultado === 'INVALIDO') throw erros.invalido('QR_INVALIDO', 'QR Code inválido.')

      if (!(await turmas.alunoMatriculado(chamada.turmaId, alunoId))) {
        throw erros.semPermissao('Você não está matriculado na turma desta chamada.')
      }

      if (await presencas.buscarPorChamadaEAluno(chamada.id, alunoId)) {
        throw erros.conflito('PRESENCA_DUPLICADA', 'A presença deste aluno já foi registrada nesta chamada.')
      }

      if (!coordenadasValidas(entrada.latitude, entrada.longitude)) {
        throw erros.invalido('COORDENADAS_INVALIDAS', 'Não foi possível validar a localização enviada.')
      }

      const distancia = distanciaEmMetros(chamada.latitude, chamada.longitude, entrada.latitude, entrada.longitude)
      if (distancia > chamada.raioMetros) {
        throw erros.naoProcessavel(
          'FORA_DO_RAIO',
          `Localização fora do limite de ${chamada.raioMetros} m do local da aula (${Math.round(distancia)} m).`,
        )
      }

      const presenca = await criarPresenca({
        chamadaId: chamada.id,
        alunoId,
        registradaEm: new Date().toISOString(),
        origem: 'QR_CODE',
        latitude: entrada.latitude,
        longitude: entrada.longitude,
        distanciaMetros: Math.round(distancia),
      })

      return {
        chamadaId: chamada.id,
        turmaId: chamada.turmaId,
        registradaEm: presenca.registradaEm,
        distanciaMetros: presenca.distanciaMetros,
      }
    },

    /** Histórico de presenças e faltas do aluno, por turma. */
    async historicoDoAluno(alunoId: number) {
      const turmasDoAluno = await turmas.listarPorAluno(alunoId)
      const lista = await chamadas.listarPorTurmas(turmasDoAluno.map((turma) => turma.id))
      const registros = await montarRegistros(lista, alunoId)

      return {
        turmas: turmasDoAluno.map((turma) => {
          const daTurma = registros.filter((registro) => registro.turmaId === turma.id)
          const presentes = daTurma.filter((registro) => registro.status === 'PRESENTE').length
          const faltas = daTurma.filter((registro) => registro.status === 'AUSENTE').length
          return {
            id: turma.id,
            codigo: turma.codigo,
            disciplina: turma.disciplina,
            presencas: presentes,
            faltas,
            percentualPresenca: porcentagem(presentes, presentes + faltas),
          }
        }),
        registros,
      }
    },
  }
}

export type PresencaService = ReturnType<typeof criarPresencaService>
