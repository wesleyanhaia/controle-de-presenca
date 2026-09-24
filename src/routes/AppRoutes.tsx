import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom'

import ProtectedRoute from '../components/ProtectedRoute'
import Chamada from '../pages/Chamada'
import Dashboard from '../pages/Dashboard'
import Login from '../pages/Login'
import Registros from '../pages/Registros'

export default function AppRoutes() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<Navigate to="/login" replace />} />

        <Route path="/login" element={<Login />} />

        <Route element={<ProtectedRoute />}>
          <Route path="/dashboard" element={<Dashboard />} />
          <Route path="/chamada" element={<Chamada />} />
          <Route path="/registros" element={<Registros />} />
        </Route>

        <Route path="*" element={<Navigate to="/login" replace />} />
      </Routes>
    </BrowserRouter>
  )
}