"""MQTT-connected simulator process (Phase 3) — replaces `backend/app/state.py`'s old `step()`.

Publishes fake sensor readings on a timer, reacts to actuator/valve commands immediately, and
exposes a config channel (paused + value ranges) so the frontend's Simulator Control page can
drive it live. Run with:  python -m simulator.run_simulator
"""

from __future__ import annotations

import asyncio
import logging
from typing import Any

from amqtt.client import MQTTClient
from amqtt.mqtt.constants import QOS_0

from shared import topics

from . import engine
from .config import SimulatorConfig

logging.basicConfig(level=logging.INFO, format="%(asctime)s %(name)s %(levelname)s %(message)s")
logging.getLogger("amqtt").setLevel(logging.WARNING)
logging.getLogger("transitions").setLevel(logging.WARNING)
logger = logging.getLogger("simulator")

BROKER_URI = "mqtt://localhost:1883/"
TICK_SECONDS = 5

OFFLINE_STATUS = topics.encode({"running": False, "paused": False, "lastTick": None, "timestamp": topics.now_iso()})

CLIENT_CONFIG = {
    "auto_reconnect": True,
    "reconnect_retries": -1,
    "reconnect_max_interval": 10,
    "will": {
        "topic": topics.SIM_STATUS,
        "message": OFFLINE_STATUS.decode("utf-8"),
        "qos": QOS_0,
        "retain": True,
    },
}

SUBSCRIBE_TOPICS = [
    (topics.ACTUATOR_CMD_WILDCARD, QOS_0),
    (topics.VALVE_CMD_WILDCARD, QOS_0),
    (topics.SIM_CONFIG_CMD, QOS_0),
]


class Simulator:
    def __init__(self) -> None:
        self.client = MQTTClient(client_id="simulator", config=CLIENT_CONFIG)
        self.config = SimulatorConfig()
        self.readings = engine.initial_readings(self.config)

    async def run(self) -> None:
        # auto_reconnect + reconnect_retries=-1 makes this retry indefinitely with backoff
        # if the broker isn't up yet — no manual retry loop needed here.
        await self.client.connect(BROKER_URI)
        await self.client.subscribe(SUBSCRIBE_TOPICS)
        logger.info("Connected to broker, subscribed to cmd topics")
        await self.publish_full_snapshot()
        await asyncio.gather(self.receive_loop(), self.tick_loop())

    async def publish_full_snapshot(self) -> None:
        """Publish every retained topic on connect, covering the case where the *broker* itself
        restarted and lost its retained-message store (not just this process restarting)."""
        await self.publish_sensors()
        for device in topics.DEVICE_NAMES:
            await self._publish_actuator_state(device, self.readings[device])
        for plot in self.readings["plots"]:
            await self._publish_valve_state(plot["id"], plot["valveOpen"])
        await self.publish_config_state()
        await self.publish_status()

    async def publish_sensors(self) -> None:
        await self.client.publish(
            topics.SENSOR_TEMPERATURE,
            topics.encode(topics.build_sensor_payload(self.readings["temperature"])),
            qos=QOS_0,
            retain=True,
        )
        await self.client.publish(
            topics.SENSOR_HUMIDITY,
            topics.encode(topics.build_sensor_payload(self.readings["humidity"])),
            qos=QOS_0,
            retain=True,
        )
        for plot in self.readings["plots"]:
            await self.client.publish(
                topics.sensor_soil_moisture_topic(plot["id"]),
                topics.encode(topics.build_plot_sensor_payload(plot["id"], plot["soilMoisture"])),
                qos=QOS_0,
                retain=True,
            )

    async def _publish_actuator_state(self, device: str, on: bool, request_id: str | None = None) -> None:
        await self.client.publish(
            topics.actuator_state_topic(device),
            topics.encode(topics.build_actuator_payload(on, request_id)),
            qos=QOS_0,
            retain=True,
        )

    async def _publish_valve_state(self, plot_id: str, open_: bool, request_id: str | None = None) -> None:
        await self.client.publish(
            topics.valve_state_topic(plot_id),
            topics.encode(topics.build_valve_payload(open_, request_id)),
            qos=QOS_0,
            retain=True,
        )

    async def publish_config_state(self, request_id: str | None = None) -> None:
        await self.client.publish(
            topics.SIM_CONFIG_STATE,
            topics.encode(topics.build_config_state_payload(self.config.to_dict(), request_id)),
            qos=QOS_0,
            retain=True,
        )

    async def publish_status(self, last_tick: str | None = None) -> None:
        await self.client.publish(
            topics.SIM_STATUS,
            topics.encode(
                {
                    "running": True,
                    "paused": self.config.paused,
                    "lastTick": last_tick,
                    "timestamp": topics.now_iso(),
                }
            ),
            qos=QOS_0,
            retain=True,
        )

    async def handle_message(self, topic: str, payload: dict[str, Any]) -> None:
        request_id = payload.get("requestId")

        if topic.startswith("farm/zone1/actuator/") and topic.endswith("/cmd"):
            device = topic.split("/")[3]
            if device in topics.DEVICE_NAMES and "on" in payload:
                self.readings[device] = bool(payload["on"])
                logger.info("cmd: %s -> %s", device, self.readings[device])
                await self._publish_actuator_state(device, self.readings[device], request_id)
            return

        if topic.startswith("farm/zone1/plot/") and topic.endswith("/valve/cmd"):
            plot_id = topic.split("/")[3]
            plot = next((p for p in self.readings["plots"] if p["id"] == plot_id), None)
            if plot is not None and "open" in payload:
                plot["valveOpen"] = bool(payload["open"])
                logger.info("cmd: valve %s -> %s", plot_id, plot["valveOpen"])
                await self._publish_valve_state(plot_id, plot["valveOpen"], request_id)
            return

        if topic == topics.SIM_CONFIG_CMD:
            try:
                self.config.apply_patch(payload)
            except ValueError:
                logger.exception("Rejected invalid simulator config patch: %s", payload)
                return
            engine.reclamp_to_config(self.readings, self.config)
            logger.info("config updated: paused=%s ranges=%s", self.config.paused, self.config.ranges)
            await self.publish_config_state(request_id)
            # a range/pause change should be visible immediately, not only on the next 5s tick
            await self.publish_sensors()

    async def receive_loop(self) -> None:
        while True:
            try:
                message = await self.client.deliver_message()
            except Exception:
                logger.exception("Error while waiting for message")
                await asyncio.sleep(1)
                continue
            try:
                payload = topics.decode(message.data)
            except ValueError:
                logger.warning("Ignoring malformed payload on %s", message.topic)
                continue
            await self.handle_message(message.topic, payload)

    async def tick_loop(self) -> None:
        while True:
            await asyncio.sleep(TICK_SECONDS)
            if self.config.paused:
                continue
            engine.step(self.readings, self.config)
            await self.publish_sensors()
            await self.publish_status(last_tick=topics.now_iso())


async def main() -> None:
    simulator = Simulator()
    await simulator.run()


if __name__ == "__main__":
    try:
        asyncio.run(main())
    except KeyboardInterrupt:
        pass
