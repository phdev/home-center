"""Notification routing: home center TV cards + Telegram via OpenClaw bridge."""

import json
import logging
import time
import uuid
import requests

logger = logging.getLogger(__name__)

CATEGORY_ICONS = {
    "school": "🏫",
    "medical": "🏥",
    "activities": "⚽",
    "household": "🏠",
    "travel": "✈️",
    "family_events": "🎉",
    "deliveries": "📦",
    "government": "🏛️",
    "finance": "💰",
}


class Notifier:
    def __init__(self, config):
        notif_config = config["notifications"]
        self.worker_url = notif_config["worker_url"].rstrip("/")
        self.worker_token = notif_config["worker_token"]
        telegram_cfg = notif_config.get("telegram", notif_config.get("nanoclaw", {}))
        self.telegram_enabled = telegram_cfg.get("enabled", False)
        self.openclaw_url = telegram_cfg.get(
            "openclaw_url", telegram_cfg.get("webhook_url", "")
        ).rstrip("/")
        self.target_chat = telegram_cfg.get(
            "target_chat", telegram_cfg.get("chat_id", "")
        )

    def send(self, email, classification):
        """Send notification to home center TV and optionally Telegram."""
        if classification["category"] == "not_relevant":
            return

        icon = CATEGORY_ICONS.get(classification["category"], "📧")
        summary = classification["summary"] or email["subject"]

        self._send_to_worker(email, classification, icon, summary)

        if self.telegram_enabled:
            self._send_to_telegram(email, classification, icon, summary)

    def _send_to_worker(self, email, classification, icon, summary):
        """Push notification card to home center Cloudflare Worker."""
        notification = {
            "id": f"email_{email['id']}_{uuid.uuid4().hex[:6]}",
            "type": "email",
            "category": classification["category"],
            "icon": icon,
            "title": summary,
            "from": email["from_name"] or email["from_addr"],
            "subject": email["subject"],
            "timestamp": int(time.time() * 1000),
            "confidence": classification["confidence"],
            "routing": classification["routing"],
        }

        headers = {"Content-Type": "application/json"}
        if self.worker_token:
            headers["Authorization"] = f"Bearer {self.worker_token}"

        try:
            resp = requests.post(
                f"{self.worker_url}/api/notifications",
                json=notification,
                headers=headers,
                timeout=10,
            )
            if resp.ok:
                logger.info("Notification sent to worker: %s", summary)
            else:
                logger.warning("Worker notification failed (%d): %s", resp.status_code, resp.text)
        except requests.RequestException as e:
            logger.error("Failed to reach worker: %s", e)

    def _send_to_telegram(self, email, classification, icon, summary):
        """Send notification to Telegram via the OpenClaw bridge on the Mac Mini."""
        # Telegram MarkdownV2 requires escaping — stick to plain text for safety.
        message = (
            f"{icon} {classification['category'].replace('_', ' ').title()}\n"
            f"{summary}\n"
            f"From: {email['from_name'] or email['from_addr']}"
        )

        try:
            resp = requests.post(
                f"{self.openclaw_url}/send",
                json={
                    "chatId": self.target_chat,
                    "message": message,
                },
                timeout=10,
            )
            if resp.ok:
                logger.info("Telegram notification sent: %s", summary)
            else:
                logger.warning("Telegram notification failed (%d): %s", resp.status_code, resp.text)
        except requests.RequestException as e:
            logger.error("Failed to send Telegram notification: %s", e)
