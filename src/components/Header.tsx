import { Bell, ChevronDown, Menu } from "lucide-react";
import "./Header.css";

function Header() {
  return (
    <header className="header">
      <div className="header__welcome">
        <button className="header__menu-button" type="button">
          <Menu size={23} />
        </button>

        <div>
          <p>Visão geral</p>
          <h1>Olá, Professor!</h1>
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
          <div className="header__avatar">WA</div>

          <div className="header__profile-info">
            <strong>Wesley Anhaia</strong>
            <span>Professor</span>
          </div>

          <ChevronDown size={18} className="header__profile-arrow" />
        </div>
      </div>
    </header>
  );
}

export default Header;