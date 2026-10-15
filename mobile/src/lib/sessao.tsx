import * as SecureStore from 'expo-secure-store'
import { useCallback, useEffect, useMemo, useState, type ReactNode } from 'react'
import { definirUrlDaApi, ErroDaApi, normalizarEndereco, obterUrlDaApi, requisitar, testarServidor, type Sessao } from './api'
import { ContextoDaSessao } from './useSessao'

// O token fica no armazenamento seguro do aparelho (Android Keystore).
const CHAVE = 'presenca.sessao'
const CHAVE_SERVIDOR = 'presenca.servidor'

export function ProvedorDeSessao({ children }: { children: ReactNode }) {
  const [sessao, setSessao] = useState<Sessao | null>(null)
  const [carregando, setCarregando] = useState(true)
  const [servidor, setServidor] = useState(obterUrlDaApi)

  useEffect(() => {
    const lerSessao = SecureStore.getItemAsync(CHAVE)
      .then((salva) => {
        if (salva) setSessao(JSON.parse(salva) as Sessao)
      })
      .catch(() => {
        // Sessão ilegível: o aluno simplesmente faz login de novo.
      })
    const lerServidor = SecureStore.getItemAsync(CHAVE_SERVIDOR)
      .then((salvo) => {
        if (!salvo) return
        definirUrlDaApi(salvo)
        setServidor(obterUrlDaApi())
      })
      .catch(() => {
        // Sem endereço salvo: vale o padrão do aplicativo.
      })
    Promise.all([lerSessao, lerServidor]).finally(() => setCarregando(false))
  }, [])

  const alterarServidor = useCallback(async (endereco: string) => {
    const url = normalizarEndereco(endereco)
    await testarServidor(url)
    definirUrlDaApi(url)
    setServidor(url)
    await SecureStore.setItemAsync(CHAVE_SERVIDOR, url)
  }, [])

  const sair = useCallback(async () => {
    setSessao(null)
    await SecureStore.deleteItemAsync(CHAVE).catch(() => {})
  }, [])

  const entrar = useCallback(async (matricula: string, senha: string) => {
    const nova = await requisitar<Sessao>('/auth/login/aluno', { corpo: { matricula, senha } })
    await SecureStore.setItemAsync(CHAVE, JSON.stringify(nova))
    setSessao(nova)
  }, [])

  const requisitarComSessao = useCallback(
    async <T,>(caminho: string, opcoes: { metodo?: string; corpo?: unknown } = {}) => {
      try {
        return await requisitar<T>(caminho, { ...opcoes, token: sessao?.token })
      } catch (erro) {
        if (erro instanceof ErroDaApi && erro.status === 401) await sair()
        throw erro
      }
    },
    [sessao, sair],
  )

  const valor = useMemo(
    () => ({ sessao, carregando, servidor, alterarServidor, entrar, sair, requisitarComSessao }),
    [sessao, carregando, servidor, alterarServidor, entrar, sair, requisitarComSessao],
  )

  return <ContextoDaSessao.Provider value={valor}>{children}</ContextoDaSessao.Provider>
}
