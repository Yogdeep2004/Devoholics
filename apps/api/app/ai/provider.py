"""Provider-agnostic LLM access over the OpenAI-compatible chat API. No key => clear 503, never a fake answer."""
import time
from typing import Protocol

import httpx
import structlog

from app.core.config import settings

log = structlog.get_logger()


class LLMError(Exception):
    pass


class LLMNotConfigured(LLMError):
    pass


class LLM(Protocol):
    def complete(self, system: str, user: str) -> str: ...


class OpenAICompatLLM:
    def __init__(self, base_url: str, api_key: str, model: str, client: httpx.Client | None = None,
                 sleep=time.sleep, max_retries: int = 3):
        self.model, self._sleep, self._retries = model, sleep, max_retries
        self._c = client or httpx.Client(base_url=base_url.rstrip("/"), timeout=60,
                                         headers={"Authorization": f"Bearer {api_key}"})

    def complete(self, system: str, user: str) -> str:
        body = {"model": self.model, "temperature": 0.2,
                "messages": [{"role": "system", "content": system}, {"role": "user", "content": user}],
                "response_format": {"type": "json_object"}}
        for attempt in range(self._retries + 1):
            try:
                r = self._c.post("/chat/completions", json=body)
            except httpx.TransportError as e:
                if attempt == self._retries:
                    raise LLMError(f"LLM unreachable: {e}") from e
                self._sleep(2**attempt); continue
            if r.status_code == 400 and "response_format" in body and "response_format" in r.text:
                body.pop("response_format")  # model/provider without JSON mode: rely on prompt + validation
                continue
            if r.status_code in (429, 500, 502, 503) and attempt < self._retries:
                self._sleep(min(float(r.headers.get("retry-after", 2**attempt)), 20)); continue
            if r.status_code >= 400:
                raise LLMError(f"LLM error {r.status_code}: {r.text[:200]}")
            try:
                return r.json()["choices"][0]["message"]["content"] or ""
            except (KeyError, IndexError, ValueError) as e:
                raise LLMError("malformed LLM response") from e
        raise LLMError("LLM retries exhausted")


NOT_CONFIGURED = "AI assistant is not configured: set LLM_API_KEY (free key at console.groq.com)"


class NotConfiguredLLM:
    def complete(self, system: str, user: str) -> str:
        raise LLMNotConfigured(NOT_CONFIGURED)


def get_llm() -> LLM:
    if not settings.llm_api_key:
        return NotConfiguredLLM()
    return OpenAICompatLLM(settings.llm_base_url, settings.llm_api_key, settings.llm_model)
