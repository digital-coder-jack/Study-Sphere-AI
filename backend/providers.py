"""
=====================================================================
 STUDY SPHERE AI  -  backend/providers.py
=====================================================================
Multi-provider AI layer with automatic fallback, load balancing,
response caching and unified streaming.

Providers (all free-tier compatible, OpenAI-compatible chat APIs):
  * Kimi    (Moonshot AI)   -> primary       KIMI_API_KEY
  * Gemini  (Google)        -> secondary     GEMINI_API_KEY
  * Groq    (Llama / etc.)  -> tertiary       GROQ_API_KEY

Fallback chain (Auto mode):
  Kimi -> Gemini -> Groq -> graceful error

If the user pins a specific provider, that provider is tried first and
the remaining providers are used as fallbacks (unless STRICT_PROVIDER
is requested by the caller).

Keys are read ONLY from environment variables — never hardcoded and
never exposed to the frontend.
=====================================================================
"""

from __future__ import annotations

import asyncio
import hashlib
import json
import logging
import os
import time
from typing import AsyncGenerator

import httpx

logger = logging.getLogger("study-sphere.providers")

# ---------------------------------------------------------------------------
# Provider definitions
# ---------------------------------------------------------------------------
# Each provider speaks the OpenAI /chat/completions wire format (Kimi and
# Groq natively; Gemini via its OpenAI-compatibility endpoint), so a single
# request/response code path handles all three.
PROVIDERS: dict[str, dict] = {
    "kimi": {
        "label": "Kimi (Moonshot)",
        "env": "KIMI_API_KEY",
        "url": "https://api.moonshot.ai/v1/chat/completions",
        "default_model": os.environ.get("KIMI_MODEL", "moonshot-v1-8k"),
    },
    "gemini": {
        "label": "Google Gemini",
        "env": "GEMINI_API_KEY",
        # Gemini exposes an OpenAI-compatible endpoint:
        "url": "https://generativelanguage.googleapis.com/v1beta/openai/chat/completions",
        "default_model": os.environ.get("GEMINI_MODEL", "gemini-1.5-flash"),
    },
    "groq": {
        "label": "Groq",
        "env": "GROQ_API_KEY",
        "url": "https://api.groq.com/openai/v1/chat/completions",
        "default_model": os.environ.get("GROQ_MODEL", "llama-3.3-70b-versatile"),
    },
}

# Canonical fallback order for Auto mode.
DEFAULT_ORDER = ["kimi", "gemini", "groq"]

VALID_SELECTIONS = ["auto", "kimi", "gemini", "groq"]


def provider_key(name: str) -> str:
    return os.environ.get(PROVIDERS[name]["env"], "").strip()


def provider_available(name: str) -> bool:
    return name in PROVIDERS and bool(provider_key(name))


def available_providers() -> list[str]:
    return [p for p in DEFAULT_ORDER if provider_available(p)]


def resolve_order(selection: str | None) -> list[str]:
    """
    Return the ordered list of providers to try for a given user selection.

    * "auto" / None  -> all configured providers in DEFAULT_ORDER.
    * a provider name -> that provider first, then the rest as fallbacks.
    Only providers that actually have an API key configured are returned.
    """
    selection = (selection or "auto").lower()
    configured = available_providers()
    if selection == "auto" or selection not in PROVIDERS:
        return configured
    # Pinned provider first, remaining configured providers after it.
    order = [selection] if provider_available(selection) else []
    order += [p for p in configured if p != selection]
    return order


def status_snapshot() -> dict:
    """Lightweight status used by the /api/ai/status monitoring endpoint."""
    return {
        "providers": [
            {
                "id": name,
                "label": meta["label"],
                "configured": provider_available(name),
                "model": meta["default_model"],
            }
            for name, meta in PROVIDERS.items()
        ],
        "order": DEFAULT_ORDER,
        "any_configured": bool(available_providers()),
    }


# ---------------------------------------------------------------------------
# Simple in-memory response cache (per-process; safe for serverless warm
# instances). Keyed by a hash of the provider order + messages + params.
# ---------------------------------------------------------------------------
_CACHE: dict[str, tuple[float, str]] = {}
_CACHE_TTL = int(os.environ.get("AI_CACHE_TTL", "900"))  # 15 minutes
_CACHE_MAX = 256


def _cache_key(order, messages, temperature, max_tokens) -> str:
    raw = json.dumps(
        {"o": order, "m": messages, "t": temperature, "k": max_tokens},
        sort_keys=True,
        separators=(",", ":"),
    )
    return hashlib.sha256(raw.encode("utf-8")).hexdigest()


def _cache_get(key: str) -> str | None:
    hit = _CACHE.get(key)
    if not hit:
        return None
    ts, value = hit
    if time.time() - ts > _CACHE_TTL:
        _CACHE.pop(key, None)
        return None
    return value


def _cache_set(key: str, value: str) -> None:
    if len(_CACHE) >= _CACHE_MAX:
        # Drop the oldest entry.
        oldest = min(_CACHE, key=lambda k: _CACHE[k][0])
        _CACHE.pop(oldest, None)
    _CACHE[key] = (time.time(), value)


def _headers(name: str) -> dict:
    return {
        "Authorization": f"Bearer {provider_key(name)}",
        "Content-Type": "application/json",
    }


def _payload(name: str, messages, temperature, max_tokens, stream=False) -> dict:
    return {
        "model": PROVIDERS[name]["default_model"],
        "messages": messages,
        "temperature": temperature,
        "max_tokens": max_tokens,
        "stream": stream,
    }


_NOT_CONFIGURED = (
    "🤖 AI is not configured yet. Set at least one of KIMI_API_KEY, "
    "GEMINI_API_KEY or GROQ_API_KEY to enable AI features."
)
_ALL_FAILED = (
    "⚠️ All AI providers are currently unavailable. Please try again in a "
    "moment."
)


# ---------------------------------------------------------------------------
# Non-streaming completion with automatic fallback + caching
# ---------------------------------------------------------------------------
async def chat(
    messages: list[dict],
    *,
    selection: str | None = "auto",
    temperature: float = 0.7,
    max_tokens: int = 1024,
    use_cache: bool = True,
) -> tuple[str, str]:
    """
    Return (provider_used, text). Tries each provider in order until one
    succeeds. Falls back to a graceful message if all fail / none configured.
    """
    order = resolve_order(selection)
    if not order:
        return ("none", _NOT_CONFIGURED)

    key = _cache_key(order, messages, temperature, max_tokens)
    if use_cache:
        cached = _cache_get(key)
        if cached is not None:
            return ("cache", cached)

    last_error = None
    for name in order:
        try:
            async with httpx.AsyncClient(timeout=60) as client:
                resp = await client.post(
                    PROVIDERS[name]["url"],
                    json=_payload(name, messages, temperature, max_tokens),
                    headers=_headers(name),
                )
                resp.raise_for_status()
                data = resp.json()
                text = data["choices"][0]["message"]["content"].strip()
                if text:
                    if use_cache:
                        _cache_set(key, text)
                    logger.info("AI completion served by '%s'", name)
                    return (name, text)
        except httpx.HTTPStatusError as exc:
            last_error = f"{name}:{exc.response.status_code}"
            logger.warning("Provider %s failed (%s); falling back.", name, last_error)
        except Exception as exc:  # noqa: BLE001
            last_error = f"{name}:{type(exc).__name__}"
            logger.warning("Provider %s error (%s); falling back.", name, last_error)

    logger.error("All AI providers failed. Last error: %s", last_error)
    return ("error", _ALL_FAILED)


# ---------------------------------------------------------------------------
# Streaming completion with automatic fallback
# ---------------------------------------------------------------------------
# Total wall-clock budget for one streamed reply, and the maximum gap allowed
# between two tokens (detects a silently stalled upstream connection).
_STREAM_TOTAL_TIMEOUT = int(os.environ.get("AI_STREAM_TIMEOUT", "120"))
_STREAM_IDLE_TIMEOUT = int(os.environ.get("AI_STREAM_IDLE_TIMEOUT", "30"))


async def chat_stream(
    messages: list[dict],
    *,
    selection: str | None = "auto",
    temperature: float = 0.7,
    max_tokens: int = 1024,
    cancel_event: "asyncio.Event | None" = None,
) -> AsyncGenerator[tuple[str, str], None]:
    """
    Async generator yielding (event, value) tuples:
       ("meta",     provider_name)   emitted once when a provider starts streaming
       ("token",    text_chunk)      incremental content
       ("cancelled", reason)         the stream was cancelled / superseded
       ("error",    {type,message})  structured failure (network/timeout/http/none)

    Behaviour guarantees:
      * Fallback to the next provider only happens BEFORE the first token of a
        provider is emitted; once output started we stay with it.
      * If ``cancel_event`` is set at any point, streaming stops promptly and a
        ("cancelled", ...) event is emitted instead of more tokens.
      * A per-token idle timeout and an overall timeout protect against a
        silently stalled upstream connection.
    """
    order = resolve_order(selection)
    if not order:
        yield ("error", {"type": "not_configured", "message": _NOT_CONFIGURED})
        return

    if cancel_event is not None and cancel_event.is_set():
        yield ("cancelled", "cancelled before start")
        return

    deadline = time.monotonic() + _STREAM_TOTAL_TIMEOUT
    last_error: dict | None = None

    for name in order:
        produced = False
        try:
            timeout = httpx.Timeout(connect=15.0, read=_STREAM_IDLE_TIMEOUT, write=15.0, pool=15.0)
            async with httpx.AsyncClient(timeout=timeout) as client:
                async with client.stream(
                    "POST",
                    PROVIDERS[name]["url"],
                    json=_payload(name, messages, temperature, max_tokens, stream=True),
                    headers=_headers(name),
                ) as resp:
                    if resp.status_code != 200:
                        body = await resp.aread()
                        last_error = {
                            "type": "http",
                            "message": f"{name} returned {resp.status_code}",
                            "status": resp.status_code,
                        }
                        logger.warning("Stream %s failed (%s); falling back.", name, body[:200])
                        continue

                    line_iter = resp.aiter_lines().__aiter__()
                    while True:
                        # Cooperative cancellation check between every chunk.
                        if cancel_event is not None and cancel_event.is_set():
                            yield ("cancelled", "superseded by a newer request")
                            return
                        if time.monotonic() > deadline:
                            if produced:
                                yield ("token", "\n\n⚠️ Response timed out.")
                                return
                            last_error = {"type": "timeout", "message": f"{name} exceeded time budget"}
                            break

                        try:
                            # Idle-timeout each line read so a stalled socket
                            # cannot hang the whole request forever.
                            line = await asyncio.wait_for(
                                line_iter.__anext__(), timeout=_STREAM_IDLE_TIMEOUT
                            )
                        except StopAsyncIteration:
                            break
                        except asyncio.TimeoutError:
                            if produced:
                                yield ("token", "\n\n⚠️ The response stalled and was stopped.")
                                return
                            last_error = {"type": "timeout", "message": f"{name} stalled"}
                            break

                        line = line.strip()
                        if not line or not line.startswith("data:"):
                            continue
                        data = line[len("data:"):].strip()
                        if data == "[DONE]":
                            break
                        try:
                            chunk = json.loads(data)
                            token = chunk["choices"][0]["delta"].get("content")
                        except (json.JSONDecodeError, KeyError, IndexError):
                            continue
                        if token:
                            if not produced:
                                produced = True
                                yield ("meta", name)
                            yield ("token", token)
            if produced:
                logger.info("AI stream served by '%s'", name)
                return
        except (httpx.ConnectError, httpx.ConnectTimeout) as exc:
            last_error = {"type": "network", "message": f"Could not reach {name}: {type(exc).__name__}"}
            logger.warning("Stream %s network error (%s); falling back.", name, last_error)
        except httpx.ReadTimeout as exc:
            last_error = {"type": "timeout", "message": f"{name} read timed out"}
            logger.warning("Stream %s read timeout; falling back.", name)
            if produced:
                yield ("token", "\n\n⚠️ The connection timed out.")
                return
        except Exception as exc:  # noqa: BLE001
            last_error = {"type": "network", "message": f"{name}: {type(exc).__name__}"}
            logger.warning("Stream %s error (%s); falling back.", name, last_error)
            if produced:
                # Already streamed partial output; surface interruption inline.
                yield ("token", "\n\n⚠️ The connection was interrupted.")
                return

    logger.error("All AI providers failed to stream. Last error: %s", last_error)
    yield ("error", last_error or {"type": "unavailable", "message": _ALL_FAILED})
