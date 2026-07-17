from datetime import date, timedelta
from typing import Optional

SPLIT_CYCLE = ["Pull", "Push", "Legs", "Rest", "Upper", "Rest", "Lower"]


def get_day_type(cycle_start_date: date, query_date: date) -> str:
    """Compute Day_Type for a given date.

    Returns one of: Pull, Push, Legs, Rest, Upper, Lower
    Raises ValueError if cycle_start_date is None.
    """
    if cycle_start_date is None:
        raise ValueError("cycle_start_date must not be None")
    delta = (query_date - cycle_start_date).days
    day_index = delta % 7
    return SPLIT_CYCLE[day_index]


def get_day_index(cycle_start_date: date, query_date: date) -> int:
    """Compute day_index (0-6) for a given date."""
    delta = (query_date - cycle_start_date).days
    return delta % 7


def get_week_schedule(cycle_start_date: date, start_date: date) -> list[dict]:
    """Return the next 7 days with their date and Day_Type."""
    result = []
    for i in range(7):
        d = start_date + timedelta(days=i)
        result.append({
            "date": d.isoformat(),
            "day_index": get_day_index(cycle_start_date, d),
            "day_type": get_day_type(cycle_start_date, d),
        })
    return result
