"""Backend-side MQTT client: keeps `app.state.state` in sync with the simulator, and lets REST
endpoints command the simulator and await its acknowledgment (see `publish_and_await`).
"""

from __future__ import annotations

import asyncio
import logging
import uuid
from typing import Any

from amqtt.client import MQTTClient
from amqtt.mqtt.constants import QOS_0

from shared import topics

from . import state as state_module

logger = logging.getLogger("mqtt_bridge")

BROKER_URI = "mqtt://localhost:1883/"

SUBSCRIBE_TOPICS = [
    (topics.SENSOR_TEMPERATURE, QOS_0),
    (topics.SENSOR_HUMIDITY, QOS_0),
    (topics.SENSOR_SOIL_MOISTURE_WILDCARD, QOS_0),
    (topics.ACTUATOR_STATE_WILDCARD, QOS_0),
    (topics.VALVE_STATE_WILDCARD, QOS_0),
    (topics.SIM_CONFIG_STATE, QOS_0),
    (topics.SIM_STATUS, QOS_0),
]

CLIENT_CONFIG = {
    "auto_reconnect": True,
    "reconnect_retries": -1,
    "reconnect_max_interval": 10,
}


class MqttBridge:
    """One instance lives for the lifetime of the FastAPI app (see `main.py`'s lifespan)."""

    def __init__(self) -> None:
        self.client = MQTTClient(client_id="backend", config=CLIENT_CONFIG)
        self.simulator_config: dict[str, Any] | None = None
        self.simulator_status: dict[str, Any] | None = None
        self._pending: dict[str, asyncio.Future[dict[str, Any]]] = {}
        self._receive_task: asyncio.Task[Any] | None = None

    async def connect(self) -> None:
        # auto_reconnect + reconnect_retries=-1 retries indefinitely with backoff if the broker
        # isn't up yet — the FastAPI app still starts and serves HTTP while this is in progress.
        await self.client.connect(BROKER_URI)
        await self.client.subscribe(SUBSCRIBE_TOPICS)
        self._receive_task = asyncio.create_task(self._receive_loop())
        logger.info("Connected to broker, subscribed to state topics")

    async def disconnect(self) -> None:
        if self._receive_task is not None:
            self._receive_task.cancel()
        await self.client.disconnect()

    async def _receive_loop(self) -> None:
        while True:
            try:
                message = await self.client.deliver_message()
            except asyncio.CancelledError:
                raise
            except Exception:
                logger.exception("Error while waiting for message")
                await asyncio.sleep(1)
                continue
            try:
                payload = topics.decode(message.data)
            except ValueError:
                logger.warning("Ignoring malformed payload on %s", message.topic)
                continue
            self._dispatch(message.topic, payload)

    def _dispatch(self, topic: str, payload: dict[str, Any]) -> None:
        if topic == topics.SENSOR_TEMPERATURE:
            state_module.apply_sensor_reading("temperature", payload["value"], payload["timestamp"])
        elif topic == topics.SENSOR_HUMIDITY:
            state_module.apply_sensor_reading("humidity", payload["value"], payload["timestamp"])
        elif topic.startswith("farm/zone1/sensor/soil_moisture/"):
            state_module.apply_plot_soil(payload["plotId"], payload["value"], payload["timestamp"])
        elif topic.startswith("farm/zone1/actuator/") and topic.endswith("/state"):
            device = topic.split("/")[3]
            state_module.apply_actuator_state(device, payload["on"])
        elif topic.startswith("farm/zone1/plot/") and topic.endswith("/valve/state"):
            plot_id = topic.split("/")[3]
            state_module.apply_valve_state(plot_id, payload["open"])
        elif topic == topics.SIM_CONFIG_STATE:
            self.simulator_config = payload
        elif topic == topics.SIM_STATUS:
            self.simulator_status = payload
        else:
            return

        self._resolve_pending(payload)

    def _resolve_pending(self, payload: dict[str, Any]) -> None:
        request_id = payload.get("requestId")
        if request_id and request_id in self._pending:
            future = self._pending.pop(request_id)
            if not future.done():
                future.set_result(payload)

    async def publish_and_await(self, cmd_topic: str, payload: dict[str, Any], timeout: float = 2.0) -> dict[str, Any]:
        """Publish `payload` (tagged with a fresh requestId) to `cmd_topic`, and wait for the
        simulator's matching `*/state` reply carrying that same requestId. Raises
        `asyncio.TimeoutError` if no reply arrives in time — callers should turn that into a
        504 rather than blocking the request forever.
        """
        request_id = uuid.uuid4().hex
        outgoing = {**payload, "requestId": request_id}
        future: asyncio.Future[dict[str, Any]] = asyncio.get_running_loop().create_future()
        self._pending[request_id] = future
        try:
            await self.client.publish(cmd_topic, topics.encode(outgoing), qos=QOS_0, retain=False)
            return await asyncio.wait_for(future, timeout=timeout)
        finally:
            self._pending.pop(request_id, None)
