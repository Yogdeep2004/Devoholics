from datetime import datetime, timedelta, timezone

import httpx
import pytest

from app.collectors.github import GitHubClient, NotFound, RateLimited
from app.intelligence.growth import acceleration, growth

T0 = datetime(2026, 1, 1, tzinfo=timezone.utc)
SPEC = [(T0 + timedelta(days=i), v) for i, v in enumerate([10000, 10200, 10450, 10900])]


def test_growth_spec_example():
    g = growth(SPEC, 1)
    assert g.absolute == 450 and round(g.relative, 4) == round(450 / 10450, 4)
    assert growth(SPEC, 3).absolute == 900


def test_growth_insufficient_history_is_none():
    assert growth(SPEC[:1], 7) is None
    assert growth(SPEC, 30) is None  # nothing at/before now-30d
    assert acceleration(SPEC[:2]) is None


def test_acceleration_positive_when_speeding_up():
    s = [(T0 + timedelta(days=i), v) for i, v in [(0, 0), (7, 70), (14, 210)]]
    assert acceleration(s, 7) == 70.0


def _gh(handler, sleeps=None):
    c = httpx.Client(base_url="https://api.github.com", transport=httpx.MockTransport(handler))
    return GitHubClient(client=c, sleep=(sleeps.append if sleeps is not None else lambda s: None))


REPO = {"id": 1, "full_name": "a/b", "html_url": "https://github.com/a/b", "description": "d",
        "homepage": "", "license": {"spdx_id": "NOASSERTION"}, "topics": [], "stargazers_count": 5,
        "forks_count": 1, "open_issues_count": 2, "pushed_at": "2026-01-01T00:00:00Z"}


def test_repo_parsing_and_unknowns():
    def h(req):
        if req.url.path.endswith("/contributors"):
            return httpx.Response(200, json=[{}], headers={"link": '<x?per_page=1&page=42>; rel="last"'})
        return httpx.Response(200, json=REPO)
    d = _gh(h).repo("a/b")
    assert d.stars == 5 and d.contributors == 42 and d.license is None and d.homepage is None


def test_contributors_unknown_on_error():
    def h(req):
        return httpx.Response(403 if req.url.path.endswith("/contributors") else 200,
                              json=REPO if not req.url.path.endswith("/contributors") else {})
    assert _gh(h).repo("a/b").contributors is None


def test_retry_on_5xx_then_success():
    calls, sleeps = [], []
    def h(req):
        calls.append(1)
        return httpx.Response(502) if len(calls) < 3 else httpx.Response(200, json=REPO)
    _gh(h, sleeps).repo("a/b")
    assert sleeps[:2] == [1, 2]


def test_rate_limit_and_404():
    rl = lambda r: httpx.Response(403, headers={"x-ratelimit-remaining": "0", "x-ratelimit-reset": "99"})
    with pytest.raises(RateLimited):
        _gh(rl).repo("a/b")
    with pytest.raises(NotFound):
        _gh(lambda r: httpx.Response(404)).repo("a/b")
