#!/usr/bin/env python3
"""
Train a custom "Hey Homer" wake word model for openWakeWord.

This script generates synthetic training data using text-to-speech and trains
a lightweight TFLite model that runs efficiently on the Raspberry Pi 5.

Usage:
    cd /path/to/home-center
    source pi/.venv/bin/activate
    python pi/train_wake_word.py

The resulting model will be saved to pi/models/hey_homer.tflite
"""

import logging
import sys
from pathlib import Path

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(message)s",
    datefmt="%H:%M:%S",
)
log = logging.getLogger("train")

MODEL_DIR = Path(__file__).parent / "models"
MODEL_DIR.mkdir(exist_ok=True)


def main() -> None:
    try:
        from openwakeword.train import train_custom_model
    except ImportError:
        log.error(
            "openWakeWord training dependencies not installed.\n"
            "Run: pip install openwakeword[train]"
        )
        sys.exit(1)

    log.info("Training custom wake word model for 'hey homer'...")
    log.info("This will generate synthetic audio samples and train a small neural network.")
    log.info("Output directory: %s", MODEL_DIR)

    model_path = train_custom_model(
        phrase="hey homer",
        output_dir=str(MODEL_DIR),
        num_samples=3000,
        epochs=100,
    )

    log.info("Model saved to: %s", model_path)
    log.info("The wake word service will automatically pick up this model on next start.")


if __name__ == "__main__":
    main()
