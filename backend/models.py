from pydantic import BaseModel, Field
from typing import Optional


class ThreadCreate(BaseModel):
    name: str
    category: str
    status: str = "not_started"
    next_action: Optional[str] = None


class ThreadUpdate(BaseModel):
    name: Optional[str] = None
    category: Optional[str] = None
    status: Optional[str] = None
    next_action: Optional[str] = None


class ThreadResponse(BaseModel):
    id: int
    name: str
    category: str
    status: str
    next_action: Optional[str]
    updated_at: str


class LogCreate(BaseModel):
    date: Optional[str] = None
    category: str
    metric: str
    value: float
    notes: Optional[str] = None


class LogUpdate(BaseModel):
    date: Optional[str] = None
    category: Optional[str] = None
    metric: Optional[str] = None
    value: Optional[float] = None
    notes: Optional[str] = None


class LogResponse(BaseModel):
    id: int
    date: str
    category: str
    metric: str
    value: float
    notes: Optional[str]


# Schedule models

class ScheduleTodayResponse(BaseModel):
    date: str
    day_type: Optional[str]
    day_index: Optional[int]
    configured: bool


# Gym exercise input model

class GymExerciseInput(BaseModel):
    name: str = Field(max_length=50)
    weight: float = Field(ge=0, le=2000)
    reps: int = Field(ge=1, le=100)
    sets: int = Field(ge=1, le=50)


# Subtask models

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


# Gym exercise seed models

class ExerciseDefinition(BaseModel):
    name: str
    swap: Optional[str] = None


class SplitDayExercises(BaseModel):
    day_type: str
    exercises: list[ExerciseDefinition]



