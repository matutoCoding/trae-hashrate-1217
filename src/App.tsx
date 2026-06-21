import { HashRouter, Routes, Route } from 'react-router-dom'
import { Layout } from 'antd'
import AppLayout from './components/Layout'
import Dashboard from './pages/Dashboard'
import Robots from './pages/Robots'
import Schedule from './pages/Schedule'
import Billing from './pages/Billing'
import Bills from './pages/Bills'
import Insurance from './pages/Insurance'

export default function App() {
  return (
    <HashRouter>
      <Layout style={{ minHeight: '100vh' }}>
        <Routes>
          <Route path="/" element={<AppLayout />}>
            <Route index element={<Dashboard />} />
            <Route path="robots" element={<Robots />} />
            <Route path="schedule" element={<Schedule />} />
            <Route path="billing" element={<Billing />} />
            <Route path="bills" element={<Bills />} />
            <Route path="insurance" element={<Insurance />} />
          </Route>
        </Routes>
      </Layout>
    </HashRouter>
  )
}
