"""Transparent deterministic feed ranking. Every point of score is returned as a reason."""
from datetime import datetime, timezone

W_FOLLOW, W_INTEREST = 50.0, 20.0
TYPE_WEIGHT = {"new_release": 10.0, "trending": 15.0, "maintenance_warning": 12.0}


def score(event_type: str, detected_at: datetime, followed: bool, in_interest: bool,
          now: datetime | None = None) -> tuple[float, list[str]]:
    now = now or datetime.now(timezone.utc)
    if detected_at.tzinfo is None:
        detected_at = detected_at.replace(tzinfo=timezone.utc)
    age_days = max(0.0, (now - detected_at).total_seconds() / 86400)
    recency = 30.0 / (1.0 + age_days)  # 30 today, 15 after a day, ~4 after a week
    s, why = recency, [f"recency +{recency:.1f}"]
    if followed:
        s += W_FOLLOW; why.append("you follow this technology")
    if in_interest:
        s += W_INTEREST; why.append("matches your interests")
    w = TYPE_WEIGHT.get(event_type, 5.0)
    s += w; why.append(f"{event_type.replace('_', ' ')} +{w:.0f}")
    return s, why
