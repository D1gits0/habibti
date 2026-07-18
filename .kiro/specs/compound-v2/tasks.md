# Implementation Plan: Compound v2

## Overview

This plan implements the Compound v2 redesign in four phases: (1) Theme overhaul + Gym page redesign, (2) Q&A flow + split schedule backend, (3) Split-aware logging + dynamic shifting, and (4) Natural-language input mode. Each phase builds incrementally on the previous, with checkpoints to validate before moving forward.

## Tasks

- [x] 1. Theme overhaul and Tailwind configuration
  - [x] 1.1 Update Tailwind config with new theme tokens
    - Remove `gym-red`, `gym-orange`, `academic-blue`, `habit-green`, `quest-purple`, `quest-gold` color tokens
    - Add `accent: '#FF4F00'` as the single highlight color
    - Add `text-primary: '#e5e7eb'`, `text-secondary: '#6b7280'`, `text-muted: '#9ca3af'` tokens
    - Keep `charcoal`, `charcoal-light`, `charcoal-lighter` unchanged
    - Ensure `font-body` (JetBrains Mono) is the default body font
    - Remove `font-pixel` from body text usage (keep font definition for optional use)
    - _Requirements: 2.1, 2.2, 2.3, 2.5, 2.6_

  - [x] 1.2 Update global CSS and index.html for JetBrains Mono
    - Add Google Fonts link for JetBrains Mono in `index.html`
    - Update `index.css` to apply `font-body` as the default font family on body
    - Remove any `panel-glow-*` CSS classes or box-shadow effects at rest state
    - _Requirements: 2.3, 2.2_

  - [x] 1.3 Update App.jsx navigation to use new theme
    - Replace `text-quest-purple` active state with `text-accent` (or appropriate accent usage per requirement — accent is for meaningful moments only, use lighter gray for active nav)
    - Replace all old color references in navigation with muted gray tokens
    - Update font usage from `font-pixel` to `font-body` for nav labels
    - Ensure hover/focus states use `charcoal-lighter` only
    - _Requirements: 2.4, 2.5, 2.6, 2.7, 2.8_

  - [x] 1.4 Update HabitView page to use new theme tokens
    - Replace any old color references with new muted gray palette
    - Apply `font-body` typography
    - Ensure no bright colors at rest state
    - _Requirements: 2.5, 2.6, 2.7_

  - [x] 1.5 Update ThreadsBoard page to use new theme tokens
    - Replace `quest-purple`, `quest-gold` and other old color references
    - Apply muted gray palette for all non-highlighted elements
    - _Requirements: 2.5, 2.6, 2.7_

- [x] 2. Gym page redesign
  - [x] 2.1 Redesign GymView with chart-above-table layout
    - Implement metric selector dropdown for filtering chart
    - Render Recharts line chart above the table with 24px vertical gap
    - Display up to 20 most recent gym log entries in the table below
    - Add section headings for chart and table regions
    - Apply new theme: charcoal background, muted panels, charcoal-lighter borders
    - _Requirements: 3.1, 3.2, 3.5, 3.6, 3.3_

  - [x] 2.2 Implement personal record highlighting in GymView
    - Compute PR (max value) per metric client-side
    - Highlight PR values in chart dots and table text using Accent_Color (#FF4F00)
    - Render non-record values in default muted text color
    - _Requirements: 3.4, 3.3_

  - [x] 2.3 Implement empty states for GymView
    - Show empty-state message when no gym log entries exist (replaces both chart and table)
    - Show empty-state message in chart section when selected metric has no entries (table still shows)
    - _Requirements: 3.7, 3.8_

  - [x] 2.4 Write property tests for GymView logic (frontend)
    - **Property 3: Gym Table Displays At Most 20 Entries Sorted by Date**
    - **Property 4: Personal Record Equals Maximum Value Per Metric**
    - **Property 5: Chart Filter Shows Only Selected Metric**
    - **Validates: Requirements 3.2, 3.4, 3.6**

- [x] 3. Checkpoint - Phase 1 complete
  - Ensure all tests pass, ask the user if questions arise.

- [x] 4. Split schedule backend
  - [x] 4.1 Add new database tables for split schedule
    - Add `split_schedule` and `schedule_state` tables to `init_db()` in `database.py`
    - Include `CREATE TABLE IF NOT EXISTS` with proper constraints
    - Seed `split_schedule` with the fixed 7-day cycle if empty
    - Ensure `schedule_state` single-row pattern (INSERT OR IGNORE id=1)
    - _Requirements: 4.1, 4.2, 4.8_

  - [x] 4.2 Create schedule engine module
    - Create `backend/schedule_engine.py` with pure-logic functions
    - Implement `get_day_type(cycle_start_date, query_date)` using modulo arithmetic
    - Implement `get_day_index(cycle_start_date, query_date)`
    - Implement `get_week_schedule(cycle_start_date, start_date)` returning next 7 days
    - _Requirements: 4.3_

  - [x] 4.3 Create shift engine module
    - Create `backend/shift_engine.py` with pure-logic functions
    - Implement `compute_shift(cycle_start_date, unavailable_date, split_cycle)` algorithm
    - Implement `validate_shift_request(unavailable_date, today)` validation
    - Handle cases: no rest in range, one rest absorbed, multiple rests (only first absorbed)
    - _Requirements: 6.1, 6.2, 6.3, 6.4, 6.8_

  - [x] 4.4 Add Pydantic models for schedule and shift
    - Add `ScheduleConfigUpdate`, `ScheduleConfigResponse`, `ScheduleTodayResponse` to `models.py`
    - Add `WeekDayResponse`, `ShiftRequest`, `ShiftResponse` to `models.py`
    - Add `GymExerciseInput` model with validation constraints
    - _Requirements: 4.5, 6.7_

  - [x] 4.5 Add schedule and shift API endpoints to main.py
    - Implement `GET /api/schedule/today` returning day type or configured=false
    - Implement `GET /api/schedule/week` returning next 7 days
    - Implement `GET /api/schedule/config` returning current configuration
    - Implement `PUT /api/schedule/config` with date validation (±30 days)
    - Implement `POST /api/schedule/shift` with future-date validation and shift execution
    - _Requirements: 4.3, 4.4, 4.5, 4.6, 4.7, 6.1, 6.5, 6.7_

  - [x] 4.6 Write property tests for schedule engine
    - **Property 6: Day_Type Computation via Modulo Arithmetic**
    - **Validates: Requirements 4.3**

  - [x] 4.7 Write property tests for shift engine
    - **Property 8: Schedule Shift Algorithm Correctness**
    - **Validates: Requirements 6.1, 6.2, 6.3, 6.4, 6.8**

  - [x] 4.8 Write property test for date validation
    - **Property 7: Cycle Start Date Validation Window**
    - **Validates: Requirements 4.5, 4.7**

- [x] 5. Checkpoint - Phase 2 backend complete
  - Ensure all tests pass, ask the user if questions arise.

- [x] 6. Q&A Flow frontend
  - [x] 6.1 Create QAFlow page with step state machine
    - Create `frontend/src/pages/QAFlow.jsx`
    - Implement step state machine with steps: sleep_quality, water_oz, protein_g, gym_attendance, gym_exercises, review
    - Store answers in component state (Record<string, any>)
    - Display one question per screen on mobile (below 768px)
    - _Requirements: 1.1, 1.4_

  - [x] 6.2 Implement QAFlow navigation and auto-advance
    - Implement auto-advance after 300ms on numeric input confirmation
    - Implement back button preserving all previously entered values
    - Implement skip button setting answer to null and advancing
    - _Requirements: 1.3, 1.5, 1.6_

  - [x] 6.3 Implement gym exercise sub-form in QAFlow
    - Implement repeatable exercise entry (name, weight, reps, sets) on gym_attendance=Yes
    - Allow up to 20 exercises per session
    - Validate constraints: name max 50 chars, weight 0-2000, reps 1-100, sets 1-50
    - _Requirements: 1.2_

  - [x] 6.4 Implement QAFlow review and submission
    - Map answers to Log_Entry records per the category mapping rules
    - POST entries via `createLog()` API
    - Handle partial failures: display which entries failed, preserve all answers for retry
    - _Requirements: 1.7, 1.8_

  - [x] 6.5 Add API client functions for schedule endpoints
    - Add `getTodaySchedule`, `getWeekSchedule`, `getScheduleConfig`, `updateScheduleConfig`, `shiftSchedule` to `api.js`
    - _Requirements: 4.3, 4.4, 6.5_

  - [x] 6.6 Update App.jsx routing for QAFlow and Settings
    - Replace `/log` route to render QAFlow instead of AddLog
    - Add `/settings` route for the Settings page
    - Add Settings to navigation items
    - _Requirements: 1.1, 4.4_

  - [x] 6.7 Write property tests for QAFlow logic (frontend)
    - **Property 1: Back Navigation Preserves State**
    - **Property 2: QA Answer to Log_Entry Mapping**
    - **Validates: Requirements 1.5, 1.7**

- [x] 7. Settings page
  - [x] 7.1 Create Settings page component
    - Create `frontend/src/pages/Settings.jsx`
    - Display all 7 days of split cycle (day_index and Day_Type)
    - Display currently configured cycle_start_date
    - Implement date input for setting/updating cycle_start_date
    - Show week preview of next 7 days after configuration
    - Validate date range (±30 days from today) client-side
    - Display error messages for invalid dates
    - _Requirements: 4.4, 4.5, 4.6, 4.7_

  - [x] 7.2 Implement shift operation UI in Settings
    - Add date picker for marking a day unavailable
    - Call shift endpoint and display updated week schedule
    - Show which rest day was absorbed (if any)
    - Display error for today/past date selections
    - _Requirements: 6.1, 6.5, 6.6, 6.7_

- [x] 8. Checkpoint - Phase 2 frontend complete
  - Ensure all tests pass, ask the user if questions arise.

- [x] 9. Split-aware logging
  - [x] 9.1 Integrate split awareness into QAFlow gym step
    - Fetch today's Day_Type from schedule API when user reaches gym question
    - Display expected Day_Type label with confirm/override options
    - If Rest day, offer option to log exercises with alternative Day_Type selection
    - If schedule not configured, skip suggestion and go straight to exercise logging
    - _Requirements: 5.1, 5.2, 5.6_

  - [x] 9.2 Implement mismatch notes and Abs add-on logic
    - When exercises don't match expected Day_Type, add override note to Log_Entry notes field
    - Allow Abs exercises as add-on to any day without triggering mismatch note
    - When user confirms suggested Day_Type, store entries without mismatch note
    - Ensure no cardio options appear in exercise selection
    - _Requirements: 5.3, 5.4, 5.5, 5.7_

  - [x] 9.3 Write property test for override mismatch note
    - **Property 9: Override Mismatch Note**
    - **Validates: Requirements 5.3**

- [x] 10. Checkpoint - Phase 3 complete
  - Ensure all tests pass, ask the user if questions arise.

- [x] 11. Natural-language input mode
  - [x] 11.1 Create NL parser backend service
    - Create `backend/nl_parser.py` with `NLParserService` class
    - Implement `parse_input(text, today)` method calling Claude API
    - Implement `build_prompt(text, today)` with schema instructions
    - Handle timeout (30s) and parse failure error cases
    - Add `anthropic` to `requirements.txt`
    - _Requirements: 7.1, 7.2, 7.4, 7.5_

  - [x] 11.2 Add NL parse API endpoint and Pydantic models
    - Add `NLParseRequest` (text max 2000 chars) and `NLParseResponse` models
    - Implement `POST /api/nl/parse` endpoint
    - Return structured entries for confirmation
    - Handle timeout (504) and parse failure (422) error responses
    - _Requirements: 7.1, 7.2, 7.4, 7.5, 7.6_

  - [x] 11.3 Create NL input modal frontend component
    - Create `frontend/src/components/NLInputModal.jsx`
    - Implement free-text input field (max 2000 chars)
    - Display parsed entry preview for user confirmation
    - On confirm, write entries to logs table via existing `createLog()` API
    - Handle and display timeout/parse errors, preserve input text for retry
    - Default date to today when no date mentioned in input
    - Filter out excluded categories (cardio, schoolwork, Canvas, SMS) in display
    - Add `parseNaturalLanguage` function to `api.js`
    - _Requirements: 7.1, 7.2, 7.3, 7.4, 7.5, 7.6, 7.8, 9.6_

  - [x] 11.4 Wire NL input mode into App navigation
    - Add trigger button/route for NL input modal accessible from main navigation
    - Ensure NL input writes to same `logs` table as QA flow
    - _Requirements: 7.3, 7.6_

  - [x] 11.5 Write property tests for NL parser logic
    - **Property 10: NL Parser Date Defaulting**
    - **Property 11: NL Parser Excluded Category Filtering**
    - **Validates: Requirements 7.8, 9.6**

- [x] 12. Final checkpoint
  - Ensure all tests pass, ask the user if questions arise.

## Notes

- Tasks marked with `*` are optional and can be skipped for faster MVP
- Each task references specific requirements for traceability
- Checkpoints ensure incremental validation per implementation phase
- Property tests validate universal correctness properties from the design
- Unit tests validate specific examples and edge cases
- The project uses Hypothesis (Python) for backend property tests and fast-check (JavaScript) for frontend property tests
- Version control follows Requirement 8: commit per logical unit on `compound-v2/` branch with `phase-N: <summary>` format

## Task Dependency Graph

```json
{
  "waves": [
    { "id": 0, "tasks": ["1.1", "1.2", "4.1"] },
    { "id": 1, "tasks": ["1.3", "1.4", "1.5", "4.2", "4.3", "4.4"] },
    { "id": 2, "tasks": ["2.1", "4.5", "6.5"] },
    { "id": 3, "tasks": ["2.2", "2.3", "4.6", "4.7", "4.8", "6.1"] },
    { "id": 4, "tasks": ["2.4", "6.2", "6.3", "6.6"] },
    { "id": 5, "tasks": ["6.4", "7.1"] },
    { "id": 6, "tasks": ["6.7", "7.2"] },
    { "id": 7, "tasks": ["9.1"] },
    { "id": 8, "tasks": ["9.2"] },
    { "id": 9, "tasks": ["9.3", "11.1"] },
    { "id": 10, "tasks": ["11.2"] },
    { "id": 11, "tasks": ["11.3"] },
    { "id": 12, "tasks": ["11.4"] },
    { "id": 13, "tasks": ["11.5"] }
  ]
}
```
