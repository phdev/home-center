"""Configuration loader for email triage."""

import os
import yaml

DEFAULT_CONFIG = {
    "gmail": {
        "credentials_file": "credentials.json",
        "token_file": "token.json",
        "poll_interval_seconds": 300,
        "max_results": 20,
    },
    "llm": {
        "confidence_threshold": 0.7,
        "local": {
            "enabled": True,
            "model_path": "models/phi-3-mini-4k-instruct-q4_k_m.gguf",
            "server_url": "http://localhost:8411/v1",
            "max_tokens": 256,
            "timeout_seconds": 10,
            "batch_fallback_interval": 900,
        },
        "cloud": {
            "provider": "anthropic",
            "max_classifications_per_hour": 100,
        },
    },
    "notifications": {
        "worker_url": "https://home-center-api.phhowell.workers.dev",
        "worker_token": "",
        "nanoclaw": {
            "enabled": False,
            "webhook_url": "",
            "target_chat": "",
        },
    },
    "database": {"path": "email_triage.db"},
    "logging": {"level": "INFO", "file": "email_triage.log"},
}


def deep_merge(base, override):
    """Recursively merge override into base dict."""
    result = base.copy()
    for key, value in override.items():
        if key in result and isinstance(result[key], dict) and isinstance(value, dict):
            result[key] = deep_merge(result[key], value)
        else:
            result[key] = value
    return result


def load_config(config_path="config.yaml"):
    """Load config from YAML file, falling back to defaults."""
    config = DEFAULT_CONFIG.copy()
    if os.path.exists(config_path):
        with open(config_path) as f:
            user_config = yaml.safe_load(f) or {}
        config = deep_merge(config, user_config)

    # Environment variable overrides
    if os.environ.get("GMAIL_POLL_INTERVAL"):
        config["gmail"]["poll_interval_seconds"] = int(os.environ["GMAIL_POLL_INTERVAL"])
    if os.environ.get("LLM_PROVIDER"):
        config["llm"]["cloud"]["provider"] = os.environ["LLM_PROVIDER"]
    if os.environ.get("WORKER_URL"):
        config["notifications"]["worker_url"] = os.environ["WORKER_URL"]
    if os.environ.get("WORKER_TOKEN"):
        config["notifications"]["worker_token"] = os.environ["WORKER_TOKEN"]

    return config
