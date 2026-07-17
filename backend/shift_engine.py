from datetime import date, timedelta
from typing import Optional


def validate_shift_request(unavailable_date: date, today: date) -> Optional[str]:
    """Return error message if request is invalid, None if valid.

    Only future dates (strictly after today) may be marked as unavailable.
    """
    if unavailable_date <= today:
        return "Only future dates may be marked as unavailable"
    return None


def compute_shift(
    cycle_start_date: date,
    unavailable_date: date,
    split_cycle: list[str],
) -> date:
    """Compute new cycle_start_date after marking unavailable_date.

    Algorithm:
    1. Identify the day_index of unavailable_date in the cycle.
    2. Collect remaining indices after the unavailable day through the end of
       the cycle (indices idx+1 through 6). These are the days that get pushed
       forward.
    3. Search remaining indices for the first Rest day.
    4. Shift cycle_start_date back by 1 day (equivalent to pushing all future
       days forward by 1 calendar day).
    5. If a Rest day was found in the remaining range, shift forward by 1 to
       compensate (absorbing the rest day cancels one day of shift).
    6. Return the new cycle_start_date.

    Requirements:
    - 6.1: Push every subsequent scheduled day forward by one calendar day.
    - 6.2: If a Rest day falls in the shifted range, absorb it (reduce shift by one).
    - 6.3: If more than one Rest day in range, absorb ONLY the first one.
    - 6.8: If no Rest day in range, still shift all days forward by one.
    """
    # Step 1: Compute day_index of the unavailable date
    idx = (unavailable_date - cycle_start_date).days % 7

    # Step 2: Collect remaining indices after the unavailable day
    # These are the days in the cycle that come after the marked day
    remaining_indices = list(range(idx + 1, 7))

    # Step 3: Search remaining indices for the first Rest day
    rest_found = False
    for i in remaining_indices:
        if split_cycle[i] == "Rest":
            rest_found = True
            break

    # Step 4: Shift cycle_start_date back by 1 day
    # (pushing all future days forward by 1 calendar day)
    new_cycle_start_date = cycle_start_date - timedelta(days=1)

    # Step 5: If a rest day was absorbed, compensate by shifting forward 1
    if rest_found:
        new_cycle_start_date = new_cycle_start_date + timedelta(days=1)

    # Step 6: Return new cycle_start_date
    return new_cycle_start_date
