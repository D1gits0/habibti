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

class ScheduleConfigUpdate(BaseModel):
    cycle_start_date: str  # ISO 8601 date, validated in endpoint


class ScheduleConfigResponse(BaseModel):
    cycle_start_date: Optional[str]
    split_cycle: list[dict]  # [{day_index: int, day_type: str}]


class ScheduleTodayResponse(BaseModel):
    date: str
    day_type: Optional[str]
    day_index: Optional[int]
    configured: bool


class WeekDayResponse(BaseModel):
    date: str
    day_index: int
    day_type: str


# Shift models

class ShiftRequest(BaseModel):
    unavailable_date: str  # ISO 8601, must be future


class ShiftResponse(BaseModel):
    new_cycle_start_date: str
    week_schedule: list[WeekDayResponse]
    absorbed_rest: bool


# Gym exercise input model

class GymExerciseInput(BaseModel):
    name: str = Field(max_length=50)
    weight: float = Field(ge=0, le=2000)
    reps: int = Field(ge=1, le=100)
    sets: int = Field(ge=1, le=50)


# Natural-language parse models

class NLParseRequest(BaseModel):
    text: str = Field(max_length=2000)


class NLParseResponse(BaseModel):
    entries: list[dict]  # [{category, metric, value, notes, date}]
    errors: list[str]
