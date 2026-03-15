import { useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { VALID_USERS } from '../lib/UserContext'

export default function UserSelect() {
  const navigate = useNavigate()

  useEffect(() => {
    const saved = localStorage.getItem('workout-user')
    if (saved && VALID_USERS.includes(saved as any)) {
      navigate(`/${saved}`, { replace: true })
    }
  }, [navigate])

  function handleSelect(user: string) {
    localStorage.setItem('workout-user', user)
    navigate(`/${user}`)
  }

  return (
    <div className="min-h-dvh bg-slate-950 flex flex-col items-center justify-center px-6">
      <h1 className="text-3xl font-bold text-white mb-2">Workout Tracker</h1>
      <p className="text-slate-400 mb-10">Who's training today?</p>
      <div className="w-full max-w-xs space-y-4">
        {VALID_USERS.map((user) => (
          <button
            key={user}
            onClick={() => handleSelect(user)}
            className="w-full py-5 rounded-2xl bg-slate-800 border border-slate-700 text-white text-xl font-semibold capitalize hover:bg-slate-700 active:scale-[0.98] transition-all"
          >
            {user}
          </button>
        ))}
      </div>
    </div>
  )
}
