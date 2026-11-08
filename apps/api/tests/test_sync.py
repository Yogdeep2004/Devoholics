from datetime import datetime, timezone

from sqlalchemy import create_engine, func, select
from sqlalchemy.orm import Session

import app.models as m
from app.collectors.github import ReleaseData, RepoData
from app.db import Base
from app.services.sync import sync_repository


class FakeGH:
    def __init__(self, stars, release="v1"):
        self.stars, self.release = stars, release

    def repo(self, name):
        return RepoData("1", name, f"https://github.com/{name}", "desc", None, "MIT", [], self.stars, 1, 2, 3,
                        datetime.now(timezone.utc), False)

    def latest_release(self, name):
        return ReleaseData(self.release, "https://r/" + self.release, datetime.now(timezone.utc))


def test_one_snapshot_per_day_and_release_events():
    eng = create_engine("sqlite://"); Base.metadata.create_all(eng)
    with Session(eng) as s:
        c = m.Category(name="c", slug="c"); s.add(c); s.flush()
        t = m.Technology(name="T", slug="t", category_id=c.id); s.add(t); s.flush()
        r = m.Repository(technology_id=t.id, source_platform="github", external_id="p", repository_url="https://github.com/o/r")
        s.add(r); s.flush()
        assert sync_repository(s, FakeGH(10), r, t)
        assert sync_repository(s, FakeGH(12), r, t)  # same day: updates, no duplicate
        assert s.scalar(select(func.count(m.MetricSnapshot.id))) == 1
        assert s.scalar(select(m.MetricSnapshot.stars)) == 12
        assert s.scalar(select(func.count(m.FeedEvent.id))) == 0  # first release is backfill, not news
        assert sync_repository(s, FakeGH(13, "v2"), r, t)
        assert [e.event_title for e in s.scalars(select(m.FeedEvent))] == ["T v2 released"]
        assert t.license == "MIT"
