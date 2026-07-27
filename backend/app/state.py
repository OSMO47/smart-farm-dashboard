"""In-memory cache of the zone's last-known state, kept up to date by `mqtt_bridge.py`.

Phase 3: this module no longer randomizes anything itself — `backend/simulator/run_simulator.py`
is the source of truth for sensor values, publishing over MQTT. This module just holds the last
values the bridge has seen so `GET /api/zone1/status` has something to serve, including before
the bridge's first message arrives (via `_default_state()`) or if the simulator is unreachable.
"""

from __future__ import annotations

from datetime import datetime, timezone
from typing import Any

from shared.topics import PLOT_IDS


def clamp(value: float, lo: float, hi: float) -> float:
    return max(lo, min(hi, value))


def now_iso() -> str:
    return datetime.now(timezone.utc).isoformat()


def _default_state() -> dict[str, Any]:
    plots = [
        {"id": pid, "soilMoisture": 44 + ((i * 7) % 30), "valveOpen": i in (1, 5)}
        for i, pid in enumerate(PLOT_IDS)
    ]
    return {
        "zoneId": "zone1",
        "zoneName": "โซน 1",
        "temperature": 22.0,
        "humidity": 65.0,
        "soilMoisture": 55.0,
        "timestamp": now_iso(),
        "pump": True,
        "fan": False,
        "light": True,
        "plots": plots,
    }


state: dict[str, Any] = _default_state()


def _recompute_soil_average() -> None:
    plots = state["plots"]
    state["soilMoisture"] = sum(p["soilMoisture"] for p in plots) / len(plots)


def apply_sensor_reading(field: str, value: float, timestamp: str) -> None:
    """`field` is 'temperature' or 'humidity'."""
    state[field] = value
    state["timestamp"] = timestamp


def apply_plot_soil(plot_id: str, value: float, timestamp: str) -> None:
    for plot in state["plots"]:
        if plot["id"] == plot_id:
            plot["soilMoisture"] = value
            break
    _recompute_soil_average()
    state["timestamp"] = timestamp


def apply_actuator_state(device: str, on: bool) -> None:
    state[device] = on


def apply_valve_state(plot_id: str, open_: bool) -> None:
    for plot in state["plots"]:
        if plot["id"] == plot_id:
            plot["valveOpen"] = open_
            break
