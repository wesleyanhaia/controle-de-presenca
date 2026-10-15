import type {
  Aluno,
  Chamada,
  Presenca,
  Professor,
  ResultadoTentativa,
  TentativaRegistro,
  Turma,
} from '../domain/types.ts'

/*
  Contratos de acesso a dados.

  As regras de negócio (services) dependem somente destas interfaces. Há duas
  implementações: em memória (./memory) e PostgreSQL (./postgres); a escolha
  fica em ./index.ts. Todos os métodos são assíncronos para que as duas
  implementações sejam intercambiáveis.
*/

/**
 * Lançado por `criar`/`atualizar` quando o registro violaria uma regra de
 * unicidade (equivalente ao erro de UNIQUE do banco de dados).
 */
export class ErroDeDuplicidade extends Error {}

/**
 * Lançado por `excluir` quando outros registros dependem deste
 * (equivalente ao erro de chave estrangeira do banco de dados).
 */
export class ErroDeVinculo extends Error {}

export type NovoProfessor = Omit<Professor, 'id'>
export type NovoAluno = Omit<Aluno, 'id'>
export type NovaTurma = Omit<Turma, 'id'>

export interface ProfessorRepository {
  listar(): Promise<Professor[]>
  buscarPorId(id: number): Promise<Professor | null>
  buscarPorEmail(email: string): Promise<Professor | null>
  /** Rejeita com ErroDeDuplicidade se o e-mail já estiver em uso. */
  criar(professor: NovoProfessor): Promise<Professor>
  /** Devolve null se o professor não existir. */
  atualizar(id: number, dados: Partial<NovoProfessor>): Promise<Professor | null>
  /** Devolve false se não existir; rejeita com ErroDeVinculo se o professor tiver turmas ou chamadas. */
  excluir(id: number): Promise<boolean>
}

export interface AlunoRepository {
  listar(): Promise<Aluno[]>
  buscarPorId(id: number): Promise<Aluno | null>
  buscarPorEmail(email: string): Promise<Aluno | null>
  buscarPorMatricula(matricula: string): Promise<Aluno | null>
  listarPorTurma(turmaId: number): Promise<Aluno[]>
  /** Rejeita com ErroDeDuplicidade se a matrícula ou o e-mail já estiverem em uso. */
  criar(aluno: NovoAluno): Promise<Aluno>
  atualizar(id: number, dados: Partial<NovoAluno>): Promise<Aluno | null>
  /** Remove também as matrículas; rejeita com ErroDeVinculo se o aluno tiver presenças registradas. */
  excluir(id: number): Promise<boolean>
}

export interface TurmaRepository {
  buscarPorId(id: number): Promise<Turma | null>
  listarPorProfessor(professorId: number): Promise<Turma[]>
  listarPorAluno(alunoId: number): Promise<Turma[]>
  /** Rejeita com ErroDeDuplicidade se já houver turma com o mesmo código no semestre. */
  criar(turma: NovaTurma): Promise<Turma>
  atualizar(id: number, dados: Partial<NovaTurma>): Promise<Turma | null>
  /** Remove também as matrículas; rejeita com ErroDeVinculo se a turma tiver chamadas. */
  excluir(id: number): Promise<boolean>
  alunoMatriculado(turmaId: number, alunoId: number): Promise<boolean>
  /** Não faz nada se o aluno já estiver matriculado. */
  matricular(turmaId: number, alunoId: number): Promise<void>
  /** Devolve false se o aluno não estava matriculado. */
  desmatricular(turmaId: number, alunoId: number): Promise<boolean>
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
  /** Exclui a chamada com suas presenças e tentativas. Devolve false se não existir. */
  excluir(id: string): Promise<boolean>
}

export interface PresencaRepository {
  /** Rejeita com ErroDeDuplicidade se o aluno já tiver presença nesta chamada. */
  criar(presenca: Omit<Presenca, 'id'>): Promise<Presenca>
  buscarPorChamadaEAluno(chamadaId: string, alunoId: number): Promise<Presenca | null>
  listarPorChamadas(chamadaIds: string[]): Promise<Presenca[]>
  /** Devolve false se não havia presença registrada. */
  excluir(chamadaId: string, alunoId: number): Promise<boolean>
}

export interface TentativaRepository {
  registrar(tentativa: Omit<TentativaRegistro, 'id'>): Promise<void>
  /** Quantidade de tentativas por resultado nas chamadas informadas. */
  contarPorResultado(chamadaIds: string[]): Promise<Partial<Record<ResultadoTentativa, number>>>
}

export interface Repositorios {
  professores: ProfessorRepository
  alunos: AlunoRepository
  turmas: TurmaRepository
  chamadas: ChamadaRepository
  presencas: PresencaRepository
  tentativas: TentativaRepository
  /** Libera conexões abertas (no PostgreSQL, encerra o pool). */
  encerrar(): Promise<void>
}
