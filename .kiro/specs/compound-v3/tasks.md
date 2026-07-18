# Implementation Plan: Compound v3

## Overview

This plan implements the Compound v3 refactor and feature upgrade in incremental steps. It starts by removing unused modules (NL parser, shift engine, Add Log page), then builds the new features: Projects with subtasks, chart-tap inline editing, the overhauled Gym page with split selection/exercise logging, overload charts, and the consistency calendar. Each step builds on the previous to avoid orphaned code.

## Tasks

- [x] 1. Remove unused backend modules and endpoints
  - [x] 1.1 Remove NL parser module and related code
    - Delete `backend/nl_parser.py`
    - Delete `backend/tests/test_nl_parser.py`
    - Remove `NLParseRequest`, `NLParseResponse` models from `backend/models.py`
    - Remove `POST /api/nl/parse` endpoint and all `nl_parser` imports from `backend/main.py`
    - Remove `anthropic` from `backend/requirements.txt`
    - _Requirements: 1.1, 1.2, 1.4, 1.8, 1.9_

  - [x] 1.2 Remove shift engine module and related code
    - Delete `backend/shift_engine.py`
    - Delete `backend/tests/test_shift_engine.py`
    - Remove `ShiftRequest`, `ShiftResponse`, `ScheduleConfigUpdate`, `ScheduleConfigResponse`, `WeekDayResponse` models from `backend/models.py`
    - Remove `POST /api/schedule/shift`, `GET /api/schedule/week`, `PUT /api/schedule/config`, `GET /api/schedule/config` endpoints from `backend/main.py`
    - Remove `get_week_schedule` from `backend/schedule_engine.py` while retaining `SPLIT_CYCLE`, `get_day_type()`, `get_day_index()`
    - _Requirements: 2.1, 2.2, 2.3, 2.4, 2.5, 2.8_

  - [x] 1.3 Remove unused frontend modules
    - Delete `frontend/src/components/NLInputModal.jsx`
    - Delete `frontend/src/pages/AddLog.jsx`
    - Remove `parseNaturalLanguage`, `shiftSchedule`, `getWeekSchedule`, `updateScheduleConfig`, `getScheduleConfig` from `frontend/src/api.js`
    - Remove the "Quick" (💬) button from the navigation bar in `App.jsx`
    - Remove the Add Log route and navigation entry from `App.jsx`
    - Ensure `/log` route renders QAFlow component
    - Remove any dangling imports referencing removed modules
    - _Requirements: 1.3, 1.5, 1.6, 2.6, 3.1, 3.2, 3.3, 3.4_

- [x] 2. Checkpoint — Verify removals
  - Ensure all tests pass, ask the user if questions arise.

- [x] 3. Implement subtasks backend (Projects feature)
  - [x] 3.1 Create subtasks database table and models
    - Add `subtasks` table creation SQL to `backend/database.py` with columns: id, thread_id, parent_subtask_id, description, done, sort_order, created_at
    - Add indexes: `idx_subtasks_thread`, `idx_subtasks_parent`
    - Add Pydantic models: `SubtaskCreate`, `SubtaskUpdate`, `SubtaskResponse`, `SubtaskReorderItem`, `SubtaskReorderRequest` to `backend/models.py`
    - _Requirements: 4.2_

  - [x] 3.2 Implement subtask CRUD endpoints
    - `GET /api/threads/{id}/subtasks` — list all subtasks for a project
    - `POST /api/threads/{id}/subtasks` — create subtask with nesting depth validation (≤ 2), count validation (≤ 50), and description validation (1-300 non-whitespace chars)
    - `PUT /api/subtasks/{subtask_id}` — update description, done, sort_order
    - `DELETE /api/subtasks/{subtask_id}` — cascade delete subtask and all descendants
    - `PUT /api/threads/{id}/subtasks/reorder` — batch update sort_order for subtasks within a parent scope
    - Implement next-sequential sort_order assignment on insert
    - _Requirements: 4.3, 4.4, 4.5, 4.6, 4.7, 4.8, 4.9, 4.14_

  - [x] 3.3 Implement completion percentage utility
    - Create `compute_completion_percentage(subtasks)` function that calculates floor(done_count / total_count * 100), returning 0 when total is 0
    - Expose completion percentage in the GET subtasks response or project detail
    - _Requirements: 4.10, 4.13_

  - [x] 3.4 Write property tests for subtask logic (backend)
    - **Property 2: Subtask nesting depth enforcement**
    - **Property 3: Subtask description validation**
    - **Property 4: Subtask reorder preserves integrity**
    - **Property 5: Subtask insertion assigns next sort_order**
    - **Property 6: Cascade deletion removes all descendants**
    - **Property 7: Completion percentage calculation**
    - **Validates: Requirements 4.3, 4.4, 4.5, 4.6, 4.7, 4.8, 4.10, 4.13**

- [x] 4. Implement Projects frontend (rename Threads + subtasks UI)
  - [x] 4.1 Rename ThreadsBoard to ProjectsBoard
    - Rename `frontend/src/pages/ThreadsBoard.jsx` to `ProjectsBoard.jsx`
    - Replace all "Thread" labels with "Projects" in UI text (headings, buttons, empty states)
    - Update route and navigation references in `App.jsx`
    - _Requirements: 4.1_

  - [x] 4.2 Implement subtask UI in ProjectsBoard
    - Add subtask API functions to `frontend/src/api.js`: `getSubtasks`, `createSubtask`, `updateSubtask`, `deleteSubtask`, `reorderSubtasks`
    - Render subtasks with nesting indicators (indentation for depth)
    - Inline subtask creation input with validation (1-300 chars, non-empty)
    - Checkbox toggle for done/undone state
    - Display progress bar per project card using completion percentage
    - Support drag-to-reorder subtasks within same parent scope
    - Show error messages for max depth (2), max count (50), and invalid description
    - _Requirements: 4.1, 4.3, 4.4, 4.5, 4.6, 4.9, 4.11, 4.12, 4.14_

  - [x] 4.3 Write property test for completion percentage (frontend)
    - **Property 7: Completion percentage calculation**
    - **Validates: Requirements 4.10, 4.13**

- [x] 5. Checkpoint — Verify Projects feature
  - Ensure all tests pass, ask the user if questions arise.

- [x] 6. Implement chart-tap inline logging
  - [x] 6.1 Create InlineInput component
    - Create `frontend/src/components/InlineInput.jsx`
    - Props: date, metric, category, existingValue, position, onSave, onDismiss
    - Numeric validation: reject empty or non-numeric input with error text
    - Save on Enter key press
    - Dismiss on Escape key press or click outside
    - Show error toast on backend save failure, retain entered value for retry
    - _Requirements: 5.1, 5.6, 5.9, 5.10_

  - [x] 6.2 Integrate InlineInput into HabitView chart
    - Add click/tap handler on chart data points in `HabitView.jsx`
    - Show InlineInput positioned adjacent to clicked point
    - On save: call POST/PUT to `/api/logs` (upsert logic — create if no entry exists, update if it does)
    - Refresh chart data after successful save within 1 second without full page reload
    - Support both current day and past days on the chart
    - Works for all habit types (sleep, water, protein) without special-case logic
    - _Requirements: 5.1, 5.2, 5.3, 5.4, 5.5, 5.7, 5.8_

  - [x] 6.3 Write property tests for inline input validation (frontend)
    - **Property 9: Inline input numeric validation**
    - **Validates: Requirements 5.9**

  - [x] 6.4 Write property test for chart-tap upsert semantics (backend)
    - **Property 8: Chart-tap upsert semantics**
    - **Validates: Requirements 5.2, 5.3**

- [x] 7. Implement gym seed data and backend endpoints
  - [x] 7.1 Create exercise seed JSON and gym API endpoints
    - Create `backend/exercise_seed.json` with all split day exercises and swaps per design spec
    - Implement `GET /api/gym/exercises` — return full exercise seed data
    - Implement `GET /api/gym/exercises/{day_type}` — return exercises for a specific split day
    - Implement `GET /api/gym/history/{exercise_name}` — return logged entries for an exercise with range filter (1m, 3m, 6m, ytd)
    - Add `ExerciseDefinition` and `SplitDayExercises` Pydantic models
    - _Requirements: 7.1–7.12_

  - [x] 7.2 Implement exercise validation and notes encoding utilities
    - Create `validate_exercise_entry(name, weight, reps, failure_flag)` function with rules: name 1-50 chars, reps 1-100, weight 0-2000 (or -100 to 2000 for Pull Ups), weight increments of 0.5
    - Create `encode_exercise_notes(reps, failure_flag, dropset_flag)` and `decode_exercise_notes(notes_string)` functions
    - Notes format: `"[flags]|{reps}r"` where flags are optional (e.g., `"failure:true|8r"`, `"dropset:true|6r"`, `"8r"`)
    - _Requirements: 6.7, 6.8, 6.12, 6.15_

  - [x] 7.3 Write property tests for exercise validation and notes encoding (backend)
    - **Property 10: Exercise entry validation**
    - **Property 11: Exercise notes field round-trip**
    - **Validates: Requirements 6.7, 6.8, 6.12, 6.15**

  - [x] 7.4 Write property test for split cycle day type computation (backend)
    - **Property 1: Split cycle day type computation**
    - **Validates: Requirements 2.5**

  - [x] 7.5 Write property test for seed exercise order (frontend)
    - **Property 12: Seed exercises displayed in order with at most one swap**
    - **Validates: Requirements 6.4, 7.11, 7.12**

- [x] 8. Checkpoint — Verify gym backend
  - Ensure all tests pass, ask the user if questions arise.

- [x] 9. Implement GymPage frontend — split selection and exercise logging
  - [x] 9.1 Create GymPage with split selection
    - Create `frontend/src/pages/GymPage.jsx` (replaces `GymView.jsx`)
    - Display split day type selection banner (Push/Pull/Legs/Rest/Upper/Lower)
    - On "Rest" selection: show confirmation that no exercises are required, skip logging
    - On non-Rest selection: fetch and display primary exercises for selected split from `/api/gym/exercises/{day_type}`
    - Update route in `App.jsx` to use new GymPage instead of GymView
    - _Requirements: 6.1, 6.2, 6.3, 6.4_

  - [x] 9.2 Implement SwapPicker component and exercise logging form
    - Create `frontend/src/components/SwapPicker.jsx`
    - Props: slot, primaryExercise, swapHistory, defaultSwap, onSelect
    - Display default swap and previously-used swaps (most recently used first)
    - Allow free-text entry for new swap exercise name
    - Implement exercise logging form per exercise: weight input, reps input, failure/drop-set flag toggle
    - Validate inputs per field (weight range, reps range, name length)
    - Highlight invalid fields with red border and error text
    - Max 20 exercises per session — disable "Add" when reached
    - _Requirements: 6.5, 6.6, 6.7, 6.8, 6.13, 6.14, 6.15_

  - [x] 9.3 Implement Abs Toggle and exercise session persistence
    - After all primary exercises logged: show Abs_Toggle prompt ("Was today an abs day? Y/N")
    - On "Yes": display Cable Crunches (fixed) + second slot swappable between Leg Raises and Side Planks
    - On "No": skip abs section
    - Persist all exercise entries to `/api/logs` with category "gym", metric as exercise name, value as weight, notes with structured flags
    - _Requirements: 6.9, 6.10, 6.11, 6.12_

- [x] 10. Implement overload charts and consistency calendar
  - [x] 10.1 Create OverloadChart component
    - Create `frontend/src/components/OverloadChart.jsx`
    - Props: exerciseName, data, timeRange, onTimeRangeChange
    - Render 120px-height line chart with dual y-axes (weight primary, reps secondary) using Recharts
    - Time range selector buttons: 1m, 3m, 6m, YTD (default 3m)
    - Empty state: "No data for this period" text
    - Integrate into GymPage beneath each exercise section
    - _Requirements: 8.1, 8.2, 8.3, 8.4, 8.5, 8.6_

  - [x] 10.2 Create ConsistencyCalendar component
    - Create `frontend/src/components/ConsistencyCalendar.jsx`
    - Props: month, year, gymDays, onNavigate
    - Render 7-column month grid with day numbers
    - Highlight days that have at least one gym log entry
    - Current day visual indicator
    - Prev/next month navigation (forward up to current month, backward unrestricted)
    - Empty month: grid with no highlights
    - Integrate into GymPage below overload charts
    - _Requirements: 9.1, 9.2, 9.3, 9.4, 9.5, 9.6_

  - [x] 10.3 Write property test for overload chart time range filter (frontend)
    - **Property 13: Overload chart time range filter**
    - **Validates: Requirements 8.5**

  - [x] 10.4 Write property test for consistency calendar highlights (frontend)
    - **Property 14: Consistency calendar highlights match gym log dates**
    - **Validates: Requirements 9.3**

- [x] 11. Integration and wiring
  - [x] 11.1 Wire InlineInput into GymPage overload charts
    - Add chart-tap interaction on OverloadChart data points to open InlineInput for editing gym log values
    - Reuse same InlineInput component with gym-specific metric/category
    - _Requirements: 5.1, 5.2, 5.3_

  - [x] 11.2 Clean up old GymView and verify all routes
    - Delete `frontend/src/pages/GymView.jsx` and `frontend/src/__tests__/gym-view.test.js`
    - Ensure all navigation links point to correct new pages (ProjectsBoard, GymPage)
    - Verify no dangling imports or dead references remain
    - _Requirements: 1.7, 2.7, 3.4_

  - [x] 11.3 Write integration tests
    - Test subtask cascade delete via API → verify DB state
    - Test chart-tap upsert flow: create then update same date/metric → verify single entry
    - Test gym session end-to-end: select split → log exercises → abs toggle → verify all persisted
    - _Requirements: 4.8, 5.2, 5.3, 6.12_

- [x] 12. Final checkpoint — Ensure all tests pass
  - Ensure all tests pass, ask the user if questions arise.

## Notes

- Tasks marked with `*` are optional and can be skipped for faster MVP
- Each task references specific requirements for traceability
- Checkpoints ensure incremental validation
- Property tests validate universal correctness properties from the design document
- Unit tests validate specific examples and edge cases
- The `threads` table is NOT renamed in the database — only UI labels change to "Projects"
- Exercise seed data lives in a static JSON file, not a database table
- The existing `logs` table schema is unchanged; gym flags use structured notes field encoding

## Task Dependency Graph

```json
{
  "waves": [
    { "id": 0, "tasks": ["1.1", "1.2", "1.3"] },
    { "id": 1, "tasks": ["3.1"] },
    { "id": 2, "tasks": ["3.2", "4.1"] },
    { "id": 3, "tasks": ["3.3", "3.4", "4.2"] },
    { "id": 4, "tasks": ["4.3", "6.1", "7.1"] },
    { "id": 5, "tasks": ["6.2", "7.2", "7.4"] },
    { "id": 6, "tasks": ["6.3", "6.4", "7.3", "7.5", "9.1"] },
    { "id": 7, "tasks": ["9.2", "10.1", "10.2"] },
    { "id": 8, "tasks": ["9.3", "10.3", "10.4"] },
    { "id": 9, "tasks": ["11.1", "11.2"] },
    { "id": 10, "tasks": ["11.3"] }
  ]
}
```
