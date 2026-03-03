# Project Instructions

## Package Manager

- Always use `rpm` instead of `npm` (it is an alias for npm).
- Always use `rpx` instead of `npx` (it is an alias for npx).

## Project Overview

Personal workout tracking PWA. Single user, no authentication. Users import JSON training programs and log workouts week by week with per-set tracking for lifting.

## Tech Stack

- React (Vite) + TypeScript, configured as a PWA
- Supabase (Postgres + REST API) — client at `src/lib/supabase.ts`
- Tailwind CSS — dark mode only (`bg-slate-950` base)
- Recharts — charts in Trends page
- React Router — bottom tab nav (This Week / Trends / Program) + full-screen Active Workout

## Key Files

- `src/types.ts` — all TypeScript types (DB models + JSON import format)
- `src/lib/hooks.ts` — data hooks (`useActiveProgram`, `useCurrentWeek`, `useWorkoutDetails`, `useSuggestedWeight`) + functions (`logWorkoutComplete`, `importProgram`)
- `src/lib/supabase.ts` — Supabase client init
- `src/components/Layout.tsx` — bottom tab bar shell
- `src/pages/` — ThisWeek, ActiveWorkout, Trends, ProgramOverview
- `supabase-schema.sql` — full DB schema (programs, cycles, weeks, programmed_workouts, programmed_exercises, workout_logs, set_logs)

## Design Principles

- Dark mode only, mobile-first, big tap targets
- Minimal typing — sliders, steppers, tap interactions
- Active workout screen must be fast — no loading spinners mid-set
- Completed workouts sort to bottom, dimmed

## Weight Progression Logic

Located in `useSuggestedWeight` in `src/lib/hooks.ts`:
- All reps hit last session → suggest weight + increment (5 lbs upper / 10 lbs lower)
- Missed reps → suggest same weight
- Missed reps 2+ consecutive sessions → suggest deload (weight - increment)

## DB Tables

`programs` → `cycles` → `weeks` → `programmed_workouts` → `programmed_exercises`
`workout_logs` → `set_logs` (actual logged data)
