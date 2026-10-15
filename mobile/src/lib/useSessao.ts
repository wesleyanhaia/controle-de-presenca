import { createContext, useContext } from 'react'
import type { Sessao } from './api'

export interface ContextoDeSessao {
  sessao: Sessao | null
  carregando: boolean
  /** Endereço da API em uso. */
  servidor: string
  /** Testa o endereço e, se responder, passa a usá-lo (fica salvo no aparelho). */
  alterarServidor(endereco: string): Promise<void>
  entrar(matricula: string, senha: string): Promise<void>
  sair(): Promise<void>
  /** Requisição autenticada; se o login tiver expirado, encerra a sessão. */
  requisitarComSessao<T>(caminho: string, opcoes?: { metodo?: string; corpo?: unknown }): Promise<T>
}

export const ContextoDaSessao = createContext<ContextoDeSessao | null>(null)

export function useSessao() {
  const contexto = useContext(ContextoDaSessao)
  if (!contexto) throw new Error('useSessao precisa estar dentro de <ProvedorDeSessao>.')
  return contexto
}
