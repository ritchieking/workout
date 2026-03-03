# Workout App — Build Spec

## Overview

A personal workout tracking PWA for a single user. The app is built around pre-planned training programs (imported as JSON), displayed as weekly workout menus, and logged with detailed per-set tracking for lifting and simple completion marking for other activity types. It includes a trends explorer for analyzing training data and a program overview for visualizing macro/mini cycle structure.

**Single user, no authentication.**

---

## Tech Stack

- **Frontend:** React (Vite) configured as a PWA (service worker + manifest)
- **Backend/Database:** Supabase (Postgres + REST API)
- **Styling:** Tailwind CSS, dark mode only
- **Charts:** Recharts (for volume line charts and calendar heatmap)
- **Hosting:** TBD (Vercel, Netlify, or similar — should be easy to deploy)

---

## Design Principles

- **Dark mode only.** Modern, clean, minimal UI.
- **Mobile-first.** The primary use case is logging workouts on an iPhone at the gym.
- **Big tap targets.** Buttons, sliders, and interactive elements should be large and easy to hit.
- **Minimal typing.** Use sliders, steppers, and tap interactions wherever possible.
- **Fast.** The active workout screen needs to be snappy — no loading spinners mid-set.

---

## Pages

### 1. This Week

The home screen. Shows the current week's workouts.

**Layout:**

- Header showing the current week (e.g., "Week 3 of 12 — Hypertrophy Block A")
- A list of the 7 programmed workouts for this week, each displayed as a card
- Each card shows:
  - Workout name (e.g., "Upper Body A", "Zone 2 Cardio", "Rest Day")
  - Workout type badge (Lifting, Cardio, Yoga, Rest, etc.)
  - Brief summary (e.g., "Bench, Rows, OHP — 5 exercises" or "45 min easy effort")
  - Status: Not started / Completed
- Completed workouts get a prominent checkmark and move to the bottom of the list, visually dimmed
- An **"Add Custom Workout"** button at the bottom that opens a form with:
  - Name (text input)
  - Type (dropdown: Lifting, Cardio, Yoga, Class, Other)
  - Notes (free text field)
  - The custom workout appears in the weekly list and can be marked complete

**Sequencing Warning:**

- If the user taps a workout that conflicts with what they did yesterday (e.g., two heavy upper-body days back to back), show a soft warning banner: "Heads up — you did Upper Body A yesterday. Consider picking a different workout today."
- The warning is dismissible — the user can proceed anyway.
- Conflict logic: workouts in the JSON can have a `muscleGroup` tag (e.g., "upper", "lower", "full"). Warn if the same muscle group was logged on the previous day.

**Week Boundaries:**

- Weeks start on Monday.
- If a week ends with incomplete workouts, they do NOT roll over. The next week's workouts simply populate on Monday.
- The app should still record which workouts were not completed (for trends/analytics).

**Tapping a Workout → Active Workout Screen (see below)**

---

### 2. Active Workout Screen

Opened when the user taps a workout from the This Week page. This is the core logging interface.

**For Lifting Workouts:**

- Show the workout name at the top
- List of exercises in order, each showing:
  - Exercise name
  - Prescribed sets × reps (e.g., "4 × 10")
  - **Last weight:** the weight used last time this exercise was logged (if available), shown prominently
  - **Suggested weight:** a recommended weight based on the rep-aware progression formula (see below)
- Tapping an exercise expands it to show individual set logging:
  - Each set is a row
  - **Weight input:** a horizontal slider that snaps to 5 lb increments, with the current value displayed large and bold above the slider. **+5 / -5 buttons** on either side for fine-tuning. The slider should initialize to the suggested weight (or last weight if no suggestion is available).
  - **Reps input:** a simple stepper (- / number / +) defaulting to the prescribed rep count
  - A **checkmark button** to confirm the set is logged
  - After logging a set, it collapses/dims and the next set becomes active
- After all sets of all exercises are logged, a **"Complete Workout"** button appears prominently
- There should also be an option to mark the workout complete even if not all sets are logged (e.g., "Finish Early")

**For Non-Lifting Workouts (Cardio, Yoga, Rest, Custom):**

- Show the workout name, type, and any description/notes from the program
- A single large **"Mark Complete"** button
- For custom workouts, also show the free-text notes the user entered

**Rep-Aware Weight Progression Formula:**

The goal is to suggest smart weight increases based on past performance.

Logic for a given exercise:

1. Look at the last session where this exercise was performed
2. If the user **completed all prescribed reps on all sets** at weight X:
   - Suggest X + increment
   - Increment = **5 lbs** for upper body exercises, **10 lbs** for lower body exercises
   - Upper/lower classification comes from the exercise metadata in the JSON
3. If the user **missed reps on any set** (logged fewer reps than prescribed):
   - Suggest the same weight X (try again)
4. If the user **missed reps on the same weight for 2+ consecutive sessions**:
   - Suggest X - increment (deload)
5. If no history exists, show no suggestion — the user sets their own starting weight

Display the suggestion as: "Suggested: 190 lbs (+5)" with the logic briefly noted (e.g., "Hit all reps last time").

---

### 3. Trends Explorer

Analytics and historical data visualization.

**Volume Line Charts:**

- A dropdown/search to select an individual exercise (e.g., "Bench Press")
- A line chart showing **total volume per session** (weight × reps × sets) over time on the x-axis
- Time range selector (last 4 weeks, 8 weeks, 12 weeks, all time)
- Data points should be tappable to show details (date, weight, sets × reps)

**Calendar Heatmap:**

- A GitHub-style contribution heatmap showing workout activity
- Each day is a cell, color-coded by workout type:
  - Lifting = one color (e.g., blue)
  - Cardio = another (e.g., green)
  - Yoga/Class = another (e.g., purple)
  - Rest = neutral/dim
  - No workout = empty/dark
  - Custom = another (e.g., orange)
- Scrollable/pannable to view past months
- Tapping a day shows what workout was done (or "Missed" if nothing was logged for a programmed week)

---

### 4. Program Overview

A bird's-eye view of the training program structure.

**Calendar Grid:**

- A month-view calendar grid showing the full program timeline
- Color-coded by cycle phase:
  - Each macro cycle / mini cycle / block gets a distinct color
  - e.g., "Hypertrophy Block 1" in blue, "Strength Block" in orange, "Deload" in green
- Shows the current date with a clear "you are here" indicator
- Scrollable forward and backward through the full program timeline

**Current Position Indicator:**

- A prominent card/banner at the top: "Week 3 of 6 — Hypertrophy Block 2"
- Shows the start and end date of the current block
- Shows what's coming next: "Next: Strength Block (starts Jan 15)"

**Past Programs:**

- A section below the calendar (or accessible via a tab) showing archived programs
- Each past program shows: name, date range, summary stats (total workouts completed, completion rate)
- Tapping a past program shows its calendar grid and allows browsing its weeks

**Program Import:**

- A button to "Import Program" — opens a screen where the user can:
  - Upload a JSON file, or
  - Paste JSON into a text area
- On import, the app validates the JSON structure and shows a preview (program name, duration, number of weeks, block structure)
- User confirms, and the new program becomes the active program
- The previous active program is automatically archived

---

## Data Model

### Supabase Tables

```sql
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
  name TEXT NOT NULL,               -- e.g., "Hypertrophy Block 1"
  cycle_type TEXT NOT NULL,         -- e.g., "hypertrophy", "strength", "deload"
  order_index INT NOT NULL,         -- ordering within the program
  color TEXT,                       -- hex color for calendar display
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Weeks within a cycle
CREATE TABLE weeks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  cycle_id UUID REFERENCES cycles(id) ON DELETE CASCADE,
  program_id UUID REFERENCES programs(id) ON DELETE CASCADE,
  week_number INT NOT NULL,         -- week number within the program (1-indexed)
  start_date DATE NOT NULL,
  end_date DATE NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Programmed workouts (the template — what should be done)
CREATE TABLE programmed_workouts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  week_id UUID REFERENCES weeks(id) ON DELETE CASCADE,
  name TEXT NOT NULL,               -- e.g., "Upper Body A"
  workout_type TEXT NOT NULL,       -- "lifting", "cardio", "yoga", "rest", "other"
  muscle_group TEXT,                -- "upper", "lower", "full", null for non-lifting
  description TEXT,                 -- brief summary or instructions
  order_index INT NOT NULL,         -- ordering within the week (for display, not scheduling)
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Exercises within a lifting workout (the template)
CREATE TABLE programmed_exercises (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workout_id UUID REFERENCES programmed_workouts(id) ON DELETE CASCADE,
  name TEXT NOT NULL,               -- e.g., "Bench Press"
  sets INT NOT NULL,
  reps INT NOT NULL,
  body_region TEXT NOT NULL,        -- "upper" or "lower" (for progression increment logic)
  superset_group TEXT,              -- e.g., "A", "B", "C" — exercises with the same group are supersetted together. NULL = straight set.
  order_index INT NOT NULL,         -- ordering within the workout (and within a superset group)
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Logged workouts (what was actually done)
CREATE TABLE workout_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  programmed_workout_id UUID REFERENCES programmed_workouts(id),  -- null for custom workouts
  week_id UUID REFERENCES weeks(id),                              -- null for custom workouts
  workout_type TEXT NOT NULL,
  name TEXT NOT NULL,
  muscle_group TEXT,
  notes TEXT,                       -- for custom workouts
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
  weight DECIMAL NOT NULL,          -- in lbs
  created_at TIMESTAMPTZ DEFAULT now()
);
```

---

## JSON Import Format

The program JSON that gets imported should follow this structure:

```json
{
  "name": "12-Week Hypertrophy + Strength Block",
  "description": "Upper/lower split with progressive overload",
  "start_date": "2025-01-06",
  "cycles": [
    {
      "name": "Hypertrophy Block 1",
      "cycle_type": "hypertrophy",
      "color": "#3B82F6",
      "weeks": [
        {
          "week_number": 1,
          "workouts": [
            {
              "name": "Upper Body A",
              "workout_type": "lifting",
              "muscle_group": "upper",
              "description": "Horizontal push/pull focus",
              "exercises": [
                {
                  "name": "Bench Press",
                  "sets": 4,
                  "reps": 10,
                  "body_region": "upper",
                  "superset_group": "A"
                },
                {
                  "name": "Barbell Row",
                  "sets": 4,
                  "reps": 10,
                  "body_region": "upper",
                  "superset_group": "A"
                }
              ]
            },
            {
              "name": "Lower Body A",
              "workout_type": "lifting",
              "muscle_group": "lower",
              "description": "Squat focus",
              "exercises": [
                {
                  "name": "Back Squat",
                  "sets": 4,
                  "reps": 8,
                  "body_region": "lower"
                }
              ]
            },
            {
              "name": "Zone 2 Cardio",
              "workout_type": "cardio",
              "muscle_group": null,
              "description": "45 min easy effort — keep heart rate 120-140 bpm"
            },
            {
              "name": "Upper Body B",
              "workout_type": "lifting",
              "muscle_group": "upper",
              "description": "Vertical push/pull focus",
              "exercises": [
                {
                  "name": "Overhead Press",
                  "sets": 4,
                  "reps": 10,
                  "body_region": "upper"
                }
              ]
            },
            {
              "name": "Lower Body B",
              "workout_type": "lifting",
              "muscle_group": "lower",
              "description": "Deadlift focus",
              "exercises": [
                {
                  "name": "Romanian Deadlift",
                  "sets": 4,
                  "reps": 10,
                  "body_region": "lower"
                }
              ]
            },
            {
              "name": "Yoga / Mobility",
              "workout_type": "yoga",
              "muscle_group": null,
              "description": "Attend a class or do 30 min follow-along"
            },
            {
              "name": "Rest Day",
              "workout_type": "rest",
              "muscle_group": null,
              "description": "Full rest — walk if you feel like it"
            }
          ]
        }
      ]
    }
  ]
}
```

**On import, the app should:**

1. Validate the JSON structure
2. Calculate `start_date` and `end_date` for each week based on the program start date and week numbers (each week = 7 days starting Monday)
3. Calculate the program `end_date`
4. Show a preview: program name, total weeks, block breakdown
5. On confirmation: archive the current active program, insert all data, set the new program as active

---

## Navigation

- Bottom tab bar with three tabs: **This Week**, **Trends**, **Program**
- Standard mobile navigation pattern
- The Active Workout Screen is a full-screen overlay / pushed route (no tab bar visible — keep the user focused)

---

## Offline Considerations

Since this is a PWA used at the gym (where connectivity may be spotty):

- The active workout screen should work offline — cache the current week's data and queue set logs for sync when connectivity returns
- Use Supabase's real-time or a simple retry queue for offline-logged data
- Service worker should cache the app shell and current week data

---

## Future Considerations (Not in V1)

These are explicitly out of scope for the initial build but noted for later:

- Rest timer between sets
- Notes per exercise
- RPE / tempo tracking
- Authentication (if ever shared or multi-device security is needed)
- Push notifications (reminders to work out)
- Bodyweight / measurement tracking
- Estimated 1RM calculations
- Light mode / theme toggle
- Data export (CSV/JSON)