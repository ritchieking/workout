# Workout Flexibility & Last-Session History — Design

Date: 2026-04-27
Status: Draft (approved for implementation planning)

## Goals

Make the workout app less prescriptive, more journal-like:

1. **Substitute an exercise within a programmed slot**, sticky across future weeks (e.g., "I don't have access to a bench, so swap Dumbbell Bench Press → Dumbbell Floor Press for this slot for the rest of the program").
2. **Skip an exercise** in a given session, with that skip remembered next time the slot appears.
3. **Show last session's actual numbers** (weight × reps) instead of an algorithmic suggestion. Pre-fill set inputs with last time's values; user bumps manually.

## Non-Goals

- No algorithmic weight suggestions, deload hints, or bump pills. The user manages progression.
- No reordering of exercises within a workout.
- No editing prescribed sets/reps. Substitutes inherit the slot's prescribed sets/reps.
- No backend server. Stays client-side React + Supabase.

## Data Model Changes

### 1. Stable slot identity on `programmed_exercises`

Add column:

```sql
ALTER TABLE programmed_exercises
  ADD COLUMN IF NOT EXISTS slot_key TEXT;
```

Format: `${workout.name}:${exercise.order_index}` — e.g., `Leg Day A:2`.

- Set in `importProgram` for new imports.
- One-shot migration backfills `slot_key` for existing rows by joining to `programmed_workouts.name` and using `programmed_exercises.order_index`.
- The same `slot_key` value appears on every week's row for that slot in a given program. Identity is scoped per program (paired with `program_id` via the workout→week→program chain).

### 2. New table `exercise_overrides`

```sql
CREATE TABLE exercise_overrides (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  program_id UUID REFERENCES programs(id) ON DELETE CASCADE,
  user_id TEXT NOT NULL,
  slot_key TEXT NOT NULL,
  substitute_name TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE (program_id, slot_key)
);

ALTER TABLE exercise_overrides ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Allow all" ON exercise_overrides FOR ALL USING (true) WITH CHECK (true);
```

One row per overridden slot. `(program_id, slot_key)` is unique — upsert on swap, delete to revert. `user_id` is included for consistency with other user-scoped tables; programs are already per-user, so it's effectively redundant but cheap to carry.

### 3. Skip tracking on `set_logs`

```sql
ALTER TABLE set_logs
  ADD COLUMN IF NOT EXISTS status TEXT NOT NULL DEFAULT 'logged';
-- values: 'logged' | 'skipped'
```

A skip is recorded as a single `set_logs` row per skipped exercise:

- `set_number = 1`
- `prescribed_reps = <slot's prescribed_reps>`
- `actual_reps = 0`
- `weight = 0`
- `status = 'skipped'`

Existing rows default to `'logged'`. The new `useLastSessionData` hook queries set_logs directly, applying a `status='logged'` filter to compute pre-fill values, and a separate "any status, ordered by created_at desc, limit 1" query to determine `wasSkippedLastWeek`.

## UX

### Active Workout exercise card

Each exercise card grows a **`⋯` menu** (top-right of the card). Menu items:

- **Swap exercise…**
- **Skip this exercise**
- **Revert to original** (only shown if this slot has an override)

### Swap flow

Tapping **Swap exercise…** opens a bottom sheet:

- Search field at the top.
- A row labelled **`+ Add new exercise`** (always visible). Tapping it reveals a text input. Submitting:
  - Inserts the new name into `exercise_videos` (so it's available next time).
  - Selects it as the substitute.
- Below: a list of existing names from `exercise_videos`, alpha-sorted, filtered by the search field.

Selecting an exercise:

- Upserts a row into `exercise_overrides` for `(program_id, slot_key)` with `substitute_name = <selected>`.
- Closes the sheet.
- The card immediately re-renders showing the substitute name.
- Prescribed sets/reps remain inherited from the slot.
- Pre-fill values reload using the substitute's history.

### Skip flow

Tapping **Skip this exercise**:

- Marks the slot as skipped in component state.
- Card visually dims and shows a small **`Skipped — undo`** pill for ~5 seconds.
  - Tapping the pill within that window reverts state.
- After the window passes, the skip stands. It persists when the workout is logged via `logWorkoutComplete` (one `set_logs` row with `status='skipped'`).

### Revert flow

Tapping **Revert to original** deletes the `exercise_overrides` row for that slot. Card flips back to the original programmed exercise on next render. Historical `set_logs` under the substitute's name remain intact (they are tied to exercise name, not slot — the sub-exercise's history is preserved if you re-swap to it later).

### Card subtitle when overridden

When an override is active, the card shows the substitute name as the primary, with a tiny secondary line: `swapped from {original_name}`.

### Last-session display

Each card (whether original or substituted) shows below the prescribed line:

- `Last: 35 lb × 8, 8, 7 (Apr 19)` — most recent non-skipped session, formatted as weight × reps-per-set with the date.
- If no history: line hidden.
- If most recent session was a skip: an amber **`Skipped last week`** badge appears above the `Last:` line. The `Last:` line itself reflects the most recent *non-skipped* session.

### Pre-fill in set inputs

For each set in the card:

- Weight input pre-fills with `lastSession.weight`.
- Reps input pre-fills with the corresponding rep from `lastSession.reps[i]`. If the user did fewer sets last time than the slot prescribes, fall back to `prescribed_reps` for the extra sets.
- If no history: inputs are empty.

User edits values manually. No bump pill, no algorithmic suggestion.

## Code Changes

### New hook: `useLastSessionData`

Replaces `useSuggestedWeight`. Returns:

```ts
type LastSessionData = {
  lastSession: { weight: number; reps: number[]; date: string } | null
  wasSkippedLastWeek: boolean
}
```

- `lastSession`: derived from the most recent `set_logs` group (by `workout_log_id`) for this exercise name and user where `status = 'logged'`. `weight` is the max across that session's sets (matches existing logic). `reps` is each set's `actual_reps` in order.
- `wasSkippedLastWeek`: true if the most recent `set_logs` row for this exercise (any status) is `status = 'skipped'`.

`useSuggestedWeight` is removed.

### Update `useCurrentWeek` / workout details

When loading a week's workouts, also fetch `exercise_overrides` for the current `program_id` and apply substitutions in-memory: each `programmed_exercise` whose `slot_key` matches an override gets its `name` replaced (or, alternatively, an `override` field attached so the UI can show "swapped from"). The latter is preferred — preserves original for the subtitle and for revert.

### Update `logWorkoutComplete`

Accept an optional `skipped: { exerciseName: string; prescribedReps: number }[]` parameter. When provided, write one `set_logs` row per skipped exercise with `status='skipped'`, `set_number=1`, `actual_reps=0`, `weight=0`.

### Update `importProgram`

Compute and write `slot_key = ${workout.name}:${ex.order_index}` for each programmed exercise insert.

### One-shot backfill

Migration to populate `slot_key` for existing programs:

```sql
UPDATE programmed_exercises pe
SET slot_key = pw.name || ':' || pe.order_index
FROM programmed_workouts pw
WHERE pe.workout_id = pw.id AND pe.slot_key IS NULL;
```

### Components touched

- `src/pages/ActiveWorkout.tsx` — `⋯` menu, swap sheet, skip + undo, pre-fill, last-session line, skipped-last-week badge.
- `src/pages/ThisWeek.tsx` — show substitute name with subtitle in the day list.
- `src/pages/ProgramOverview.tsx` — display active substitutes, with original visible on tap.
- `src/lib/hooks.ts` — add `useLastSessionData`, `useExerciseOverrides`, `swapSlot`, `revertSlot`, `addCustomExerciseName`; update `useCurrentWeek`, `logWorkoutComplete`, `importProgram`; remove `useSuggestedWeight`.
- `src/types.ts` — add `ExerciseOverride`, extend `SetLog` with `status`, extend `ProgrammedExercise` with `slot_key`.
- `supabase-schema.sql` — schema changes above.

## Edge Cases

- **Swap then skip same session:** valid. Skip records under the substitute's name.
- **Substitute name collides with original:** swapping a slot to its current name is a no-op (UI disables that choice).
- **Revert with logged history under substitute:** allowed. History is exercise-name-keyed, not slot-keyed — it remains queryable if the substitute ever returns.
- **New exercise added via "+ Add new exercise":** name dedup is enforced by `exercise_videos.name` PK; if the user types an existing name, the upsert is a no-op and that exercise is selected.
- **Multiple users on shared programs:** out of scope; each user has their own programs today.

## Testing

Manual UI verification on the active workout screen for: swap, skip + undo, swap-then-revert, no-history exercise, skipped-last-week display. The user runs the dev server locally; no automated test suite exists in the project today.
