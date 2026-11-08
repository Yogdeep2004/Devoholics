"""Growth math over metric snapshots. Returns None when history is insufficient (never guesses)."""
from dataclasses import dataclass
from datetime import datetime, timedelta


@dataclass
class Growth:
    absolute: int
    relative: float  # fraction of starting value
    days_covered: float


def _at_or_before(series: list[tuple[datetime, int]], t: datetime):
    best = None
    for ts, v in series:
        if ts <= t and (best is None or ts > best[0]):
            best = (ts, v)
    return best


def growth(series: list[tuple[datetime, int]], window_days: int, now: datetime | None = None) -> Growth | None:
    series = [(t, v) for t, v in series if v is not None]
    if len(series) < 2:
        return None
    now = now or max(t for t, _ in series)
    end = _at_or_before(series, now)
    start = _at_or_before(series, now - timedelta(days=window_days))
    if not end or not start or end[0] <= start[0]:
        return None
    delta = end[1] - start[1]
    return Growth(delta, delta / start[1] if start[1] else 0.0, (end[0] - start[0]).total_seconds() / 86400)


def acceleration(series: list[tuple[datetime, int]], window_days: int = 7, now: datetime | None = None) -> float | None:
    """Stars gained in the latest window minus the window before it (positive = speeding up)."""
    series = [(t, v) for t, v in series if v is not None]
    if len(series) < 3:
        return None
    now = now or max(t for t, _ in series)
    recent = growth(series, window_days, now)
    prior = growth(series, window_days, now - timedelta(days=window_days))
    if recent is None or prior is None:
        return None
    return float(recent.absolute - prior.absolute)
