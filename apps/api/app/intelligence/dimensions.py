"""Four independent dimensions. Each is a list of explained signals; missing data => value None.
No combined score by design."""
from datetime import datetime, timedelta, timezone

from app.intelligence.growth import acceleration, growth


def _sig(name, value, note=None):
    return {"name": name, "value": value, "note": note or ("no data" if value is None else None)}


def momentum(series: list[tuple[datetime, int]]) -> list[dict]:
    out = []
    for d in (1, 7, 30):
        g = growth(series, d)
        out.append(_sig(f"stars_gained_{d}d", g.absolute if g else None,
                        None if g else "insufficient snapshot history"))
        if g and d == 30:
            out.append(_sig("stars_growth_30d_pct", round(g.relative * 100, 2)))
    out.append(_sig("star_acceleration_7d", acceleration(series, 7)))
    return out


def maintenance(last_commit: datetime | None, last_release: datetime | None, open_issues: int | None,
                contributors: int | None, now: datetime | None = None) -> list[dict]:
    now = now or datetime.now(timezone.utc)
    days = lambda t: None if t is None else max(0, (now - _aware(t)).days)
    return [_sig("days_since_last_push", days(last_commit)), _sig("days_since_last_release", days(last_release)),
            _sig("open_issues", open_issues), _sig("contributors", contributors)]


def ecosystem(verified_relationships: int, total_relationships: int) -> list[dict]:
    return [_sig("verified_integrations", verified_relationships),
            _sig("related_technologies", total_relationships)]


def readiness(license_: str | None, docs_url: str | None, has_release: bool, archived: bool = False) -> list[dict]:
    return [_sig("license", license_, "no license detected" if not license_ else None),
            _sig("documentation_url", docs_url, "not recorded" if not docs_url else None),
            _sig("has_published_release", has_release), _sig("archived", archived)]


def _aware(t: datetime) -> datetime:
    return t if t.tzinfo else t.replace(tzinfo=timezone.utc)


def freshness(last_synced: datetime | None, now: datetime | None = None) -> dict:
    now = now or datetime.now(timezone.utc)
    if last_synced is None:
        return {"last_synced_at": None, "status": "never"}
    age = now - _aware(last_synced)
    return {"last_synced_at": last_synced.isoformat(), "status": "fresh" if age < timedelta(hours=48) else "stale"}
