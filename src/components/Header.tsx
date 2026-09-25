import { Bell, ChevronDown } from 'lucide-react'
import { useLocation } from 'react-router-dom'
import { getProfessorLogado } from '../services/auth'
import './Header.css'

function Header() {
  const { pathname } = useLocation()
  const professor = getProfessorLogado()
  const nome = professor?.nome ?? 'Professor'
  const primeiroNome = nome.split(' ')[0]
  const iniciais = nome.split(' ').filter(Boolean).slice(0, 2).map((parte) => parte[0]).join('').toUpperCase()
  const titulo = pathname === '/chamada'
    ? 'Realizar chamada'
    : pathname === '/registros'
      ? 'Registros de presença'
      : 'Visão geral'

  return (
    <header className="header">
      <div className="header__welcome">
        <div>
          <p>{titulo}</p>
          <h1>Olá, {primeiroNome}!</h1>
        </div>
      </div>

      <div className="header__actions">
        <button
          className="header__notification"
          type="button"
          aria-label="Ver notificações"
        >
          <Bell size={21} />
          <span />
        </button>

        <div className="header__profile">
          <div className="header__avatar">{iniciais}</div>

          <div className="header__profile-info">
            <strong>{nome}</strong>
            <span>Professor</span>
          </div>

          <ChevronDown size={18} className="header__profile-arrow" />
        </div>
      </div>
    </header>
  );
}

export default Header;