# Requirements Document

## Introduction

Compound v2 is a multi-phase redesign of an existing personal habit and gym tracking application. The redesign replaces the current manual log form with a guided Q&A flow, applies a new minimal dark aesthetic inspired by Monkeytype, restructures the Gym page layout, introduces split-aware scheduling for gym workouts, adds dynamic schedule shifting for unavailable days, and optionally layers a natural-language input mode on top of existing data structures. The backend is Python/FastAPI with SQLite; the frontend is React/Vite/Tailwind.

## Glossary

- **QA_Flow**: The sequential question-and-answer logging interface that replaces the existing AddLog form, presenting one question per screen with auto-advance behavior.
- **Log_Entry**: A single row in the `logs` table consisting of date, category, metric, value, and notes fields.
- **Split_Schedule**: A data table defining a fixed 7-day repeating gym cycle (Pull, Push, Legs, Rest, Upper, Rest, Lower) by day index and day type.
- **Schedule_State**: A persistence mechanism mapping the repeating split cycle to real calendar dates to determine the current position in the cycle.
- **Day_Type**: One of the seven values in the split cycle: Pull, Push, Legs, Rest, Upper, Lower, or an add-on type (Abs).
- **Accent_Color**: International Orange (#FF4F00), reserved exclusively for moments of significance such as XP bar fills, streak milestones, or new personal records.
- **Theme**: The visual design system using a dark charcoal background, muted gray panels, monospace typography (JetBrains Mono), and the single Accent_Color.
- **Shift_Operation**: The process of pushing all subsequent scheduled days forward by one when the user marks a future day as unavailable, absorbing rest days that fall within the shifted range.
- **NL_Parser**: A natural-language parsing layer using Claude API that converts free-text input into structured Log_Entry or schedule update operations.

## Requirements

### Requirement 1: Guided Q&A Flow Structure

**User Story:** As a user, I want to log my daily habits through a sequential question flow, so that I can quickly capture sleep, hydration, protein, and gym data without navigating a complex form.

#### Acceptance Criteria

1. WHEN the user navigates to the Log page, THE QA_Flow SHALL present questions in the fixed sequence: sleep quality (integer 1-10), water intake (integer 0-300 oz), protein intake (integer 0-1000 g), gym attendance (Y/N).
2. WHEN the user answers the gym attendance question with "Yes", THE QA_Flow SHALL present a repeatable sub-form collecting exercise name (text, max 50 characters), weight (numeric, 0-2000 lbs), reps (integer, 1-100), and sets (integer, 1-50) for each exercise, up to a maximum of 20 exercises.
3. WHEN the user submits a numeric answer by confirming the input (e.g., tapping a next/confirm control or selecting a predefined option), THE QA_Flow SHALL auto-advance to the next question within 300ms.
4. THE QA_Flow SHALL display one question per screen on mobile viewports (below 768px width).
5. THE QA_Flow SHALL provide a back button allowing navigation to any previously answered or skipped question, preserving previously entered values.
6. THE QA_Flow SHALL provide a skip button allowing the user to bypass any individual question without providing an answer.
7. WHEN the user completes or skips all questions, THE QA_Flow SHALL write each answered habit question as a separate Log_Entry to the `logs` table with category mapped as follows: sleep quality → category: "sleep", metric: "sleep_quality"; water intake → category: "hydration", metric: "oz_water"; protein intake → category: "habit", metric: "protein_g"; each gym exercise → category: "gym", metric: exercise name, value: weight, notes: "{reps}r x {sets}s".
8. IF the save operation fails for any Log_Entry, THEN THE QA_Flow SHALL display an error message indicating which entries failed to save and SHALL preserve all entered answers so the user can retry submission without re-entering data.

### Requirement 2: Theme and Visual Design System

**User Story:** As a user, I want a minimal dark aesthetic with restrained use of color, so that the interface feels calm and focused with highlights only on meaningful moments.

#### Acceptance Criteria

1. THE Theme SHALL use a dark charcoal/graphite background color (not pure black) as the base surface color token (charcoal: #1a1a1f).
2. THE Theme SHALL render all panels with muted gray tones (charcoal-light: #242430, charcoal-lighter: #2e2e3a), 1px solid borders using charcoal-lighter, and no box-shadow glow or bevel effects at rest state.
3. THE Theme SHALL use JetBrains Mono as the sole typeface for all headers, body text, and UI labels; no other font families SHALL appear except for icon fonts.
4. THE Theme SHALL restrict use of Accent_Color (#FF4F00) exclusively to: XP bar fills on new log entries, streak milestone indicators, new personal record values on lifts, and daily goal completion indicators.
5. THE Theme SHALL NOT use green (#22c55e or similar) or purple (#a855f7 or similar) as primary or secondary UI colors in any component; existing usages of these colors SHALL be removed or replaced.
6. THE Theme SHALL render all non-highlighted UI elements (text, borders, backgrounds, icons) in muted gray tones (#6b7280 for secondary text, #9ca3af for tertiary labels) with no bright colors at rest state.
7. THE Theme SHALL apply consistently across all pages including QA_Flow, Gym page, Habit page, and Settings page with no per-page color overrides outside the defined token set.
8. WHEN the user interacts with a control (hover, focus, active), THE Theme SHALL use a lighter shade of the muted gray palette (charcoal-lighter) for the interaction state, and SHALL NOT introduce any color outside the defined token set.

### Requirement 3: Gym Page Redesign

**User Story:** As a user, I want a restructured Gym page that presents my exercise data clearly, so that I can track progress over time in a readable layout.

#### Acceptance Criteria

1. WHEN the user navigates to the Gym page, THE GymView SHALL display a line chart for the currently selected exercise metric plotting the logged numeric value on the Y-axis against the log date on the X-axis, sorted chronologically.
2. WHEN the user navigates to the Gym page, THE GymView SHALL display a table of the 20 most recent gym log entries showing columns for date, exercise metric name, numeric value, and notes.
3. THE GymView SHALL apply the Theme design system: charcoal background, muted panels with charcoal-light background and charcoal-lighter border, monospace typography (JetBrains Mono), and Accent_Color (#FF4F00) applied exclusively to values that represent a personal record.
4. THE GymView SHALL define a personal record as the highest numeric value ever logged for a given exercise metric, and SHALL visually distinguish personal-record values in both the chart and the table by rendering them in Accent_Color while rendering non-record values in the default muted text color.
5. THE GymView SHALL structure the layout with the chart section rendered above the recent entries table section, separated by a minimum vertical spacing of 24px, with section headings identifying each region.
6. WHEN the user selects an exercise metric from the metric selector, THE GymView SHALL filter the chart to display only data points for that selected metric, and SHALL retain the table showing all exercise metrics unfiltered.
7. IF no gym log entries exist, THEN THE GymView SHALL display an empty-state message in place of both the chart and table indicating that no gym data has been logged yet.
8. IF the selected exercise metric has no log entries, THEN THE GymView SHALL display an empty-state message within the chart section indicating no data is available for that metric, while continuing to display the recent entries table.

### Requirement 4: Split Schedule Configuration

**User Story:** As a user, I want to define my gym split as a repeating 7-day cycle, so that the app knows which muscle group I should train on any given day.

#### Acceptance Criteria

1. THE Split_Schedule SHALL store a fixed 7-day repeating cycle with the sequence: Pull (day_index 0), Push (day_index 1), Legs (day_index 2), Rest (day_index 3), Upper (day_index 4), Rest (day_index 5), Lower (day_index 6).
2. THE Schedule_State SHALL store a single cycle_start_date value representing the calendar date that corresponds to day_index 0 of the split cycle.
3. WHEN the system receives a query for the Day_Type of a given calendar date, THE Schedule_State SHALL compute the day_index as (query_date minus cycle_start_date) modulo 7, and return the corresponding Day_Type from the Split_Schedule.
4. WHEN the user opens the Settings page, THE Settings_Page SHALL display all 7 days of the current split cycle (day_index and Day_Type) and the currently configured cycle_start_date.
5. WHEN the user submits a cycle start date on the Settings page, THE Settings_Page SHALL accept a valid calendar date in ISO 8601 format (YYYY-MM-DD) that is no more than 30 days in the past and no more than 30 days in the future relative to today, and persist it as the cycle_start_date in the Schedule_State.
6. IF no cycle_start_date has been configured when the system attempts to determine the current Day_Type, THEN THE Schedule_State SHALL return a response indicating that the schedule is not configured, and the Settings_Page SHALL prompt the user to set a start date.
7. IF the user submits an invalid or out-of-range date as the cycle start date, THEN THE Settings_Page SHALL display an error message indicating the accepted date range and SHALL NOT update the stored cycle_start_date.
8. THE Split_Schedule SHALL persist in a `split_schedule` database table with columns for day_index (integer 0-6) and day_type (text matching one of: Pull, Push, Legs, Rest, Upper, Lower).

### Requirement 5: Split-Aware Logging

**User Story:** As a user, I want the Q&A flow to suggest today's expected workout based on my split, so that I can quickly confirm or override what I should be doing.

#### Acceptance Criteria

1. WHEN the user reaches the gym question in the QA_Flow, THE QA_Flow SHALL display the expected Day_Type label for today (one of: Pull, Push, Legs, Rest, Upper, Lower) derived from the Split_Schedule and Schedule_State, and present options to confirm the suggested Day_Type or override it with a different selection.
2. IF the expected Day_Type is a Rest day, THEN THE QA_Flow SHALL present the Rest day label and offer the user the option to log gym exercises by selecting an alternative Day_Type to proceed with exercise entry.
3. WHEN the user logs exercises that do not match the expected Day_Type, THE QA_Flow SHALL store the Log_Entry records with the actual exercises performed and write a note in the notes field indicating the expected Day_Type that was overridden.
4. THE QA_Flow SHALL allow logging Abs exercises as an add-on to any gym day regardless of the scheduled Day_Type, and Abs add-on entries SHALL NOT be treated as a mismatch with the expected Day_Type.
5. THE QA_Flow SHALL NOT include cardio exercises in this phase; no cardio exercise options SHALL appear in the exercise selection.
6. IF the Schedule_State has not been initialized (no cycle start date configured), THEN THE QA_Flow SHALL skip the Day_Type suggestion and proceed directly to exercise logging without displaying an expected Day_Type.
7. WHEN the user confirms the suggested Day_Type, THE QA_Flow SHALL store the Log_Entry records without a mismatch note in the notes field.

### Requirement 6: Dynamic Schedule Shifting

**User Story:** As a user, I want to mark a future day as unavailable and have my schedule shift forward automatically, so that I do not lose workout days when life gets in the way.

#### Acceptance Criteria

1. WHEN the user marks a future day as unavailable, THE Shift_Operation SHALL push every subsequent scheduled day in the cycle forward by one calendar day, starting from the marked day and continuing through the remainder of the current 7-day cycle.
2. WHEN a Rest day falls within the range of shifted days, THE Shift_Operation SHALL remove that Rest day from the sequence and reduce the total shift by one calendar day, so that workout days beyond the rest day remain in their original positions.
3. IF more than one Rest day falls within the range of shifted days, THEN THE Shift_Operation SHALL absorb only the first Rest day encountered in forward chronological order and shift remaining days (including the second Rest day) forward by one.
4. THE Shift_Operation SHALL update the Schedule_State mapping for dates strictly after today (midnight local time) only and SHALL NOT modify any historical Log_Entry records or Schedule_State entries for today or earlier.
5. WHEN the user marks a day as unavailable, THE Schedule_State SHALL reflect the updated schedule before the response is returned to the client.
6. WHEN the user views the next 7 days after a shift, THE Settings_Page SHALL display the recalculated Day_Types for each calendar day, indicating which day (if any) was absorbed from a Rest day.
7. IF the user attempts to mark today or a past date as unavailable, THEN THE Shift_Operation SHALL reject the request and return an error message indicating that only future dates may be marked unavailable.
8. IF the user attempts to mark a day as unavailable and no Rest day exists within the shifted range to absorb, THEN THE Shift_Operation SHALL still shift all subsequent days forward by one calendar day, extending the cycle by one day.

### Requirement 7: Natural-Language Input Mode

**User Story:** As a user, I want to type a free-text description of my workout or habits, so that I can log data quickly without stepping through individual questions.

#### Acceptance Criteria

1. WHEN the user selects the natural-language input mode, THE NL_Parser SHALL present a free-text input field accepting unstructured English text up to 2000 characters.
2. WHEN the user submits free-text input, THE NL_Parser SHALL send the text to the Claude API for parsing into structured Log_Entry records and display a preview of the parsed entries for user confirmation before writing to the database.
3. WHEN the user confirms the parsed preview, THE NL_Parser SHALL write the resulting records to the existing `logs` table using the same schema as the QA_Flow.
4. IF the Claude API fails to respond within 30 seconds, THEN THE NL_Parser SHALL display a timeout error message and allow the user to retry submission.
5. IF the Claude API fails to parse the input into valid structured data, THEN THE NL_Parser SHALL display a descriptive error message and allow the user to retry or edit the input.
6. THE NL_Parser SHALL map parsed data to the exact same `logs` and `schedule_state` tables used by the QA_Flow — no new data model is introduced.
7. THE NL_Parser SHALL only be implemented after Phases 1-4 are complete and tested.
8. IF the free-text input does not mention a date, THEN THE NL_Parser SHALL default the Log_Entry date to today's date.

### Requirement 8: Incremental Version Control

**User Story:** As a developer, I want work committed and pushed to GitHub at logical checkpoints, so that progress is preserved incrementally and I can review diffs per feature chunk.

#### Acceptance Criteria

1. WHEN a self-contained unit of work is completed (a full component, a new table migration, a completed page redesign, or a passing test suite), THE System SHALL commit the changes to a feature branch with a commit message that summarizes the specific work completed in that unit.
2. WHEN a commit is made, THE System SHALL push the feature branch to the GitHub remote within the same operation.
3. IF a push to the GitHub remote fails, THEN THE System SHALL retain the local commit and report the push failure to the developer before continuing further work.
4. THE System SHALL use a dedicated feature branch named with the prefix `compound-v2/` (not main or master) for all Compound v2 work.
5. THE System SHALL write commit messages in the format `phase-N: <imperative summary of change>` where N corresponds to the implementation phase (1 through 4) and the summary describes the scope of the change in 72 characters or fewer.
6. THE System SHALL limit each commit to a single logical unit of work such that the diff addresses one component, one migration, one page redesign, or one test suite — not multiple unrelated changes combined.

### Requirement 9: Scope Exclusions

**User Story:** As a developer, I want explicit boundaries on this iteration, so that scope does not creep into unplanned features.

#### Acceptance Criteria

1. THE System SHALL NOT include a 3D interactive muscle model in this iteration.
2. THE System SHALL NOT include SMS bot functionality in this iteration.
3. THE System SHALL NOT include Canvas API or schoolwork integration in this iteration.
4. THE System SHALL NOT include cardio scheduling logic in this iteration.
5. THE System SHALL NOT include tracking categories beyond gym, sleep, water, and protein in this iteration.
6. IF the NL_Parser receives free-text input referencing an excluded category (e.g., cardio, schoolwork), THEN THE NL_Parser SHALL ignore the excluded content and only parse entries for supported categories (gym, sleep, water, protein).
