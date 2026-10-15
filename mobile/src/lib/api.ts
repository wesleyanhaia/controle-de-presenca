/*
  Comunicação com o backend. No celular, "localhost" é o próprio aparelho: o
  endereço é o IP do computador que roda o backend, por exemplo
  http://192.168.1.140:3333/api.

  O endereço padrão vem de EXPO_PUBLIC_API_URL (.env.local no Expo Go; "env"
  do eas.json no APK). Como o IP muda de uma rede para outra, o aluno pode
  trocá-lo na tela de login sem gerar um novo APK.
*/

const TEMPO_LIMITE_MS = 15_000
const PORTA_PADRAO = 3333

/**
 * Completa o endereço digitado: "192.168.1.140" e "192.168.1.140:3333"
 * viram "http://192.168.1.140:3333/api"; uma URL com caminho fica como está.
 */
export function normalizarEndereco(texto: string): string {
  let url = texto.trim().replace(/\/+$/, '')
  if (!url) return ''
  if (!/^https?:\/\//i.test(url)) url = `http://${url}`

  const [, origem, caminho] = url.match(/^(https?:\/\/[^/]+)(\/.*)?$/i) ?? []
  if (!origem) return url
  if (caminho) return url
  const comPorta = /:\d+$/.test(origem) || /^https:/i.test(origem) ? origem : `${origem}:${PORTA_PADRAO}`
  return `${comPorta}/api`
}

export const URL_PADRAO_DA_API = normalizarEndereco(process.env.EXPO_PUBLIC_API_URL ?? '')

let urlDaApi = URL_PADRAO_DA_API

export const obterUrlDaApi = () => urlDaApi

export function definirUrlDaApi(url: string) {
  urlDaApi = normalizarEndereco(url)
}

/** Confere se há um backend do Presença+ respondendo no endereço (GET /health). */
export async function testarServidor(url: string): Promise<void> {
  const controle = new AbortController()
  const temporizador = setTimeout(() => controle.abort(), 6_000)
  try {
    const resposta = await fetch(`${url}/health`, { signal: controle.signal })
    const corpo = await resposta.json().catch(() => null)
    if (!resposta.ok || corpo?.status !== 'ok') throw new Error('resposta inesperada')
  } catch {
    throw new ErroDaApi(
      'SEM_CONEXAO',
      'Nenhum servidor do Presença+ respondeu nesse endereço. Confira o IP, se o backend está rodando e se o celular está na mesma rede.',
    )
  } finally {
    clearTimeout(temporizador)
  }
}

export interface Usuario {
  id: number
  nome: string
  email: string
  perfil: 'ALUNO' | 'PROFESSOR'
  matricula?: string
}

export interface Sessao {
  token: string
  usuario: Usuario
}

export interface TurmaResumo {
  id: number
  codigo: string
  disciplina: string
  presencas: number
  faltas: number
  percentualPresenca: number
}

export interface Registro {
  id: string
  chamadaId: string
  turmaId: number
  dataAula: string
  dataHoraRegistro?: string
  status: 'PRESENTE' | 'AUSENTE' | 'PENDENTE'
  origem?: 'QR_CODE' | 'MANUAL'
  distanciaMetros?: number
}

export interface Historico {
  turmas: TurmaResumo[]
  registros: Registro[]
}

export interface PresencaRegistrada {
  chamadaId: string
  turmaId: number
  registradaEm: string
  distanciaMetros: number
}

/** Erro devolvido pela API ({ erro: { codigo, mensagem } }) ou falha de conexão. */
export class ErroDaApi extends Error {
  readonly codigo: string
  readonly status: number

  constructor(codigo: string, mensagem: string, status = 0) {
    super(mensagem)
    this.codigo = codigo
    this.status = status
  }
}

export async function requisitar<T>(
  caminho: string,
  opcoes: { token?: string; metodo?: string; corpo?: unknown } = {},
): Promise<T> {
  if (!urlDaApi) {
    throw new ErroDaApi('SEM_CONFIGURACAO', 'Informe o endereço do servidor na tela de login.')
  }

  const controle = new AbortController()
  const temporizador = setTimeout(() => controle.abort(), TEMPO_LIMITE_MS)

  let resposta: Response
  try {
    resposta = await fetch(`${urlDaApi}${caminho}`, {
      method: opcoes.metodo ?? (opcoes.corpo ? 'POST' : 'GET'),
      headers: {
        'Content-Type': 'application/json',
        ...(opcoes.token ? { Authorization: `Bearer ${opcoes.token}` } : {}),
      },
      body: opcoes.corpo ? JSON.stringify(opcoes.corpo) : undefined,
      signal: controle.signal,
    })
  } catch {
    throw new ErroDaApi(
      'SEM_CONEXAO',
      'Não foi possível falar com o servidor. Verifique sua conexão com a internet e tente novamente.',
    )
  } finally {
    clearTimeout(temporizador)
  }

  const corpo = await resposta.json().catch(() => null)
  if (!resposta.ok) {
    throw new ErroDaApi(
      corpo?.erro?.codigo ?? 'ERRO_INTERNO',
      corpo?.erro?.mensagem ?? 'O servidor não conseguiu processar a solicitação.',
      resposta.status,
    )
  }
  return corpo as T
}
