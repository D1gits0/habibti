# Requirements Document

## Introduction

Compound v3 is a focused refactor and feature upgrade for the Compound personal tracking app. It removes unused complexity (NL parser, schedule-shifting, the Add Log form), renames Threads to Projects with nested subtasks, replaces the log form with chart-tap inline editing, and overhauls the Gym page with manual split selection, primary/swap exercise logging, progressive overload graphs, and a consistency calendar. The underlying 7-day split cycle remains as static read-only reference data.

## Glossary

- **App**: The Compound full-stack application (React frontend + FastAPI backend + SQLite database).
- **Project**: A tracked goal or initiative (previously called "Thread" in the UI). Stored in the existing `threads` database table.
- **Subtask**: A discrete action item nested under a Project. Supports one additional nesting level (sub-subtask).
- **Habit_Chart**: A line chart rendered per metric on HabitView or GymView, displaying logged values over time.
- **Log_Entry**: A single row in the `logs` table (columns: id, date, category, metric, value, notes).
- **Split_Cycle**: The static 7-day gym rotation reference: Pull, Push, Legs, Rest, Upper, Rest, Lower.
- **QA_Flow**: The step-by-step daily check-in wizard on the /log route.
- **Completion_Percentage**: The ratio of done subtasks to total subtasks across all nesting levels for a given Project, expressed as a percentage.
- **Inline_Input**: A small input element that appears overlaid on or adjacent to a chart data point to allow value entry for a specific date.
- **Exercise_Entry**: A single exercise logged during a gym session, containing name, weight, reps, and optional failure/drop-set flag.
- **Primary_Exercise**: The default exercise assigned to a given slot within a split day. Persists across sessions as the baseline.
- **Swap_Exercise**: An alternate exercise substituted for a Primary_Exercise for a single session. The Primary_Exercise remains the default for subsequent sessions.
- **Swap_History**: The set of previously-used Swap_Exercises for a given exercise slot, offered in the swap picker for quick re-selection.
- **Split_Day_Type**: One of Pull, Push, Legs, Rest, Upper, or Lower — manually selected by the user at the start of each gym session.
- **Abs_Toggle**: A yes/no prompt after main exercises to indicate whether the user performed an abs routine this session.
- **Overload_Chart**: A per-exercise mini chart showing weight and reps trend over a configurable time range.
- **Consistency_Calendar**: A month-view calendar indicating which days had at least one gym session logged.

## Requirements

### Requirement 1: Remove NL Parser Service and Anthropic Dependency

**User Story:** As a maintainer, I want to remove the unused natural-language parsing feature, so that the codebase has fewer dependencies and less dead code.

#### Acceptance Criteria

1. WHEN the App is deployed, THE App SHALL NOT contain the `nl_parser.py` module in the backend.
2. WHEN the App is deployed, THE App SHALL NOT expose the `/api/nl/parse` endpoint.
3. WHEN the App is deployed, THE App SHALL NOT contain the `NLInputModal` component in the frontend source.
4. WHEN the App is deployed, THE App SHALL NOT include the `anthropic` package in `requirements.txt`.
5. WHEN the App is deployed, THE App SHALL NOT include the `parseNaturalLanguage` function in the frontend API module.
6. WHEN the App is deployed, THE App SHALL NOT render the "Quick" (💬) button in the navigation bar.
7. WHEN the App is built, THE App backend SHALL pass all pytest tests and the frontend SHALL complete its build step without errors, with zero import or reference errors related to removed modules.
8. WHEN the App is deployed, THE App SHALL NOT contain the `test_nl_parser.py` file in the backend test directory.
9. WHEN the App is deployed, THE App SHALL NOT contain the `NLParseRequest` or `NLParseResponse` model definitions in the backend source.

### Requirement 2: Remove Schedule-Shifting Engine

**User Story:** As a maintainer, I want to remove the schedule-shifting and "mark day unavailable" features, so that the codebase is simpler while retaining the static split reference.

#### Acceptance Criteria

1. WHEN the App is deployed, THE App SHALL NOT contain the `shift_engine.py` module in the backend.
2. WHEN the App is deployed, THE App SHALL NOT expose the `POST /api/schedule/shift` endpoint.
3. WHEN the App is deployed, THE App SHALL NOT expose the `GET /api/schedule/week` endpoint.
4. WHEN the App is deployed, THE App SHALL NOT expose the `PUT /api/schedule/config` endpoint.
5. THE App SHALL retain the `SPLIT_CYCLE` constant with value `["Pull", "Push", "Legs", "Rest", "Upper", "Rest", "Lower"]` in `schedule_engine.py` as static read-only data, and the `GET /api/schedule/today` endpoint SHALL continue to return the current day's `day_type` and `day_index` derived from that cycle.
6. WHEN the App is deployed, THE App SHALL NOT contain any frontend component or page that calls `shiftSchedule`, `getWeekSchedule`, or `updateScheduleConfig`, and SHALL NOT render UI for marking days unavailable or viewing a week-preview calendar.
7. WHEN the App is built, THE App SHALL compile and pass all remaining test suites (excluding the removed `test_shift_engine.py`) without errors or failures after removal.
8. WHEN the App is deployed, THE App SHALL NOT contain the `test_shift_engine.py` test file in the backend tests directory.

### Requirement 3: Remove the Add Log Page

**User Story:** As a user, I want the dedicated Add Log form removed, so that logging happens directly through chart interactions instead.

#### Acceptance Criteria

1. WHEN the App is deployed, THE App SHALL NOT contain the `AddLog.jsx` page component.
2. WHEN the App is deployed, THE App SHALL NOT include a navigation entry or route for the Add Log page.
3. WHEN the `/log` route is requested, THE App SHALL render the QA_Flow component (the daily check-in wizard).
4. WHEN the App is built, THE App SHALL compile without any dangling imports or references to the removed `AddLog` component.

### Requirement 4: Rename Threads to Projects with Nested Subtasks

**User Story:** As a user, I want my tracked goals displayed as "Projects" with nested subtasks, so that I can break complex goals into manageable pieces and track progress.

#### Acceptance Criteria

1. THE App SHALL display the label "Projects" in place of "Threads" in all user-facing UI text (page headings, buttons, empty states).
2. THE App SHALL store subtasks in a `subtasks` table with columns: `id` (integer primary key), `thread_id` (foreign key to threads), `parent_subtask_id` (nullable integer foreign key to subtasks, for nesting), `description` (text, not null, maximum 300 characters), `done` (boolean, default false), `sort_order` (integer).
3. THE App SHALL support subtask nesting to a maximum depth of 2 levels (a subtask may have child sub-subtasks, but sub-subtasks SHALL NOT have children).
4. IF a user attempts to create a subtask at depth greater than 2, THEN THE App SHALL reject the request and display an error message indicating that the maximum nesting depth has been reached.
5. IF a user submits a subtask with a description that is empty, whitespace-only, or exceeds 300 characters, THEN THE App SHALL reject the request and display an error message indicating the description length constraint.
6. WHEN a user drags a subtask within the same parent level, THE App SHALL reorder the subtask and persist the new `sort_order` values.
7. WHEN a user adds a subtask, THE App SHALL insert the subtask with the next sequential `sort_order` within its parent scope.
8. WHEN a user removes a subtask that has children, THE App SHALL remove the subtask and all its children.
9. WHEN a user checks or unchecks a subtask, THE App SHALL update the `done` field to the corresponding boolean value.
10. THE App SHALL calculate Completion_Percentage as: (count of subtasks where done = true across all nesting levels) ÷ (total count of subtasks across all nesting levels) × 100, for each Project, rounded down to the nearest integer.
11. THE App SHALL display the Completion_Percentage as a progress bar on each Project card.
12. WHEN a subtask is checked, added, or removed, THE App SHALL recalculate and re-render the Completion_Percentage within 1 second without a full page reload.
13. WHEN a Project has zero subtasks, THE App SHALL display the progress bar at 0%.
14. THE App SHALL allow a maximum of 50 subtasks per Project across all nesting levels.

### Requirement 5: Chart-Based Habit Logging

**User Story:** As a user, I want to tap or click a specific day on a habit chart to log or edit that day's value, so that I can add data inline without navigating to a separate form.

#### Acceptance Criteria

1. WHEN a user clicks or taps a day on a Habit_Chart, THE App SHALL display an Inline_Input positioned adjacent to the selected data point for that day's date.
2. WHEN a user submits a value through the Inline_Input and no Log_Entry exists for that date and metric, THE App SHALL create a new Log_Entry in the `logs` table with the provided value.
3. WHEN a user submits a value through the Inline_Input and a Log_Entry already exists for that date and metric, THE App SHALL update the existing Log_Entry with the new value.
4. THE App SHALL support chart-tap logging for both the current day and past days displayed on the chart.
5. THE App SHALL use the same Inline_Input mechanism for daily habits (sleep, water, protein) and lower-frequency habits without special-case logic per habit type.
6. WHEN a user dismisses the Inline_Input without submitting (by clicking outside or pressing Escape), THE App SHALL discard any unsaved changes and close the input.
7. WHEN a user submits a value, THE App SHALL save directly to the existing `logs` table using the same schema (date, category, metric, value, notes).
8. WHEN a Log_Entry is saved or updated via chart-tap, THE App SHALL refresh the chart to reflect the new data point within 1 second without a full page reload.
9. IF a user submits an empty or non-numeric value through the Inline_Input, THEN THE App SHALL display a validation error and keep the input open for correction.
10. IF the save request to the backend fails, THEN THE App SHALL display an error message to the user and retain the entered value in the Inline_Input for retry.

### Requirement 6: Gym Page Overhaul — Split Selection and Exercise Logging

**User Story:** As a user, I want the gym page to show today's split day (manually selected), present my primary exercises with swap options, and log weight/reps/failure flags, so that I can quickly and accurately record each session.

#### Acceptance Criteria

1. THE App SHALL display a banner at the top of the Gym page showing the currently selected Split_Day_Type for this session.
2. WHEN a user opens the Gym page for a new session, THE App SHALL prompt the user to manually select the Split_Day_Type (Push, Pull, Legs, Rest, Upper, or Lower) without auto-detection or auto-shifting.
3. WHEN the user selects "Rest" as the Split_Day_Type, THE App SHALL skip exercise logging for that session and display a confirmation that no exercises are required.
4. WHEN a non-Rest Split_Day_Type is selected, THE App SHALL display the list of Primary_Exercises defined for that split day.
5. WHEN a user activates the swap control on an exercise slot, THE App SHALL display a swap picker allowing the user to substitute a Swap_Exercise for that session only, without altering the Primary_Exercise assignment for subsequent sessions.
6. WHEN a user opens the swap picker for an exercise slot, THE App SHALL display previously-used Swap_Exercises from Swap_History for that slot, ordered by most recently used first.
7. FOR EACH Exercise_Entry, THE App SHALL capture: exercise name (maximum 50 characters), weight (numeric, range -100 to 2000 in increments of 0.5), reps (integer, range 1 to 100), and a single flag indicating whether the set was a failure set or drop set (boolean, default false).
8. THE App SHALL allow negative weight values only for the Pull Ups exercise, where 0 represents bodyweight and negative values represent assist amounts (e.g., -15 means 15 lb assist), using the same numeric weight field to allow future transition to positive weighted values without a schema change.
9. WHEN the user has logged at least one entry for every Primary_Exercise (or its swapped substitute) in the current split day, THE App SHALL prompt the user with the Abs_Toggle: "Was today an abs day? Y/N".
10. WHEN the user answers "Yes" to the Abs_Toggle, THE App SHALL display Cable Crunches as a fixed exercise and a second slot that is swappable between Leg Raises and Side Planks.
11. WHEN the user answers "No" to the Abs_Toggle, THE App SHALL skip the abs section entirely.
12. THE App SHALL persist all Exercise_Entry data to the `logs` table with category "gym" and include the failure/drop-set flag as a structured prefix in the notes field (e.g., "failure:true" or "dropset:true").
13. THE App SHALL allow logging between 1 and 20 exercises per gym session (including abs if selected).
14. IF the user attempts to add an exercise entry beyond 20 for the current session, THEN THE App SHALL prevent the addition and display an error message indicating the maximum of 20 exercises has been reached.
15. IF the user submits an Exercise_Entry with a weight or reps value outside the permitted range, THEN THE App SHALL reject the entry and display an error message indicating which field is out of range.

### Requirement 7: Split Exercise Seed Data

**User Story:** As a user, I want each split day pre-populated with a defined set of primary exercises and known swaps, so that I can start logging immediately without manual setup.

#### Acceptance Criteria

1. THE App SHALL define the following Primary_Exercises for Push day in this display order: Incline DB Press, Cable Chest Fly, Machine Shoulder Press, Lateral Raises, Overhead Tricep Extension.
2. THE App SHALL define Pec Deck as the default Swap_Exercise for Cable Chest Fly on Push day.
3. THE App SHALL define the following Primary_Exercises for Pull day in this display order: Lat Pulldowns, Close Grip Cable Rows, Reverse Fly, Preacher Curls, Cable Hammer Curls.
4. THE App SHALL define Archer Pull as the default Swap_Exercise for Reverse Fly on Pull day, and DB Hammer Curl as the default Swap_Exercise for Cable Hammer Curls on Pull day.
5. THE App SHALL define the following Primary_Exercises for Legs day in this display order: Bulgarian Split Squat, 45 Degree Back Extension, Leg Extensions, Leg Curls, Calf Raises.
6. THE App SHALL define the following Primary_Exercises for Upper day in this display order: Weighted Dips, Cable Chest Fly, Pull Ups, Wide Grip Cable Rows, Lateral Raises, Incline Curls, Overhead Tricep Extension.
7. THE App SHALL define Pec Deck as the default Swap_Exercise for Cable Chest Fly on Upper day.
8. THE App SHALL define the same Primary_Exercises and display order for Lower day as Legs day with no Swap_Exercises.
9. THE App SHALL define no exercises for Rest day.
10. THE App SHALL store seed data such that additions or modifications to the exercise list do not require a schema migration.
11. WHEN a user views a split day, THE App SHALL present the Primary_Exercises in the defined display order, with each exercise showing at most one associated Swap_Exercise.
12. THE App SHALL allow each Primary_Exercise to have at most one default Swap_Exercise per day_type.

### Requirement 8: Progressive Overload Mini-Graphs

**User Story:** As a user, I want to see a small trend chart for each exercise showing my weight and reps over time, so that I can track progressive overload at a glance.

#### Acceptance Criteria

1. THE App SHALL display an Overload_Chart for each exercise on the Gym page, rendered as a line chart with a maximum height of 120px.
2. WHEN an Overload_Chart is rendered, THE App SHALL plot the weight as the primary y-axis and reps as a secondary y-axis, using data points from the `logs` table for that specific exercise metric.
3. THE App SHALL default the Overload_Chart time range to 3 months on initial load.
4. THE App SHALL provide time range filter options for the Overload_Chart: 1 month, 3 months, 6 months, and Year to Date.
5. WHEN the user selects a time range filter, THE App SHALL re-render the Overload_Chart showing only data within the selected period.
6. WHEN no data exists for an exercise within the selected time range, THE App SHALL display the text "No data for this period" in place of the chart.

### Requirement 9: Gym Consistency Calendar

**User Story:** As a user, I want a month-view calendar showing which days I logged a gym session, so that I can visualize my training consistency.

#### Acceptance Criteria

1. THE App SHALL display a Consistency_Calendar on the Gym page in a month-view grid format showing all days of the displayed month.
2. WHEN the Gym page loads, THE App SHALL display the Consistency_Calendar for the current month with today's date visually indicated.
3. THE App SHALL highlight each day on the Consistency_Calendar that has at least one Log_Entry with category "gym".
4. WHEN the user navigates to the next or previous month, THE App SHALL update the Consistency_Calendar to display the corresponding month's data.
5. THE App SHALL support navigating both forward (up to current month) and backward through calendar history without restriction.
6. WHEN a month has no gym sessions logged, THE App SHALL display the calendar grid with no highlighted days.
