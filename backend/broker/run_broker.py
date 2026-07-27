"""Standalone MQTT broker process for local dev (Phase 3).

Run with:  python -m broker.run_broker
"""

import asyncio
import logging
from pathlib import Path

import yaml
from amqtt.broker import Broker

logging.basicConfig(level=logging.INFO, format="%(asctime)s %(name)s %(levelname)s %(message)s")
logger = logging.getLogger("broker")

CONFIG_PATH = Path(__file__).parent / "broker_config.yaml"


async def main() -> None:
    config = yaml.safe_load(CONFIG_PATH.read_text(encoding="utf-8"))
    broker = Broker(config=config)
    await broker.start()
    logger.info("Broker listening on %s", config["listeners"]["default"]["bind"])
    try:
        await asyncio.Event().wait()  # run until cancelled (Ctrl+C)
    finally:
        await broker.shutdown()
        logger.info("Broker stopped")


if __name__ == "__main__":
    try:
        asyncio.run(main())
    except KeyboardInterrupt:
        pass
