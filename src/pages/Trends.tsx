import { useState, useEffect, useMemo } from 'react'
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
} from 'recharts'
import { supabase } from '../lib/supabase'
import type { WorkoutLog } from '../types'

// ── Volume Line Chart ─────────────────────────────────────────────

type VolumePoint = { date: string; volume: number }

const TIME_RANGES = [
  { label: '4 wk', weeks: 4 },
  { label: '8 wk', weeks: 8 },
  { label: '12 wk', weeks: 12 },
  { label: 'All', weeks: 0 },
] as const

function VolumeChart() {
  const [exercises, setExercises] = useState<string[]>([])
  const [selected, setSelected] = useState('')
  const [search, setSearch] = useState('')
  const [dropdownOpen, setDropdownOpen] = useState(false)
  const [rangeIdx, setRangeIdx] = useState(1) // default 8 wk
  const [volumeData, setVolumeData] = useState<VolumePoint[]>([])
  const [loading, setLoading] = useState(false)

  // Fetch distinct exercise names
  useEffect(() => {
    supabase
      .from('set_logs')
      .select('exercise_name')
      .then(({ data }) => {
        if (!data) return
        const unique = [...new Set(data.map((r) => r.exercise_name))].sort()
        setExercises(unique)
        if (unique.length > 0 && !selected) setSelected(unique[0])
      })
  }, [])

  // Fetch volume data when exercise or range changes
  useEffect(() => {
    if (!selected) return
    setLoading(true)

    const range = TIME_RANGES[rangeIdx]
    let query = supabase
      .from('set_logs')
      .select('weight, actual_reps, workout_log_id, workout_logs!inner(completed_at)')
      .eq('exercise_name', selected)
      .order('created_at', { ascending: true })

    if (range.weeks > 0) {
      const cutoff = new Date()
      cutoff.setDate(cutoff.getDate() - range.weeks * 7)
      query = query.gte('workout_logs.completed_at', cutoff.toISOString())
    }

    query.then(({ data }) => {
      if (!data) {
        setVolumeData([])
        setLoading(false)
        return
      }

      // Group by workout session and sum volume
      const sessions = new Map<string, { date: string; volume: number }>()
      for (const row of data as any[]) {
        const logId = row.workout_log_id as string
        const completedAt = row.workout_logs?.completed_at as string
        const vol = (row.weight as number) * (row.actual_reps as number)
        if (!sessions.has(logId)) {
          sessions.set(logId, {
            date: completedAt?.split('T')[0] ?? '',
            volume: 0,
          })
        }
        sessions.get(logId)!.volume += vol
      }

      const points = Array.from(sessions.values()).sort((a, b) =>
        a.date.localeCompare(b.date)
      )
      setVolumeData(points)
      setLoading(false)
    })
  }, [selected, rangeIdx])

  const filtered = useMemo(
    () =>
      exercises.filter((e) =>
        e.toLowerCase().includes(search.toLowerCase())
      ),
    [exercises, search]
  )

  return (
    <section className="space-y-4">
      <h2 className="text-lg font-semibold text-slate-200">Volume Over Time</h2>

      {/* Exercise selector */}
      <div className="relative">
        <button
          onClick={() => setDropdownOpen(!dropdownOpen)}
          className="w-full flex items-center justify-between rounded-lg bg-slate-800 border border-slate-700 px-3 py-2.5 text-sm text-slate-200"
        >
          <span>{selected || 'Select exercise'}</span>
          <ChevronDown />
        </button>

        {dropdownOpen && (
          <div className="absolute z-20 mt-1 w-full rounded-lg bg-slate-800 border border-slate-700 shadow-xl max-h-64 overflow-hidden flex flex-col">
            <div className="p-2 border-b border-slate-700">
              <input
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search..."
                className="w-full rounded bg-slate-900 border border-slate-600 px-2.5 py-1.5 text-sm text-slate-200 placeholder:text-slate-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                autoFocus
              />
            </div>
            <ul className="overflow-y-auto flex-1">
              {filtered.map((name) => (
                <li key={name}>
                  <button
                    onClick={() => {
                      setSelected(name)
                      setDropdownOpen(false)
                      setSearch('')
                    }}
                    className={`w-full text-left px-3 py-2 text-sm transition-colors ${
                      name === selected
                        ? 'bg-blue-600/20 text-blue-400'
                        : 'text-slate-300 hover:bg-slate-700'
                    }`}
                  >
                    {name}
                  </button>
                </li>
              ))}
              {filtered.length === 0 && (
                <li className="px-3 py-4 text-sm text-slate-500 text-center">
                  No exercises found
                </li>
              )}
            </ul>
          </div>
        )}
      </div>

      {/* Time range pills */}
      <div className="flex gap-2">
        {TIME_RANGES.map((r, i) => (
          <button
            key={r.label}
            onClick={() => setRangeIdx(i)}
            className={`rounded-full px-3 py-1 text-xs font-medium transition-colors ${
              i === rangeIdx
                ? 'bg-blue-600 text-white'
                : 'bg-slate-800 text-slate-400 hover:text-slate-200'
            }`}
          >
            {r.label}
          </button>
        ))}
      </div>

      {/* Chart */}
      <div className="h-56 w-full">
        {loading ? (
          <div className="flex items-center justify-center h-full text-sm text-slate-500">
            Loading...
          </div>
        ) : volumeData.length === 0 ? (
          <div className="flex items-center justify-center h-full text-sm text-slate-500">
            No data for this exercise
          </div>
        ) : (
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={volumeData}>
              <XAxis
                dataKey="date"
                tick={{ fill: '#94a3b8', fontSize: 11 }}
                tickLine={{ stroke: '#334155' }}
                axisLine={{ stroke: '#334155' }}
                tickFormatter={(v: string) => {
                  const d = new Date(v + 'T00:00:00')
                  return `${d.getMonth() + 1}/${d.getDate()}`
                }}
              />
              <YAxis
                tick={{ fill: '#94a3b8', fontSize: 11 }}
                tickLine={{ stroke: '#334155' }}
                axisLine={{ stroke: '#334155' }}
                width={48}
              />
              <Tooltip
                contentStyle={{
                  backgroundColor: '#1e293b',
                  border: '1px solid #334155',
                  borderRadius: 8,
                  fontSize: 13,
                }}
                labelStyle={{ color: '#94a3b8' }}
                itemStyle={{ color: '#60a5fa' }}
                formatter={(value: number | undefined) => [`${(value ?? 0).toLocaleString()} lbs`, 'Volume']}
              />
              <Line
                type="monotone"
                dataKey="volume"
                stroke="#3b82f6"
                strokeWidth={2}
                dot={{ fill: '#3b82f6', r: 3 }}
                activeDot={{ r: 5, fill: '#60a5fa' }}
              />
            </LineChart>
          </ResponsiveContainer>
        )}
      </div>
    </section>
  )
}

// ── Calendar Heatmap ──────────────────────────────────────────────

const WORKOUT_COLORS: Record<string, string> = {
  lifting: '#3b82f6',
  cardio: '#22c55e',
  yoga: '#a855f7',
  class: '#a855f7',
  rest: '#334155',
  other: '#f97316',
}
const EMPTY_COLOR = '#1e293b'
const DAY_LABELS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']

interface DayCell {
  date: string
  workoutType: string | null
  workoutName: string | null
}

function CalendarHeatmap() {
  const [cells, setCells] = useState<DayCell[]>([])
  const [selected, setSelected] = useState<DayCell | null>(null)

  useEffect(() => {
    const today = new Date()
    const start = new Date(today)
    start.setDate(start.getDate() - 12 * 7 + 1)
    // Adjust to Monday
    const dayOfWeek = start.getDay()
    const mondayOffset = dayOfWeek === 0 ? -6 : 1 - dayOfWeek
    start.setDate(start.getDate() + mondayOffset)

    supabase
      .from('workout_logs')
      .select('completed_at, workout_type, name')
      .gte('completed_at', start.toISOString().split('T')[0])
      .order('completed_at', { ascending: true })
      .then(({ data: logs }) => {
        // Build a map of date -> workout
        const logMap = new Map<string, WorkoutLog>()
        for (const log of logs || []) {
          const d = (log.completed_at as string).split('T')[0]
          logMap.set(d, log as WorkoutLog)
        }

        // Build cells from start to today
        const result: DayCell[] = []
        const cursor = new Date(start)
        while (cursor <= today) {
          const key = cursor.toISOString().split('T')[0]
          const log = logMap.get(key)
          result.push({
            date: key,
            workoutType: log?.workout_type ?? null,
            workoutName: log?.name ?? null,
          })
          cursor.setDate(cursor.getDate() + 1)
        }
        setCells(result)
      })
  }, [])

  // Group cells into weeks (columns)
  const weeks = useMemo(() => {
    const w: DayCell[][] = []
    let current: DayCell[] = []
    for (const cell of cells) {
      const d = new Date(cell.date + 'T00:00:00')
      const dow = d.getDay() === 0 ? 6 : d.getDay() - 1 // Mon=0...Sun=6
      if (dow === 0 && current.length > 0) {
        w.push(current)
        current = []
      }
      current.push(cell)
    }
    if (current.length > 0) w.push(current)
    return w
  }, [cells])

  const getCellColor = (cell: DayCell) => {
    if (!cell.workoutType) return EMPTY_COLOR
    return WORKOUT_COLORS[cell.workoutType] ?? WORKOUT_COLORS.other
  }

  return (
    <section className="space-y-4">
      <h2 className="text-lg font-semibold text-slate-200">Activity</h2>

      <div className="overflow-x-auto -mx-4 px-4">
        <div className="flex gap-1">
          {/* Day labels */}
          <div className="flex flex-col gap-1 mr-1 shrink-0">
            {DAY_LABELS.map((d) => (
              <div
                key={d}
                className="h-4 w-7 flex items-center text-[10px] text-slate-500 leading-none"
              >
                {d}
              </div>
            ))}
          </div>

          {/* Weeks */}
          {weeks.map((week, wi) => (
            <div key={wi} className="flex flex-col gap-1">
              {week.map((cell) => {
                const d = new Date(cell.date + 'T00:00:00')
                const dow = d.getDay() === 0 ? 6 : d.getDay() - 1
                return (
                  <div key={cell.date} style={{ gridRow: dow + 1 }}>
                    <button
                      onClick={() => setSelected(selected?.date === cell.date ? null : cell)}
                      className="block h-4 w-4 rounded-[3px] transition-transform active:scale-110"
                      style={{ backgroundColor: getCellColor(cell) }}
                      title={cell.date}
                    />
                  </div>
                )
              })}
              {/* Pad incomplete weeks */}
              {week.length < 7 &&
                Array.from({ length: 7 - week.length }).map((_, i) => (
                  <div key={`pad-${i}`} className="h-4 w-4" />
                ))}
            </div>
          ))}
        </div>
      </div>

      {/* Legend */}
      <div className="flex flex-wrap gap-x-4 gap-y-1 text-[11px] text-slate-400">
        {Object.entries(WORKOUT_COLORS).map(([type, color]) => (
          <span key={type} className="flex items-center gap-1.5">
            <span
              className="inline-block h-2.5 w-2.5 rounded-[2px]"
              style={{ backgroundColor: color }}
            />
            {type.charAt(0).toUpperCase() + type.slice(1)}
          </span>
        ))}
      </div>

      {/* Selected day detail */}
      {selected && (
        <div className="rounded-lg bg-slate-800/60 border border-slate-700 p-3 text-sm">
          <p className="text-slate-400">
            {new Date(selected.date + 'T00:00:00').toLocaleDateString('en-US', {
              weekday: 'long',
              month: 'short',
              day: 'numeric',
            })}
          </p>
          {selected.workoutType ? (
            <p className="text-slate-200 mt-1 font-medium">
              {selected.workoutName}
              <span className="ml-2 text-xs font-normal text-slate-400">
                ({selected.workoutType})
              </span>
            </p>
          ) : (
            <p className="text-slate-500 mt-1">No workout logged</p>
          )}
        </div>
      )}
    </section>
  )
}

// ── Page ──────────────────────────────────────────────────────────

export default function Trends() {
  return (
    <div className="px-4 pt-6 pb-4 max-w-lg mx-auto space-y-8">
      <h1 className="text-2xl font-bold text-white">Trends</h1>
      <VolumeChart />
      <CalendarHeatmap />
    </div>
  )
}

// ── Icons ─────────────────────────────────────────────────────────

function ChevronDown() {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      className="w-4 h-4 text-slate-400"
      fill="none"
      viewBox="0 0 24 24"
      stroke="currentColor"
      strokeWidth={2}
    >
      <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
    </svg>
  )
}
