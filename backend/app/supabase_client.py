"""Thin async wrapper around Supabase's PostgREST HTTP API — just the one insert shape and one
filtered select this project needs, so there's no reason to pull in the full supabase-py SDK.
"""

from __future__ import annotations

import logging
import os
from datetime import datetime, timezone
from typing import Any

import httpx
from dotenv import load_dotenv

load_dotenv()

logger = logging.getLogger("supabase_client")


def _now_iso() -> str:
    return datetime.now(timezone.utc).isoformat()

SUPABASE_URL = os.environ.get("SUPABASE_URL", "").rstrip("/")
SUPABASE_SECRET_KEY = os.environ.get("SUPABASE_SECRET_KEY", "")

_HEADERS = {
    "apikey": SUPABASE_SECRET_KEY,
    "Authorization": f"Bearer {SUPABASE_SECRET_KEY}",
    "Content-Type": "application/json",
}


async def insert_reading(temperature: float, humidity: float, soil_moisture: float, recorded_at: str) -> None:
    """Fire-and-forget insert of one sensor_readings row. Never raises — a Supabase hiccup must
    not take down the MQTT dispatch loop that calls this."""
    if not SUPABASE_URL or not SUPABASE_SECRET_KEY:
        return
    row = {
        "zone_id": "zone1",
        "temperature": temperature,
        "humidity": humidity,
        "soil_moisture": soil_moisture,
        "recorded_at": recorded_at,
    }
    try:
        async with httpx.AsyncClient(timeout=5.0) as client:
            res = await client.post(
                f"{SUPABASE_URL}/rest/v1/sensor_readings",
                headers={**_HEADERS, "Prefer": "return=minimal"},
                json=row,
            )
            res.raise_for_status()
    except httpx.HTTPError:
        logger.exception("Failed to persist sensor reading to Supabase")


async def fetch_history(since_iso: str, limit: int = 2000) -> list[dict[str, Any]]:
    """Rows for zone1 since `since_iso`, oldest first. Raises httpx.HTTPError on failure —
    callers should turn that into a 502 rather than silently returning nothing."""
    async with httpx.AsyncClient(timeout=5.0) as client:
        res = await client.get(
            f"{SUPABASE_URL}/rest/v1/sensor_readings",
            headers=_HEADERS,
            params={
                "zone_id": "eq.zone1",
                "recorded_at": f"gte.{since_iso}",
                "order": "recorded_at.asc",
                "limit": str(limit),
            },
        )
        res.raise_for_status()
        rows = res.json()

    return [
        {
            "temperature": row["temperature"],
            "humidity": row["humidity"],
            "soilAvg": row["soil_moisture"],
            "timestamp": row["recorded_at"],
        }
        for row in rows
    ]


def _schedule_row_to_dict(row: dict[str, Any]) -> dict[str, Any]:
    return {
        "plotId": row["plot_id"],
        # Postgres `time` comes back as "HH:MM:SS" — trim to "HH:MM" for the frontend <input type="time">.
        "startTime": row["start_time"][:5],
        "durationMinutes": row["duration_minutes"],
        "enabled": row["enabled"],
    }


async def fetch_schedules() -> list[dict[str, Any]]:
    """All watering schedule rows. Raises httpx.HTTPError on failure."""
    async with httpx.AsyncClient(timeout=5.0) as client:
        res = await client.get(f"{SUPABASE_URL}/rest/v1/watering_schedules", headers=_HEADERS)
        res.raise_for_status()
        rows = res.json()
    return [_schedule_row_to_dict(row) for row in rows]


async def upsert_schedule(plot_id: str, start_time: str, duration_minutes: int, enabled: bool) -> dict[str, Any]:
    """Insert or update the one schedule row for `plot_id`. Raises httpx.HTTPError on failure."""
    row = {
        "plot_id": plot_id,
        "start_time": start_time,
        "duration_minutes": duration_minutes,
        "enabled": enabled,
        "updated_at": _now_iso(),
    }
    async with httpx.AsyncClient(timeout=5.0) as client:
        res = await client.post(
            f"{SUPABASE_URL}/rest/v1/watering_schedules",
            headers={**_HEADERS, "Prefer": "resolution=merge-duplicates,return=representation"},
            params={"on_conflict": "plot_id"},
            json=row,
        )
        res.raise_for_status()
        saved = res.json()
    return _schedule_row_to_dict(saved[0])
