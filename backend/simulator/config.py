"""Runtime-adjustable simulator configuration — backs the frontend's Simulator Control page.

Defaults match the min/max bounds `backend/app/state.py`'s old `step()` used to hardcode, so
behavior is unchanged until someone actually opens the control page and changes something.
"""

from __future__ import annotations

from dataclasses import dataclass, field
from typing import Any

METRICS = ("temperature", "humidity", "soilMoisture")

DEFAULT_RANGES: dict[str, dict[str, float]] = {
    "temperature": {"min": 14.0, "max": 33.0},
    "humidity": {"min": 40.0, "max": 97.0},
    "soilMoisture": {"min": 22.0, "max": 90.0},
}

# Sanity bounds a range patch may never exceed, regardless of what the control page requests.
ABSOLUTE_BOUNDS: dict[str, tuple[float, float]] = {
    "temperature": (0.0, 50.0),
    "humidity": (0.0, 100.0),
    "soilMoisture": (0.0, 100.0),
}


def validate_range(metric: str, lo: float, hi: float) -> None:
    if lo >= hi:
        msg = f"{metric}: min ({lo}) must be less than max ({hi})"
        raise ValueError(msg)
    abs_lo, abs_hi = ABSOLUTE_BOUNDS[metric]
    if lo < abs_lo or hi > abs_hi:
        msg = f"{metric}: range must be within [{abs_lo}, {abs_hi}]"
        raise ValueError(msg)


@dataclass
class SimulatorConfig:
    paused: bool = False
    ranges: dict[str, dict[str, float]] = field(
        default_factory=lambda: {metric: dict(bounds) for metric, bounds in DEFAULT_RANGES.items()}
    )

    def to_dict(self) -> dict[str, Any]:
        return {
            "paused": self.paused,
            "ranges": {metric: dict(bounds) for metric, bounds in self.ranges.items()},
        }

    def apply_patch(self, patch: dict[str, Any]) -> None:
        """Merge a partial config patch in place. Raises ValueError on an invalid range."""
        if "paused" in patch:
            self.paused = bool(patch["paused"])
        if "ranges" in patch:
            for metric, bounds in patch["ranges"].items():
                if metric not in METRICS:
                    msg = f"unknown metric '{metric}'"
                    raise ValueError(msg)
                current = self.ranges[metric]
                lo = float(bounds["min"]) if "min" in bounds else current["min"]
                hi = float(bounds["max"]) if "max" in bounds else current["max"]
                validate_range(metric, lo, hi)
                self.ranges[metric] = {"min": lo, "max": hi}
