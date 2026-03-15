import { useState, useEffect, useCallback } from 'react'
import { supabase } from './supabase'
import type {
  Program,
  ProgrammedWorkout,
  ProgrammedExercise,
  WorkoutLog,
  SetLog,
  WeekWithWorkouts,
  ProgramImport,
} from '../types'

export function useExerciseVideos() {
  const [videos, setVideos] = useState<Map<string, string>>(new Map())

  useEffect(() => {
    supabase
      .from('exercise_videos')
      .select('name, video_url')
      .not('video_url', 'is', null)
      .then(({ data }) => {
        const map = new Map<string, string>()
        for (const row of data || []) {
          if (row.video_url) map.set(row.name, row.video_url)
        }
        setVideos(map)
      })
  }, [])

  return videos
}

export function useActiveProgram(userId: string) {
  const [program, setProgram] = useState<Program | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    supabase
      .from('programs')
      .select('*')
      .eq('is_active', true)
      .eq('user_id', userId)
      .limit(1)
      .then(({ data }) => {
        setProgram(data?.[0] ?? null)
        setLoading(false)
      })
  }, [userId])

  return { program, loading }
}

export function useCurrentWeek(programId: string | undefined) {
  const [week, setWeek] = useState<WeekWithWorkouts | null>(null)
  const [loading, setLoading] = useState(true)

  const refresh = useCallback(() => {
    if (!programId) return
    setLoading(true)

    const today = new Date().toISOString().split('T')[0]

    supabase
      .from('weeks')
      .select('*, cycles(*)')
      .eq('program_id', programId)
      .lte('start_date', today)
      .gte('end_date', today)
      .single()
      .then(async ({ data: weekData }) => {
        if (!weekData) {
          setLoading(false)
          return
        }

        const { data: workouts } = await supabase
          .from('programmed_workouts')
          .select('*, programmed_exercises(*)')
          .eq('week_id', weekData.id)
          .order('order_index')

        const { data: logs } = await supabase
          .from('workout_logs')
          .select('*')
          .eq('week_id', weekData.id)

        const enriched = (workouts || []).map((w: ProgrammedWorkout & { programmed_exercises?: ProgrammedExercise[] }) => ({
          ...w,
          exercises: w.programmed_exercises || [],
          log: (logs || []).find((l: WorkoutLog) => l.programmed_workout_id === w.id),
        }))

        setWeek({
          ...weekData,
          cycle: weekData.cycles,
          workouts: enriched,
        })
        setLoading(false)
      })
  }, [programId])

  useEffect(() => {
    refresh()
  }, [refresh])

  return { week, loading, refresh }
}

export function useWorkoutDetails(workoutId: string | undefined) {
  const [workout, setWorkout] = useState<ProgrammedWorkout | null>(null)
  const [exercises, setExercises] = useState<ProgrammedExercise[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!workoutId) return

    Promise.all([
      supabase.from('programmed_workouts').select('*').eq('id', workoutId).single(),
      supabase.from('programmed_exercises').select('*').eq('workout_id', workoutId).order('order_index'),
    ]).then(([{ data: w }, { data: ex }]) => {
      setWorkout(w)
      setExercises(ex || [])
      setLoading(false)
    })
  }, [workoutId])

  return { workout, exercises, loading }
}

export function useExerciseHistory(exerciseName: string, userId: string) {
  const [history, setHistory] = useState<SetLog[]>([])

  useEffect(() => {
    if (!exerciseName) return

    supabase
      .from('set_logs')
      .select('*, workout_logs!inner(completed_at, user_id)')
      .eq('exercise_name', exerciseName)
      .eq('workout_logs.user_id', userId)
      .order('created_at', { ascending: false })
      .limit(100)
      .then(({ data }) => {
        setHistory(data || [])
      })
  }, [exerciseName, userId])

  return history
}

export function useSuggestedWeight(exerciseName: string, _prescribedReps: number, bodyRegion: 'upper' | 'lower', userId: string) {
  const [suggestion, setSuggestion] = useState<{ weight: number; reason: string } | null>(null)
  const history = useExerciseHistory(exerciseName, userId)

  useEffect(() => {
    if (history.length === 0) {
      setSuggestion(null)
      return
    }

    const increment = bodyRegion === 'upper' ? 5 : 10

    // Group sets by workout session
    const sessions = new Map<string, SetLog[]>()
    for (const s of history) {
      const logId = s.workout_log_id
      if (!sessions.has(logId)) sessions.set(logId, [])
      sessions.get(logId)!.push(s)
    }

    const sessionList = Array.from(sessions.values())
    if (sessionList.length === 0) return

    const lastSession = sessionList[0]
    const lastWeight = Math.max(...lastSession.map((s) => s.weight))
    const allRepsHit = lastSession.every((s) => s.actual_reps >= s.prescribed_reps)

    if (allRepsHit) {
      setSuggestion({ weight: lastWeight + increment, reason: 'Hit all reps last time' })
    } else {
      // Check if missed 2+ consecutive sessions at same weight
      if (sessionList.length >= 2) {
        const prevSession = sessionList[1]
        const prevWeight = Math.max(...prevSession.map((s) => s.weight))
        const prevAllMissed = prevSession.some((s) => s.actual_reps < s.prescribed_reps)

        if (prevAllMissed && prevWeight === lastWeight) {
          setSuggestion({ weight: lastWeight - increment, reason: 'Missed reps 2 sessions — deload' })
          return
        }
      }
      setSuggestion({ weight: lastWeight, reason: 'Missed reps — try again' })
    }
  }, [history, bodyRegion])

  return suggestion
}

export async function logWorkoutComplete(
  userId: string,
  programmedWorkoutId: string | null,
  weekId: string | null,
  name: string,
  workoutType: string,
  muscleGroup: string | null,
  sets: { exerciseName: string; setNumber: number; prescribedReps: number; actualReps: number; weight: number }[],
  notes?: string,
  isCustom = false,
  completedAt?: string
) {
  const { data: log } = await supabase
    .from('workout_logs')
    .insert({
      programmed_workout_id: programmedWorkoutId,
      week_id: weekId,
      name,
      workout_type: workoutType,
      muscle_group: muscleGroup,
      notes,
      is_custom: isCustom,
      completed_at: completedAt ?? new Date().toISOString(),
      user_id: userId,
    })
    .select()
    .single()

  if (log && sets.length > 0) {
    await supabase.from('set_logs').insert(
      sets.map((s) => ({
        workout_log_id: log.id,
        exercise_name: s.exerciseName,
        set_number: s.setNumber,
        prescribed_reps: s.prescribedReps,
        actual_reps: s.actualReps,
        weight: s.weight,
      }))
    )
  }

  return log
}

export async function importProgram(data: ProgramImport, userId: string) {
  // Archive current active program for this user
  await supabase.from('programs').update({ is_active: false }).eq('is_active', true).eq('user_id', userId)

  // Calculate end date
  const totalWeeks = data.cycles.reduce((sum, c) => sum + c.weeks.length, 0)
  const startDate = new Date(data.start_date)
  const endDate = new Date(startDate)
  endDate.setDate(endDate.getDate() + totalWeeks * 7 - 1)

  const { data: program } = await supabase
    .from('programs')
    .insert({
      name: data.name,
      description: data.description,
      start_date: data.start_date,
      end_date: endDate.toISOString().split('T')[0],
      is_active: true,
      user_id: userId,
    })
    .select()
    .single()

  if (!program) throw new Error('Failed to create program')

  let globalWeekIndex = 0

  for (let ci = 0; ci < data.cycles.length; ci++) {
    const cycle = data.cycles[ci]

    const { data: cycleRow } = await supabase
      .from('cycles')
      .insert({
        program_id: program.id,
        name: cycle.name,
        cycle_type: cycle.cycle_type,
        order_index: ci,
        color: cycle.color,
      })
      .select()
      .single()

    if (!cycleRow) continue

    for (const week of cycle.weeks) {
      const weekStart = new Date(startDate)
      weekStart.setDate(weekStart.getDate() + globalWeekIndex * 7)
      const weekEnd = new Date(weekStart)
      weekEnd.setDate(weekEnd.getDate() + 6)

      const { data: weekRow } = await supabase
        .from('weeks')
        .insert({
          cycle_id: cycleRow.id,
          program_id: program.id,
          week_number: week.week_number,
          start_date: weekStart.toISOString().split('T')[0],
          end_date: weekEnd.toISOString().split('T')[0],
        })
        .select()
        .single()

      if (!weekRow) continue

      for (let wi = 0; wi < week.workouts.length; wi++) {
        const workout = week.workouts[wi]

        const { data: workoutRow } = await supabase
          .from('programmed_workouts')
          .insert({
            week_id: weekRow.id,
            name: workout.name,
            workout_type: workout.workout_type,
            muscle_group: workout.muscle_group,
            description: workout.description,
            order_index: wi,
          })
          .select()
          .single()

        if (workoutRow && workout.exercises) {
          await supabase.from('programmed_exercises').insert(
            workout.exercises.map((ex, ei) => ({
              workout_id: workoutRow.id,
              name: ex.name,
              sets: ex.sets,
              reps: ex.reps,
              body_region: ex.body_region,
              superset_group: ex.superset_group ?? null,
              order_index: ei,
            }))
          )
        }
      }

      globalWeekIndex++
    }
  }

  // Auto-insert exercise names into exercise_videos lookup table
  const exerciseNames = new Set<string>()
  for (const cycle of data.cycles) {
    for (const week of cycle.weeks) {
      for (const workout of week.workouts) {
        for (const ex of workout.exercises || []) {
          exerciseNames.add(ex.name)
        }
      }
    }
  }
  if (exerciseNames.size > 0) {
    await supabase
      .from('exercise_videos')
      .upsert(
        Array.from(exerciseNames).map((name) => ({ name })),
        { onConflict: 'name', ignoreDuplicates: true }
      )
  }

  return program
}

export async function deleteWorkoutLog(logId: string) {
  const { error } = await supabase
    .from('workout_logs')
    .delete()
    .eq('id', logId)
  if (error) throw error
}

export function useCustomWorkoutLogs(weekId: string | undefined) {
  const [logs, setLogs] = useState<WorkoutLog[]>([])

  useEffect(() => {
    if (!weekId) return
    supabase
      .from('workout_logs')
      .select('*')
      .eq('week_id', weekId)
      .eq('is_custom', true)
      .then(({ data }) => setLogs(data || []))
  }, [weekId])

  return logs
}
