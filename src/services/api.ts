/*
  Cliente HTTP do backend (pasta /backend).

  Em desenvolvimento o Vite encaminha "/api" para http://localhost:3333
  (veja vite.config.ts). Para apontar para outro servidor, defina
  VITE_API_URL, por exemplo: VITE_API_URL=https://meu-servidor/api
*/
export const API_BASE_URL: string = import.meta.env.VITE_API_URL ?? '/api'

export const CHAVE_TOKEN = 'token'
export const CHAVE_PROFESSOR = 'professor'
export const CHAVE_SESSAO_EXPIRADA = 'sessao-expirada'

export class ApiError extends Error {
  readonly status: number
  readonly codigo: string

  constructor(status: number, codigo: string, mensagem: string) {
    super(mensagem)
    this.status = status
    this.codigo = codigo
  }
}

interface OpcoesRequisicao {
  method?: 'GET' | 'POST'
  body?: unknown
  /** Token a usar no lugar do token do professor logado (null = sem autenticação). */
  token?: string | null
}

export function limparSessao() {
  localStorage.removeItem(CHAVE_TOKEN)
  localStorage.removeItem(CHAVE_PROFESSOR)
}

export async function api<T>(caminho: string, opcoes: OpcoesRequisicao = {}): Promise<T> {
  const usaSessao = opcoes.token === undefined
  const token = usaSessao ? localStorage.getItem(CHAVE_TOKEN) : opcoes.token
  let resposta: Response

  try {
    resposta = await fetch(`${API_BASE_URL}${caminho}`, {
      method: opcoes.method ?? (opcoes.body === undefined ? 'GET' : 'POST'),
      headers: {
        ...(opcoes.body === undefined ? {} : { 'Content-Type': 'application/json' }),
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
      body: opcoes.body === undefined ? undefined : JSON.stringify(opcoes.body),
    })
  } catch {
    throw new ApiError(0, 'SEM_CONEXAO', 'Não foi possível conectar ao servidor. Verifique sua conexão e se o backend está em execução.')
  }

  const corpo = await resposta.json().catch(() => null)

  if (!resposta.ok) {
    // Sessão do professor expirada ou inválida: volta para o login.
    if (resposta.status === 401 && usaSessao && token) {
      limparSessao()
      sessionStorage.setItem(CHAVE_SESSAO_EXPIRADA, '1')
      window.location.replace('/login')
    }

    throw new ApiError(
      resposta.status,
      corpo?.erro?.codigo ?? 'ERRO',
      corpo?.erro?.mensagem ?? (resposta.status >= 500
        ? 'O servidor não respondeu corretamente. Verifique se o backend está em execução.'
        : 'Não foi possível concluir a operação.'),
    )
  }

  return corpo as T
}

export function mensagemDeErro(erro: unknown, padrao = 'Não foi possível concluir a operação.') {
  return erro instanceof Error && erro.message ? erro.message : padrao
}
