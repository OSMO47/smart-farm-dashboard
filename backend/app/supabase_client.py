"""Thin async wrapper around Supabase's PostgREST HTTP API — just the one insert shape and one
filtered select this project needs, so there's no reason to pull in the full supabase-py SDK.
"""

from __future__ import annotations

import logging
import os
from typing import Any

import httpx
from dotenv import load_dotenv

load_dotenv()

logger = logging.getLogger("supabase_client")

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
