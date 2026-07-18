# Design Document: Compound v3

## Overview

Compound v3 is a focused refactor and feature upgrade that simplifies the codebase by removing unused services (NL parser, schedule-shifting) and the Add Log page, while introducing richer project management (subtasks with nesting), chart-based inline logging, and a fully overhauled gym experience with manual split selection, primary/swap exercises, progressive overload graphs, and a consistency calendar.

The system retains its existing architecture: a React SPA (Vite + TailwindCSS) communicating with a FastAPI backend backed by SQLite. All changes are additive to the existing `logs` and `threads` tables, with one new `subtasks` table and a JSON-based `exercise_seed.json` file for gym configuration.

### Design Decisions

1. **Keep the `threads` table name in the DB** — only rename UI labels to "Projects". This avoids a disruptive migration while achieving the user-facing goal.
2. **JSON seed file for exercises** — gym split exercises are stored in a static JSON file loaded at startup, not in a database table. This satisfies Requirement 7.10 (no schema migration for exercise changes).
3. **Inline_Input as a reusable React component** — a single `InlineInput` component handles chart-tap logging across both HabitView and GymView.
4. **Notes-field encoding for failure/drop-set** — exercise flags are stored as structured prefixes in the existing `notes` column (e.g., `"failure:true|3r x 3s"`), avoiding schema changes.
5. **Swap_History derived from logs** — instead of a separate table, swap history is computed from past `logs` entries where the metric differs from the primary exercise for a given slot and date.

## Architecture

```mermaid
graph TD
    subgraph Frontend [React SPA - Vite]
        App[App.jsx Router]
        ProjectsBoard[ProjectsBoard.jsx]
        QAFlow[QAFlow.jsx]
        GymPage[GymPage.jsx]
        HabitView[HabitView.jsx]
        InlineInput[InlineInput component]
        OverloadChart[OverloadChart component]
        ConsistencyCalendar[ConsistencyCalendar component]
    end

    subgraph Backend [FastAPI]
        ThreadsAPI[/api/threads + /api/threads/:id/subtasks]
        LogsAPI[/api/logs]
        ScheduleAPI[/api/schedule/today]
        GymSeedAPI[/api/gym/exercises]
    end

    subgraph Storage [SQLite]
        ThreadsTable[threads table]
        SubtasksTable[subtasks table]
        LogsTable[logs table]
    end

    subgraph Static [File System]
        ExerciseSeed[exercise_seed.json]
    end

    App --> ProjectsBoard
    App --> QAFlow
    App --> GymPage
    App --> HabitView
    GymPage --> OverloadChart
    GymPage --> ConsistencyCalendar
    HabitView --> InlineInput
    GymPage --> InlineInput

    ProjectsBoard --> ThreadsAPI
    HabitView --> LogsAPI
    GymPage --> LogsAPI
    GymPage --> ScheduleAPI
    GymPage --> GymSeedAPI
    QAFlow --> LogsAPI

    ThreadsAPI --> ThreadsTable
    ThreadsAPI --> SubtasksTable
    LogsAPI --> LogsTable
    GymSeedAPI --> ExerciseSeed
    ScheduleAPI --> Storage
```

### Key Architectural Changes from v2

| Area | v2 (Current) | v3 (Target) |
|------|-------------|-------------|
| NL Parser | `nl_parser.py` + Anthropic API | **Removed** |
| Schedule Shifting | `shift_engine.py` + week/config endpoints | **Removed** |
| Add Log Page | `AddLog.jsx` dedicated form | **Removed** — chart-tap replaces it |
| Threads | Flat kanban board | **Projects** with nested subtasks + progress bar |
| Gym Logging | Embedded in QAFlow wizard | **Dedicated GymPage** with split selection, primary/swap exercises |
| Gym Data | Manual exercise name entry | **Seed-based** primary exercises with swap picker |
| Gym Visualization | Single metric chart | **Per-exercise overload charts** + consistency calendar |

## Components and Interfaces

### Backend Components

#### 1. Simplified `main.py`

Remove imports and endpoints for:
- `nl_parser` module, `NLParserService`
- `shift_engine` module, `compute_shift`, `validate_shift_request`
- Models: `NLParseRequest`, `NLParseResponse`, `ShiftRequest`, `ShiftResponse`, `ScheduleConfigUpdate`, `ScheduleConfigResponse`, `WeekDayResponse`
- Endpoints: `POST /api/nl/parse`, `POST /api/schedule/shift`, `GET /api/schedule/week`, `PUT /api/schedule/config`, `GET /api/schedule/config`

Retain:
- `GET /api/schedule/today` (simplified to use `SPLIT_CYCLE` constant directly)
- All `/api/threads` and `/api/logs` endpoints

#### 2. New Subtasks Endpoints

| Method | Path | Description |
|--------|------|-------------|
| GET | `/api/threads/{id}/subtasks` | List all subtasks for a project (flat list with parent_subtask_id for tree reconstruction) |
| POST | `/api/threads/{id}/subtasks` | Create a subtask (validates nesting depth ≤ 2, total count ≤ 50, description length) |
| PUT | `/api/subtasks/{subtask_id}` | Update a subtask (description, done, sort_order) |
| DELETE | `/api/subtasks/{subtask_id}` | Delete a subtask and all its children (cascade) |
| PUT | `/api/threads/{id}/subtasks/reorder` | Batch update sort_order for subtasks within a parent scope |

#### 3. New Gym Seed Endpoint

| Method | Path | Description |
|--------|------|-------------|
| GET | `/api/gym/exercises` | Return the full exercise seed data (all split days with primary/swap exercises) |
| GET | `/api/gym/exercises/{day_type}` | Return exercises for a specific split day |

#### 4. New Gym History Endpoint

| Method | Path | Description |
|--------|------|-------------|
| GET | `/api/gym/history/{exercise_name}` | Return logged entries for a specific exercise, supporting `range` query param (1m, 3m, 6m, ytd) |

#### 5. Simplified `schedule_engine.py`

Retains only:
- `SPLIT_CYCLE` constant
- `get_day_type()` and `get_day_index()` functions

Removes: `get_week_schedule()` function.

### Frontend Components

#### 1. `ProjectsBoard.jsx` (renamed from `ThreadsBoard.jsx`)

- Replaces all "Thread" labels with "Projects"
- Adds subtask management: inline creation, nesting indicator, checkbox toggle
- Renders progress bar per project card using `Completion_Percentage`
- Supports drag-to-reorder subtasks within a parent scope

#### 2. `InlineInput.jsx` (new component)

- Renders a positioned input overlay adjacent to a chart data point
- Props: `date`, `metric`, `category`, `existingValue`, `position`, `onSave`, `onDismiss`
- Handles: numeric validation, ESC/click-outside dismiss, save on Enter
- Shows validation error for empty/non-numeric input
- Shows error toast on backend save failure

#### 3. `GymPage.jsx` (replaces current `GymView.jsx`)

Sub-sections:
1. **Split Selection Banner** — manual day-type picker (Push/Pull/Legs/Rest/Upper/Lower)
2. **Exercise List** — renders primary exercises for selected split with swap controls
3. **Exercise Logging Form** — weight/reps/failure-flag per exercise
4. **Abs Toggle** — prompted after all exercises logged
5. **Overload Charts** — per-exercise mini line charts
6. **Consistency Calendar** — month-view grid

#### 4. `OverloadChart.jsx` (new component)

- Props: `exerciseName`, `data`, `timeRange`, `onTimeRangeChange`
- Renders a 120px-height line chart with dual y-axes (weight + reps)
- Time range selector: 1m, 3m, 6m, YTD
- Empty state: "No data for this period"

#### 5. `ConsistencyCalendar.jsx` (new component)

- Props: `month`, `year`, `gymDays`, `onNavigate`
- Renders a 7-column month grid
- Highlights days with gym logs
- Supports prev/next month navigation
- Current day indicator

#### 6. `SwapPicker.jsx` (new component)

- Props: `slot`, `primaryExercise`, `swapHistory`, `defaultSwap`, `onSelect`
- Displays the default swap exercise and previously-used swaps from history
- Allows free-text entry for a new swap exercise name

### Frontend API Module Updates (`api.js`)

**Remove:**
- `parseNaturalLanguage`
- `shiftSchedule`
- `getWeekSchedule`
- `updateScheduleConfig`
- `getScheduleConfig`

**Add:**
```javascript
// Subtasks
export const getSubtasks = (threadId) => request(`/threads/${threadId}/subtasks`)
export const createSubtask = (threadId, data) => request(`/threads/${threadId}/subtasks`, { method: 'POST', body: JSON.stringify(data) })
export const updateSubtask = (subtaskId, data) => request(`/subtasks/${subtaskId}`, { method: 'PUT', body: JSON.stringify(data) })
export const deleteSubtask = (subtaskId) => request(`/subtasks/${subtaskId}`, { method: 'DELETE' })
export const reorderSubtasks = (threadId, data) => request(`/threads/${threadId}/subtasks/reorder`, { method: 'PUT', body: JSON.stringify(data) })

// Gym
export const getGymExercises = (dayType) => request(`/gym/exercises${dayType ? `/${dayType}` : ''}`)
export const getGymHistory = (exerciseName, range = '3m') => request(`/gym/history/${encodeURIComponent(exerciseName)}?range=${range}`)
```

## Data Models

### Database Schema Changes

#### New Table: `subtasks`

```sql
CREATE TABLE IF NOT EXISTS subtasks (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    thread_id INTEGER NOT NULL REFERENCES threads(id) ON DELETE CASCADE,
    parent_subtask_id INTEGER REFERENCES subtasks(id) ON DELETE CASCADE,
    description TEXT NOT NULL CHECK(length(description) <= 300 AND length(trim(description)) > 0),
    done INTEGER NOT NULL DEFAULT 0,
    sort_order INTEGER NOT NULL DEFAULT 0,
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX idx_subtasks_thread ON subtasks(thread_id);
CREATE INDEX idx_subtasks_parent ON subtasks(parent_subtask_id);
```

#### Existing Tables — No Schema Changes

- `threads` — unchanged (UI label change only)
- `logs` — unchanged (gym exercises use notes field for structured flags)
- `split_schedule` — retained as read-only reference
- `schedule_state` — retained (only `GET /api/schedule/today` uses it)

### Pydantic Models (Backend)

#### New Models

```python
class SubtaskCreate(BaseModel):
    description: str = Field(min_length=1, max_length=300)
    parent_subtask_id: Optional[int] = None

class SubtaskUpdate(BaseModel):
    description: Optional[str] = Field(None, min_length=1, max_length=300)
    done: Optional[bool] = None
    sort_order: Optional[int] = None

class SubtaskResponse(BaseModel):
    id: int
    thread_id: int
    parent_subtask_id: Optional[int]
    description: str
    done: bool
    sort_order: int

class SubtaskReorderItem(BaseModel):
    id: int
    sort_order: int

class SubtaskReorderRequest(BaseModel):
    items: list[SubtaskReorderItem]

class ExerciseDefinition(BaseModel):
    name: str
    swap: Optional[str] = None

class SplitDayExercises(BaseModel):
    day_type: str
    exercises: list[ExerciseDefinition]
```

#### Models to Remove

- `NLParseRequest`, `NLParseResponse`
- `ShiftRequest`, `ShiftResponse`
- `ScheduleConfigUpdate`, `ScheduleConfigResponse`
- `WeekDayResponse`
- `GymExerciseInput` (replaced by new exercise logging in gym flow)

### Exercise Seed Data (`exercise_seed.json`)

```json
{
  "Push": [
    { "name": "Incline DB Press", "swap": null },
    { "name": "Cable Chest Fly", "swap": "Pec Deck" },
    { "name": "Machine Shoulder Press", "swap": null },
    { "name": "Lateral Raises", "swap": null },
    { "name": "Overhead Tricep Extension", "swap": null }
  ],
  "Pull": [
    { "name": "Lat Pulldowns", "swap": null },
    { "name": "Close Grip Cable Rows", "swap": null },
    { "name": "Reverse Fly", "swap": "Archer Pull" },
    { "name": "Preacher Curls", "swap": null },
    { "name": "Cable Hammer Curls", "swap": "DB Hammer Curl" }
  ],
  "Legs": [
    { "name": "Bulgarian Split Squat", "swap": null },
    { "name": "45 Degree Back Extension", "swap": null },
    { "name": "Leg Extensions", "swap": null },
    { "name": "Leg Curls", "swap": null },
    { "name": "Calf Raises", "swap": null }
  ],
  "Upper": [
    { "name": "Weighted Dips", "swap": null },
    { "name": "Cable Chest Fly", "swap": "Pec Deck" },
    { "name": "Pull Ups", "swap": null },
    { "name": "Wide Grip Cable Rows", "swap": null },
    { "name": "Lateral Raises", "swap": null },
    { "name": "Incline Curls", "swap": null },
    { "name": "Overhead Tricep Extension", "swap": null }
  ],
  "Lower": [
    { "name": "Bulgarian Split Squat", "swap": null },
    { "name": "45 Degree Back Extension", "swap": null },
    { "name": "Leg Extensions", "swap": null },
    { "name": "Leg Curls", "swap": null },
    { "name": "Calf Raises", "swap": null }
  ],
  "Rest": [],
  "Abs": [
    { "name": "Cable Crunches", "swap": null },
    { "name": "Leg Raises", "swap": "Side Planks" }
  ]
}
```

### Notes Field Encoding for Gym Logs

Exercise entries in the `logs` table use this format:

- **metric**: exercise name (e.g., `"Incline DB Press"`)
- **category**: `"gym"`
- **value**: weight in lbs (float; negative for assisted pull-ups)
- **notes**: structured format: `"[flags]|{reps}r"` where flags are optional
  - Normal set: `"8r"` (just reps)
  - Failure set: `"failure:true|8r"`
  - Drop set: `"dropset:true|6r"`

This preserves backward compatibility with existing gym logs that use `"{reps}r x {sets}s"` format.



## Correctness Properties

*A property is a characteristic or behavior that should hold true across all valid executions of a system — essentially, a formal statement about what the system should do. Properties serve as the bridge between human-readable specifications and machine-verifiable correctness guarantees.*

### Property 1: Split cycle day type computation

*For any* valid cycle_start_date and query_date (where query_date >= cycle_start_date), `get_day_type(cycle_start_date, query_date)` SHALL return `SPLIT_CYCLE[(query_date - cycle_start_date).days % 7]`.

**Validates: Requirements 2.5**

### Property 2: Subtask nesting depth enforcement

*For any* project and any sequence of subtask creation operations, the system SHALL never allow a subtask to exist at a nesting depth greater than 2 (where a root subtask is depth 1 and its child is depth 2).

**Validates: Requirements 4.3, 4.4**

### Property 3: Subtask description validation

*For any* string `s`, subtask creation SHALL be accepted if and only if `s` has at least one non-whitespace character and `len(s) <= 300`. Strings that are empty, whitespace-only, or exceed 300 characters SHALL be rejected.

**Validates: Requirements 4.5**

### Property 4: Subtask reorder preserves integrity

*For any* list of subtasks within a parent scope and any valid reorder operation, the resulting sort_order values SHALL be unique within that parent scope and the set of subtask IDs SHALL be unchanged.

**Validates: Requirements 4.6**

### Property 5: Subtask insertion assigns next sort_order

*For any* parent scope with existing subtasks, inserting a new subtask SHALL assign it a sort_order equal to `max(existing sort_orders within that parent) + 1`, or 0 if no siblings exist.

**Validates: Requirements 4.7**

### Property 6: Cascade deletion removes all descendants

*For any* subtask tree and any node selected for deletion, after deletion, the deleted node and all of its descendants (direct children and their children) SHALL no longer exist in the database.

**Validates: Requirements 4.8**

### Property 7: Completion percentage calculation

*For any* set of subtasks (across all nesting levels) belonging to a project, the Completion_Percentage SHALL equal `floor(count(done=true) / count(total) * 100)`. When total is 0, the result SHALL be 0.

**Validates: Requirements 4.10, 4.13**

### Property 8: Chart-tap upsert semantics

*For any* date, metric, and category combination, after submitting a value through InlineInput, there SHALL exist exactly one Log_Entry with that (date, metric, category) key, and its value SHALL equal the submitted value.

**Validates: Requirements 5.2, 5.3**

### Property 9: Inline input numeric validation

*For any* string input to the InlineInput component, the validator SHALL reject it (return error) if and only if the trimmed string is empty or cannot be parsed as a valid finite number.

**Validates: Requirements 5.9**

### Property 10: Exercise entry validation

*For any* exercise entry with fields (name, weight, reps, failure_flag), the validator SHALL accept it if and only if: `len(name.trim()) >= 1 AND len(name) <= 50 AND reps in [1, 100] AND weight in [-100, 2000] (if name == "Pull Ups") or weight in [0, 2000] (otherwise) AND weight % 0.5 == 0`.

**Validates: Requirements 6.7, 6.8, 6.15**

### Property 11: Exercise notes field round-trip

*For any* valid exercise entry (reps integer, failure_flag boolean, dropset_flag boolean), encoding the entry to the notes field format and then decoding it back SHALL produce the original reps and flag values.

**Validates: Requirements 6.12**

### Property 12: Seed exercises displayed in order with at most one swap

*For any* non-Rest day_type in the exercise seed data, the returned exercise list SHALL match the seed's defined order exactly, and each exercise SHALL have at most one associated swap exercise.

**Validates: Requirements 6.4, 7.11, 7.12**

### Property 13: Overload chart time range filter

*For any* set of log entries for a given exercise and any selected time range (1m, 3m, 6m, YTD), all data points displayed in the Overload_Chart SHALL have dates within the selected time range, and no log entries within the range SHALL be omitted.

**Validates: Requirements 8.5**

### Property 14: Consistency calendar highlights match gym log dates

*For any* month and any set of Log_Entries with category "gym", the set of highlighted days in the Consistency_Calendar SHALL equal exactly the set of unique dates within that month that have at least one gym log entry.

**Validates: Requirements 9.3**

## Error Handling

### Backend Error Handling

| Scenario | HTTP Status | Response |
|----------|-------------|----------|
| Subtask creation at depth > 2 | 422 | `{"detail": "Maximum nesting depth of 2 levels reached"}` |
| Subtask description invalid (empty/too long) | 422 | `{"detail": "Description must be 1-300 non-whitespace characters"}` |
| Subtask count exceeds 50 per project | 422 | `{"detail": "Maximum of 50 subtasks per project reached"}` |
| Exercise weight out of range | 422 | `{"detail": "Weight must be between 0 and 2000 (or -100 to 2000 for Pull Ups)"}` |
| Exercise reps out of range | 422 | `{"detail": "Reps must be between 1 and 100"}` |
| Exercise name too long | 422 | `{"detail": "Exercise name must be 50 characters or fewer"}` |
| Exercise session exceeds 20 entries | 422 | `{"detail": "Maximum of 20 exercises per session"}` |
| Subtask not found | 404 | `{"detail": "Subtask not found"}` |
| Project not found | 404 | `{"detail": "Project not found"}` |
| Log entry not found | 404 | `{"detail": "Log not found"}` |
| Invalid date format in log | 422 | `{"detail": "Invalid date format"}` |
| Non-numeric value in log | 422 | `{"detail": "Value must be a number"}` |

### Frontend Error Handling

| Component | Error Scenario | Behavior |
|-----------|---------------|----------|
| InlineInput | Non-numeric input | Show red validation text below input, keep input open |
| InlineInput | Backend save failure | Show error toast, retain entered value for retry |
| InlineInput | Empty submission | Show "Value is required" validation message |
| ProjectsBoard | Subtask creation failure | Show inline error message below the input field |
| ProjectsBoard | Max subtask limit | Show "Maximum 50 subtasks reached" message, disable add button |
| ProjectsBoard | Max depth exceeded | Show "Cannot nest deeper than 2 levels" message |
| GymPage | Exercise validation failure | Highlight invalid field with red border and error text |
| GymPage | Max exercises reached | Disable "Add Exercise" button, show count message |
| GymPage | Swap history load failure | Show empty swap picker, allow manual text entry |
| ConsistencyCalendar | Data load failure | Show calendar grid with no highlights, show retry option |
| OverloadChart | No data in range | Display "No data for this period" text placeholder |

## Testing Strategy

### Property-Based Testing (PBT)

This feature is well-suited for property-based testing. The core logic involves pure computations (completion percentage, day type calculation, input validation, notes encoding, date filtering) that can be exhaustively tested with generated inputs.

**Library**: 
- Backend: `hypothesis` (already in requirements.txt)
- Frontend: `fast-check` (already in devDependencies)

**Configuration**: Minimum 100 iterations per property test.

**Tag format**: `Feature: compound-v3, Property {N}: {title}`

#### Backend Property Tests (Python + Hypothesis)

| Property | Module Under Test | Generator Strategy |
|----------|------------------|-------------------|
| 1: Split cycle day type | `schedule_engine.get_day_type` | Random dates within 1 year of cycle start |
| 2: Nesting depth enforcement | Subtask creation endpoint | Random tree-building sequences |
| 3: Description validation | `SubtaskCreate` model | Random strings (empty, whitespace, 1-300 valid, 301+ overflow) |
| 4: Reorder integrity | Subtask reorder endpoint | Random permutations of subtask ID lists |
| 5: Sort_order assignment | Subtask creation endpoint | Random parent scopes with varying existing items |
| 6: Cascade deletion | Subtask deletion endpoint | Random subtask trees, random node selection |
| 7: Completion percentage | `compute_completion_percentage` function | Random lists of (done: bool) with length 0-100 |
| 8: Upsert semantics | Log create/update endpoints | Random (date, metric, category, value) tuples |
| 10: Exercise validation | `validate_exercise_entry` function | Random (name, weight, reps, flag) tuples |
| 11: Notes round-trip | `encode_exercise_notes` / `decode_exercise_notes` | Random (reps, failure, dropset) tuples |

#### Frontend Property Tests (JavaScript + fast-check)

| Property | Module Under Test | Generator Strategy |
|----------|------------------|-------------------|
| 7: Completion percentage | `computeCompletionPercentage` utility | Random arrays of booleans |
| 9: Numeric validation | `validateInlineInput` utility | Random strings (numeric, non-numeric, empty, whitespace) |
| 12: Seed exercise order | Seed data loader | All non-Rest day types from seed file |
| 13: Time range filter | `filterByTimeRange` utility | Random log arrays + random range selections |
| 14: Calendar highlights | `computeGymDays` utility | Random gym log arrays + random month/year |

### Unit Tests (Example-Based)

- **Requirement 1-3 (Removals)**: Smoke tests verifying files/endpoints don't exist
- **Requirement 4**: Subtask CRUD operations, progress bar rendering
- **Requirement 5**: InlineInput open/close/dismiss behavior, chart click interaction
- **Requirement 6**: Split selection UI flow, abs toggle behavior, swap picker interaction
- **Requirement 7**: Seed data matches spec exactly (all exercises, all swaps)
- **Requirement 8**: Overload chart renders with correct axes, default time range
- **Requirement 9**: Calendar renders grid, navigation works, today indicator shows

### Integration Tests

- Full QA flow submission with gym exercises → verify logs created correctly
- Subtask cascade delete → verify DB state via API
- Chart-tap upsert → create then update same date/metric → verify single entry
- Gym session end-to-end: select split → log exercises → abs toggle → verify all persisted

### Test File Structure

```
backend/tests/
├── test_subtasks.py              # Subtask CRUD + property tests
├── test_completion.py            # Completion percentage property tests
├── test_schedule_engine.py       # Day type property test (retained, updated)
├── test_exercise_validation.py   # Exercise entry validation properties
├── test_notes_encoding.py        # Notes field round-trip property
├── test_gym_seed.py              # Seed data smoke tests
├── test_removals.py              # Verify removed files/endpoints
└── conftest.py                   # Shared fixtures

frontend/src/__tests__/
├── inline-input.test.js          # InlineInput behavior + validation property
├── completion.test.js            # Completion percentage property
├── time-range-filter.test.js     # Overload chart filter property
├── consistency-calendar.test.js  # Calendar highlights property
├── seed-exercises.test.js        # Seed data order property
├── projects-board.test.js        # ProjectsBoard rendering
└── gym-page.test.js              # GymPage flow tests
```
