import { Navigate, Outlet } from 'react-router-dom'
import { isAuthenticated } from '../services/auth'
import "./ProtectedRoute.css"

export default function ProtectedRoute() {
  const usuarioAutenticado = isAuthenticated()

  return usuarioAutenticado ? <Outlet /> : <Navigate to="/login" replace />
}