import { useState } from 'react'
import { importProgram } from '../lib/hooks'
import { useUser } from '../lib/UserContext'
import type { ProgramImport } from '../types'

// ── Form types ──────────────────────────────────────────────────────

interface ExerciseForm {
  name: string
  sets: number
  reps: number
  bodyRegion: 'upper' | 'lower'
}

interface WorkoutForm {
  id: number
  name: string
  description: string
  workoutType: string
  muscleGroup: string | null
  exercises: ExerciseForm[]
}

let nextId = 0

function getNextMonday(): string {
  const d = new Date()
  const day = d.getDay()
  const diff = day === 0 ? 1 : 8 - day
  d.setDate(d.getDate() + diff)
  return d.toISOString().split('T')[0]
}

// ── Type badge (matches rest of app) ────────────────────────────────

const TYPE_BADGE: Record<string, { bg: string; text: string; label: string }> = {
  lifting: { bg: 'bg-blue-500/20', text: 'text-blue-400', label: 'Lifting' },
  cardio: { bg: 'bg-green-500/20', text: 'text-green-400', label: 'Cardio' },
  yoga: { bg: 'bg-purple-500/20', text: 'text-purple-400', label: 'Yoga' },
  rest: { bg: 'bg-slate-500/20', text: 'text-slate-400', label: 'Rest' },
  other: { bg: 'bg-pink-500/20', text: 'text-pink-400', label: 'Other' },
}

const WORKOUT_TYPES = ['lifting', 'cardio', 'yoga', 'rest', 'other'] as const

// ── Step 1: Program Details ─────────────────────────────────────────

function ProgramDetailsStep({
  name,
  startDate,
  numWeeks,
  onName,
  onStartDate,
  onNumWeeks,
}: {
  name: string
  startDate: string
  numWeeks: number
  onName: (v: string) => void
  onStartDate: (v: string) => void
  onNumWeeks: (v: number) => void
}) {
  return (
    <div className="space-y-5">
      <div>
        <label className="block text-sm font-medium text-slate-300 mb-1">Program Name</label>
        <input
          type="text"
          value={name}
          onChange={(e) => onName(e.target.value)}
          placeholder="e.g. 8-Week Strength Builder"
          className="w-full rounded-lg bg-slate-800 border border-slate-700 px-4 py-3 text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-blue-500 text-base"
          autoFocus
        />
      </div>

      <div>
        <label className="block text-sm font-medium text-slate-300 mb-1">Start Date</label>
        <input
          type="date"
          value={startDate}
          onChange={(e) => onStartDate(e.target.value)}
          className="w-full rounded-lg bg-slate-800 border border-slate-700 px-4 py-3 text-white focus:outline-none focus:ring-2 focus:ring-blue-500 text-base"
        />
      </div>

      <div>
        <label className="block text-sm font-medium text-slate-300 mb-1">Number of Weeks</label>
        <div className="flex items-center gap-4">
          <button
            type="button"
            onClick={() => onNumWeeks(Math.max(1, numWeeks - 1))}
            className="w-12 h-12 flex items-center justify-center rounded-xl bg-slate-700 active:bg-slate-600 text-white text-xl font-bold"
          >
            &minus;
          </button>
          <span className="text-2xl font-bold text-white w-12 text-center">{numWeeks}</span>
          <button
            type="button"
            onClick={() => onNumWeeks(Math.min(52, numWeeks + 1))}
            className="w-12 h-12 flex items-center justify-center rounded-xl bg-slate-700 active:bg-slate-600 text-white text-xl font-bold"
          >
            +
          </button>
        </div>
      </div>
    </div>
  )
}

// ── Exercise Row ────────────────────────────────────────────────────

function ExerciseRow({
  exercise,
  onUpdate,
  onRemove,
}: {
  exercise: ExerciseForm
  onUpdate: (updates: Partial<ExerciseForm>) => void
  onRemove: () => void
}) {
  return (
    <div className="rounded-lg bg-slate-800/60 border border-slate-700 p-3 space-y-3">
      <div className="flex items-center gap-2">
        <input
          type="text"
          value={exercise.name}
          onChange={(e) => onUpdate({ name: e.target.value })}
          placeholder="Exercise name"
          className="flex-1 rounded-lg bg-slate-800 border border-slate-600 px-3 py-2 text-sm text-white placeholder-slate-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
        />
        <button
          type="button"
          onClick={onRemove}
          className="p-1.5 text-slate-500 hover:text-red-400 transition-colors"
        >
          <XSmallIcon />
        </button>
      </div>

      <div className="flex items-center gap-3">
        {/* Sets */}
        <div className="flex items-center gap-1.5">
          <span className="text-xs text-slate-400">Sets</span>
          <button
            type="button"
            onClick={() => onUpdate({ sets: Math.max(1, exercise.sets - 1) })}
            className="w-7 h-7 flex items-center justify-center rounded bg-slate-700 active:bg-slate-600 text-white text-sm font-bold"
          >
            &minus;
          </button>
          <span className="text-sm font-semibold text-white w-5 text-center">{exercise.sets}</span>
          <button
            type="button"
            onClick={() => onUpdate({ sets: exercise.sets + 1 })}
            className="w-7 h-7 flex items-center justify-center rounded bg-slate-700 active:bg-slate-600 text-white text-sm font-bold"
          >
            +
          </button>
        </div>

        {/* Reps */}
        <div className="flex items-center gap-1.5">
          <span className="text-xs text-slate-400">Reps</span>
          <button
            type="button"
            onClick={() => onUpdate({ reps: Math.max(1, exercise.reps - 1) })}
            className="w-7 h-7 flex items-center justify-center rounded bg-slate-700 active:bg-slate-600 text-white text-sm font-bold"
          >
            &minus;
          </button>
          <span className="text-sm font-semibold text-white w-5 text-center">{exercise.reps}</span>
          <button
            type="button"
            onClick={() => onUpdate({ reps: exercise.reps + 1 })}
            className="w-7 h-7 flex items-center justify-center rounded bg-slate-700 active:bg-slate-600 text-white text-sm font-bold"
          >
            +
          </button>
        </div>

        {/* Body region toggle */}
        <div className="flex rounded-lg overflow-hidden border border-slate-600 ml-auto">
          <button
            type="button"
            onClick={() => onUpdate({ bodyRegion: 'upper' })}
            className={`px-2.5 py-1 text-xs font-medium transition-colors ${
              exercise.bodyRegion === 'upper'
                ? 'bg-blue-600 text-white'
                : 'bg-slate-800 text-slate-400'
            }`}
          >
            Upper
          </button>
          <button
            type="button"
            onClick={() => onUpdate({ bodyRegion: 'lower' })}
            className={`px-2.5 py-1 text-xs font-medium transition-colors ${
              exercise.bodyRegion === 'lower'
                ? 'bg-blue-600 text-white'
                : 'bg-slate-800 text-slate-400'
            }`}
          >
            Lower
          </button>
        </div>
      </div>
    </div>
  )
}

// ── Workout Card (accordion) ────────────────────────────────────────

function WorkoutCard({
  workout,
  isExpanded,
  onToggle,
  onUpdate,
  onRemove,
  onAddExercise,
  onUpdateExercise,
  onRemoveExercise,
}: {
  workout: WorkoutForm
  isExpanded: boolean
  onToggle: () => void
  onUpdate: (updates: Partial<WorkoutForm>) => void
  onRemove: () => void
  onAddExercise: () => void
  onUpdateExercise: (index: number, updates: Partial<ExerciseForm>) => void
  onRemoveExercise: (index: number) => void
}) {
  const badge = TYPE_BADGE[workout.workoutType] ?? TYPE_BADGE.other
  const isLifting = workout.workoutType === 'lifting'

  return (
    <div className="rounded-xl bg-slate-900 border border-slate-800 overflow-hidden">
      {/* Collapsed header */}
      <button
        type="button"
        onClick={onToggle}
        className="w-full flex items-center justify-between px-4 py-3 active:bg-slate-800/50 transition-colors"
      >
        <div className="flex items-center gap-2.5 min-w-0">
          <span className={`shrink-0 inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${badge.bg} ${badge.text}`}>
            {badge.label}
          </span>
          <span className="text-sm font-medium text-white truncate">
            {workout.name || 'Untitled'}
          </span>
          {isLifting && workout.exercises.length > 0 && (
            <span className="text-xs text-slate-500">
              {workout.exercises.length} exercise{workout.exercises.length !== 1 ? 's' : ''}
            </span>
          )}
        </div>
        <ChevronIcon open={isExpanded} />
      </button>

      {/* Expanded editor */}
      {isExpanded && (
        <div className="px-4 pb-4 space-y-4 border-t border-slate-800 pt-4">
          {/* Name */}
          <div>
            <label className="block text-xs font-medium text-slate-400 mb-1">Name</label>
            <input
              type="text"
              value={workout.name}
              onChange={(e) => onUpdate({ name: e.target.value })}
              placeholder="e.g. Upper Body A"
              className="w-full rounded-lg bg-slate-800 border border-slate-700 px-3 py-2.5 text-sm text-white placeholder-slate-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
            />
          </div>

          {/* Type */}
          <div>
            <label className="block text-xs font-medium text-slate-400 mb-1">Type</label>
            <div className="flex flex-wrap gap-2">
              {WORKOUT_TYPES.map((t) => {
                const b = TYPE_BADGE[t]
                return (
                  <button
                    key={t}
                    type="button"
                    onClick={() => onUpdate({
                      workoutType: t,
                      muscleGroup: t === 'lifting' ? (workout.muscleGroup || 'upper') : null,
                    })}
                    className={`rounded-full px-3 py-1.5 text-xs font-medium transition-colors ${
                      workout.workoutType === t
                        ? `${b.bg} ${b.text} ring-1 ring-current`
                        : 'bg-slate-800 text-slate-400'
                    }`}
                  >
                    {b.label}
                  </button>
                )
              })}
            </div>
          </div>

          {/* Description */}
          {workout.workoutType !== 'rest' && (
            <div>
              <label className="block text-xs font-medium text-slate-400 mb-1">Description</label>
              <input
                type="text"
                value={workout.description}
                onChange={(e) => onUpdate({ description: e.target.value })}
                placeholder="Optional description"
                className="w-full rounded-lg bg-slate-800 border border-slate-700 px-3 py-2.5 text-sm text-white placeholder-slate-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
              />
            </div>
          )}

          {/* Muscle group (lifting only) */}
          {isLifting && (
            <div>
              <label className="block text-xs font-medium text-slate-400 mb-1">Muscle Group</label>
              <div className="flex rounded-lg overflow-hidden border border-slate-700">
                {(['upper', 'lower', 'full'] as const).map((g) => (
                  <button
                    key={g}
                    type="button"
                    onClick={() => onUpdate({ muscleGroup: g })}
                    className={`flex-1 py-2 text-xs font-medium transition-colors capitalize ${
                      workout.muscleGroup === g
                        ? 'bg-blue-600 text-white'
                        : 'bg-slate-800 text-slate-400'
                    }`}
                  >
                    {g}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Exercises (lifting only) */}
          {isLifting && (
            <div className="space-y-2">
              <label className="block text-xs font-medium text-slate-400">Exercises</label>
              {workout.exercises.map((ex, i) => (
                <ExerciseRow
                  key={i}
                  exercise={ex}
                  onUpdate={(updates) => onUpdateExercise(i, updates)}
                  onRemove={() => onRemoveExercise(i)}
                />
              ))}
              <button
                type="button"
                onClick={onAddExercise}
                className="w-full flex items-center justify-center gap-1.5 py-2 rounded-lg border border-dashed border-slate-600 text-xs font-medium text-slate-400 hover:text-slate-200 hover:border-slate-500 transition-colors"
              >
                <PlusIcon />
                Add Exercise
              </button>
            </div>
          )}

          {/* Delete workout */}
          <button
            type="button"
            onClick={onRemove}
            className="w-full py-2 rounded-lg text-xs font-medium text-red-400 hover:text-red-300 hover:bg-red-500/10 transition-colors"
          >
            Remove Workout
          </button>
        </div>
      )}
    </div>
  )
}

// ── Step 2: Weekly Workouts ─────────────────────────────────────────

function WeekBuilderStep({
  workouts,
  expandedId,
  onExpandToggle,
  onAddWorkout,
  onUpdateWorkout,
  onRemoveWorkout,
  onAddExercise,
  onUpdateExercise,
  onRemoveExercise,
}: {
  workouts: WorkoutForm[]
  expandedId: number | null
  onExpandToggle: (id: number) => void
  onAddWorkout: () => void
  onUpdateWorkout: (id: number, updates: Partial<WorkoutForm>) => void
  onRemoveWorkout: (id: number) => void
  onAddExercise: (workoutId: number) => void
  onUpdateExercise: (workoutId: number, exIndex: number, updates: Partial<ExerciseForm>) => void
  onRemoveExercise: (workoutId: number, exIndex: number) => void
}) {
  return (
    <div className="space-y-3">
      <p className="text-xs text-slate-400">
        Build your weekly workout template. These workouts will repeat each week of the program.
      </p>

      {workouts.map((w) => (
        <WorkoutCard
          key={w.id}
          workout={w}
          isExpanded={expandedId === w.id}
          onToggle={() => onExpandToggle(w.id)}
          onUpdate={(updates) => onUpdateWorkout(w.id, updates)}
          onRemove={() => onRemoveWorkout(w.id)}
          onAddExercise={() => onAddExercise(w.id)}
          onUpdateExercise={(i, updates) => onUpdateExercise(w.id, i, updates)}
          onRemoveExercise={(i) => onRemoveExercise(w.id, i)}
        />
      ))}

      <button
        type="button"
        onClick={onAddWorkout}
        className="w-full flex items-center justify-center gap-2 py-3 rounded-xl border-2 border-dashed border-slate-700 text-slate-400 hover:border-slate-600 hover:text-slate-300 active:bg-slate-900 transition-colors"
      >
        <PlusIcon />
        <span className="font-medium text-sm">Add Workout</span>
      </button>
    </div>
  )
}

// ── Step 3: Review ──────────────────────────────────────────────────

function ReviewStep({
  name,
  startDate,
  numWeeks,
  workouts,
}: {
  name: string
  startDate: string
  numWeeks: number
  workouts: WorkoutForm[]
}) {
  const liftingCount = workouts.filter((w) => w.workoutType === 'lifting').length
  const otherCount = workouts.length - liftingCount

  return (
    <div className="space-y-4">
      <div className="rounded-lg bg-slate-800/60 border border-slate-700 p-4 space-y-2">
        <h4 className="font-semibold text-white">{name}</h4>
        <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-slate-400">
          <span>Starts {new Date(startDate + 'T00:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}</span>
          <span>{numWeeks} week{numWeeks !== 1 ? 's' : ''}</span>
          <span>{workouts.length} workout{workouts.length !== 1 ? 's' : ''}/week</span>
        </div>
      </div>

      <div className="space-y-2">
        <h4 className="text-xs font-medium text-slate-400 uppercase tracking-wide">Weekly Schedule</h4>
        {workouts.map((w) => {
          const badge = TYPE_BADGE[w.workoutType] ?? TYPE_BADGE.other
          return (
            <div key={w.id} className="rounded-lg bg-slate-800/60 border border-slate-700 p-3">
              <div className="flex items-center gap-2">
                <span className={`shrink-0 inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-medium ${badge.bg} ${badge.text}`}>
                  {badge.label}
                </span>
                <span className="text-sm font-medium text-white">{w.name || 'Untitled'}</span>
              </div>
              {w.workoutType === 'lifting' && w.exercises.length > 0 && (
                <ul className="mt-2 space-y-0.5 pl-1">
                  {w.exercises.map((ex, i) => (
                    <li key={i} className="text-xs text-slate-400">
                      {ex.name || 'Unnamed'} — {ex.sets} &times; {ex.reps}
                    </li>
                  ))}
                </ul>
              )}
            </div>
          )
        })}
      </div>

      {liftingCount > 0 && (
        <p className="text-xs text-slate-500">
          {liftingCount} lifting session{liftingCount !== 1 ? 's' : ''}
          {otherCount > 0 ? ` + ${otherCount} other` : ''} per week, repeated for {numWeeks} weeks.
        </p>
      )}

      <p className="text-xs text-amber-400/80">
        Your current active program will be archived.
      </p>
    </div>
  )
}

// ── Main Modal ──────────────────────────────────────────────────────

export default function CreateProgramModal({
  open,
  onClose,
  onCreated,
}: {
  open: boolean
  onClose: () => void
  onCreated: () => void
}) {
  const userId = useUser()
  const [step, setStep] = useState(0)
  const [programName, setProgramName] = useState('')
  const [startDate, setStartDate] = useState(getNextMonday)
  const [numWeeks, setNumWeeks] = useState(4)
  const [workouts, setWorkouts] = useState<WorkoutForm[]>([])
  const [expandedId, setExpandedId] = useState<number | null>(null)
  const [creating, setCreating] = useState(false)
  const [error, setError] = useState('')

  function handleClose() {
    onClose()
    setStep(0)
    setProgramName('')
    setStartDate(getNextMonday())
    setNumWeeks(4)
    setWorkouts([])
    setExpandedId(null)
    setError('')
  }

  // ── Workout CRUD ────────────────────────────────────────────────
  function addWorkout() {
    const id = ++nextId
    setWorkouts((prev) => [
      ...prev,
      { id, name: '', description: '', workoutType: 'lifting', muscleGroup: 'upper', exercises: [] },
    ])
    setExpandedId(id)
  }

  function updateWorkout(id: number, updates: Partial<WorkoutForm>) {
    setWorkouts((prev) => prev.map((w) => (w.id === id ? { ...w, ...updates } : w)))
  }

  function removeWorkout(id: number) {
    setWorkouts((prev) => prev.filter((w) => w.id !== id))
    if (expandedId === id) setExpandedId(null)
  }

  // ── Exercise CRUD ───────────────────────────────────────────────
  function addExercise(workoutId: number) {
    setWorkouts((prev) =>
      prev.map((w) =>
        w.id === workoutId
          ? { ...w, exercises: [...w.exercises, { name: '', sets: 3, reps: 10, bodyRegion: 'upper' }] }
          : w
      )
    )
  }

  function updateExercise(workoutId: number, exIndex: number, updates: Partial<ExerciseForm>) {
    setWorkouts((prev) =>
      prev.map((w) =>
        w.id === workoutId
          ? { ...w, exercises: w.exercises.map((ex, i) => (i === exIndex ? { ...ex, ...updates } : ex)) }
          : w
      )
    )
  }

  function removeExercise(workoutId: number, exIndex: number) {
    setWorkouts((prev) =>
      prev.map((w) =>
        w.id === workoutId
          ? { ...w, exercises: w.exercises.filter((_, i) => i !== exIndex) }
          : w
      )
    )
  }

  // ── Validation ──────────────────────────────────────────────────
  function canAdvance(): boolean {
    if (step === 0) return programName.trim().length > 0 && startDate.length > 0 && numWeeks >= 1
    if (step === 1) {
      if (workouts.length === 0) return false
      return workouts.every((w) => {
        if (!w.name.trim()) return false
        if (w.workoutType === 'lifting' && w.exercises.length > 0) {
          return w.exercises.every((ex) => ex.name.trim().length > 0)
        }
        return true
      })
    }
    return true
  }

  // ── Create program ─────────────────────────────────────────────
  async function handleCreate() {
    setCreating(true)
    setError('')

    const programData: ProgramImport = {
      name: programName.trim(),
      description: `${workouts.length} workouts/week, ${numWeeks} weeks`,
      start_date: startDate,
      cycles: [
        {
          name: programName.trim(),
          cycle_type: 'general',
          color: '#3b82f6',
          weeks: Array.from({ length: numWeeks }, (_, i) => ({
            week_number: i + 1,
            workouts: workouts.map((w) => ({
              name: w.name.trim(),
              workout_type: w.workoutType,
              muscle_group: w.workoutType === 'lifting' ? w.muscleGroup : null,
              description: w.description,
              ...(w.workoutType === 'lifting' && w.exercises.length > 0
                ? {
                    exercises: w.exercises.map((ex) => ({
                      name: ex.name.trim(),
                      sets: ex.sets,
                      reps: ex.reps,
                      body_region: ex.bodyRegion,
                    })),
                  }
                : {}),
            })),
          })),
        },
      ],
    }

    try {
      await importProgram(programData, userId)
      onCreated()
      handleClose()
    } catch (e: any) {
      setError(e.message || 'Failed to create program')
      setCreating(false)
    }
  }

  if (!open) return null

  const stepLabel = step === 0 ? 'Program Details' : step === 1 ? 'Weekly Workouts' : 'Review'

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center">
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={handleClose} />

      <div className="relative w-full max-w-lg mx-4 mb-4 sm:mb-0 rounded-xl bg-slate-900 border border-slate-700 shadow-2xl max-h-[85dvh] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-slate-800">
          <h3 className="text-base font-semibold text-white">{stepLabel}</h3>
          <button onClick={handleClose} className="text-slate-400 hover:text-slate-200 p-1">
            <XIcon />
          </button>
        </div>

        {/* Step indicator */}
        <div className="flex gap-1 px-4 pt-3">
          {[0, 1, 2].map((s) => (
            <div
              key={s}
              className={`flex-1 h-1 rounded-full transition-colors ${s <= step ? 'bg-blue-500' : 'bg-slate-700'}`}
            />
          ))}
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto px-4 py-4">
          {step === 0 && (
            <ProgramDetailsStep
              name={programName}
              startDate={startDate}
              numWeeks={numWeeks}
              onName={setProgramName}
              onStartDate={setStartDate}
              onNumWeeks={setNumWeeks}
            />
          )}
          {step === 1 && (
            <WeekBuilderStep
              workouts={workouts}
              expandedId={expandedId}
              onExpandToggle={(id) => setExpandedId(expandedId === id ? null : id)}
              onAddWorkout={addWorkout}
              onUpdateWorkout={updateWorkout}
              onRemoveWorkout={removeWorkout}
              onAddExercise={addExercise}
              onUpdateExercise={updateExercise}
              onRemoveExercise={removeExercise}
            />
          )}
          {step === 2 && (
            <ReviewStep
              name={programName}
              startDate={startDate}
              numWeeks={numWeeks}
              workouts={workouts}
            />
          )}
        </div>

        {/* Footer */}
        <div className="px-4 py-3 border-t border-slate-800 space-y-2">
          {error && <p className="text-sm text-red-400">{error}</p>}
          <div className="flex gap-2">
            {step > 0 && (
              <button
                type="button"
                onClick={() => setStep((s) => s - 1)}
                className="flex-1 rounded-lg bg-slate-800 border border-slate-700 py-2.5 text-sm font-medium text-slate-300 hover:bg-slate-700 transition-colors"
              >
                Back
              </button>
            )}
            {step < 2 && (
              <button
                type="button"
                onClick={() => setStep((s) => s + 1)}
                disabled={!canAdvance()}
                className="flex-1 rounded-lg bg-blue-600 py-2.5 text-sm font-medium text-white disabled:opacity-40 hover:bg-blue-500 transition-colors"
              >
                Next
              </button>
            )}
            {step === 2 && (
              <button
                type="button"
                onClick={handleCreate}
                disabled={creating}
                className="flex-1 rounded-lg bg-blue-600 py-2.5 text-sm font-medium text-white disabled:opacity-40 hover:bg-blue-500 transition-colors"
              >
                {creating ? 'Creating...' : 'Create Program'}
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}

// ── Icons ───────────────────────────────────────────────────────────

function XIcon() {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
    </svg>
  )
}

function XSmallIcon() {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
    </svg>
  )
}

function ChevronIcon({ open }: { open: boolean }) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      className={`w-5 h-5 text-slate-400 transition-transform ${open ? 'rotate-180' : ''}`}
      fill="none"
      viewBox="0 0 24 24"
      stroke="currentColor"
      strokeWidth={2}
    >
      <path strokeLinecap="round" strokeLinejoin="round" d="m19.5 8.25-7.5 7.5-7.5-7.5" />
    </svg>
  )
}

function PlusIcon() {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
    </svg>
  )
}
