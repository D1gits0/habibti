import { BrowserRouter, Routes, Route, NavLink } from 'react-router-dom'
import ThreadsBoard from './pages/ThreadsBoard'
import AddLog from './pages/AddLog'
import GymView from './pages/GymView'
import HabitView from './pages/HabitView'

const navItems = [
  { to: '/', label: 'Quests', icon: '⚔️' },
  { to: '/log', label: 'Log', icon: '✏️' },
  { to: '/gym', label: 'Gym', icon: '🏋️' },
  { to: '/habits', label: 'Habits', icon: '🌿' },
]

export default function App() {
  return (
    <BrowserRouter>
      <div className="flex flex-col min-h-screen">
        <main className="flex-1 pb-20 md:pb-4 px-3 md:px-6 pt-4">
          <Routes>
            <Route path="/" element={<ThreadsBoard />} />
            <Route path="/log" element={<AddLog />} />
            <Route path="/gym" element={<GymView />} />
            <Route path="/habits" element={<HabitView />} />
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
                  isActive ? 'text-quest-purple' : 'text-gray-400 hover:text-gray-200'
                }`
              }
            >
              <span className="text-lg">{item.icon}</span>
              <span className="font-pixel text-[8px]">{item.label}</span>
            </NavLink>
          ))}
        </nav>

        {/* Top nav - desktop */}
        <nav className="hidden md:flex fixed top-0 left-0 right-0 bg-charcoal-light border-b border-charcoal-lighter items-center px-6 py-3 z-50">
          <span className="font-pixel text-quest-purple text-sm mr-8">COMPOUND</span>
          <div className="flex gap-6">
            {navItems.map((item) => (
              <NavLink
                key={item.to}
                to={item.to}
                className={({ isActive }) =>
                  `flex items-center gap-2 text-sm transition-colors ${
                    isActive ? 'text-quest-purple' : 'text-gray-400 hover:text-gray-200'
                  }`
                }
              >
                <span>{item.icon}</span>
                <span>{item.label}</span>
              </NavLink>
            ))}
          </div>
        </nav>
        <div className="hidden md:block h-14" /> {/* spacer for top nav */}
      </div>
    </BrowserRouter>
  )
}
