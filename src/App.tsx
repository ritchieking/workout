import { Routes, Route } from 'react-router-dom'
import Layout from './components/Layout'
import ThisWeek from './pages/ThisWeek'
import ActiveWorkout from './pages/ActiveWorkout'
import Trends from './pages/Trends'
import ProgramOverview from './pages/ProgramOverview'

export default function App() {
  return (
    <Routes>
      <Route element={<Layout />}>
        <Route path="/" element={<ThisWeek />} />
        <Route path="/trends" element={<Trends />} />
        <Route path="/program" element={<ProgramOverview />} />
      </Route>
      <Route path="/workout/:id" element={<ActiveWorkout />} />
    </Routes>
  )
}
