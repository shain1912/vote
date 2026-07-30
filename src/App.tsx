import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom'
import { AdminRouteGuard } from './components/AdminRouteGuard'
import { AdminDashboardPage } from './pages/admin/AdminDashboardPage'
import { AdminLoginPage } from './pages/admin/AdminLoginPage'
import { HomePage } from './pages/HomePage'
import { JudgePage } from './pages/judge/JudgePage'
import { NotFoundPage } from './pages/NotFoundPage'
import { StudentInvestPage } from './pages/student/StudentInvestPage'

export default function App() {
  return (
    <BrowserRouter basename={import.meta.env.BASE_URL}>
      <Routes>
        <Route path="/" element={<HomePage />} />

        <Route path="/t/:code" element={<StudentInvestPage />} />
        <Route path="/j/:code" element={<JudgePage />} />

        {/* Bare /admin isn't a guessable shortcut to results: it just
            forwards to /admin/dashboard, which itself redirects to
            /admin/login unless there's an authenticated Supabase session. */}
        <Route path="/admin" element={<Navigate to="/admin/dashboard" replace />} />
        <Route path="/admin/login" element={<AdminLoginPage />} />
        <Route
          path="/admin/dashboard"
          element={
            <AdminRouteGuard>
              <AdminDashboardPage />
            </AdminRouteGuard>
          }
        />

        <Route path="*" element={<NotFoundPage />} />
      </Routes>
    </BrowserRouter>
  )
}
