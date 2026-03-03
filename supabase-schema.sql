-- Training programs
CREATE TABLE programs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  description TEXT,
  is_active BOOLEAN DEFAULT false,
  start_date DATE NOT NULL,
  end_date DATE,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Macro cycles (blocks) within a program
CREATE TABLE cycles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  program_id UUID REFERENCES programs(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  cycle_type TEXT NOT NULL,
  order_index INT NOT NULL,
  color TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Weeks within a cycle
CREATE TABLE weeks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  cycle_id UUID REFERENCES cycles(id) ON DELETE CASCADE,
  program_id UUID REFERENCES programs(id) ON DELETE CASCADE,
  week_number INT NOT NULL,
  start_date DATE NOT NULL,
  end_date DATE NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Programmed workouts (the template)
CREATE TABLE programmed_workouts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  week_id UUID REFERENCES weeks(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  workout_type TEXT NOT NULL,
  muscle_group TEXT,
  description TEXT,
  order_index INT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Exercises within a lifting workout (the template)
CREATE TABLE programmed_exercises (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workout_id UUID REFERENCES programmed_workouts(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  sets INT NOT NULL,
  reps INT NOT NULL,
  body_region TEXT NOT NULL,
  order_index INT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Logged workouts (what was actually done)
CREATE TABLE workout_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  programmed_workout_id UUID REFERENCES programmed_workouts(id),
  week_id UUID REFERENCES weeks(id),
  workout_type TEXT NOT NULL,
  name TEXT NOT NULL,
  muscle_group TEXT,
  notes TEXT,
  completed_at TIMESTAMPTZ NOT NULL,
  is_custom BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Logged sets (individual set data for lifting)
CREATE TABLE set_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workout_log_id UUID REFERENCES workout_logs(id) ON DELETE CASCADE,
  exercise_name TEXT NOT NULL,
  set_number INT NOT NULL,
  prescribed_reps INT NOT NULL,
  actual_reps INT NOT NULL,
  weight DECIMAL NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Add superset grouping to exercises (migration for existing table)
ALTER TABLE programmed_exercises ADD COLUMN IF NOT EXISTS superset_group TEXT;

-- Disable RLS for single-user app (no auth)
ALTER TABLE programs ENABLE ROW LEVEL SECURITY;
ALTER TABLE cycles ENABLE ROW LEVEL SECURITY;
ALTER TABLE weeks ENABLE ROW LEVEL SECURITY;
ALTER TABLE programmed_workouts ENABLE ROW LEVEL SECURITY;
ALTER TABLE programmed_exercises ENABLE ROW LEVEL SECURITY;
ALTER TABLE workout_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE set_logs ENABLE ROW LEVEL SECURITY;

-- Allow all operations (single user, no auth)
CREATE POLICY "Allow all" ON programs FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all" ON cycles FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all" ON weeks FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all" ON programmed_workouts FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all" ON programmed_exercises FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all" ON workout_logs FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all" ON set_logs FOR ALL USING (true) WITH CHECK (true);
