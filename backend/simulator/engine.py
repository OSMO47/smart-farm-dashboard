"""Pure random-walk sensor simulation — ported from the old `backend/app/state.py:step()`.

No MQTT or asyncio here on purpose: `run_simulator.py` owns I/O, this module only owns the
number-crunching, so the random-walk behavior can be reasoned about (and eyeballed) in isolation.
"""

from __future__ import annotations

import random
from typing import Any

from shared.topics import PLOT_IDS

from .config import SimulatorConfig


def clamp(value: float, lo: float, hi: float) -> float:
    return max(lo, min(hi, value))


def initial_readings(config: SimulatorConfig) -> dict[str, Any]:
    soil = config.ranges["soilMoisture"]
    temp = config.ranges["temperature"]
    humidity = config.ranges["humidity"]

    plots = [
        {
            "id": pid,
            "soilMoisture": clamp(44 + ((i * 7) % 30), soil["min"], soil["max"]),
            "valveOpen": i in (1, 5),
        }
        for i, pid in enumerate(PLOT_IDS)
    ]
    return {
        "temperature": clamp(temp["min"] + random.random() * (temp["max"] - temp["min"]) * 0.4, temp["min"], temp["max"]),
        "humidity": clamp(humidity["min"] + random.random() * (humidity["max"] - humidity["min"]) * 0.4, humidity["min"], humidity["max"]),
        "plots": plots,
        "pump": True,
        "fan": False,
        "light": True,
    }


def reclamp_to_config(readings: dict[str, Any], config: SimulatorConfig) -> None:
    """Snap current values into a just-changed range immediately, instead of waiting for the
    random walk to wander there — this is what makes the control page's range fields feel responsive.
    """
    temp = config.ranges["temperature"]
    humidity = config.ranges["humidity"]
    soil = config.ranges["soilMoisture"]

    readings["temperature"] = clamp(readings["temperature"], temp["min"], temp["max"])
    readings["humidity"] = clamp(readings["humidity"], humidity["min"], humidity["max"])
    for plot in readings["plots"]:
        plot["soilMoisture"] = clamp(plot["soilMoisture"], soil["min"], soil["max"])


def step(readings: dict[str, Any], config: SimulatorConfig) -> None:
    """Advance the random walk by one tick, mutating `readings` in place."""
    temp = config.ranges["temperature"]
    humidity = config.ranges["humidity"]
    soil = config.ranges["soilMoisture"]

    fan_on = readings["fan"]
    light_on = readings["light"]
    pump_on = readings["pump"]

    readings["temperature"] = clamp(
        readings["temperature"] + (random.random() - 0.5) * 0.8 + (-0.3 if fan_on else 0) + (0.15 if light_on else 0),
        temp["min"],
        temp["max"],
    )
    readings["humidity"] = clamp(
        readings["humidity"] + (random.random() - 0.5) * 2.5 + (-1.2 if fan_on else 0.3),
        humidity["min"],
        humidity["max"],
    )

    for i, plot in enumerate(readings["plots"]):
        dry_rate = 0.4 + ((i * 13) % 10) / 18
        delta = 2.4 if (pump_on and plot["valveOpen"]) else -dry_rate
        plot["soilMoisture"] = clamp(
            plot["soilMoisture"] + (random.random() - 0.5) * 1.2 + delta,
            soil["min"],
            soil["max"],
        )
