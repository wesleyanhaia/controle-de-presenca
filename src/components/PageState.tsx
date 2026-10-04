import { LoaderCircle, RefreshCw, WifiOff } from 'lucide-react'
import './PageState.css'

interface PageStateProps {
  carregando: boolean
  erro: string
  onTentarNovamente: () => void
}

/** Aviso de carregamento ou de falha ao buscar os dados de uma tela. */
export default function PageState({ carregando, erro, onTentarNovamente }: PageStateProps) {
  if (erro) {
    return (
      <div className="page-state page-state--error" role="alert">
        <WifiOff size={26} />
        <strong>Não foi possível carregar os dados</strong>
        <span>{erro}</span>
        <button type="button" onClick={onTentarNovamente}>
          <RefreshCw size={15} /> Tentar novamente
        </button>
      </div>
    )
  }

  if (carregando) {
    return (
      <div className="page-state" role="status">
        <LoaderCircle size={26} className="page-state__spinner" />
        <span>Carregando...</span>
      </div>
    )
  }

  return null
}
