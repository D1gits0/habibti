import { BrowserRouter, Routes, Route, NavLink, Navigate } from 'react-router-dom'
import ProjectsBoard from './pages/ProjectsBoard'
import GymPage from './pages/GymPage'
import HabitView from './pages/HabitView'
import Settings from './pages/Settings'

const navItems = [
  { to: '/', label: 'Projects' },
  { to: '/habits', label: 'Habits' },
  { to: '/gym', label: 'Gym' },
  { to: '/settings', label: 'Settings' },
]

export default function App() {
  return (
    <BrowserRouter>
      <div className="flex flex-col min-h-screen">
        <main className="flex-1 pb-20 md:pb-4 px-3 md:px-6 pt-4">
          <Routes>
            <Route path="/" element={<ProjectsBoard />} />
            <Route path="/log" element={<Navigate to="/habits" replace />} />
            <Route path="/gym" element={<GymPage />} />
            <Route path="/habits" element={<HabitView />} />
            <Route path="/settings" element={<Settings />} />
          </Routes>
        </main>

        {/* Bottom nav - mobile */}
        <nav className="fixed bottom-0 left-0 right-0 bg-charcoal-light border-t border-charcoal-lighter flex justify-around items-center py-2 md:hidden z-50"
             style={{ paddingBottom: 'max(0.5rem, env(safe-area-inset-bottom))' }}>
          {navItems.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              className={({ isActive }) =>
                `flex flex-col items-center gap-0.5 text-xs transition-colors ${
                  isActive ? 'text-text-primary' : 'text-text-secondary hover:text-text-muted'
                }`
              }
            >
              <span className="font-body text-[10px]">{item.label}</span>
            </NavLink>
          ))}
        </nav>

        {/* Top nav - desktop */}
        <nav className="hidden md:flex fixed top-0 left-0 right-0 bg-charcoal-light border-b border-charcoal-lighter items-center px-6 py-3 z-50">
          <span className="font-body text-text-primary text-sm mr-8">HABIBTI</span>
          <div className="flex gap-6">
            {navItems.map((item) => (
              <NavLink
                key={item.to}
                to={item.to}
                className={({ isActive }) =>
                  `text-sm font-body transition-colors ${
                    isActive ? 'text-text-primary' : 'text-text-secondary hover:text-text-muted'
                  }`
                }
              >
                {item.label}
              </NavLink>
            ))}
          </div>
        </nav>
        <div className="hidden md:block h-14" /> {/* spacer for top nav */}
      </div>
    </BrowserRouter>
  )
}
