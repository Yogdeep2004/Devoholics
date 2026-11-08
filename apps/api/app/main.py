from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.api.ai import router as ai_router
from app.api.architectures import router as arch_router
from app.api.me import router as me_router
from app.api.routes import router
from app.core.config import settings
from app.core.logging import configure_logging

configure_logging(settings.log_level)
app = FastAPI(title="DEVOHOLICS API", version="0.1.0")


app.add_middleware(CORSMiddleware, allow_origins=settings.cors_origins.split(","),
                   allow_methods=["GET", "POST", "PUT", "PATCH", "DELETE"], allow_headers=["Authorization", "Content-Type"])
app.include_router(router)
app.include_router(me_router)
app.include_router(arch_router)
app.include_router(ai_router)


@app.get("/health")
def health() -> dict:
    return {"status": "ok"}
