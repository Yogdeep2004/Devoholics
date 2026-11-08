from sqlalchemy import create_engine, func, select
from sqlalchemy.orm import Session

import app.models as m
from app.db import Base
from app.services.seed import seed_catalog


def test_reseeding_after_a_github_rename_does_not_duplicate_repositories():
    eng = create_engine("sqlite://"); Base.metadata.create_all(eng)
    with Session(eng) as s:
        seed_catalog(s)
        before = s.scalar(select(func.count(m.Repository.id)))
        r = s.scalar(select(m.Repository).join(m.Technology).where(m.Technology.slug == "react"))
        r.repository_url, r.external_id = "https://github.com/react/react", "10270250"  # what sync does after a redirect
        s.commit()
        seed_catalog(s); seed_catalog(s)
        assert s.scalar(select(func.count(m.Repository.id))) == before
        t = s.scalar(select(m.Technology).where(m.Technology.slug == "react"))
        assert len(t.repositories) == 1 and t.repositories[0].repository_url == "https://github.com/react/react"
