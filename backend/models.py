from pydantic import BaseModel
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
