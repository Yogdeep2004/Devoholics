"""GitHub REST collector: retries on 5xx, honours rate limits, never invents data."""
import re
import time
from dataclasses import dataclass
from datetime import datetime

import httpx
import structlog

log = structlog.get_logger()
API = "https://api.github.com"


class RateLimited(Exception):
    def __init__(self, reset_at: int):
        super().__init__(f"GitHub rate limit hit; resets at {reset_at}")
        self.reset_at = reset_at


class NotFound(Exception):
    pass


@dataclass
class RepoData:
    external_id: str
    full_name: str
    url: str
    description: str | None
    homepage: str | None
    license: str | None
    topics: list[str]
    stars: int
    forks: int
    open_issues: int
    contributors: int | None
    last_commit_at: datetime | None
    archived: bool


@dataclass
class ReleaseData:
    version: str
    url: str | None
    published_at: datetime | None


def _dt(v: str | None) -> datetime | None:
    return datetime.fromisoformat(v.replace("Z", "+00:00")) if v else None


class GitHubClient:
    def __init__(self, token: str = "", client: httpx.Client | None = None, max_retries: int = 3,
                 sleep=time.sleep):
        headers = {"Accept": "application/vnd.github+json", "X-GitHub-Api-Version": "2022-11-28"}
        if token:
            headers["Authorization"] = f"Bearer {token}"
        self._c = client or httpx.Client(base_url=API, headers=headers, timeout=20, follow_redirects=True)
        self._retries = max_retries
        self._sleep = sleep

    def _get(self, path: str, **params) -> httpx.Response:
        for attempt in range(self._retries + 1):
            try:
                r = self._c.get(path, params=params)
            except httpx.TransportError:
                if attempt == self._retries:
                    raise
                self._sleep(2**attempt)
                continue
            if r.status_code in (403, 429) and r.headers.get("x-ratelimit-remaining") == "0":
                raise RateLimited(int(r.headers.get("x-ratelimit-reset", "0")))
            if r.status_code >= 500 and attempt < self._retries:
                self._sleep(2**attempt)
                continue
            return r
        raise RuntimeError("unreachable")

    def repo(self, full_name: str) -> RepoData:
        r = self._get(f"/repos/{full_name}")
        if r.status_code == 404:
            raise NotFound(full_name)
        r.raise_for_status()
        d = r.json()
        spdx = (d.get("license") or {}).get("spdx_id")
        return RepoData(
            external_id=str(d["id"]), full_name=d["full_name"], url=d["html_url"],
            description=d.get("description"), homepage=d.get("homepage") or None,
            license=None if spdx in (None, "NOASSERTION") else spdx,
            topics=d.get("topics", []), stars=d["stargazers_count"], forks=d["forks_count"],
            open_issues=d["open_issues_count"], contributors=self._contributors(full_name),
            last_commit_at=_dt(d.get("pushed_at")), archived=d.get("archived", False),
        )

    def _contributors(self, full_name: str) -> int | None:
        r = self._get(f"/repos/{full_name}/contributors", per_page=1, anon="false")
        if r.status_code != 200:
            return None  # unknown, not zero
        m = re.search(r'[?&]page=(\d+)>; rel="last"', r.headers.get("link", ""))
        return int(m.group(1)) if m else len(r.json())

    def latest_release(self, full_name: str) -> ReleaseData | None:
        r = self._get(f"/repos/{full_name}/releases/latest")
        if r.status_code == 404:
            return None
        r.raise_for_status()
        d = r.json()
        return ReleaseData(d["tag_name"], d.get("html_url"), _dt(d.get("published_at")))
