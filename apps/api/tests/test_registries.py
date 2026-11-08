import httpx

from app.collectors import registries as R


def _c(h):
    return httpx.Client(transport=httpx.MockTransport(h))


def test_npm_and_missing():
    def h(req):
        u = str(req.url)
        if "downloads" in u:
            return httpx.Response(200, json={"downloads": 7})
        if u.endswith("/nope"):
            return httpx.Response(404)
        return httpx.Response(200, json={"dist-tags": {"latest": "1.0.0"}, "time": {"1.0.0": "2026-01-01T00:00:00Z"},
                                         "versions": {"1.0.0": {"dependencies": {"a": "1", "b": "2"}}}})
    p = R.npm_package("x", _c(h))
    assert (p.version, p.weekly_downloads, p.dependency_count) == ("1.0.0", 7, 2)
    assert R.npm_package("nope", _c(h)) is None


def test_pypi_ignores_extras_and_leaves_downloads_unknown():
    j = {"info": {"version": "2", "requires_dist": ["a>1", "b; extra == 'dev'"]},
         "urls": [{"upload_time_iso_8601": "2026-01-01T00:00:00Z"}]}
    p = R.pypi_package("x", _c(lambda r: httpx.Response(200, json=j)))
    assert p.dependency_count == 1 and p.weekly_downloads is None


def test_hf_license_and_mcp_pagination():
    m = R._hf({"id": "a/b", "likes": 3, "tags": ["license:mit", "x"]})
    assert m.license == "mit" and m.url.endswith("a/b")
    pages = iter([{"servers": [{"server": {"name": "n", "repository": {"url": "https://github.com/o/r"}}}],
                   "metadata": {"nextCursor": "c"}},
                  {"servers": [{"server": {"name": "m"}}], "metadata": {}}])
    s = R.mcp_servers(_c(lambda r: httpx.Response(200, json=next(pages))))
    assert [x.github_repo for x in s] == ["o/r", None]
