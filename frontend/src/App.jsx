import { useState } from 'react'
import { BrowserRouter, Routes, Route, NavLink } from 'react-router-dom'
import ThreadsBoard from './pages/ThreadsBoard'
import QAFlow from './pages/QAFlow'
import GymView from './pages/GymView'
import HabitView from './pages/HabitView'
import Settings from './pages/Settings'
import NLInputModal from './components/NLInputModal'

const navItems = [
  { to: '/', label: 'Quests', icon: '⚔️' },
  { to: '/log', label: 'Log', icon: '✏️' },
  { to: '/gym', label: 'Gym', icon: '🏋️' },
  { to: '/habits', label: 'Habits', icon: '🌿' },
  { to: '/settings', label: 'Settings', icon: '⚙️' },
]

export default function App() {
  const [nlModalOpen, setNlModalOpen] = useState(false)

  return (
    <BrowserRouter>
      <div className="flex flex-col min-h-screen">
        <main className="flex-1 pb-20 md:pb-4 px-3 md:px-6 pt-4">
          <Routes>
            <Route path="/" element={<ThreadsBoard />} />
            <Route path="/log" element={<QAFlow />} />
            <Route path="/gym" element={<GymView />} />
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
              <span className="text-lg">{item.icon}</span>
              <span className="font-body text-[8px]">{item.label}</span>
            </NavLink>
          ))}
          <button
            onClick={() => setNlModalOpen(true)}
            className="flex flex-col items-center gap-0.5 text-xs transition-colors text-text-secondary hover:text-text-muted"
            aria-label="Quick natural language input"
          >
            <span className="text-lg">💬</span>
            <span className="font-body text-[8px]">Quick</span>
          </button>
        </nav>

        {/* Top nav - desktop */}
        <nav className="hidden md:flex fixed top-0 left-0 right-0 bg-charcoal-light border-b border-charcoal-lighter items-center px-6 py-3 z-50">
          <span className="font-body text-text-primary text-sm mr-8">COMPOUND</span>
          <div className="flex gap-6">
            {navItems.map((item) => (
              <NavLink
                key={item.to}
                to={item.to}
                className={({ isActive }) =>
                  `flex items-center gap-2 text-sm font-body transition-colors ${
                    isActive ? 'text-text-primary' : 'text-text-secondary hover:text-text-muted'
                  }`
                }
              >
                <span>{item.icon}</span>
                <span>{item.label}</span>
              </NavLink>
            ))}
            <button
              onClick={() => setNlModalOpen(true)}
              className="flex items-center gap-2 text-sm font-body transition-colors text-text-secondary hover:text-text-muted"
              aria-label="Quick natural language input"
            >
              <span>💬</span>
              <span>Quick</span>
            </button>
          </div>
        </nav>
        <div className="hidden md:block h-14" /> {/* spacer for top nav */}

        {/* NL Input Modal */}
        <NLInputModal isOpen={nlModalOpen} onClose={() => setNlModalOpen(false)} />
      </div>
    </BrowserRouter>
  )
}
