from datetime import date

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
