import { NavLink } from "react-router-dom";
import {
  CalendarCheck,
  ClipboardList,
  LayoutDashboard,
  LogOut,
  MapPin,
  QrCode,
} from "lucide-react";
import "./Sidebar.css";

function Sidebar() {
  return (
    <aside className="sidebar">
      <div>
        <div className="sidebar__brand">
          <div className="sidebar__brand-icon">
            <QrCode size={24} />
          </div>

          <div>
            <strong>Presença+</strong>
            <span>Portal do Professor</span>
          </div>
        </div>

        <nav className="sidebar__navigation">
          <p className="sidebar__section-title">MENU PRINCIPAL</p>

          <NavLink
            to="/dashboard"
            className={({ isActive }) =>
              `sidebar__link ${isActive ? "sidebar__link--active" : ""}`
            }
          >
            <LayoutDashboard size={20} />
            Dashboard
          </NavLink>

          <NavLink
            to="/chamada"
            className={({ isActive }) =>
              `sidebar__link ${isActive ? "sidebar__link--active" : ""}`
            }
          >
            <CalendarCheck size={20} />
            Realizar chamada
          </NavLink>

          <NavLink
          style={{backgroundColor:"white" }}
            to="/registros"
            className={({ isActive }) =>
              `sidebar__link ${isActive ? "sidebar__link--active" : ""}`
            }
          >
            <ClipboardList size={20} />
            Registros
          </NavLink>
        </nav>
      </div>

      <div className="sidebar__bottom">
        <div className="sidebar__privacy">
          <MapPin size={18} />
          <div>
            <strong>Localização segura</strong>
            <span>Validação por proximidade</span>
          </div>
        </div>

        <button className="sidebar__logout" type="button">
          <LogOut size={19} />
          Sair da conta
        </button>
      </div>
    </aside>
  );
}

export default Sidebar;