import type { Presenca } from '../types/Presenca'
import type { Turma } from '../types/Turma'
import { api } from './api'
import type { LoginApi } from './auth'

export interface TurmaPresenca extends Turma {
  codigo: string
  local: string
  /** Ponto de referência usado na última chamada da turma. */
  latitude: number | null
  longitude: number | null
}

export interface RegistroPresenca extends Presenca {
  chamadaId: string
  alunoId: number
  dataAula: string
  origem?: 'QR_CODE' | 'MANUAL'
  distanciaMetros?: number
}

export interface ChamadaResumo {
  id: string
  turmaId: number
  iniciadaEm: string
  encerradaEm: string | null
  latitude: number
  longitude: number
  raioMetros: number
  totalAlunos: number
  totalPresentes: number
}

export interface ChamadaAtiva extends ChamadaResumo {
  qr: {
    token: string
    expiraEm: string
    validoPorMs: number
    payload: string
  }
}

export interface SituacaoDaChamada {
  chamada: ChamadaAtiva | null
  registros: RegistroPresenca[]
}

export interface FrequenciaAluno {
  alunoId: number
  alunoNome: string
  matricula: string
  totalAulas: number
  presencas: number
  faltas: number
  percentualPresenca: number
}

export function listarTurmas() {
  return api<TurmaPresenca[]>('/turmas')
}

export function listarPresencas() {
  return api<RegistroPresenca[]>('/presencas')
}

export function listarChamadas() {
  return api<ChamadaResumo[]>('/chamadas')
}

export function listarFrequencia(turmaId: number) {
  return api<FrequenciaAluno[]>(`/turmas/${turmaId}/frequencia`)
}

export function consultarChamadaAtiva() {
  return api<SituacaoDaChamada>('/chamadas/ativa')
}

export function iniciarChamada(turmaId: number, latitude: number, longitude: number) {
  return api<SituacaoDaChamada>('/chamadas', { body: { turmaId, latitude, longitude } })
}

export function encerrarChamada(chamadaId: string) {
  return api<ChamadaResumo>(`/chamadas/${chamadaId}/encerrar`, { method: 'POST' })
}

export function registrarPresencaManual(chamadaId: string, alunoId: number) {
  return api<SituacaoDaChamada>(`/chamadas/${chamadaId}/presencas/manual`, { body: { alunoId } })
}

interface RegistroDoAluno {
  email: string
  senha: string
  chamadaId: string
  token: string
  latitude: number
  longitude: number
}

/**
 * Executa o mesmo fluxo que o aplicativo do aluno fará: login do aluno e envio
 * do QR Code lido com a localização. O token do aluno não é guardado.
 */
export async function registrarPresencaComoAluno({ email, senha, ...registro }: RegistroDoAluno) {
  const { token } = await api<LoginApi>('/auth/login', { body: { email, senha }, token: null })
  return api<{ distanciaMetros: number }>('/presencas', { body: registro, token })
}
