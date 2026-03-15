import { useState, useEffect, useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  useActiveProgram,
  useCurrentWeek,
  useCustomWorkoutLogs,
  logWorkoutComplete,
} from '../lib/hooks'
import { useUser } from '../lib/UserContext'
import type { WorkoutWithStatus, WorkoutLog } from '../types'

// ─── Type badge colors ───────────────────────────────────────────────
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

// ─── Summary helpers ─────────────────────────────────────────────────
function buildSummary(workout: WorkoutWithStatus): string {
  if (workout.workout_type === 'rest') return 'Recovery day'

  if (workout.exercises && workout.exercises.length > 0) {
    const names = workout.exercises.slice(0, 3).map((e) => e.name)
    const suffix =
      workout.exercises.length > 3
        ? ` + ${workout.exercises.length - 3} more`
        : ''
    return `${names.join(', ')}${suffix} — ${workout.exercises.length} exercises`
  }

  return workout.description ?? ''
}

function buildCustomSummary(log: WorkoutLog): string {
  return log.notes ?? ''
}

// ─── Sequencing conflict detection ───────────────────────────────────
function getYesterdayMuscleGroups(
  workouts: WorkoutWithStatus[],
  customLogs: WorkoutLog[]
): Set<string> {
  const groups = new Set<string>()
  const yesterday = new Date()
  yesterday.setDate(yesterday.getDate() - 1)
  const yesterdayStr = yesterday.toISOString().split('T')[0]

  for (const w of workouts) {
    if (w.log && w.log.completed_at.startsWith(yesterdayStr) && w.muscle_group) {
      groups.add(w.muscle_group)
    }
  }

  for (const log of customLogs) {
    if (log.completed_at.startsWith(yesterdayStr) && log.muscle_group) {
      groups.add(log.muscle_group)
    }
  }

  return groups
}

// ─── Week header helper ──────────────────────────────────────────────
function useTotalWeeks(programId: string | undefined) {
  const [total, setTotal] = useState<number | null>(null)

  useEffect(() => {
    if (!programId) return
    import('../lib/supabase').then(({ supabase }) => {
      supabase
        .from('weeks')
        .select('id', { count: 'exact', head: true })
        .eq('program_id', programId)
        .then(({ count }) => {
          setTotal(count ?? null)
        })
    })
  }, [programId])

  return total
}

// ─── Custom Workout Modal ────────────────────────────────────────────
const CUSTOM_TYPES = ['lifting', 'cardio', 'yoga', 'class', 'other'] as const

function AddCustomWorkoutModal({
  weekId,
  onClose,
  onAdded,
}: {
  weekId: string
  onClose: () => void
  onAdded: () => void
}) {
  const [name, setName] = useState('')
  const [type, setType] = useState<string>('lifting')
  const [notes, setNotes] = useState('')
  const [saving, setSaving] = useState(false)

  const userId = useUser()

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!name.trim()) return

    setSaving(true)
    await logWorkoutComplete(userId, null, weekId, name.trim(), type, null, [], notes || undefined, true)
    setSaving(false)
    onAdded()
    onClose()
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/60 backdrop-blur-sm"
        onClick={onClose}
      />

      {/* Modal */}
      <form
        onSubmit={handleSubmit}
        className="relative w-full max-w-lg bg-slate-900 border border-slate-700 rounded-t-2xl sm:rounded-2xl p-6 space-y-5 mx-4 mb-0 sm:mb-0"
      >
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold text-white">Add Custom Workout</h2>
          <button
            type="button"
            onClick={onClose}
            className="p-2 -mr-2 text-slate-400 hover:text-white transition-colors"
            aria-label="Close"
          >
            <svg xmlns="http://www.w3.org/2000/svg" className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18 18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Name */}
        <div>
          <label htmlFor="cw-name" className="block text-sm font-medium text-slate-300 mb-1">
            Name
          </label>
          <input
            id="cw-name"
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="e.g. Morning Run"
            className="w-full rounded-lg bg-slate-800 border border-slate-700 px-4 py-3 text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-blue-500 text-base"
            autoFocus
          />
        </div>

        {/* Type */}
        <div>
          <label htmlFor="cw-type" className="block text-sm font-medium text-slate-300 mb-1">
            Type
          </label>
          <select
            id="cw-type"
            value={type}
            onChange={(e) => setType(e.target.value)}
            className="w-full rounded-lg bg-slate-800 border border-slate-700 px-4 py-3 text-white focus:outline-none focus:ring-2 focus:ring-blue-500 text-base appearance-none"
          >
            {CUSTOM_TYPES.map((t) => (
              <option key={t} value={t}>
                {getBadge(t).label}
              </option>
            ))}
          </select>
        </div>

        {/* Notes */}
        <div>
          <label htmlFor="cw-notes" className="block text-sm font-medium text-slate-300 mb-1">
            Notes
          </label>
          <textarea
            id="cw-notes"
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            placeholder="Optional details..."
            rows={3}
            className="w-full rounded-lg bg-slate-800 border border-slate-700 px-4 py-3 text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-blue-500 text-base resize-none"
          />
        </div>

        {/* Submit */}
        <button
          type="submit"
          disabled={!name.trim() || saving}
          className="w-full py-3.5 rounded-lg bg-blue-600 text-white font-semibold text-base hover:bg-blue-500 active:bg-blue-700 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
        >
          {saving ? 'Saving...' : 'Add Workout'}
        </button>
      </form>
    </div>
  )
}

// ─── Sequencing Warning Banner ───────────────────────────────────────
function SequencingWarning({
  muscleGroup,
  onDismiss,
}: {
  muscleGroup: string
  onDismiss: () => void
}) {
  const label = muscleGroup === 'upper' ? 'Upper Body' : muscleGroup === 'lower' ? 'Lower Body' : 'Full Body'

  return (
    <div className="mx-4 mt-3 mb-1 flex items-start gap-3 rounded-xl bg-amber-500/10 border border-amber-500/30 px-4 py-3">
      <svg xmlns="http://www.w3.org/2000/svg" className="w-5 h-5 text-amber-400 mt-0.5 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126ZM12 15.75h.007v.008H12v-.008Z" />
      </svg>
      <p className="flex-1 text-sm text-amber-200">
        Heads up — you trained <strong>{label}</strong> yesterday. Consider spacing out similar muscle groups.
      </p>
      <button
        onClick={onDismiss}
        className="p-1 text-amber-400 hover:text-amber-200 transition-colors shrink-0"
        aria-label="Dismiss warning"
      >
        <svg xmlns="http://www.w3.org/2000/svg" className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M6 18 18 6M6 6l12 12" />
        </svg>
      </button>
    </div>
  )
}

// ─── Workout Card (programmed) ───────────────────────────────────────
function WorkoutCard({
  workout,
  yesterdayGroups,
  onWarningTrigger,
}: {
  workout: WorkoutWithStatus
  yesterdayGroups: Set<string>
  onWarningTrigger: (group: string) => void
}) {
  const navigate = useNavigate()
  const userId = useUser()
  const completed = !!workout.log
  const badge = getBadge(workout.workout_type)
  const summary = buildSummary(workout)

  function handleTap() {
    if (
      workout.muscle_group &&
      yesterdayGroups.has(workout.muscle_group) &&
      !completed
    ) {
      onWarningTrigger(workout.muscle_group)
    }
    navigate(`/${userId}/workout/${workout.id}`)
  }

  return (
    <button
      onClick={handleTap}
      className={`w-full text-left rounded-2xl border px-5 py-4 transition-all active:scale-[0.98] ${
        completed
          ? 'bg-slate-900/50 border-slate-800 opacity-60'
          : 'bg-slate-900 border-slate-800 hover:border-slate-700'
      }`}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2.5 mb-1.5">
            <h3
              className={`font-semibold text-base truncate ${
                completed ? 'text-slate-400 line-through' : 'text-white'
              }`}
            >
              {workout.name}
            </h3>
            <span
              className={`shrink-0 inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${badge.bg} ${badge.text}`}
            >
              {badge.label}
            </span>
          </div>
          {summary && (
            <p className="text-sm text-slate-400 truncate">{summary}</p>
          )}
        </div>

        {/* Status indicator */}
        <div className="shrink-0 mt-1">
          {completed ? (
            <div className="w-8 h-8 rounded-full bg-green-500/20 flex items-center justify-center">
              <svg xmlns="http://www.w3.org/2000/svg" className="w-5 h-5 text-green-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="m4.5 12.75 6 6 9-13.5" />
              </svg>
            </div>
          ) : (
            <div className="w-8 h-8 rounded-full border-2 border-slate-700" />
          )}
        </div>
      </div>
    </button>
  )
}

// ─── Custom Workout Card (already completed) ─────────────────────────
function CustomWorkoutCard({ log }: { log: WorkoutLog }) {
  const badge = getBadge(log.workout_type)
  const summary = buildCustomSummary(log)

  return (
    <div className="w-full text-left rounded-2xl border px-5 py-4 bg-slate-900/50 border-slate-800 opacity-60">
      <div className="flex items-start justify-between gap-3">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2.5 mb-1.5">
            <h3 className="font-semibold text-base truncate text-slate-400 line-through">
              {log.name}
            </h3>
            <span
              className={`shrink-0 inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${badge.bg} ${badge.text}`}
            >
              {badge.label}
            </span>
            <span className="shrink-0 inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium bg-slate-700/50 text-slate-400">
              Custom
            </span>
          </div>
          {summary && (
            <p className="text-sm text-slate-400 truncate">{summary}</p>
          )}
        </div>

        <div className="shrink-0 mt-1">
          <div className="w-8 h-8 rounded-full bg-green-500/20 flex items-center justify-center">
            <svg xmlns="http://www.w3.org/2000/svg" className="w-5 h-5 text-green-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="m4.5 12.75 6 6 9-13.5" />
            </svg>
          </div>
        </div>
      </div>
    </div>
  )
}

// ─── Main Page ───────────────────────────────────────────────────────
export default function ThisWeek() {
  const navigate = useNavigate()
  const userId = useUser()
  const { program, loading: programLoading } = useActiveProgram(userId)
  const { week, loading: weekLoading, refresh } = useCurrentWeek(program?.id)
  const customLogs = useCustomWorkoutLogs(week?.id)
  const totalWeeks = useTotalWeeks(program?.id)

  const [showModal, setShowModal] = useState(false)
  const [warningGroup, setWarningGroup] = useState<string | null>(null)

  const loading = programLoading || weekLoading

  // Sort workouts: incomplete first (in order), completed at bottom
  const { incomplete, completed } = useMemo(() => {
    if (!week) return { incomplete: [], completed: [] }
    const inc: WorkoutWithStatus[] = []
    const comp: WorkoutWithStatus[] = []
    for (const w of week.workouts) {
      if (w.log) comp.push(w)
      else inc.push(w)
    }
    return { incomplete: inc, completed: comp }
  }, [week])

  const yesterdayGroups = useMemo(
    () => getYesterdayMuscleGroups(week?.workouts ?? [], customLogs),
    [week, customLogs]
  )

  // ─── Loading state ──────────────────────────────────────────────
  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="w-8 h-8 border-2 border-blue-400 border-t-transparent rounded-full animate-spin" />
      </div>
    )
  }

  // ─── Empty state: no active program ─────────────────────────────
  if (!program) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] px-6 text-center">
        <div className="w-16 h-16 mb-5 rounded-2xl bg-slate-800 flex items-center justify-center">
          <svg xmlns="http://www.w3.org/2000/svg" className="w-8 h-8 text-slate-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 6.042A8.967 8.967 0 0 0 6 3.75c-1.052 0-2.062.18-3 .512v14.25A8.987 8.987 0 0 1 6 18c2.305 0 4.408.867 6 2.292m0-14.25a8.966 8.966 0 0 1 6-2.292c1.052 0 2.062.18 3 .512v14.25A8.987 8.987 0 0 0 18 18a8.967 8.967 0 0 0-6 2.292m0-14.25v14.25" />
          </svg>
        </div>
        <h2 className="text-xl font-semibold text-white mb-2">No Active Program</h2>
        <p className="text-slate-400 text-sm max-w-xs mb-4">
          Import a training plan to get started.
        </p>
        <button
          onClick={() => navigate(`/${userId}/program`)}
          className="rounded-lg bg-blue-600 px-5 py-2.5 text-sm font-medium text-white hover:bg-blue-500 active:bg-blue-700 transition-colors"
        >
          Go to Program
        </button>
      </div>
    )
  }

  // ─── Empty state: no current week ───────────────────────────────
  if (!week) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] px-6 text-center">
        <div className="w-16 h-16 mb-5 rounded-2xl bg-slate-800 flex items-center justify-center">
          <svg xmlns="http://www.w3.org/2000/svg" className="w-8 h-8 text-slate-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M6.75 3v2.25M17.25 3v2.25M3 18.75V7.5a2.25 2.25 0 0 1 2.25-2.25h13.5A2.25 2.25 0 0 1 21 7.5v11.25m-18 0A2.25 2.25 0 0 0 5.25 21h13.5A2.25 2.25 0 0 0 21 18.75m-18 0v-7.5A2.25 2.25 0 0 1 5.25 9h13.5A2.25 2.25 0 0 1 21 11.25v7.5" />
          </svg>
        </div>
        <h2 className="text-xl font-semibold text-white mb-2">No Workouts This Week</h2>
        <p className="text-slate-400 text-sm max-w-xs mb-4">
          The current date doesn't fall within any week of your program. Check your program dates.
        </p>
        <button
          onClick={() => navigate(`/${userId}/program`)}
          className="rounded-lg bg-blue-600 px-5 py-2.5 text-sm font-medium text-white hover:bg-blue-500 active:bg-blue-700 transition-colors"
        >
          Go to Program
        </button>
      </div>
    )
  }

  // ─── Header info ────────────────────────────────────────────────
  const cycleName = week.cycle?.name ?? ''
  const cycleType = week.cycle?.cycle_type ?? ''
  const weekLabel = totalWeeks
    ? `Week ${week.week_number} of ${totalWeeks}`
    : `Week ${week.week_number}`
  const subtitle = cycleName
    ? `${cycleType ? cycleType.charAt(0).toUpperCase() + cycleType.slice(1) + ' — ' : ''}${cycleName}`
    : program.name

  const completedCount = completed.length + customLogs.length
  const totalCount = week.workouts.length + customLogs.length

  return (
    <div className="pb-6">
      {/* Header */}
      <div className="px-5 pt-6 pb-4">
        <h1 className="text-2xl font-bold text-white">{weekLabel}</h1>
        <p className="text-sm text-slate-400 mt-1">{subtitle}</p>

        {/* Progress indicator */}
        <div className="mt-4 flex items-center gap-3">
          <div className="flex-1 h-2 bg-slate-800 rounded-full overflow-hidden">
            <div
              className="h-full bg-blue-500 rounded-full transition-all duration-500"
              style={{
                width: totalCount > 0 ? `${(completedCount / totalCount) * 100}%` : '0%',
              }}
            />
          </div>
          <span className="text-xs text-slate-400 tabular-nums shrink-0">
            {completedCount}/{totalCount}
          </span>
        </div>
      </div>

      {/* Sequencing warning */}
      {warningGroup && (
        <SequencingWarning
          muscleGroup={warningGroup}
          onDismiss={() => setWarningGroup(null)}
        />
      )}

      {/* Workout list */}
      <div className="px-4 space-y-3">
        {/* Incomplete workouts first */}
        {incomplete.map((w) => (
          <WorkoutCard
            key={w.id}
            workout={w}
            yesterdayGroups={yesterdayGroups}
            onWarningTrigger={setWarningGroup}
          />
        ))}

        {/* Completed programmed workouts */}
        {completed.map((w) => (
          <WorkoutCard
            key={w.id}
            workout={w}
            yesterdayGroups={yesterdayGroups}
            onWarningTrigger={setWarningGroup}
          />
        ))}

        {/* Custom workout logs */}
        {customLogs.map((log) => (
          <CustomWorkoutCard key={log.id} log={log} />
        ))}
      </div>

      {/* Add Custom Workout button */}
      <div className="px-4 mt-5">
        <button
          onClick={() => setShowModal(true)}
          className="w-full flex items-center justify-center gap-2 py-3.5 rounded-2xl border-2 border-dashed border-slate-700 text-slate-400 hover:border-slate-600 hover:text-slate-300 active:bg-slate-900 transition-colors"
        >
          <svg xmlns="http://www.w3.org/2000/svg" className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
          </svg>
          <span className="font-medium text-sm">Add Custom Workout</span>
        </button>
      </div>

      {/* Custom workout modal */}
      {showModal && week && (
        <AddCustomWorkoutModal
          weekId={week.id}
          onClose={() => setShowModal(false)}
          onAdded={refresh}
        />
      )}
    </div>
  )
}
