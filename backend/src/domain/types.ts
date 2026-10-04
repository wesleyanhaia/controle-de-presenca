export type Perfil = 'PROFESSOR' | 'ALUNO'
export type StatusPresenca = 'PRESENTE' | 'AUSENTE' | 'PENDENTE'
export type OrigemPresenca = 'QR_CODE' | 'MANUAL'

export interface Professor {
  id: number
  nome: string
  email: string
  senhaHash: string
}

export interface Aluno {
  id: number
  nome: string
  matricula: string
  email: string
  senhaHash: string
}

export interface Turma {
  id: number
  professorId: number
  codigo: string
  nome: string
  disciplina: string
  semestre: string
  local: string
  /** Ponto de referência da sala, salvo na última chamada da turma. */
  latitude: number | null
  longitude: number | null
}

export interface Matricula {
  turmaId: number
  alunoId: number
}

export interface Chamada {
  id: string
  turmaId: number
  professorId: number
  iniciadaEm: string
  encerradaEm: string | null
  latitude: number
  longitude: number
  raioMetros: number
}

export interface Presenca {
  id: number
  chamadaId: string
  alunoId: number
  registradaEm: string
  origem: OrigemPresenca
  /** Coordenada enviada pelo aluno no momento do registro (nula no registro manual). */
  latitude: number | null
  longitude: number | null
  distanciaMetros: number | null
}

export interface UsuarioAutenticado {
  id: number
  perfil: Perfil
}
