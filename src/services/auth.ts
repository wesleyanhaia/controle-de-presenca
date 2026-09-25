import type { Professor } from '../types/Professor'

const CHAVE_TOKEN = 'token'
const CHAVE_PROFESSOR = 'professor'

const professorTeste: Professor = {
  id: 1,
  nome: 'Wesley Anhaia da Silva',
  email: 'professor@unesc.br',
}

interface LoginResponse {
  token: string
  professor: Professor
}

export async function login(
  email: string,
  senha: string,
): Promise<LoginResponse> {
  /*
    Esta validação é temporária, somente para desenvolver o frontend.

    Quando o backend Spring Boot estiver pronto, esta função enviará
    os dados para a API e receberá um token JWT real.
  */
  if (email !== 'professor@unesc.br' || senha !== '123456') {
    throw new Error('E-mail ou senha inválidos.')
  }

  const tokenSimulado = 'token-professor-simulado'

  localStorage.setItem(CHAVE_TOKEN, tokenSimulado)
  localStorage.setItem(CHAVE_PROFESSOR, JSON.stringify(professorTeste))

  return {
    token: tokenSimulado,
    professor: professorTeste,
  }
}

export function logout() {
  localStorage.removeItem(CHAVE_TOKEN)
  localStorage.removeItem(CHAVE_PROFESSOR)
}

export function isAuthenticated() {
  return Boolean(localStorage.getItem(CHAVE_TOKEN))
}

export function getProfessorLogado(): Professor | null {
  const professorSalvo = localStorage.getItem(CHAVE_PROFESSOR)

  if (!professorSalvo) {
    return null
  }

  return JSON.parse(professorSalvo) as Professor
}