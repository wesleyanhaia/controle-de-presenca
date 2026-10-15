import bcrypt from 'bcryptjs'
import type { Aluno, Chamada, Matricula, Presenca, Professor, TentativaRegistro, Turma } from '../../domain/types.ts'

export interface Dados {
  professores: Professor[]
  alunos: Aluno[]
  turmas: Turma[]
  matriculas: Matricula[]
  chamadas: Chamada[]
  presencas: Presenca[]
  tentativas: TentativaRegistro[]
}

export const SENHA_DO_PROFESSOR = '123456'
/** Senha curta só para facilitar os testes; cadastros pela API exigem 6 caracteres. */
export const SENHA_DOS_ALUNOS = '123'

/**
 * Dados de demonstração (repositório em memória e carga inicial do PostgreSQL).
 * Começam sem chamadas: presenças e faltas surgem dos testes.
 */
export function dadosDeDemonstracao(): Dados {
  const professores: Professor[] = [
    { id: 1, nome: 'Wesley Anhaia da Silva', email: 'professor@unesc.br', senhaHash: bcrypt.hashSync(SENHA_DO_PROFESSOR, 8) },
  ]

  // Matrícula = número do aluno (1 a 12), para entrar rápido no aplicativo durante os testes.
  const senhaDosAlunos = bcrypt.hashSync(SENHA_DOS_ALUNOS, 8)

  const alunos: Aluno[] = [
    'Ana Paula Martins',
    'Bruno Henrique Costa',
    'Camila Souza Lima',
    'Diego Alves Rocha',
    'Eduarda Mendes Silva',
    'Felipe Nunes Oliveira',
    'Gabriela Pereira Santos',
    'Henrique Cardoso Ramos',
    'Isabela Freitas Borges',
    'João Vitor Machado',
    'Larissa Teixeira Duarte',
    'Matheus Ribeiro Farias',
  ].map((nome, indice) => ({
    id: indice + 1,
    nome,
    matricula: String(indice + 1),
    email: `aluno${indice + 1}@unesc.net`,
    senhaHash: senhaDosAlunos,
  }))

  const turmaBase = { professorId: 1, semestre: '2026/2', latitude: null, longitude: null }
  const turmas: Turma[] = [
    { ...turmaBase, id: 1, codigo: 'CCO-501', nome: 'Ciência da Computação · 5ª fase', disciplina: 'Estruturas de Dados', local: 'Bloco XXI · Sala 204' },
    { ...turmaBase, id: 2, codigo: 'CCO-302', nome: 'Ciência da Computação · 3ª fase', disciplina: 'Programação Orientada a Objetos', local: 'Bloco XXI · Sala 108' },
    { ...turmaBase, id: 3, codigo: 'CCO-405', nome: 'Ciência da Computação · 4ª fase', disciplina: 'Banco de Dados', local: 'Bloco XXI · Sala 301' },
    { ...turmaBase, id: 4, codigo: 'CCO-204', nome: 'Ciência da Computação · 2ª fase', disciplina: 'Redes de Computadores', local: 'Bloco XXI · Laboratório 2' },
  ]

  const alunosPorTurma: Record<number, number[]> = {
    1: [1, 2, 3, 4, 5, 6, 7, 8],
    2: [4, 5, 6, 9, 10, 11],
    3: [1, 3, 6, 8, 10, 12],
    4: [2, 7, 9, 11, 12],
  }
  const matriculas: Matricula[] = Object.entries(alunosPorTurma).flatMap(([turmaId, ids]) =>
    ids.map((alunoId) => ({ turmaId: Number(turmaId), alunoId })),
  )

  return { professores, alunos, turmas, matriculas, chamadas: [], presencas: [], tentativas: [] }
}
