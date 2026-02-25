"""Local LLM inference via llama-cpp-python HTTP server."""

import json
import logging
import requests

logger = logging.getLogger(__name__)


class LocalLLM:
    def __init__(self, server_url="http://localhost:8411/v1", max_tokens=256, timeout=10):
        self.server_url = server_url.rstrip("/")
        self.max_tokens = max_tokens
        self.timeout = timeout

    def is_available(self):
        """Check if the local LLM server is running."""
        try:
            resp = requests.get(f"{self.server_url}/models", timeout=3)
            return resp.status_code == 200
        except requests.RequestException:
            return False

    def classify(self, system_prompt, user_prompt):
        """Run classification via local model. Returns parsed JSON or None on failure."""
        try:
            resp = requests.post(
                f"{self.server_url}/chat/completions",
                json={
                    "messages": [
                        {"role": "system", "content": system_prompt},
                        {"role": "user", "content": user_prompt},
                    ],
                    "max_tokens": self.max_tokens,
                    "temperature": 0.1,
                    "response_format": {"type": "json_object"},
                },
                timeout=self.timeout,
            )
            resp.raise_for_status()
            content = resp.json()["choices"][0]["message"]["content"]
            return json.loads(content)
        except requests.Timeout:
            logger.warning("Local LLM timed out after %ds", self.timeout)
            return None
        except (requests.RequestException, json.JSONDecodeError, KeyError) as e:
            logger.warning("Local LLM error: %s", e)
            return None
