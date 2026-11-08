import json
import re

import structlog
from pydantic import BaseModel, ValidationError

from app.ai.provider import LLM, LLMError, LLMNotConfigured

log = structlog.get_logger()


class AIOutputError(Exception):
    def __init__(self, message: str, raw: str = ""):
        super().__init__(message)
        self.raw = raw


def extract_json(text: str) -> dict:
    t = text.strip()
    t = re.sub(r"^```(?:json)?\s*|\s*```$", "", t, flags=re.S)
    try:
        v = json.loads(t)
    except ValueError:
        a, b = t.find("{"), t.rfind("}")
        if a < 0 or b <= a:
            raise
        v = json.loads(t[a:b + 1])
    if not isinstance(v, dict):
        raise ValueError("expected a JSON object")
    return v


def ask(llm: LLM, system: str, user: str, model: type[BaseModel]):
    """Call the LLM and validate with Pydantic. One repair attempt feeds the validation error back."""
    raw, err = "", ""
    for attempt in (0, 1):
        prompt = user if attempt == 0 else (
            f"{user}\n\nYour previous reply was invalid: {err}\nReply again with ONE corrected JSON object only.")
        try:
            raw = llm.complete(system, prompt)
        except LLMNotConfigured:
            raise
        except LLMError as e:
            raise AIOutputError(str(e)) from e
        try:
            return model.model_validate(extract_json(raw))
        except (ValueError, ValidationError) as e:
            err = str(e)[:600]
            log.warning("ai_output_invalid", attempt=attempt, error=err[:200])
    raise AIOutputError(f"The model returned output that failed validation: {err}", raw[:2000])
