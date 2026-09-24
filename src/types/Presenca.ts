export type StatusPresenca = 'PRESENTE' | 'AUSENTE' | 'PENDENTE'

export interface Presenca {
  id: number
  alunoNome: string
  matricula: string
  turmaId: number
  dataHoraRegistro?: string
  status: StatusPresenca
}