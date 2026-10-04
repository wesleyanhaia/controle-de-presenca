import { useCallback, useEffect, useState } from 'react'
import { mensagemDeErro } from '../services/api'

interface Estado<T> {
  dados: T | null
  erro: string
  carregando: boolean
}

/**
 * Carrega dados da API ao montar a tela e expõe `recarregar`.
 * `buscar` deve ser uma função estável (declarada fora do componente).
 */
export function useDados<T>(buscar: () => Promise<T>) {
  const [estado, setEstado] = useState<Estado<T>>({ dados: null, erro: '', carregando: true })
  const [versao, setVersao] = useState(0)

  useEffect(() => {
    let ativo = true

    buscar().then(
      (dados) => {
        if (ativo) setEstado({ dados, erro: '', carregando: false })
      },
      (erro) => {
        if (ativo) setEstado((atual) => ({ ...atual, erro: mensagemDeErro(erro), carregando: false }))
      },
    )

    return () => {
      ativo = false
    }
  }, [buscar, versao])

  const recarregar = useCallback(() => {
    setEstado((atual) => ({ ...atual, erro: '', carregando: true }))
    setVersao((atual) => atual + 1)
  }, [])

  return { ...estado, recarregar }
}
