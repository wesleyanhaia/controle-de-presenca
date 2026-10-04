import { useState, type FormEvent } from 'react'
import { Eye, EyeOff } from 'lucide-react'
import { Navigate, useNavigate } from 'react-router-dom'
import { CHAVE_SESSAO_EXPIRADA, mensagemDeErro } from '../services/api'
import { isAuthenticated, login } from '../services/auth'
import "./Login.css"

function consumirAvisoDeSessao() {
  const expirada = sessionStorage.getItem(CHAVE_SESSAO_EXPIRADA)
  sessionStorage.removeItem(CHAVE_SESSAO_EXPIRADA)
  return expirada ? 'Sua sessão expirou. Entre novamente para continuar.' : ''
}

export default function Login() {
  const navigate = useNavigate()

  const [email, setEmail] = useState('')
  const [senha, setSenha] = useState('')
  const [senhaVisivel, setSenhaVisivel] = useState(false)
  const [aviso] = useState(consumirAvisoDeSessao)
  const [mensagemErro, setMensagemErro] = useState('')
  const [carregando, setCarregando] = useState(false)

  if (isAuthenticated() && !carregando) {
    return <Navigate to="/dashboard" replace />
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()

    try {
      setCarregando(true)
      setMensagemErro('')

      await login(email.trim(), senha)

      navigate('/dashboard', { replace: true })
    } catch (erro) {
      setMensagemErro(mensagemDeErro(erro, 'Não foi possível entrar. Tente novamente.'))
    } finally {
      setCarregando(false)
    }
  }

  return (
    <main className="login-page">
      <section className="login-card">
        <div className="login-card__logo">CP</div>

        <h1>Controle de Presença</h1>

        <p className="login-card__description">
          Acesse o sistema para criar chamadas, gerar QR Codes e consultar
          registros de presença.
        </p>

        <form className="login-form" onSubmit={handleSubmit}>
          <div className="form-group">
            <label htmlFor="email">E-mail institucional</label>

            <input
              id="email"
              type="email"
              placeholder="professor@unesc.br"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              autoComplete="email"
              autoFocus
              required
            />
          </div>

          <div className="form-group">
            <label htmlFor="senha">Senha</label>

            <div className="form-group__password">
              <input
                id="senha"
                type={senhaVisivel ? 'text' : 'password'}
                placeholder="Digite sua senha"
                value={senha}
                onChange={(event) => setSenha(event.target.value)}
                autoComplete="current-password"
                required
              />

              <button
                type="button"
                onClick={() => setSenhaVisivel((visivel) => !visivel)}
                aria-label={senhaVisivel ? 'Ocultar senha' : 'Mostrar senha'}
                title={senhaVisivel ? 'Ocultar senha' : 'Mostrar senha'}
              >
                {senhaVisivel ? <EyeOff size={18} /> : <Eye size={18} />}
              </button>
            </div>
          </div>

          {aviso && !mensagemErro && (
            <p className="form-notice" role="status">
              {aviso}
            </p>
          )}

          {mensagemErro && (
            <p className="form-error" role="alert">
              {mensagemErro}
            </p>
          )}

          <button className="button button--primary" type="submit" disabled={carregando}>
            {carregando ? 'Entrando...' : 'Entrar'}
          </button>
        </form>

        <div className="login-card__test-info">
          <strong>Acesso de demonstração</strong>
          <span>E-mail: professor@unesc.br</span>
          <span>Senha: 123456</span>
        </div>
      </section>
    </main>
  )
}
