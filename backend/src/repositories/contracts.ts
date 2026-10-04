import type { Aluno, Chamada, Presenca, Professor, Turma } from '../domain/types.ts'

/*
  Contratos de acesso a dados.

  As regras de negócio (services) dependem somente destas interfaces. Hoje a
  implementação é em memória (./memory); para usar o PostgreSQL basta criar
  outra implementação com os mesmos métodos e trocá-la em ./index.ts.
  Todos os métodos são assíncronos justamente para essa troca não exigir
  mudanças no restante do código.
*/

/**
 * Lançado por `criar` quando o registro violaria uma regra de unicidade
 * (equivalente ao erro de UNIQUE do banco de dados).
 */
export class ErroDeDuplicidade extends Error {}

export interface ProfessorRepository {
  buscarPorId(id: number): Promise<Professor | null>
  buscarPorEmail(email: string): Promise<Professor | null>
}

export interface AlunoRepository {
  buscarPorId(id: number): Promise<Aluno | null>
  buscarPorEmail(email: string): Promise<Aluno | null>
  listarPorTurma(turmaId: number): Promise<Aluno[]>
}

export interface TurmaRepository {
  buscarPorId(id: number): Promise<Turma | null>
  listarPorProfessor(professorId: number): Promise<Turma[]>
  listarPorAluno(alunoId: number): Promise<Turma[]>
  alunoMatriculado(turmaId: number, alunoId: number): Promise<boolean>
  atualizarLocalizacao(turmaId: number, latitude: number, longitude: number): Promise<void>
}

export interface ChamadaRepository {
  /** Rejeita com ErroDeDuplicidade se o professor já tiver uma chamada aberta. */
  criar(chamada: Chamada): Promise<Chamada>
  buscarPorId(id: string): Promise<Chamada | null>
  buscarAtivaPorProfessor(professorId: number): Promise<Chamada | null>
  listarPorProfessor(professorId: number): Promise<Chamada[]>
  listarPorTurmas(turmaIds: number[]): Promise<Chamada[]>
  encerrar(id: string, encerradaEm: string): Promise<void>
}

export interface PresencaRepository {
  /** Rejeita com ErroDeDuplicidade se o aluno já tiver presença nesta chamada. */
  criar(presenca: Omit<Presenca, 'id'>): Promise<Presenca>
  buscarPorChamadaEAluno(chamadaId: string, alunoId: number): Promise<Presenca | null>
  listarPorChamadas(chamadaIds: string[]): Promise<Presenca[]>
}

export interface Repositorios {
  professores: ProfessorRepository
  alunos: AlunoRepository
  turmas: TurmaRepository
  chamadas: ChamadaRepository
  presencas: PresencaRepository
}
