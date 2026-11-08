"""npm, PyPI, Hugging Face and MCP registry collectors (official public APIs only)."""
import re
import time
from dataclasses import dataclass
from datetime import datetime

import httpx


def _dt(v):
    return datetime.fromisoformat(v.replace("Z", "+00:00")) if v else None


def _get(c: httpx.Client, url: str, retries: int = 3, sleep=time.sleep, **params) -> httpx.Response | None:
    for a in range(retries + 1):
        try:
            r = c.get(url, params=params)
        except httpx.TransportError:
            if a == retries:
                raise
            sleep(2**a); continue
        if r.status_code == 404:
            return None
        if r.status_code in (429, 500, 502, 503, 504) and a < retries:
            sleep(int(r.headers.get("retry-after", 2**a))); continue
        r.raise_for_status()
        return r
    return None


@dataclass
class PackageData:
    name: str
    version: str | None
    published_at: datetime | None
    weekly_downloads: int | None
    dependency_count: int | None
    url: str


def npm_package(name: str, c: httpx.Client, sleep=time.sleep) -> PackageData | None:
    r = _get(c, f"https://registry.npmjs.org/{name}", sleep=sleep)
    if r is None:
        return None
    d = r.json()
    v = d.get("dist-tags", {}).get("latest")
    meta = d.get("versions", {}).get(v, {})
    dl = _get(c, f"https://api.npmjs.org/downloads/point/last-week/{name}", sleep=sleep)
    return PackageData(name, v, _dt(d.get("time", {}).get(v)),
                       dl.json().get("downloads") if dl else None,
                       len(meta.get("dependencies", {})) if meta else None,
                       f"https://www.npmjs.com/package/{name}")


def pypi_package(name: str, c: httpx.Client, sleep=time.sleep) -> PackageData | None:
    r = _get(c, f"https://pypi.org/pypi/{name}/json", sleep=sleep)
    if r is None:
        return None
    d = r.json()
    v = d["info"]["version"]
    files = d.get("urls") or []
    pub = _dt(files[0]["upload_time_iso_8601"]) if files else None
    reqs = [x for x in (d["info"].get("requires_dist") or []) if "extra ==" not in x]
    # PyPI's own download stats are not available via the JSON API; leave unknown rather than guess.
    return PackageData(name, v, pub, None, len(reqs), f"https://pypi.org/project/{name}/")


@dataclass
class HFModel:
    id: str
    likes: int
    downloads: int | None
    license: str | None
    pipeline_tag: str | None
    last_modified: datetime | None
    url: str


def _hf(m: dict) -> HFModel:
    lic = next((t.split(":", 1)[1] for t in m.get("tags", []) if t.startswith("license:")), None)
    return HFModel(m["id"], m.get("likes", 0), m.get("downloads"), lic, m.get("pipeline_tag"),
                   _dt(m.get("lastModified")), f"https://huggingface.co/{m['id']}")


def hf_top_models(c: httpx.Client, limit: int = 40) -> list[HFModel]:
    r = _get(c, "https://huggingface.co/api/models", sort="likes", direction="-1", limit=limit)
    return [_hf(m) for m in r.json()] if r else []


def hf_model(model_id: str, c: httpx.Client) -> HFModel | None:
    r = _get(c, f"https://huggingface.co/api/models/{model_id}")
    return _hf(r.json()) if r else None


@dataclass
class McpServer:
    name: str
    title: str | None
    description: str | None
    version: str | None
    github_repo: str | None  # owner/repo
    registry_url: str
    published_at: datetime | None


def mcp_servers(c: httpx.Client, max_pages: int = 5, page_size: int = 100) -> list[McpServer]:
    out, cursor = [], None
    for _ in range(max_pages):
        params = {"limit": page_size, "version": "latest"}
        if cursor:
            params["cursor"] = cursor
        r = _get(c, "https://registry.modelcontextprotocol.io/v0/servers", **params)
        if r is None:
            break
        d = r.json()
        for e in d["servers"]:
            s = e["server"]
            repo = s.get("repository") or {}
            m = re.match(r"https://github\.com/([^/]+/[^/#?]+?)(?:\.git)?/?$", repo.get("url", ""))
            meta = e.get("_meta", {}).get("io.modelcontextprotocol.registry/official", {})
            out.append(McpServer(s["name"], s.get("title"), s.get("description"), s.get("version"),
                                 m.group(1) if m else None,
                                 f"https://registry.modelcontextprotocol.io/v0/servers?search={s['name']}",
                                 _dt(meta.get("publishedAt"))))
        cursor = d.get("metadata", {}).get("nextCursor")
        if not cursor:
            break
    return out
