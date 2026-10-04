import type { Professor } from '../types/Professor'
import { api, ApiError, CHAVE_PROFESSOR, CHAVE_TOKEN, limparSessao } from './api'

export interface UsuarioApi extends Professor {
  perfil: 'PROFESSOR' | 'ALUNO'
  matricula?: string
}

export interface LoginApi {
  token: string
  usuario: UsuarioApi
}

interface LoginResponse {
  token: string
  professor: Professor
}

export async function login(
  email: string,
  senha: string,
): Promise<LoginResponse> {
  const { token, usuario } = await api<LoginApi>('/auth/login', {
    body: { email, senha },
    token: null,
  })

  if (usuario.perfil !== 'PROFESSOR') {
    throw new ApiError(403, 'SEM_PERMISSAO', 'Este portal é exclusivo para professores. Alunos registram a presença pelo aplicativo.')
  }

  const professor: Professor = { id: usuario.id, nome: usuario.nome, email: usuario.email }

  localStorage.setItem(CHAVE_TOKEN, token)
  localStorage.setItem(CHAVE_PROFESSOR, JSON.stringify(professor))

  return { token, professor }
}

export function logout() {
  limparSessao()
}

export function isAuthenticated() {
  return Boolean(localStorage.getItem(CHAVE_TOKEN))
}

export function getProfessorLogado(): Professor | null {
  const professorSalvo = localStorage.getItem(CHAVE_PROFESSOR)

  if (!professorSalvo) {
    return null
  }

  try {
    return JSON.parse(professorSalvo) as Professor
  } catch {
    return null
  }
}
