"""Main entry point for the email triage service."""

import sys
import time
import signal
import logging
import argparse
from .config import load_config
from .db import TriageDB
from .gmail_client import GmailClient
from .classifier import HybridClassifier
from .notifier import Notifier

logger = logging.getLogger("email_triage")
running = True


def handle_signal(sig, frame):
    global running
    logger.info("Shutdown signal received")
    running = False


def setup_logging(config):
    log_config = config["logging"]
    handlers = [logging.StreamHandler()]
    if log_config.get("file"):
        handlers.append(logging.FileHandler(log_config["file"]))
    logging.basicConfig(
        level=getattr(logging, log_config["level"].upper(), logging.INFO),
        format="%(asctime)s [%(name)s] %(levelname)s: %(message)s",
        handlers=handlers,
    )


def poll_once(gmail, db, classifier, notifier, max_results):
    """Run one poll cycle: fetch, classify, notify."""
    try:
        emails = gmail.fetch_new_emails(max_results=max_results)
    except Exception as e:
        logger.error("Gmail fetch failed: %s", e)
        return

    new_count = 0
    relevant_count = 0

    for email in emails:
        if db.is_processed(email["id"]):
            continue

        new_count += 1
        cloud_count = db.get_cloud_count_last_hour()
        result = classifier.classify(email, cloud_count)

        is_relevant = result["category"] != "not_relevant"
        is_cloud = result["routing"] in ("cloud", "cloud_escalated")

        db.mark_processed(
            email_id=email["id"],
            category=result["category"],
            summary=result["summary"],
            confidence=result["confidence"],
            routing=result["routing"],
            from_addr=email["from_addr"],
            subject=email["subject"],
        )
        db.update_daily_stats(
            relevant=is_relevant,
            cloud_escalation=is_cloud,
            cost=result.get("cost", 0.0),
        )

        if is_relevant:
            relevant_count += 1
            notifier.send(email, result)
            logger.info(
                "RELEVANT [%s] %s: %s (via %s, confidence=%.2f)",
                result["category"],
                email["from_name"],
                result["summary"] or email["subject"],
                result["routing"],
                result["confidence"],
            )
        else:
            logger.debug("Skipped: %s - %s", email["from_addr"], email["subject"])

    if new_count:
        stats = db.get_daily_stats()
        logger.info(
            "Poll: %d new, %d relevant | Today: %d total, %d relevant, %d cloud, $%.4f",
            new_count, relevant_count,
            stats["total_processed"] if stats else 0,
            stats["relevant"] if stats else 0,
            stats["cloud_escalations"] if stats else 0,
            stats["estimated_cost"] if stats else 0,
        )


def main():
    parser = argparse.ArgumentParser(description="Email Triage Service")
    parser.add_argument("--config", default="config.yaml", help="Config file path")
    parser.add_argument("--once", action="store_true", help="Run once and exit")
    args = parser.parse_args()

    config = load_config(args.config)
    setup_logging(config)

    signal.signal(signal.SIGINT, handle_signal)
    signal.signal(signal.SIGTERM, handle_signal)

    gmail_cfg = config["gmail"]
    db = TriageDB(config["database"]["path"])
    gmail = GmailClient(gmail_cfg["credentials_file"], gmail_cfg["token_file"])
    classifier = HybridClassifier(config)
    notifier = Notifier(config)

    logger.info("Email triage starting (poll interval: %ds)", gmail_cfg["poll_interval_seconds"])
    gmail.authenticate()

    if args.once:
        poll_once(gmail, db, classifier, notifier, gmail_cfg["max_results"])
    else:
        while running:
            poll_once(gmail, db, classifier, notifier, gmail_cfg["max_results"])
            for _ in range(gmail_cfg["poll_interval_seconds"]):
                if not running:
                    break
                time.sleep(1)

    db.close()
    logger.info("Email triage stopped")


if __name__ == "__main__":
    main()
