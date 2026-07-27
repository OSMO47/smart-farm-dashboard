"""MQTT topic names and payload helpers shared by the broker launcher, the simulator process,
and the FastAPI backend's MQTT bridge. Defined once here so the three processes can never drift
apart on topic strings or payload shape.
"""

from __future__ import annotations

import json
from datetime import datetime, timezone
from typing import Any, Literal

PLOT_IDS = ["A1", "A2", "A3", "A4", "B1", "B2", "B3", "B4"]

DeviceName = Literal["pump", "fan", "light"]
DEVICE_NAMES: list[DeviceName] = ["pump", "fan", "light"]

# --- Sensors — simulator publishes, RETAINED ---
SENSOR_TEMPERATURE = "farm/zone1/sensor/temperature"
SENSOR_HUMIDITY = "farm/zone1/sensor/humidity"


def sensor_soil_moisture_topic(plot_id: str) -> str:
    return f"farm/zone1/sensor/soil_moisture/{plot_id}"


SENSOR_SOIL_MOISTURE_WILDCARD = "farm/zone1/sensor/soil_moisture/+"

# --- Actuators (zone-wide): cmd from backend (NOT retained), state from simulator (RETAINED) ---


def actuator_cmd_topic(device: DeviceName) -> str:
    return f"farm/zone1/actuator/{device}/cmd"


def actuator_state_topic(device: DeviceName) -> str:
    return f"farm/zone1/actuator/{device}/state"


ACTUATOR_CMD_WILDCARD = "farm/zone1/actuator/+/cmd"
ACTUATOR_STATE_WILDCARD = "farm/zone1/actuator/+/state"

# --- Valves (per plot): cmd from backend (NOT retained), state from simulator (RETAINED) ---


def valve_cmd_topic(plot_id: str) -> str:
    return f"farm/zone1/plot/{plot_id}/valve/cmd"


def valve_state_topic(plot_id: str) -> str:
    return f"farm/zone1/plot/{plot_id}/valve/state"


VALVE_CMD_WILDCARD = "farm/zone1/plot/+/valve/cmd"
VALVE_STATE_WILDCARD = "farm/zone1/plot/+/valve/state"

# --- Simulator control — backs the Simulator Control page ---
SIM_CONFIG_CMD = "farm/zone1/sim/config/cmd"
SIM_CONFIG_STATE = "farm/zone1/sim/config/state"
SIM_STATUS = "farm/zone1/sim/status"

# --- Reserved for later phases — names only, no code yet ---
CAMERA_CAPTURE = "farm/zone1/camera/capture"
AI_DETECTION = "farm/zone1/ai/detection"
SYSTEM_ALERT = "farm/system/alert"


def now_iso() -> str:
    return datetime.now(timezone.utc).isoformat()


def encode(payload: dict[str, Any]) -> bytes:
    return json.dumps(payload).encode("utf-8")


def decode(data: bytes | bytearray) -> dict[str, Any]:
    return json.loads(bytes(data).decode("utf-8"))


def build_sensor_payload(value: float) -> dict[str, Any]:
    return {"value": value, "timestamp": now_iso()}


def build_plot_sensor_payload(plot_id: str, value: float) -> dict[str, Any]:
    return {"plotId": plot_id, "value": value, "timestamp": now_iso()}


def build_actuator_payload(on: bool, request_id: str | None = None) -> dict[str, Any]:
    payload: dict[str, Any] = {"on": on, "timestamp": now_iso()}
    if request_id is not None:
        payload["requestId"] = request_id
    return payload


def build_valve_payload(open_: bool, request_id: str | None = None) -> dict[str, Any]:
    payload: dict[str, Any] = {"open": open_, "timestamp": now_iso()}
    if request_id is not None:
        payload["requestId"] = request_id
    return payload


def build_config_state_payload(config_dict: dict[str, Any], request_id: str | None = None) -> dict[str, Any]:
    payload: dict[str, Any] = {**config_dict, "timestamp": now_iso()}
    if request_id is not None:
        payload["requestId"] = request_id
    return payload
