import { useState, useEffect, useRef, useCallback } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import {
  useWorkoutDetails,
  useLastSessionData,
  useExerciseVideos,
  logWorkoutComplete,
  swapSlot,
  revertSlot,
  addCustomExerciseName,
} from '../lib/hooks'
import { supabase } from '../lib/supabase'
import { useUser } from '../lib/UserContext'
import type { ProgrammedExercise, ProgrammedExerciseWithOverride } from '../types'

// ─── Per-exercise set logging state ───────────────────────────────────────────
interface SetEntry {
  weight: number
  reps: number
  logged: boolean
}

// ─── Sub-component: Last session info line ────────────────────────────────────
function LastSessionLine({ exerciseName }: { exerciseName: string }) {
  const userId = useUser()
  const { lastSession, wasSkippedLastWeek } = useLastSessionData(exerciseName, userId)

  if (!lastSession && !wasSkippedLastWeek) return null

  return (
    <div className="mt-1 space-y-0.5">
      {wasSkippedLastWeek && (
        <p className="text-xs font-semibold text-amber-400 uppercase tracking-wider">
          Skipped last week
        </p>
      )}
      {lastSession && (
        <p className="text-sm text-slate-400">
          Last: {lastSession.weight} lb &times; {lastSession.reps.join(', ')}
          <span className="text-slate-500"> ({formatShortDate(lastSession.date)})</span>
        </p>
      )}
    </div>
  )
}

function formatShortDate(iso: string): string {
  const d = new Date(iso)
  return d.toLocaleDateString(undefined, { month: 'short', day: 'numeric' })
}

// ─── Sub-component: swap sheet ────────────────────────────────────────────────
function SwapSheet({
  open,
  currentName,
  onClose,
  onSelect,
}: {
  open: boolean
  currentName: string
  onClose: () => void
  onSelect: (name: string) => void
}) {
  const [query, setQuery] = useState('')
  const [allNames, setAllNames] = useState<string[]>([])
  const [showAdd, setShowAdd] = useState(false)
  const [newName, setNewName] = useState('')

  useEffect(() => {
    if (!open) return
    supabase
      .from('exercise_videos')
      .select('name')
      .order('name')
      .then(({ data }) => setAllNames((data || []).map((r: { name: string }) => r.name)))
  }, [open])

  if (!open) return null

  const filtered = allNames
    .filter((n) => n !== currentName)
    .filter((n) => n.toLowerCase().includes(query.toLowerCase()))

  const handleAdd = async () => {
    const trimmed = newName.trim()
    if (!trimmed) return
    await addCustomExerciseName(trimmed)
    onSelect(trimmed)
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end bg-black/60" onClick={onClose}>
      <div
        className="w-full bg-slate-900 rounded-t-3xl p-5 max-h-[85vh] flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-lg font-semibold text-white">Swap exercise</h3>
          <button type="button" onClick={onClose} className="text-slate-400 active:text-slate-200 text-xl">&times;</button>
        </div>
        <input
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search exercises..."
          className="w-full px-4 py-3 mb-3 rounded-xl bg-slate-800 text-white placeholder-slate-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
        />
        <div className="flex-1 overflow-y-auto space-y-1">
          {!showAdd ? (
            <button
              type="button"
              onClick={() => setShowAdd(true)}
              className="w-full text-left px-4 py-3 rounded-xl bg-blue-600/20 text-blue-300 active:bg-blue-600/40 font-medium"
            >
              + Add new exercise
            </button>
          ) : (
            <div className="px-4 py-3 rounded-xl bg-blue-600/20 space-y-2">
              <input
                type="text"
                value={newName}
                onChange={(e) => setNewName(e.target.value)}
                placeholder="Exercise name"
                autoFocus
                className="w-full px-3 py-2 rounded-lg bg-slate-800 text-white placeholder-slate-500 focus:outline-none"
              />
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={handleAdd}
                  disabled={!newName.trim()}
                  className="flex-1 py-2 rounded-lg bg-blue-600 active:bg-blue-500 disabled:opacity-50 text-white font-medium"
                >
                  Add &amp; select
                </button>
                <button
                  type="button"
                  onClick={() => { setShowAdd(false); setNewName('') }}
                  className="px-3 py-2 rounded-lg bg-slate-700 active:bg-slate-600 text-slate-300"
                >
                  Cancel
                </button>
              </div>
            </div>
          )}
          {filtered.map((n) => (
            <button
              key={n}
              type="button"
              onClick={() => onSelect(n)}
              className="w-full text-left px-4 py-3 rounded-xl text-white active:bg-slate-800"
            >
              {n}
            </button>
          ))}
        </div>
      </div>
    </div>
  )
}

// ─── Sub-component: menu sheet ────────────────────────────────────────────────
function MenuSheet({
  open,
  hasOverride,
  isSkipped,
  onClose,
  onSwap,
  onSkip,
  onRevert,
  onUnskip,
}: {
  open: boolean
  hasOverride: boolean
  isSkipped: boolean
  onClose: () => void
  onSwap: () => void
  onSkip: () => void
  onRevert: () => void
  onUnskip: () => void
}) {
  if (!open) return null
  return (
    <div className="fixed inset-0 z-40 flex items-end bg-black/60" onClick={onClose}>
      <div className="w-full bg-slate-900 rounded-t-3xl p-3 space-y-1" onClick={(e) => e.stopPropagation()}>
        {!isSkipped && (
          <>
            <button type="button" onClick={onSwap} className="w-full text-left px-4 py-3 rounded-xl text-white active:bg-slate-800">
              Swap exercise…
            </button>
            <button type="button" onClick={onSkip} className="w-full text-left px-4 py-3 rounded-xl text-amber-400 active:bg-slate-800">
              Skip this exercise
            </button>
          </>
        )}
        {isSkipped && (
          <button type="button" onClick={onUnskip} className="w-full text-left px-4 py-3 rounded-xl text-white active:bg-slate-800">
            Unskip
          </button>
        )}
        {hasOverride && !isSkipped && (
          <button type="button" onClick={onRevert} className="w-full text-left px-4 py-3 rounded-xl text-slate-300 active:bg-slate-800">
            Revert to original
          </button>
        )}
        <button type="button" onClick={onClose} className="w-full text-left px-4 py-3 rounded-xl text-slate-500 active:bg-slate-800">
          Cancel
        </button>
      </div>
    </div>
  )
}

// ─── Sub-component: individual exercise accordion ─────────────────────────────
function ExerciseCard({
  exercise,
  isExpanded,
  onToggle,
  sets,
  onUpdateSet,
  onLogSet,
  onUnlogSet,
  videoUrl,
  isSkipped,
  showUndoSkip,
  onOpenMenu,
}: {
  exercise: ProgrammedExerciseWithOverride
  isExpanded: boolean
  onToggle: () => void
  sets: SetEntry[]
  onUpdateSet: (setIndex: number, field: 'weight' | 'reps', value: number) => void
  onLogSet: (setIndex: number) => void
  onUnlogSet: (setIndex: number) => void
  videoUrl?: string
  isSkipped: boolean
  showUndoSkip: boolean
  onOpenMenu: () => void
}) {
  const activeSetIndex = sets.findIndex((s) => !s.logged)
  const allLogged = activeSetIndex === -1

  return (
    <div className={`bg-slate-900 rounded-2xl overflow-hidden ${isSkipped ? 'opacity-50' : ''}`}>
      <div className="relative">
        <button
          type="button"
          onClick={onToggle}
          disabled={isSkipped}
          className="w-full flex items-center justify-between px-5 py-4 active:bg-slate-800 transition-colors disabled:active:bg-transparent"
        >
          <div className="text-left flex-1 min-w-0">
            <h3 className={`text-lg font-semibold ${allLogged && !isSkipped ? 'text-emerald-400 line-through' : 'text-white'}`}>
              {exercise.name}
              {videoUrl && (
                <span
                  role="button"
                  className="inline-flex items-center ml-2 text-slate-400 active:text-slate-200 align-middle"
                  onClick={(e) => {
                    e.stopPropagation()
                    window.open(videoUrl, '_blank')
                  }}
                >
                  <VideoIcon />
                </span>
              )}
            </h3>
            {exercise.override && exercise.original_name && (
              <p className="text-xs text-slate-500">swapped from {exercise.original_name}</p>
            )}
            <p className="text-sm text-slate-400">
              {exercise.sets} &times; {exercise.reps}
            </p>
            {isSkipped ? (
              <p className="text-sm font-semibold text-amber-400 mt-1">
                Skipped {showUndoSkip && <button type="button" onClick={(e) => { e.stopPropagation(); onOpenMenu() }} className="underline">undo</button>}
              </p>
            ) : (
              <LastSessionLine exerciseName={exercise.name} />
            )}
          </div>
          {!isSkipped && <ChevronIcon open={isExpanded} />}
        </button>
        <button
          type="button"
          onClick={(e) => { e.stopPropagation(); onOpenMenu() }}
          className="absolute top-3 right-12 w-9 h-9 flex items-center justify-center rounded-lg text-slate-400 active:text-slate-200 active:bg-slate-800"
          aria-label="More options"
        >
          <MoreIcon />
        </button>
      </div>

      {/* Expanded set rows */}
      {isExpanded && !isSkipped && (
        <div className="px-5 pb-5 space-y-4">
          {sets.map((setEntry, idx) => (
            <SetRow
              key={idx}
              setNumber={idx + 1}
              entry={setEntry}
              isActive={idx === activeSetIndex}
              prescribedReps={exercise.reps}
              onUpdateWeight={(w) => onUpdateSet(idx, 'weight', w)}
              onUpdateReps={(r) => onUpdateSet(idx, 'reps', r)}
              onLog={() => onLogSet(idx)}
              onUnlog={() => onUnlogSet(idx)}
            />
          ))}
        </div>
      )}
    </div>
  )
}

// ─── Sub-component: single set row ───────────────────────────────────────────
function SetRow({
  setNumber,
  entry,
  isActive,
  prescribedReps,
  onUpdateWeight,
  onUpdateReps,
  onLog,
  onUnlog,
}: {
  setNumber: number
  entry: SetEntry
  isActive: boolean
  prescribedReps: number
  onUpdateWeight: (w: number) => void
  onUpdateReps: (r: number) => void
  onLog: () => void
  onUnlog: () => void
}) {
  const sliderRef = useRef<HTMLInputElement>(null)

  // Snap slider to nearest 5
  const handleSliderChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const raw = Number(e.target.value)
    const snapped = Math.round(raw / 5) * 5
    onUpdateWeight(snapped)
  }

  if (entry.logged) {
    return (
      <button
        type="button"
        onClick={onUnlog}
        className="w-full flex items-center gap-3 opacity-50 hover:opacity-75 active:opacity-90 transition-opacity py-1"
      >
        <span className="w-8 h-8 flex items-center justify-center rounded-full bg-emerald-600 text-white text-sm font-bold">
          {setNumber}
        </span>
        <span className="text-slate-300">{entry.weight} lbs &times; {entry.reps} reps</span>
        <CheckFilledIcon />
        <span className="ml-auto text-xs text-slate-500">tap to edit</span>
      </button>
    )
  }

  return (
    <div className={`rounded-xl p-4 ${isActive ? 'bg-slate-800 ring-1 ring-blue-500' : 'bg-slate-800/50'}`}>
      {/* Set label */}
      <div className="flex items-center gap-2 mb-3">
        <span className="w-8 h-8 flex items-center justify-center rounded-full bg-slate-700 text-white text-sm font-bold">
          {setNumber}
        </span>
        {!isActive && <span className="text-xs text-slate-500">upcoming</span>}
      </div>

      {/* Weight control */}
      <div className="mb-4">
        <label className="text-xs text-slate-400 uppercase tracking-wider mb-1 block">Weight</label>
        <p className="text-3xl font-bold text-white text-center mb-2">{entry.weight} lbs</p>
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={() => onUpdateWeight(Math.max(0, entry.weight - 5))}
            className="w-14 h-14 flex items-center justify-center rounded-xl bg-slate-700 active:bg-slate-600 text-white text-xl font-bold shrink-0"
          >
            &minus;5
          </button>
          <input
            ref={sliderRef}
            type="range"
            min={0}
            max={80}
            step={5}
            value={entry.weight}
            onChange={handleSliderChange}
            className="flex-1 h-3 appearance-none rounded-full bg-slate-700 accent-blue-500 cursor-pointer
              [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:w-7 [&::-webkit-slider-thumb]:h-7 [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:bg-blue-500"
          />
          <button
            type="button"
            onClick={() => onUpdateWeight(Math.min(80, entry.weight + 5))}
            className="w-14 h-14 flex items-center justify-center rounded-xl bg-slate-700 active:bg-slate-600 text-white text-xl font-bold shrink-0"
          >
            +5
          </button>
        </div>
      </div>

      {/* Reps stepper */}
      <div className="mb-4">
        <label className="text-xs text-slate-400 uppercase tracking-wider mb-1 block">Reps</label>
        <div className="flex items-center justify-center gap-4">
          <button
            type="button"
            onClick={() => onUpdateReps(Math.max(0, entry.reps - 1))}
            className="w-14 h-14 flex items-center justify-center rounded-xl bg-slate-700 active:bg-slate-600 text-white text-2xl font-bold"
          >
            &minus;
          </button>
          <span className="text-3xl font-bold text-white w-16 text-center">{entry.reps}</span>
          <button
            type="button"
            onClick={() => onUpdateReps(entry.reps + 1)}
            className="w-14 h-14 flex items-center justify-center rounded-xl bg-slate-700 active:bg-slate-600 text-white text-2xl font-bold"
          >
            +
          </button>
        </div>
        {entry.reps < prescribedReps && (
          <p className="text-xs text-amber-400 text-center mt-1">Prescribed: {prescribedReps}</p>
        )}
      </div>

      {/* Confirm set */}
      <button
        type="button"
        onClick={onLog}
        className="w-full h-14 flex items-center justify-center gap-2 rounded-xl bg-emerald-600 active:bg-emerald-500 text-white font-semibold text-lg transition-colors"
      >
        <CheckIcon />
        Log Set
      </button>
    </div>
  )
}

// ─── Helper: build initial sets from last session / defaults ─────────────────
function ExerciseSetInitializer({
  exercise,
  onReady,
}: {
  exercise: ProgrammedExercise
  onReady: (exerciseId: string, sets: SetEntry[]) => void
}) {
  const userId = useUser()
  const { lastSession } = useLastSessionData(exercise.name, userId)
  const hasInit = useRef(false)

  useEffect(() => {
    if (hasInit.current) return
    const t = setTimeout(() => {
      if (hasInit.current) return
      hasInit.current = true
      const entries: SetEntry[] = Array.from({ length: exercise.sets }, (_, i) => ({
        weight: lastSession?.weight ?? 0,
        reps: lastSession?.reps[i] ?? exercise.reps,
        logged: false,
      }))
      onReady(exercise.id, entries)
    }, 250)
    return () => clearTimeout(t)
  }, [exercise, onReady, lastSession])

  return null
}

// ─── Superset grouping helper ─────────────────────────────────────────────────
interface ExerciseGroup {
  supersetGroup: string | null
  exercises: ProgrammedExerciseWithOverride[]
}

function groupExercises(exercises: ProgrammedExerciseWithOverride[]): ExerciseGroup[] {
  const groups: ExerciseGroup[] = []

  for (const ex of exercises) {
    const last = groups[groups.length - 1]
    if (
      ex.superset_group &&
      last &&
      last.supersetGroup === ex.superset_group
    ) {
      last.exercises.push(ex)
    } else {
      groups.push({ supersetGroup: ex.superset_group, exercises: [ex] })
    }
  }

  return groups
}

// ─── Icons ────────────────────────────────────────────────────────────────────
function BackIcon() {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 19.5 8.25 12l7.5-7.5" />
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

function CheckIcon() {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="m4.5 12.75 6 6 9-13.5" />
    </svg>
  )
}

function VideoIcon() {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M5.25 5.653c0-.856.917-1.398 1.667-.986l11.54 6.347a1.125 1.125 0 0 1 0 1.972l-11.54 6.347a1.125 1.125 0 0 1-1.667-.986V5.653Z" />
    </svg>
  )
}

function LinkIcon() {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M13.19 8.688a4.5 4.5 0 0 1 1.242 7.244l-4.5 4.5a4.5 4.5 0 0 1-6.364-6.364l1.757-1.757m13.35-.622 1.757-1.757a4.5 4.5 0 0 0-6.364-6.364l-4.5 4.5a4.5 4.5 0 0 0 1.242 7.244" />
    </svg>
  )
}

function CheckFilledIcon() {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" className="w-5 h-5 text-emerald-400" viewBox="0 0 20 20" fill="currentColor">
      <path fillRule="evenodd" d="M10 18a8 8 0 1 0 0-16 8 8 0 0 0 0 16Zm3.857-9.809a.75.75 0 0 0-1.214-.882l-3.483 4.79-1.88-1.88a.75.75 0 1 0-1.06 1.061l2.5 2.5a.75.75 0 0 0 1.137-.089l4-5.5Z" clipRule="evenodd" />
    </svg>
  )
}

function MoreIcon() {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
      <path d="M10 6a1.5 1.5 0 1 1 0-3 1.5 1.5 0 0 1 0 3Zm0 5.5a1.5 1.5 0 1 1 0-3 1.5 1.5 0 0 1 0 3Zm0 5.5a1.5 1.5 0 1 1 0-3 1.5 1.5 0 0 1 0 3Z" />
    </svg>
  )
}

// ─── Main page component ──────────────────────────────────────────────────────
export default function ActiveWorkout() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const userId = useUser()
  const { workout, exercises, programId, loading, refresh: refreshDetails } = useWorkoutDetails(id)
  const exerciseVideos = useExerciseVideos()

  const [expandedId, setExpandedId] = useState<string | null>(null)
  const [setsMap, setSetsMap] = useState<Record<string, SetEntry[]>>({})
  const [submitting, setSubmitting] = useState(false)
  const [menuExerciseId, setMenuExerciseId] = useState<string | null>(null)
  const [swapSheetExerciseId, setSwapSheetExerciseId] = useState<string | null>(null)
  const [skippedIds, setSkippedIds] = useState<Set<string>>(new Set())

  // Called by each ExerciseSetInitializer once suggestion resolves
  const handleSetsReady = useCallback((exerciseId: string, sets: SetEntry[]) => {
    setSetsMap((prev) => {
      if (prev[exerciseId]) return prev // already initialized
      return { ...prev, [exerciseId]: sets }
    })
  }, [])

  const updateSet = (exerciseId: string, setIndex: number, field: 'weight' | 'reps', value: number) => {
    setSetsMap((prev) => {
      const copy = [...(prev[exerciseId] || [])]
      copy[setIndex] = { ...copy[setIndex], [field]: value }
      return { ...prev, [exerciseId]: copy }
    })
  }

  const logSet = (exerciseId: string, setIndex: number) => {
    setSetsMap((prev) => {
      const copy = [...(prev[exerciseId] || [])]
      copy[setIndex] = { ...copy[setIndex], logged: true }
      return { ...prev, [exerciseId]: copy }
    })
  }

  const unlogSet = (exerciseId: string, setIndex: number) => {
    setSetsMap((prev) => {
      const copy = [...(prev[exerciseId] || [])]
      copy[setIndex] = { ...copy[setIndex], logged: false }
      return { ...prev, [exerciseId]: copy }
    })
  }

  const openMenu = (exerciseId: string) => setMenuExerciseId(exerciseId)
  const closeMenu = () => setMenuExerciseId(null)

  const handleSwap = () => {
    if (!menuExerciseId) return
    setSwapSheetExerciseId(menuExerciseId)
    setMenuExerciseId(null)
  }

  const handleSkip = () => {
    if (!menuExerciseId) return
    setSkippedIds((prev) => new Set(prev).add(menuExerciseId))
    setMenuExerciseId(null)
  }

  const handleUnskip = () => {
    if (!menuExerciseId) return
    setSkippedIds((prev) => {
      const next = new Set(prev)
      next.delete(menuExerciseId)
      return next
    })
    setMenuExerciseId(null)
  }

  const handleRevert = async () => {
    const ex = exercises.find((e) => e.id === menuExerciseId)
    if (!ex || !programId) return
    await revertSlot(programId, ex.slot_key)
    setMenuExerciseId(null)
    refreshDetails()
  }

  const handleSwapSelect = async (newName: string) => {
    const ex = exercises.find((e) => e.id === swapSheetExerciseId)
    if (!ex || !programId) return
    await swapSlot(programId, userId, ex.slot_key, newName)
    setSwapSheetExerciseId(null)
    refreshDetails()
  }

  // Derive completion state
  const allExercisesLogged = exercises.length > 0 && exercises.every((ex) => {
    if (skippedIds.has(ex.id)) return true
    const sets = setsMap[ex.id]
    return sets && sets.every((s) => s.logged)
  })

  const anySetLogged = Object.values(setsMap).some((sets) => sets.some((s) => s.logged))

  const handleComplete = async (partial: boolean) => {
    if (!workout) return
    setSubmitting(true)

    const flatSets: { exerciseName: string; setNumber: number; prescribedReps: number; actualReps: number; weight: number }[] = []
    for (const ex of exercises) {
      const entries = setsMap[ex.id] || []
      entries.forEach((entry, idx) => {
        if (entry.logged) {
          flatSets.push({
            exerciseName: ex.name,
            setNumber: idx + 1,
            prescribedReps: ex.reps,
            actualReps: entry.reps,
            weight: entry.weight,
          })
        }
      })
    }

    const skipped = exercises
      .filter((ex) => skippedIds.has(ex.id))
      .map((ex) => ({ exerciseName: ex.name, prescribedReps: ex.reps }))

    await logWorkoutComplete(
      userId,
      workout.id,
      workout.week_id,
      workout.name,
      workout.workout_type,
      workout.muscle_group,
      flatSets,
      partial ? 'Finished early' : undefined,
      false,
      undefined,
      skipped,
    )

    navigate(`/${userId}`, { replace: true })
  }

  const handleNonLiftingComplete = async () => {
    if (!workout) return
    setSubmitting(true)
    await logWorkoutComplete(
      userId,
      workout.id,
      workout.week_id,
      workout.name,
      workout.workout_type,
      workout.muscle_group,
      [],
    )
    navigate(`/${userId}`, { replace: true })
  }

  // ── Loading state ─────────────────────────────────────────────────────────
  if (loading) {
    return (
      <div className="min-h-dvh bg-slate-950 flex items-center justify-center">
        <div className="w-8 h-8 border-4 border-blue-500 border-t-transparent rounded-full animate-spin" />
      </div>
    )
  }

  if (!workout) {
    return (
      <div className="min-h-dvh bg-slate-950 flex flex-col items-center justify-center gap-4 text-white px-6">
        <p className="text-lg">Workout not found</p>
        <button
          type="button"
          onClick={() => navigate(`/${userId}`)}
          className="px-6 py-3 rounded-xl bg-blue-600 active:bg-blue-500 text-white font-medium"
        >
          Go Back
        </button>
      </div>
    )
  }

  // ── Non-lifting workouts ──────────────────────────────────────────────────
  if (workout.workout_type !== 'lifting') {
    return (
      <div className="min-h-dvh bg-slate-950 flex flex-col">
        {/* Header */}
        <header className="flex items-center gap-3 px-4 py-4 safe-top">
          <button
            type="button"
            onClick={() => navigate(-1)}
            className="w-12 h-12 flex items-center justify-center rounded-xl bg-slate-800 active:bg-slate-700 text-white"
          >
            <BackIcon />
          </button>
          <div>
            <h1 className="text-xl font-bold text-white">{workout.name}</h1>
            <p className="text-sm text-slate-400 capitalize">{workout.workout_type}</p>
          </div>
        </header>

        {/* Body */}
        <div className="flex-1 flex flex-col items-center justify-center px-6 gap-6">
          {workout.description && (
            <p className="text-slate-300 text-center text-lg leading-relaxed max-w-md">
              {workout.description}
            </p>
          )}
          <div className="text-6xl">
            {workout.workout_type === 'cardio' && '🏃'}
            {workout.workout_type === 'yoga' && '🧘'}
            {workout.workout_type === 'rest' && '😴'}
            {workout.workout_type === 'other' && '💪'}
          </div>
          <button
            type="button"
            onClick={handleNonLiftingComplete}
            disabled={submitting}
            className="w-full max-w-sm h-16 rounded-2xl bg-emerald-600 active:bg-emerald-500 disabled:opacity-50 text-white text-xl font-bold transition-colors"
          >
            {submitting ? 'Saving...' : 'Mark Complete'}
          </button>
        </div>
      </div>
    )
  }

  // ── Lifting workout ───────────────────────────────────────────────────────
  return (
    <div className="min-h-dvh bg-slate-950 flex flex-col">
      {/* Header */}
      <header className="flex items-center gap-3 px-4 py-4 safe-top shrink-0">
        <button
          type="button"
          onClick={() => navigate(-1)}
          className="w-12 h-12 flex items-center justify-center rounded-xl bg-slate-800 active:bg-slate-700 text-white"
        >
          <BackIcon />
        </button>
        <div>
          <h1 className="text-xl font-bold text-white">{workout.name}</h1>
          {workout.muscle_group && (
            <p className="text-sm text-slate-400 capitalize">{workout.muscle_group} body</p>
          )}
        </div>
      </header>

      {/* Hidden initializers: each one calls useSuggestedWeight and feeds initial state */}
      {exercises.map((ex) => (
        <ExerciseSetInitializer key={ex.id} exercise={ex} onReady={handleSetsReady} />
      ))}

      {/* Exercise list */}
      <div className="flex-1 overflow-y-auto px-4 pb-40 space-y-3">
        {groupExercises(exercises).map((group) => {
          const isSuperset = group.supersetGroup && group.exercises.length > 1

          if (!isSuperset) {
            const ex = group.exercises[0]
            return (
              <ExerciseCard
                key={ex.id}
                exercise={ex}
                isExpanded={expandedId === ex.id}
                onToggle={() => setExpandedId(expandedId === ex.id ? null : ex.id)}
                sets={setsMap[ex.id] || []}
                onUpdateSet={(si, field, val) => updateSet(ex.id, si, field, val)}
                onLogSet={(si) => logSet(ex.id, si)}
                onUnlogSet={(si) => unlogSet(ex.id, si)}
                videoUrl={exerciseVideos.get(ex.name)}
                isSkipped={skippedIds.has(ex.id)}
                showUndoSkip={false}
                onOpenMenu={() => openMenu(ex.id)}
              />
            )
          }

          return (
            <div
              key={`superset-${group.supersetGroup}`}
              className="border-l-2 border-blue-500 pl-3 space-y-3"
            >
              <span className="inline-flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider text-blue-400 pl-1">
                <LinkIcon />
                Superset {group.supersetGroup}
              </span>
              {group.exercises.map((ex) => (
                <ExerciseCard
                  key={ex.id}
                  exercise={ex}
                  isExpanded={expandedId === ex.id}
                  onToggle={() => setExpandedId(expandedId === ex.id ? null : ex.id)}
                  sets={setsMap[ex.id] || []}
                  onUpdateSet={(si, field, val) => updateSet(ex.id, si, field, val)}
                  onLogSet={(si) => logSet(ex.id, si)}
                  onUnlogSet={(si) => unlogSet(ex.id, si)}
                  videoUrl={exerciseVideos.get(ex.name)}
                  isSkipped={skippedIds.has(ex.id)}
                  showUndoSkip={false}
                  onOpenMenu={() => openMenu(ex.id)}
                />
              ))}
            </div>
          )
        })}
      </div>

      {/* Bottom actions */}
      <div className="fixed bottom-0 inset-x-0 p-4 bg-gradient-to-t from-slate-950 via-slate-950/95 to-transparent safe-bottom">
        <div className="max-w-lg mx-auto space-y-2">
          {allExercisesLogged && (
            <button
              type="button"
              onClick={() => handleComplete(false)}
              disabled={submitting}
              className="w-full h-16 rounded-2xl bg-emerald-600 active:bg-emerald-500 disabled:opacity-50 text-white text-xl font-bold transition-colors"
            >
              {submitting ? 'Saving...' : 'Complete Workout'}
            </button>
          )}
          {anySetLogged && !allExercisesLogged && (
            <button
              type="button"
              onClick={() => handleComplete(true)}
              disabled={submitting}
              className="w-full h-14 rounded-2xl bg-slate-800 active:bg-slate-700 border border-slate-700 disabled:opacity-50 text-slate-300 font-medium transition-colors"
            >
              {submitting ? 'Saving...' : 'Finish Early'}
            </button>
          )}
        </div>
      </div>

      <MenuSheet
        open={menuExerciseId !== null}
        hasOverride={!!exercises.find((e) => e.id === menuExerciseId)?.override}
        isSkipped={menuExerciseId ? skippedIds.has(menuExerciseId) : false}
        onClose={closeMenu}
        onSwap={handleSwap}
        onSkip={handleSkip}
        onRevert={handleRevert}
        onUnskip={handleUnskip}
      />
      <SwapSheet
        open={swapSheetExerciseId !== null}
        currentName={exercises.find((e) => e.id === swapSheetExerciseId)?.name ?? ''}
        onClose={() => setSwapSheetExerciseId(null)}
        onSelect={handleSwapSelect}
      />
    </div>
  )
}
