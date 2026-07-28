"""Backend-side watering scheduler.

Runs inside the same long-lived backend process as MqttBridge (started/stopped alongside it in
main.py's lifespan) so per-plot watering schedules keep firing even with no browser tab open —
unlike the rule-based auto mode in src/lib/automation.ts, which only runs client-side.

Every tick, re-fetches the (small) schedule table from Supabase and compares each enabled plot's
[start, start+duration) window against the current Asia/Bangkok time. Commands are only sent on
the *edge* (window just started / just ended), never on every tick — this is what lets a user
manually close a valve mid-window without the scheduler immediately reopening it; it only acts
again at the next day's start-of-window edge.
"""

from __future__ import annotations

import asyncio
import logging
from datetime import datetime
from datetime import time as dt_time
from zoneinfo import ZoneInfo

import httpx

from shared import topics

from . import supabase_client
from .mqtt_bridge import MqttBridge

logger = logging.getLogger("scheduler")

CHECK_INTERVAL_SECONDS = 20
LOCAL_TZ = ZoneInfo("Asia/Bangkok")


def _parse_time(value: str) -> dt_time:
    hour, minute = value.split(":")[:2]
    return dt_time(int(hour), int(minute))


def _is_within_window(now: dt_time, start: dt_time, duration_minutes: int) -> bool:
    start_minutes = start.hour * 60 + start.minute
    now_minutes = now.hour * 60 + now.minute
    end_minutes = start_minutes + duration_minutes
    if end_minutes <= 24 * 60:
        return start_minutes <= now_minutes < end_minutes
    return now_minutes >= start_minutes or now_minutes < end_minutes - 24 * 60  # spans midnight


class WateringScheduler:
    def __init__(self, bridge: MqttBridge) -> None:
        self._bridge = bridge
        self._was_active: dict[str, bool] = {}
        self._task: asyncio.Task[None] | None = None

    def start(self) -> None:
        self._task = asyncio.create_task(self._loop())

    async def stop(self) -> None:
        if self._task is not None:
            self._task.cancel()

    async def _loop(self) -> None:
        while True:
            await self._tick()
            await asyncio.sleep(CHECK_INTERVAL_SECONDS)

    async def _tick(self) -> None:
        try:
            schedules = await supabase_client.fetch_schedules()
        except httpx.HTTPError:
            # a transient Supabase hiccup must not touch valves that are already correctly
            # positioned — just skip this tick and try again in CHECK_INTERVAL_SECONDS.
            logger.exception("Failed to fetch watering schedules, skipping this tick")
            return

        now = datetime.now(LOCAL_TZ).time()
        for schedule in schedules:
            is_active = schedule["enabled"] and _is_within_window(
                now, _parse_time(schedule["startTime"]), schedule["durationMinutes"]
            )
            await self._apply_edge(schedule["plotId"], is_active)

    async def _apply_edge(self, plot_id: str, is_active: bool) -> None:
        was_active = self._was_active.get(plot_id, False)
        if is_active == was_active:
            return
        self._was_active[plot_id] = is_active
        try:
            await self._bridge.publish_and_await(topics.valve_cmd_topic(plot_id), {"open": is_active})
            logger.info("schedule: %s valve %s", "open" if is_active else "close", plot_id)
        except asyncio.TimeoutError:
            logger.warning(
                "schedule: simulator did not acknowledge %s valve %s in time — will retry next tick",
                "open" if is_active else "close",
                plot_id,
            )
            self._was_active[plot_id] = was_active
