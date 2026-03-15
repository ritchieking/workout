import { Routes, Route, useParams, Outlet, Navigate } from 'react-router-dom'
import { UserProvider, VALID_USERS } from './lib/UserContext'
import Layout from './components/Layout'
import UserSelect from './pages/UserSelect'
import ThisWeek from './pages/ThisWeek'
import ActiveWorkout from './pages/ActiveWorkout'
import Trends from './pages/Trends'
import ProgramOverview from './pages/ProgramOverview'

function UserRoute() {
  const { user } = useParams<{ user: string }>()
  if (!user || !VALID_USERS.includes(user as any)) {
    return <Navigate to="/" replace />
  }
  return (
    <UserProvider value={user}>
      <Outlet />
    </UserProvider>
  )
}

export default function App() {
  return (
    <Routes>
      <Route path="/" element={<UserSelect />} />
      <Route path="/:user" element={<UserRoute />}>
        <Route element={<Layout />}>
          <Route index element={<ThisWeek />} />
          <Route path="trends" element={<Trends />} />
          <Route path="program" element={<ProgramOverview />} />
        </Route>
        <Route path="workout/:id" element={<ActiveWorkout />} />
      </Route>
    </Routes>
  )
}
