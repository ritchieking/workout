import { useState, useEffect, useMemo, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import {
  useActiveProgram,
  logWorkoutComplete,
  deleteWorkoutLog,
  importProgram,
  deleteProgram,
  reactivateProgram,
  programHasLogs,
} from '../lib/hooks'
import { useUser } from '../lib/UserContext'
import CreateProgramModal from './CreateProgramModal'
import type { Program, Cycle, Week, WorkoutLog, ProgrammedWorkout, ProgramImport } from '../types'

// ── Current Position Banner ───────────────────────────────────────

function CurrentPositionBanner({
  program,
  cycles,
  weeks,
  onDeleted,
}: {
  program: Program
  cycles: Cycle[]
  weeks: Week[]
  onDeleted: () => void
}) {
  const [hasLogs, setHasLogs] = useState<boolean | null>(null)
  const [confirming, setConfirming] = useState(false)
  const [deleting, setDeleting] = useState(false)

  useEffect(() => {
    programHasLogs(program.id).then(setHasLogs)
  }, [program.id])
  const today = new Date().toISOString().split('T')[0]

  const currentWeek = weeks.find(
    (w) => w.start_date <= today && w.end_date >= today
  )
  const totalWeeks = weeks.length
  const currentWeekNum = currentWeek?.week_number ?? null

  const currentCycle = currentWeek
    ? cycles.find((c) => c.id === currentWeek.cycle_id)
    : null

  // What's next: the cycle after the current one
  const currentCycleIdx = currentCycle
    ? cycles.findIndex((c) => c.id === currentCycle.id)
    : -1
  const nextCycle =
    currentCycleIdx >= 0 && currentCycleIdx < cycles.length - 1
      ? cycles[currentCycleIdx + 1]
      : null

  return (
    <section className="rounded-xl bg-slate-800/60 border border-slate-700 p-4 space-y-3">
      <h2 className="text-xl font-bold text-white">
        {currentWeekNum
          ? `Week ${currentWeekNum} of ${totalWeeks}`
          : 'Program Overview'}
        {currentCycle && (
          <span className="text-slate-400 font-normal text-base ml-2">
            &mdash; {currentCycle.name}
          </span>
        )}
      </h2>

      <div className="flex flex-wrap gap-x-6 gap-y-1 text-sm text-slate-400">
        <span>
          Start:{' '}
          <span className="text-slate-200">
            {formatDate(program.start_date)}
          </span>
        </span>
        {program.end_date && (
          <span>
            End:{' '}
            <span className="text-slate-200">
              {formatDate(program.end_date)}
            </span>
          </span>
        )}
      </div>

      {nextCycle && (
        <p className="text-sm text-slate-500">
          Up next: <span className="text-slate-300">{nextCycle.name}</span>
        </p>
      )}

      {!currentWeek && (
        <p className="text-sm text-amber-400/80">
          You're between weeks or the program hasn't started yet.
        </p>
      )}

      {/* Delete active program */}
      {hasLogs === false && !confirming && (
        <button
          onClick={() => setConfirming(true)}
          className="text-xs text-slate-500 hover:text-red-400 transition-colors"
        >
          Delete program
        </button>
      )}
      {hasLogs === true && (
        <p className="text-xs text-slate-600">Can't delete — has logged workouts</p>
      )}
      {confirming && (
        <div className="flex items-center gap-3 text-xs">
          <span className="text-red-400">Delete this program?</span>
          <button
            onClick={async () => {
              setDeleting(true)
              await deleteProgram(program.id)
              onDeleted()
            }}
            disabled={deleting}
            className="font-medium text-red-400 hover:text-red-300 disabled:opacity-40"
          >
            {deleting ? 'Deleting...' : 'Yes, delete'}
          </button>
          <button
            onClick={() => setConfirming(false)}
            className="font-medium text-slate-400 hover:text-slate-200"
          >
            Cancel
          </button>
        </div>
      )}
    </section>
  )
}

// ── Calendar Grid (Month View) ────────────────────────────────────

function CalendarGrid({
  program,
  cycles,
  weeks,
  logsByDate,
  onDayTap,
}: {
  program: Program
  cycles: Cycle[]
  weeks: Week[]
  logsByDate: Map<string, WorkoutLog[]>
  onDayTap: (dateStr: string) => void
}) {
  const today = new Date().toISOString().split('T')[0]

  // Build a map of date -> cycle color
  const dateColorMap = useMemo(() => {
    const map = new Map<string, string>()
    for (const week of weeks) {
      const cycle = cycles.find((c) => c.id === week.cycle_id)
      const color = cycle?.color ?? '#475569'
      const cursor = new Date(week.start_date + 'T00:00:00')
      const end = new Date(week.end_date + 'T00:00:00')
      while (cursor <= end) {
        map.set(cursor.toISOString().split('T')[0], color)
        cursor.setDate(cursor.getDate() + 1)
      }
    }
    return map
  }, [cycles, weeks])

  // Determine months to show
  const months = useMemo(() => {
    const start = new Date(program.start_date + 'T00:00:00')
    const end = program.end_date
      ? new Date(program.end_date + 'T00:00:00')
      : new Date(start.getFullYear(), start.getMonth() + 6, 0)

    const result: Date[] = []
    const cursor = new Date(start.getFullYear(), start.getMonth(), 1)
    while (cursor <= end) {
      result.push(new Date(cursor))
      cursor.setMonth(cursor.getMonth() + 1)
    }
    return result
  }, [program])

  const [monthIdx, setMonthIdx] = useState(() => {
    const now = new Date()
    const idx = months.findIndex(
      (m) =>
        m.getFullYear() === now.getFullYear() &&
        m.getMonth() === now.getMonth()
    )
    return idx >= 0 ? idx : 0
  })

  const currentMonth = months[monthIdx]
  if (!currentMonth) return null

  // Build days for this month
  const year = currentMonth.getFullYear()
  const month = currentMonth.getMonth()
  const firstDay = new Date(year, month, 1)
  const lastDay = new Date(year, month + 1, 0)
  const startDow = firstDay.getDay() === 0 ? 6 : firstDay.getDay() - 1 // Mon=0

  const dayCells: (string | null)[] = []
  // Pad start
  for (let i = 0; i < startDow; i++) dayCells.push(null)
  for (let d = 1; d <= lastDay.getDate(); d++) {
    const dateStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`
    dayCells.push(dateStr)
  }

  return (
    <section className="space-y-3">
      <h2 className="text-lg font-semibold text-slate-200">Program Calendar</h2>

      {/* Month navigation */}
      <div className="flex items-center justify-between">
        <button
          onClick={() => setMonthIdx(Math.max(0, monthIdx - 1))}
          disabled={monthIdx === 0}
          className="p-2 text-slate-400 disabled:text-slate-700"
        >
          <ChevronLeft />
        </button>
        <span className="text-sm font-medium text-slate-200">
          {currentMonth.toLocaleDateString('en-US', {
            month: 'long',
            year: 'numeric',
          })}
        </span>
        <button
          onClick={() =>
            setMonthIdx(Math.min(months.length - 1, monthIdx + 1))
          }
          disabled={monthIdx === months.length - 1}
          className="p-2 text-slate-400 disabled:text-slate-700"
        >
          <ChevronRight />
        </button>
      </div>

      {/* Day-of-week headers */}
      <div className="grid grid-cols-7 gap-1 text-center text-[11px] text-slate-500 font-medium">
        {['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'].map((d) => (
          <div key={d}>{d}</div>
        ))}
      </div>

      {/* Day grid */}
      <div className="grid grid-cols-7 gap-1">
        {dayCells.map((dateStr, i) => {
          if (!dateStr) return <div key={`empty-${i}`} className="h-9" />
          const color = dateColorMap.get(dateStr)
          const isToday = dateStr === today
          const dayNum = new Date(dateStr + 'T00:00:00').getDate()
          const hasLogs = (logsByDate.get(dateStr)?.length ?? 0) > 0
          const isPast = dateStr < today
          const isTappable = isPast && !!color

          return (
            <div
              key={dateStr}
              onClick={isTappable ? () => onDayTap(dateStr) : undefined}
              className={`relative h-9 rounded-md flex items-center justify-center text-xs font-medium transition-colors ${
                isToday
                  ? 'ring-2 ring-blue-400 ring-offset-1 ring-offset-slate-950'
                  : ''
              } ${isTappable ? 'cursor-pointer active:scale-95' : ''}`}
              style={{
                backgroundColor: color ? color + '33' : 'transparent',
                color: color ? color : '#475569',
              }}
            >
              {dayNum}
              {isToday && (
                <span className="absolute -bottom-0.5 left-1/2 -translate-x-1/2 h-1 w-1 rounded-full bg-blue-400" />
              )}
              {hasLogs && (
                <span className="absolute -bottom-0.5 left-1/2 -translate-x-1/2 h-1.5 w-1.5 rounded-full bg-emerald-400" />
              )}
            </div>
          )
        })}
      </div>

      {/* Cycle legend */}
      <div className="flex flex-wrap gap-x-4 gap-y-1 text-[11px] text-slate-400 pt-1">
        {cycles.map((c) => (
          <span key={c.id} className="flex items-center gap-1.5">
            <span
              className="inline-block h-2.5 w-2.5 rounded-[2px]"
              style={{ backgroundColor: c.color ?? '#475569' }}
            />
            {c.name}
          </span>
        ))}
      </div>
    </section>
  )
}

// ── Past Programs ─────────────────────────────────────────────────

function PastPrograms({ onChanged }: { onChanged: () => void }) {
  const userId = useUser()
  const [programs, setPrograms] = useState<
    (Program & { totalWorkouts: number; completionRate: number; hasLogs: boolean })[]
  >([])
  const [loading, setLoading] = useState(true)
  const [confirmId, setConfirmId] = useState<string | null>(null)
  const [acting, setActing] = useState(false)

  useEffect(() => {
    supabase
      .from('programs')
      .select('*')
      .eq('is_active', false)
      .eq('user_id', userId)
      .order('created_at', { ascending: false })
      .then(async ({ data }) => {
        if (!data || data.length === 0) {
          setPrograms([])
          setLoading(false)
          return
        }

        const enriched = await Promise.all(
          data.map(async (p: Program) => {
            const weekIds = await supabase
              .from('weeks')
              .select('id')
              .eq('program_id', p.id)
              .then(({ data: w }) => (w || []).map((r) => r.id))

            const { count: programmedCount } = await supabase
              .from('programmed_workouts')
              .select('id', { count: 'exact', head: true })
              .in('week_id', weekIds)
              .neq('workout_type', 'rest')

            const { count: completedCount } = await supabase
              .from('workout_logs')
              .select('id', { count: 'exact', head: true })
              .in('week_id', weekIds)

            const total = programmedCount ?? 0
            const completed = completedCount ?? 0

            return {
              ...p,
              totalWorkouts: completed,
              completionRate: total > 0 ? Math.round((completed / total) * 100) : 0,
              hasLogs: completed > 0,
            }
          })
        )

        setPrograms(enriched)
        setLoading(false)
      })
  }, [userId])

  async function handleReactivate(programId: string) {
    setActing(true)
    await reactivateProgram(programId, userId)
    onChanged()
  }

  async function handleDelete(programId: string) {
    setActing(true)
    await deleteProgram(programId)
    setPrograms((prev) => prev.filter((p) => p.id !== programId))
    setConfirmId(null)
    setActing(false)
  }

  if (loading) {
    return (
      <section className="space-y-3">
        <h2 className="text-lg font-semibold text-slate-200">Past Programs</h2>
        <p className="text-sm text-slate-500">Loading...</p>
      </section>
    )
  }

  if (programs.length === 0) {
    return (
      <section className="space-y-3">
        <h2 className="text-lg font-semibold text-slate-200">Past Programs</h2>
        <p className="text-sm text-slate-500">No archived programs yet.</p>
      </section>
    )
  }

  return (
    <section className="space-y-3">
      <h2 className="text-lg font-semibold text-slate-200">Past Programs</h2>

      <div className="space-y-2">
        {programs.map((p) => (
          <div
            key={p.id}
            className="rounded-lg bg-slate-800/60 border border-slate-700 p-3 space-y-2"
          >
            <h3 className="text-sm font-medium text-slate-200">{p.name}</h3>
            <div className="flex flex-wrap gap-x-4 gap-y-0.5 text-xs text-slate-400">
              <span>
                {formatDate(p.start_date)}
                {p.end_date ? ` — ${formatDate(p.end_date)}` : ''}
              </span>
              <span>{p.totalWorkouts} workouts</span>
              <span>{p.completionRate}% complete</span>
            </div>

            {confirmId === p.id ? (
              <div className="flex items-center gap-3 text-xs">
                <span className="text-red-400">Delete this program?</span>
                <button
                  onClick={() => handleDelete(p.id)}
                  disabled={acting}
                  className="font-medium text-red-400 hover:text-red-300 disabled:opacity-40"
                >
                  {acting ? 'Deleting...' : 'Yes, delete'}
                </button>
                <button
                  onClick={() => setConfirmId(null)}
                  className="font-medium text-slate-400 hover:text-slate-200"
                >
                  Cancel
                </button>
              </div>
            ) : (
              <div className="flex items-center gap-3 text-xs">
                <button
                  onClick={() => handleReactivate(p.id)}
                  disabled={acting}
                  className="font-medium text-blue-400 hover:text-blue-300 disabled:opacity-40"
                >
                  Reactivate
                </button>
                {!p.hasLogs ? (
                  <button
                    onClick={() => setConfirmId(p.id)}
                    className="font-medium text-slate-500 hover:text-red-400 transition-colors"
                  >
                    Delete
                  </button>
                ) : (
                  <span className="text-slate-600">Can't delete — has logs</span>
                )}
              </div>
            )}
          </div>
        ))}
      </div>
    </section>
  )
}

// ── Copy Prompt Button ───────────────────────────────────────────

const PROGRAM_PROMPT = `I need you to generate a workout program as JSON for my workout tracking app. I'll describe what I want below, and you output ONLY the raw JSON (no markdown fences, no explanation).

**Tell me about:**
- [YOUR GOALS: e.g. fat loss, muscle gain, strength, general fitness]
- [EQUIPMENT AVAILABLE: e.g. dumbbells only, full gym, bodyweight only]
- [SCHEDULE: e.g. 4 days lifting + 2 cardio + 1 rest, or 3 full body + 2 cardio]
- [PROGRAM LENGTH: e.g. 8 weeks, 12 weeks]
- [ANY PREFERENCES: e.g. upper/lower split, push/pull/legs, supersets, specific exercises to include/avoid]

**How the program structure works:**

The program is divided into "cycles" (training blocks/phases, e.g. "Foundation" → "Intensification" → "Peak"). Each cycle contains one or more weeks. Within a cycle, the weekly workout template typically stays the same (same exercises, same structure) but you can adjust sets/reps across weeks for progression. If exercises change week-to-week, each week needs its own full workout list.

Every week must have exactly 7 workouts (one per day), including rest days.

**JSON schema:**

{
  "name": "Program Name",
  "description": "Brief program description with split type and equipment",
  "start_date": "YYYY-MM-DD (use the upcoming Monday)",
  "cycles": [
    {
      "name": "Phase/Block Name",
      "cycle_type": "hypertrophy | strength | deload | endurance",
      "color": "#hex (use distinct colors per cycle)",
      "weeks": [
        {
          "week_number": 1,
          "workouts": [
            {
              "name": "e.g. Upper Body A",
              "workout_type": "lifting | cardio | yoga | rest | other",
              "muscle_group": "upper | lower | full (required for lifting, null for others)",
              "description": "Brief description of the session",
              "exercises": [
                {
                  "name": "Exercise Name",
                  "sets": 3,
                  "reps": 12,
                  "body_region": "upper | lower",
                  "superset_group": "A (optional — exercises sharing a letter are done as a superset)"
                }
              ]
            }
          ]
        }
      ]
    }
  ]
}

**Important rules:**
- "exercises" array is ONLY for lifting workouts. Omit it for cardio/yoga/rest/other.
- "body_region" is per exercise: "upper" or "lower" (the app uses this for weight progression — 5 lb increments for upper, 10 lb for lower).
- "week_number" increments continuously across ALL cycles (1, 2, 3... not restarting per cycle).
- Each week should include all planned sessions plus rest days. A typical week has 7 entries (one per day), but can have more if a day includes separate sessions (e.g. lifting + cardio). Always include at least one rest day.
- If multiple weeks in a cycle have the same exercises, you still need to output each week's full workout list.
- For progressive overload: you can vary sets/reps across weeks within a cycle (e.g. week 1: 3x12, week 2: 3x10, week 3: 4x8).
- Include a deload week every 4–6 weeks if the program is long enough.`

function CopyPromptButton() {
  const [copied, setCopied] = useState(false)

  async function handleCopy() {
    await navigator.clipboard.writeText(PROGRAM_PROMPT)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  return (
    <div className="space-y-1.5">
      <button
        onClick={handleCopy}
        className="w-full flex items-center justify-center gap-2 rounded-lg bg-slate-800 border border-slate-700 py-2.5 text-sm font-medium text-slate-300 hover:bg-slate-700 transition-colors"
      >
        {copied ? (
          <>
            <CheckSmallIcon />
            Copied!
          </>
        ) : (
          <>
            <ClipboardIcon />
            Copy prompt for workout formatting
          </>
        )}
      </button>
      <p className="text-xs text-slate-400">
        Pasting this prompt into Claude when you generate your workout will ensure it gets formatted correctly.
      </p>
    </div>
  )
}

// ── Import Program Modal ──────────────────────────────────────────

function ImportProgramModal({
  open,
  onClose,
  onImported,
}: {
  open: boolean
  onClose: () => void
  onImported: () => void
}) {
  const [json, setJson] = useState('')
  const [preview, setPreview] = useState<ProgramImport | null>(null)
  const [error, setError] = useState('')
  const [importing, setImporting] = useState(false)

  const handleParse = () => {
    setError('')
    setPreview(null)
    try {
      const parsed = JSON.parse(json)

      // Validate structure
      if (!parsed.name || typeof parsed.name !== 'string') {
        throw new Error('Missing or invalid "name"')
      }
      if (!parsed.start_date || typeof parsed.start_date !== 'string') {
        throw new Error('Missing or invalid "start_date"')
      }
      if (!Array.isArray(parsed.cycles) || parsed.cycles.length === 0) {
        throw new Error('Missing or empty "cycles" array')
      }
      for (const cycle of parsed.cycles) {
        if (!cycle.name) throw new Error('Each cycle needs a "name"')
        if (!Array.isArray(cycle.weeks) || cycle.weeks.length === 0) {
          throw new Error(`Cycle "${cycle.name}" has no weeks`)
        }
        for (const week of cycle.weeks) {
          if (!Array.isArray(week.workouts)) {
            throw new Error(
              `Week ${week.week_number} in "${cycle.name}" has no workouts array`
            )
          }
        }
      }

      setPreview(parsed as ProgramImport)
    } catch (e: any) {
      setError(e.message || 'Invalid JSON')
    }
  }

  const userId = useUser()

  const handleImport = async () => {
    if (!preview) return
    setImporting(true)
    setError('')
    try {
      await importProgram(preview, userId)
      onImported()
      onClose()
      setJson('')
      setPreview(null)
    } catch (e: any) {
      setError(e.message || 'Import failed')
    } finally {
      setImporting(false)
    }
  }

  const handleClose = () => {
    onClose()
    setJson('')
    setPreview(null)
    setError('')
  }

  if (!open) return null

  const totalWeeks = preview
    ? preview.cycles.reduce((s, c) => s + c.weeks.length, 0)
    : 0
  const totalBlocks = preview ? preview.cycles.length : 0

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/60 backdrop-blur-sm"
        onClick={handleClose}
      />

      {/* Modal */}
      <div className="relative w-full max-w-lg mx-4 mb-4 sm:mb-0 rounded-xl bg-slate-900 border border-slate-700 shadow-2xl max-h-[80dvh] flex flex-col">
        <div className="flex items-center justify-between px-4 py-3 border-b border-slate-800">
          <h3 className="text-base font-semibold text-white">Import Program</h3>
          <button
            onClick={handleClose}
            className="text-slate-400 hover:text-slate-200 p-1"
          >
            <XIcon />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto px-4 py-3 space-y-3">
          {!preview ? (
            <>
              <CopyPromptButton />
              <textarea
                value={json}
                onChange={(e) => setJson(e.target.value)}
                placeholder="Paste program JSON here..."
                rows={10}
                className="w-full rounded-lg bg-slate-800 border border-slate-700 px-3 py-2 text-sm text-slate-200 placeholder:text-slate-500 font-mono resize-none focus:outline-none focus:ring-1 focus:ring-blue-500"
              />
              {error && (
                <p className="text-sm text-red-400">{error}</p>
              )}
              <button
                onClick={handleParse}
                disabled={!json.trim()}
                className="w-full rounded-lg bg-blue-600 py-2.5 text-sm font-medium text-white disabled:opacity-40 hover:bg-blue-500 transition-colors"
              >
                Validate & Preview
              </button>
            </>
          ) : (
            <>
              <div className="rounded-lg bg-slate-800/60 border border-slate-700 p-3 space-y-2 text-sm">
                <p className="font-medium text-white">{preview.name}</p>
                {preview.description && (
                  <p className="text-slate-400">{preview.description}</p>
                )}
                <div className="flex gap-4 text-xs text-slate-400">
                  <span>{totalBlocks} block{totalBlocks !== 1 ? 's' : ''}</span>
                  <span>{totalWeeks} week{totalWeeks !== 1 ? 's' : ''}</span>
                  <span>Starts {formatDate(preview.start_date)}</span>
                </div>
                <div className="space-y-1 pt-1">
                  {preview.cycles.map((c, i) => (
                    <div key={i} className="flex items-center gap-2 text-xs">
                      <span
                        className="h-2 w-2 rounded-full shrink-0"
                        style={{ backgroundColor: c.color ?? '#475569' }}
                      />
                      <span className="text-slate-300">
                        {c.name}
                      </span>
                      <span className="text-slate-500">
                        {c.weeks.length} wk{c.weeks.length !== 1 ? 's' : ''}
                      </span>
                    </div>
                  ))}
                </div>
              </div>

              <p className="text-xs text-amber-400/80">
                Your current active program will be archived.
              </p>

              {error && (
                <p className="text-sm text-red-400">{error}</p>
              )}

              <div className="flex gap-2">
                <button
                  onClick={() => {
                    setPreview(null)
                    setError('')
                  }}
                  className="flex-1 rounded-lg bg-slate-800 border border-slate-700 py-2.5 text-sm font-medium text-slate-300 hover:bg-slate-700 transition-colors"
                >
                  Back
                </button>
                <button
                  onClick={handleImport}
                  disabled={importing}
                  className="flex-1 rounded-lg bg-blue-600 py-2.5 text-sm font-medium text-white disabled:opacity-40 hover:bg-blue-500 transition-colors"
                >
                  {importing ? 'Importing...' : 'Confirm Import'}
                </button>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  )
}

// ── Type badge (matches ThisWeek) ─────────────────────────────────

const TYPE_BADGE: Record<string, { bg: string; text: string; label: string }> = {
  lifting: { bg: 'bg-blue-500/20', text: 'text-blue-400', label: 'Lifting' },
  cardio: { bg: 'bg-green-500/20', text: 'text-green-400', label: 'Cardio' },
  yoga: { bg: 'bg-purple-500/20', text: 'text-purple-400', label: 'Yoga' },
  rest: { bg: 'bg-slate-500/20', text: 'text-slate-400', label: 'Rest' },
  class: { bg: 'bg-amber-500/20', text: 'text-amber-400', label: 'Class' },
  other: { bg: 'bg-pink-500/20', text: 'text-pink-400', label: 'Other' },
}

function getBadge(type: string) {
  return TYPE_BADGE[type] ?? TYPE_BADGE.other
}

const CUSTOM_TYPES = ['lifting', 'cardio', 'yoga', 'class', 'other'] as const

// ── Day Detail Modal ─────────────────────────────────────────────

function DayDetailModal({
  dateStr,
  logs,
  weeks,
  onClose,
  onChanged,
}: {
  dateStr: string
  logs: WorkoutLog[]
  weeks: Week[]
  onClose: () => void
  onChanged: () => void
}) {
  const userId = useUser()
  const [programmedWorkouts, setProgrammedWorkouts] = useState<ProgrammedWorkout[]>([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [deleting, setDeleting] = useState<string | null>(null)
  const [showCustom, setShowCustom] = useState(false)
  const [customName, setCustomName] = useState('')
  const [customType, setCustomType] = useState<string>('lifting')
  const [customNotes, setCustomNotes] = useState('')

  // Find which week this date falls in
  const week = useMemo(
    () => weeks.find((w) => w.start_date <= dateStr && w.end_date >= dateStr),
    [weeks, dateStr]
  )

  // Fetch programmed workouts for this week
  useEffect(() => {
    if (!week) {
      setLoading(false)
      return
    }
    supabase
      .from('programmed_workouts')
      .select('*')
      .eq('week_id', week.id)
      .neq('workout_type', 'rest')
      .order('order_index')
      .then(({ data }) => {
        setProgrammedWorkouts(data || [])
        setLoading(false)
      })
  }, [week])

  const formatted = new Date(dateStr + 'T00:00:00').toLocaleDateString('en-US', {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  })

  async function handleLogProgrammed(pw: ProgrammedWorkout) {
    setSaving(true)
    await logWorkoutComplete(
      userId,
      pw.id,
      pw.week_id,
      pw.name,
      pw.workout_type,
      pw.muscle_group,
      [],
      undefined,
      false,
      new Date(dateStr + 'T12:00:00').toISOString()
    )
    setSaving(false)
    onChanged()
  }

  async function handleDelete(logId: string) {
    setDeleting(logId)
    await deleteWorkoutLog(logId)
    setDeleting(null)
    onChanged()
  }

  async function handleCustomSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!customName.trim()) return
    setSaving(true)
    await logWorkoutComplete(
      userId,
      null,
      week?.id ?? null,
      customName.trim(),
      customType,
      null,
      [],
      customNotes || undefined,
      true,
      new Date(dateStr + 'T12:00:00').toISOString()
    )
    setSaving(false)
    setShowCustom(false)
    setCustomName('')
    setCustomNotes('')
    onChanged()
  }

  // Which programmed workouts are already logged for this day
  const loggedPwIds = new Set(logs.map((l) => l.programmed_workout_id).filter(Boolean))

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center">
      <div
        className="absolute inset-0 bg-black/60 backdrop-blur-sm"
        onClick={onClose}
      />

      <div className="relative w-full max-w-lg mx-4 mb-4 sm:mb-0 rounded-xl bg-slate-900 border border-slate-700 shadow-2xl max-h-[80dvh] flex flex-col">
        <div className="flex items-center justify-between px-4 py-3 border-b border-slate-800">
          <h3 className="text-base font-semibold text-white">{formatted}</h3>
          <button
            onClick={onClose}
            className="text-slate-400 hover:text-slate-200 p-1"
          >
            <XIcon />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto px-4 py-3 space-y-4">
          {/* Logged workouts */}
          {logs.length > 0 && (
            <div className="space-y-2">
              <h4 className="text-xs font-medium text-slate-400 uppercase tracking-wide">
                Logged
              </h4>
              {logs.map((log) => {
                const badge = getBadge(log.workout_type)
                return (
                  <div
                    key={log.id}
                    className="rounded-lg bg-slate-800/60 border border-slate-700 p-3 flex items-center justify-between"
                  >
                    <div className="space-y-0.5">
                      <span className="text-sm font-medium text-white">
                        {log.name}
                      </span>
                      <span
                        className={`ml-2 text-[10px] font-medium px-1.5 py-0.5 rounded ${badge.bg} ${badge.text}`}
                      >
                        {badge.label}
                      </span>
                      {log.notes && (
                        <p className="text-xs text-slate-400">{log.notes}</p>
                      )}
                    </div>
                    <button
                      onClick={() => handleDelete(log.id)}
                      disabled={deleting === log.id}
                      className="text-xs font-medium text-red-400 hover:text-red-300 px-2 py-1 rounded transition-colors disabled:opacity-40"
                    >
                      {deleting === log.id ? '...' : 'Remove'}
                    </button>
                  </div>
                )
              })}
            </div>
          )}

          {/* Programmed workouts for this week */}
          {loading ? (
            <p className="text-sm text-slate-500">Loading...</p>
          ) : (
            <div className="space-y-2">
              <h4 className="text-xs font-medium text-slate-400 uppercase tracking-wide">
                Log a Workout
              </h4>
              {programmedWorkouts.length > 0 ? (
                programmedWorkouts.map((pw) => {
                  const badge = getBadge(pw.workout_type)
                  const alreadyLogged = loggedPwIds.has(pw.id)
                  return (
                    <button
                      key={pw.id}
                      onClick={() => handleLogProgrammed(pw)}
                      disabled={saving || alreadyLogged}
                      className="w-full rounded-lg bg-slate-800/60 border border-slate-700 p-3 text-left flex items-center justify-between hover:bg-slate-800 transition-colors disabled:opacity-40"
                    >
                      <div className="space-y-0.5">
                        <span className="text-sm font-medium text-white">
                          {pw.name}
                        </span>
                        <span
                          className={`ml-2 text-[10px] font-medium px-1.5 py-0.5 rounded ${badge.bg} ${badge.text}`}
                        >
                          {badge.label}
                        </span>
                        {pw.description && (
                          <p className="text-xs text-slate-400">
                            {pw.description}
                          </p>
                        )}
                      </div>
                      <span className="text-xs text-slate-500">
                        {alreadyLogged ? 'Logged' : 'Tap to log'}
                      </span>
                    </button>
                  )
                })
              ) : (
                <p className="text-sm text-slate-500">
                  No programmed workouts for this week.
                </p>
              )}

              {/* Custom workout */}
              {!showCustom ? (
                <button
                  onClick={() => setShowCustom(true)}
                  className="w-full rounded-lg border border-dashed border-slate-600 py-2.5 text-sm font-medium text-slate-400 hover:text-slate-200 hover:border-slate-500 transition-colors"
                >
                  + Add Custom
                </button>
              ) : (
                <form
                  onSubmit={handleCustomSubmit}
                  className="rounded-lg bg-slate-800/60 border border-slate-700 p-3 space-y-3"
                >
                  <input
                    type="text"
                    value={customName}
                    onChange={(e) => setCustomName(e.target.value)}
                    placeholder="Workout name"
                    className="w-full rounded-lg bg-slate-800 border border-slate-700 px-3 py-2 text-sm text-white placeholder-slate-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                    autoFocus
                  />
                  <select
                    value={customType}
                    onChange={(e) => setCustomType(e.target.value)}
                    className="w-full rounded-lg bg-slate-800 border border-slate-700 px-3 py-2 text-sm text-white focus:outline-none focus:ring-1 focus:ring-blue-500 appearance-none"
                  >
                    {CUSTOM_TYPES.map((t) => (
                      <option key={t} value={t}>
                        {getBadge(t).label}
                      </option>
                    ))}
                  </select>
                  <textarea
                    value={customNotes}
                    onChange={(e) => setCustomNotes(e.target.value)}
                    placeholder="Notes (optional)"
                    rows={2}
                    className="w-full rounded-lg bg-slate-800 border border-slate-700 px-3 py-2 text-sm text-white placeholder-slate-500 focus:outline-none focus:ring-1 focus:ring-blue-500 resize-none"
                  />
                  <div className="flex gap-2">
                    <button
                      type="button"
                      onClick={() => setShowCustom(false)}
                      className="flex-1 rounded-lg bg-slate-800 border border-slate-700 py-2 text-sm font-medium text-slate-300 hover:bg-slate-700 transition-colors"
                    >
                      Cancel
                    </button>
                    <button
                      type="submit"
                      disabled={!customName.trim() || saving}
                      className="flex-1 rounded-lg bg-blue-600 py-2 text-sm font-medium text-white disabled:opacity-40 hover:bg-blue-500 transition-colors"
                    >
                      {saving ? 'Saving...' : 'Log'}
                    </button>
                  </div>
                </form>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

// ── Page ──────────────────────────────────────────────────────────

export default function ProgramOverview() {
  const navigate = useNavigate()
  const userId = useUser()
  const { program, loading: programLoading } = useActiveProgram(userId)
  const [cycles, setCycles] = useState<Cycle[]>([])
  const [weeks, setWeeks] = useState<Week[]>([])
  const [loading, setLoading] = useState(true)
  const [importOpen, setImportOpen] = useState(false)
  const [createOpen, setCreateOpen] = useState(false)
  const [refreshKey, setRefreshKey] = useState(0)
  const [selectedDate, setSelectedDate] = useState<string | null>(null)
  const [logsByDate, setLogsByDate] = useState<Map<string, WorkoutLog[]>>(new Map())

  const fetchLogs = useCallback((weekIds: string[]) => {
    if (weekIds.length === 0) {
      setLogsByDate(new Map())
      return
    }
    supabase
      .from('workout_logs')
      .select('*')
      .in('week_id', weekIds)
      .then(({ data }) => {
        const map = new Map<string, WorkoutLog[]>()
        for (const log of data || []) {
          const dateKey = log.completed_at.split('T')[0]
          if (!map.has(dateKey)) map.set(dateKey, [])
          map.get(dateKey)!.push(log)
        }
        setLogsByDate(map)
      })
  }, [])

  useEffect(() => {
    if (!program) {
      setLoading(false)
      return
    }

    Promise.all([
      supabase
        .from('cycles')
        .select('*')
        .eq('program_id', program.id)
        .order('order_index'),
      supabase
        .from('weeks')
        .select('*')
        .eq('program_id', program.id)
        .order('week_number'),
    ]).then(([{ data: c }, { data: w }]) => {
      setCycles(c || [])
      setWeeks(w || [])
      fetchLogs((w || []).map((wk: Week) => wk.id))
      setLoading(false)
    })
  }, [program, refreshKey, fetchLogs])

  const handleImported = () => {
    setRefreshKey((k) => k + 1)
    // Force a full page reload to re-fetch active program
    window.location.reload()
  }

  const handleDayChanged = () => {
    fetchLogs(weeks.map((w) => w.id))
    // Re-open the modal with updated data by keeping selectedDate
  }

  if (programLoading || loading) {
    return (
      <div className="px-4 pt-6 max-w-lg mx-auto">
        <h1 className="text-2xl font-bold text-white mb-4">Program</h1>
        <p className="text-sm text-slate-500">Loading...</p>
      </div>
    )
  }

  return (
    <div className="px-4 pt-6 pb-4 max-w-lg mx-auto space-y-8">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-white">Program</h1>
        <div className="flex gap-2">
          <button
            onClick={() => setCreateOpen(true)}
            className="flex items-center gap-1.5 rounded-lg bg-blue-600 px-3 py-2 text-xs font-medium text-white hover:bg-blue-500 transition-colors"
          >
            + Create
          </button>
          <button
            onClick={() => setImportOpen(true)}
            className="flex items-center gap-1.5 rounded-lg bg-slate-800 border border-slate-700 px-3 py-2 text-xs font-medium text-slate-300 hover:bg-slate-700 transition-colors"
          >
            <ImportIcon />
            Import
          </button>
        </div>
      </div>

      {program ? (
        <>
          <CurrentPositionBanner
            program={program}
            cycles={cycles}
            weeks={weeks}
            onDeleted={handleImported}
          />
          <CalendarGrid
            program={program}
            cycles={cycles}
            weeks={weeks}
            logsByDate={logsByDate}
            onDayTap={setSelectedDate}
          />
        </>
      ) : (
        <div className="rounded-xl bg-slate-800/60 border border-slate-700 p-6 text-center space-y-3">
          <p className="text-slate-400 text-sm">No active program</p>
          <div className="flex gap-2 justify-center">
            <button
              onClick={() => setCreateOpen(true)}
              className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-500 transition-colors"
            >
              Create Program
            </button>
            <button
              onClick={() => setImportOpen(true)}
              className="rounded-lg bg-slate-800 border border-slate-700 px-4 py-2 text-sm font-medium text-slate-300 hover:bg-slate-700 transition-colors"
            >
              Import JSON
            </button>
          </div>
        </div>
      )}

      <PastPrograms onChanged={handleImported} />

      {/* Switch user */}
      <button
        onClick={() => {
          localStorage.removeItem('workout-user')
          navigate('/')
        }}
        className="w-full flex items-center justify-center gap-2 rounded-lg bg-slate-800/60 border border-slate-700 py-2.5 text-sm font-medium text-slate-400 hover:text-slate-200 hover:bg-slate-800 transition-colors"
      >
        Switch User
      </button>

      <ImportProgramModal
        open={importOpen}
        onClose={() => setImportOpen(false)}
        onImported={handleImported}
      />

      <CreateProgramModal
        open={createOpen}
        onClose={() => setCreateOpen(false)}
        onCreated={handleImported}
      />

      {selectedDate && (
        <DayDetailModal
          dateStr={selectedDate}
          logs={logsByDate.get(selectedDate) || []}
          weeks={weeks}
          onClose={() => setSelectedDate(null)}
          onChanged={handleDayChanged}
        />
      )}
    </div>
  )
}

// ── Helpers ───────────────────────────────────────────────────────

function formatDate(dateStr: string) {
  return new Date(dateStr + 'T00:00:00').toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  })
}

// ── Icons ─────────────────────────────────────────────────────────

function ChevronLeft() {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      className="w-5 h-5"
      fill="none"
      viewBox="0 0 24 24"
      stroke="currentColor"
      strokeWidth={2}
    >
      <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
    </svg>
  )
}

function ChevronRight() {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      className="w-5 h-5"
      fill="none"
      viewBox="0 0 24 24"
      stroke="currentColor"
      strokeWidth={2}
    >
      <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
    </svg>
  )
}

function XIcon() {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      className="w-5 h-5"
      fill="none"
      viewBox="0 0 24 24"
      stroke="currentColor"
      strokeWidth={2}
    >
      <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
    </svg>
  )
}

function ClipboardIcon() {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M15.666 3.888A2.25 2.25 0 0 0 13.5 2.25h-3c-1.03 0-1.9.693-2.166 1.638m7.332 0c.055.194.084.4.084.612v0a.75.75 0 0 1-.75.75H9.75a.75.75 0 0 1-.75-.75v0c0-.212.03-.418.084-.612m7.332 0c.646.049 1.288.11 1.927.184 1.1.128 1.907 1.077 1.907 2.185V19.5a2.25 2.25 0 0 1-2.25 2.25H6.75A2.25 2.25 0 0 1 4.5 19.5V6.257c0-1.108.806-2.057 1.907-2.185a48.208 48.208 0 0 1 1.927-.184" />
    </svg>
  )
}

function CheckSmallIcon() {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" className="w-4 h-4 text-emerald-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="m4.5 12.75 6 6 9-13.5" />
    </svg>
  )
}

function ImportIcon() {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      className="w-4 h-4"
      fill="none"
      viewBox="0 0 24 24"
      stroke="currentColor"
      strokeWidth={1.5}
    >
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M3 16.5v2.25A2.25 2.25 0 0 0 5.25 21h13.5A2.25 2.25 0 0 0 21 18.75V16.5m-13.5-9L12 3m0 0 4.5 4.5M12 3v13.5"
      />
    </svg>
  )
}
