import bcrypt from 'bcryptjs'
import type { Aluno, Professor, Turma } from '../domain/types.ts'
import { erros } from '../errors.ts'
import { ErroDeDuplicidade, ErroDeVinculo, type Repositorios } from '../repositories/contracts.ts'
import { coordenadasValidas } from './geo.ts'

/*
  Cadastros (CRUD) de professores, alunos, turmas e matrículas.
  As respostas nunca incluem o hash da senha.
*/

export interface DadosProfessor {
  nome: string
  email: string
  senha: string
}

export interface DadosAluno {
  nome: string
  matricula: string
  email: string
  senha: string
}

export interface DadosTurma {
  codigo: string
  nome: string
  disciplina: string
  semestre: string
  local?: string
  latitude?: number | null
  longitude?: number | null
}

const professorDTO = ({ senhaHash: _senhaHash, ...professor }: Professor) => professor
const alunoDTO = ({ senhaHash: _senhaHash, ...aluno }: Aluno) => aluno

const gerarHash = (senha: string) => bcrypt.hash(senha, 10)

/** Converte os erros dos repositórios em respostas HTTP. */
async function tratar<T>(operacao: () => Promise<T>): Promise<T> {
  try {
    return await operacao()
  } catch (erro) {
    if (erro instanceof ErroDeDuplicidade) throw erros.conflito('CADASTRO_DUPLICADO', erro.message)
    if (erro instanceof ErroDeVinculo) {
      throw erros.conflito('POSSUI_VINCULOS', `Não é possível excluir: ${erro.message.charAt(0).toLowerCase()}${erro.message.slice(1)}`)
    }
    throw erro
  }
}

export function criarCadastroService(repositorios: Repositorios) {
  const { professores, alunos, turmas } = repositorios

  /**
   * O login procura o e-mail primeiro entre os professores e depois entre os
   * alunos, então o mesmo e-mail não pode existir nos dois cadastros.
   */
  async function garantirEmailLivre(email: string | undefined, dono: { perfil: 'PROFESSOR' | 'ALUNO'; id?: number }) {
    if (email === undefined) return
    const [professor, aluno] = await Promise.all([professores.buscarPorEmail(email), alunos.buscarPorEmail(email)])
    const emUso =
      (professor && !(dono.perfil === 'PROFESSOR' && professor.id === dono.id)) ||
      (aluno && !(dono.perfil === 'ALUNO' && aluno.id === dono.id))
    if (emUso) throw erros.conflito('CADASTRO_DUPLICADO', 'E-mail já cadastrado.')
  }

  async function turmaDoProfessor(turmaId: number, professorId: number) {
    const turma = await turmas.buscarPorId(turmaId)
    if (!turma || turma.professorId !== professorId) throw erros.naoEncontrado('Turma não encontrada.')
    return turma
  }

  async function turmaDTO(turma: Turma) {
    const { professorId: _professorId, ...dados } = turma
    return { ...dados, quantidadeAlunos: (await alunos.listarPorTurma(turma.id)).length }
  }

  function validarLocalizacao(dados: Partial<DadosTurma>) {
    const { latitude, longitude } = dados
    if (latitude == null && longitude == null) return
    if (latitude == null || longitude == null || !coordenadasValidas(latitude, longitude)) {
      throw erros.invalido('COORDENADAS_INVALIDAS', 'Informe latitude e longitude válidas para o local da turma.')
    }
  }

  return {
    // ---------- Professores ----------

    async listarProfessores() {
      return (await professores.listar()).map(professorDTO)
    },

    async buscarProfessor(id: number) {
      const professor = await professores.buscarPorId(id)
      if (!professor) throw erros.naoEncontrado('Professor não encontrado.')
      return professorDTO(professor)
    },

    async criarProfessor(dados: DadosProfessor) {
      await garantirEmailLivre(dados.email, { perfil: 'PROFESSOR' })
      const professor = await tratar(async () =>
        professores.criar({ nome: dados.nome, email: dados.email, senhaHash: await gerarHash(dados.senha) }),
      )
      return professorDTO(professor)
    },

    /** O professor só altera o próprio cadastro. */
    async atualizarProfessor(id: number, professorLogado: number, dados: Partial<DadosProfessor>) {
      if (id !== professorLogado) throw erros.semPermissao('Você só pode alterar o seu próprio cadastro.')
      await garantirEmailLivre(dados.email, { perfil: 'PROFESSOR', id })
      const professor = await tratar(async () =>
        professores.atualizar(id, {
          nome: dados.nome,
          email: dados.email,
          senhaHash: dados.senha ? await gerarHash(dados.senha) : undefined,
        }),
      )
      if (!professor) throw erros.naoEncontrado('Professor não encontrado.')
      return professorDTO(professor)
    },

    async excluirProfessor(id: number, professorLogado: number) {
      if (id === professorLogado) throw erros.conflito('POSSUI_VINCULOS', 'Você não pode excluir o seu próprio cadastro.')
      if (!(await tratar(() => professores.excluir(id)))) throw erros.naoEncontrado('Professor não encontrado.')
    },

    // ---------- Alunos ----------

    async listarAlunos(busca?: string) {
      const termo = busca?.trim().toLowerCase()
      const lista = await alunos.listar()
      return lista
        .filter((aluno) => !termo || [aluno.nome, aluno.matricula, aluno.email].some((campo) => campo.toLowerCase().includes(termo)))
        .map(alunoDTO)
    },

    async buscarAluno(id: number) {
      const aluno = await alunos.buscarPorId(id)
      if (!aluno) throw erros.naoEncontrado('Aluno não encontrado.')
      return { ...alunoDTO(aluno), turmas: (await turmas.listarPorAluno(id)).map((turma) => turma.id) }
    },

    async criarAluno(dados: DadosAluno) {
      await garantirEmailLivre(dados.email, { perfil: 'ALUNO' })
      const aluno = await tratar(async () =>
        alunos.criar({
          nome: dados.nome,
          matricula: dados.matricula,
          email: dados.email,
          senhaHash: await gerarHash(dados.senha),
        }),
      )
      return alunoDTO(aluno)
    },

    async atualizarAluno(id: number, dados: Partial<DadosAluno>) {
      await garantirEmailLivre(dados.email, { perfil: 'ALUNO', id })
      const aluno = await tratar(async () =>
        alunos.atualizar(id, {
          nome: dados.nome,
          matricula: dados.matricula,
          email: dados.email,
          senhaHash: dados.senha ? await gerarHash(dados.senha) : undefined,
        }),
      )
      if (!aluno) throw erros.naoEncontrado('Aluno não encontrado.')
      return alunoDTO(aluno)
    },

    async excluirAluno(id: number) {
      if (!(await tratar(() => alunos.excluir(id)))) throw erros.naoEncontrado('Aluno não encontrado.')
    },

    // ---------- Turmas (sempre do professor logado) ----------

    async listarTurmas(professorId: number) {
      return Promise.all((await turmas.listarPorProfessor(professorId)).map(turmaDTO))
    },

    async buscarTurma(turmaId: number, professorId: number) {
      return turmaDTO(await turmaDoProfessor(turmaId, professorId))
    },

    async criarTurma(professorId: number, dados: DadosTurma) {
      validarLocalizacao(dados)
      const turma = await tratar(() =>
        turmas.criar({
          ...dados,
          professorId,
          local: dados.local ?? '',
          latitude: dados.latitude ?? null,
          longitude: dados.longitude ?? null,
        }),
      )
      return turmaDTO(turma)
    },

    async atualizarTurma(turmaId: number, professorId: number, dados: Partial<DadosTurma>) {
      await turmaDoProfessor(turmaId, professorId)
      validarLocalizacao(dados)
      const turma = await tratar(() => turmas.atualizar(turmaId, dados))
      return turmaDTO(turma!)
    },

    async excluirTurma(turmaId: number, professorId: number) {
      await turmaDoProfessor(turmaId, professorId)
      await tratar(() => turmas.excluir(turmaId))
    },

    // ---------- Matrículas ----------

    async listarAlunosDaTurma(turmaId: number, professorId: number) {
      await turmaDoProfessor(turmaId, professorId)
      return (await alunos.listarPorTurma(turmaId)).map(alunoDTO)
    },

    async matricularAluno(turmaId: number, professorId: number, alunoId: number) {
      await turmaDoProfessor(turmaId, professorId)
      if (!(await alunos.buscarPorId(alunoId))) throw erros.naoEncontrado('Aluno não encontrado.')
      await turmas.matricular(turmaId, alunoId)
      return (await alunos.listarPorTurma(turmaId)).map(alunoDTO)
    },

    async desmatricularAluno(turmaId: number, professorId: number, alunoId: number) {
      await turmaDoProfessor(turmaId, professorId)
      if (!(await turmas.desmatricular(turmaId, alunoId))) {
        throw erros.naoEncontrado('Aluno não encontrado nesta turma.')
      }
    },
  }
}

export type CadastroService = ReturnType<typeof criarCadastroService>
