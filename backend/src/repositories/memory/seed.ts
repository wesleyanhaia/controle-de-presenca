import bcrypt from 'bcryptjs'
import type { Aluno, Chamada, Matricula, Presenca, Professor, Turma } from '../../domain/types.ts'

export interface Dados {
  professores: Professor[]
  alunos: Aluno[]
  turmas: Turma[]
  matriculas: Matricula[]
  chamadas: Chamada[]
  presencas: Presenca[]
}

export const SENHA_DE_DEMONSTRACAO = '123456'

function dataRelativa(diasAtras: number, hora: number, minuto: number) {
  const data = new Date()
  data.setDate(data.getDate() - diasAtras)
  data.setHours(hora, minuto, 0, 0)
  return data
}

/** Dados de demonstração usados enquanto não há banco de dados. */
export function dadosDeDemonstracao(): Dados {
  const senhaHash = bcrypt.hashSync(SENHA_DE_DEMONSTRACAO, 8)

  const professores: Professor[] = [
    { id: 1, nome: 'Wesley Anhaia da Silva', email: 'professor@unesc.br', senhaHash },
  ]

  const alunos: Aluno[] = [
    ['Ana Paula Martins', '20241021'],
    ['Bruno Henrique Costa', '20241036'],
    ['Camila Souza Lima', '20241049'],
    ['Diego Alves Rocha', '20230918'],
    ['Eduarda Mendes Silva', '20230942'],
    ['Felipe Nunes Oliveira', '20230813'],
    ['Gabriela Pereira Santos', '20241058'],
    ['Henrique Cardoso Ramos', '20230877'],
    ['Isabela Freitas Borges', '20241063'],
    ['João Vitor Machado', '20230925'],
    ['Larissa Teixeira Duarte', '20241077'],
    ['Matheus Ribeiro Farias', '20230834'],
  ].map(([nome, matricula], indice) => ({
    id: indice + 1,
    nome,
    matricula,
    email: `aluno${indice + 1}@unesc.net`,
    senhaHash,
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

  // Chamadas já encerradas, para o dashboard e os registros não iniciarem vazios.
  const localDaAula = { latitude: -28.6775, longitude: -49.3697 }
  const historico: { turmaId: number; diasAtras: number; presentes: number[] }[] = [
    { turmaId: 1, diasAtras: 1, presentes: [1, 2, 4, 5, 7, 8] },
    { turmaId: 2, diasAtras: 2, presentes: [4, 6, 9, 10] },
    { turmaId: 3, diasAtras: 3, presentes: [1, 3, 6, 8, 12] },
    { turmaId: 4, diasAtras: 6, presentes: [2, 7, 9] },
  ]

  const chamadas: Chamada[] = []
  const presencas: Presenca[] = []

  historico.forEach((aula, indice) => {
    const chamadaId = `demo-${indice + 1}`
    chamadas.push({
      id: chamadaId,
      turmaId: aula.turmaId,
      professorId: 1,
      iniciadaEm: dataRelativa(aula.diasAtras, 19, 0).toISOString(),
      encerradaEm: dataRelativa(aula.diasAtras, 19, 20).toISOString(),
      ...localDaAula,
      raioMetros: 20,
    })
    aula.presentes.forEach((alunoId, posicao) => {
      presencas.push({
        id: presencas.length + 1,
        chamadaId,
        alunoId,
        registradaEm: dataRelativa(aula.diasAtras, 19, 2 + posicao).toISOString(),
        origem: 'QR_CODE',
        ...localDaAula,
        distanciaMetros: 4 + ((alunoId * 3) % 13),
      })
    })
  })

  return { professores, alunos, turmas, matriculas, chamadas, presencas }
}
