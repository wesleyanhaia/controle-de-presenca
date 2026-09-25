import { useState, type FormEvent } from 'react'
import { useNavigate } from 'react-router-dom'
import { login } from '../services/auth'
import "./Login.css"

export default function Login() {
  const navigate = useNavigate()

  const [email, setEmail] = useState('')
  const [senha, setSenha] = useState('')
  const [mensagemErro, setMensagemErro] = useState('')
  const [carregando, setCarregando] = useState(false)

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()

    try {
      setCarregando(true)
      setMensagemErro('')

      await login(email, senha)

      navigate('/dashboard')
    } catch {
      setMensagemErro('E-mail ou senha inválidos.')
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
              required
            />
          </div>

          <div className="form-group">
            <label htmlFor="senha">Senha</label>

            <input
              id="senha"
              type="password"
              placeholder="Digite sua senha"
              value={senha}
              onChange={(event) => setSenha(event.target.value)}
              autoComplete="current-password"
              required
            />
          </div>

          {mensagemErro && (
            <p className="form-error" role="alert">
              {mensagemErro}
            </p>
          )}

          <button className="button button--primary" type="submit">
            {carregando ? 'Entrando...' : 'Entrar'}
          </button>
        </form>

        <div className="login-card__test-info">
          <strong>Acesso temporário para teste</strong>
          <span>E-mail: professor@unesc.br</span>
          <span>Senha: 123456</span>
        </div>
      </section>
    </main>
  )
}