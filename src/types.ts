export interface Program {
  id: string
  name: string
  description: string | null
  is_active: boolean
  start_date: string
  end_date: string | null
  created_at: string
}

export interface Cycle {
  id: string
  program_id: string
  name: string
  cycle_type: string
  order_index: number
  color: string | null
  created_at: string
}

export interface Week {
  id: string
  cycle_id: string
  program_id: string
  week_number: number
  start_date: string
  end_date: string
  created_at: string
}

export interface ProgrammedWorkout {
  id: string
  week_id: string
  name: string
  workout_type: 'lifting' | 'cardio' | 'yoga' | 'rest' | 'other'
  muscle_group: 'upper' | 'lower' | 'full' | null
  description: string | null
  order_index: number
  created_at: string
}

export interface ProgrammedExercise {
  id: string
  workout_id: string
  name: string
  sets: number
  reps: number
  body_region: 'upper' | 'lower'
  superset_group: string | null
  order_index: number
  created_at: string
}

export interface WorkoutLog {
  id: string
  programmed_workout_id: string | null
  week_id: string | null
  workout_type: string
  name: string
  muscle_group: string | null
  notes: string | null
  completed_at: string
  is_custom: boolean
  created_at: string
}

export interface SetLog {
  id: string
  workout_log_id: string
  exercise_name: string
  set_number: number
  prescribed_reps: number
  actual_reps: number
  weight: number
  created_at: string
}

export interface ExerciseVideo {
  name: string
  video_url: string | null
}

// JSON import types
export interface ProgramImport {
  name: string
  description: string
  start_date: string
  cycles: CycleImport[]
}

export interface CycleImport {
  name: string
  cycle_type: string
  color: string
  weeks: WeekImport[]
}

export interface WeekImport {
  week_number: number
  workouts: WorkoutImport[]
}

export interface WorkoutImport {
  name: string
  workout_type: string
  muscle_group: string | null
  description: string
  exercises?: ExerciseImport[]
}

export interface ExerciseImport {
  name: string
  sets: number
  reps: number
  body_region: 'upper' | 'lower'
  superset_group?: string
}

// Enriched types for UI
export interface WorkoutWithStatus extends ProgrammedWorkout {
  log?: WorkoutLog
  exercises?: ProgrammedExercise[]
}

export interface WeekWithWorkouts extends Week {
  workouts: WorkoutWithStatus[]
  cycle?: Cycle
}
