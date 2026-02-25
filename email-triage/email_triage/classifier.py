"""Hybrid email classifier: local first-pass, cloud for ambiguous."""

import logging
from .local_llm import LocalLLM
from .cloud_llm import CloudLLM
from .prompts import (
    LOCAL_SYSTEM_PROMPT,
    LOCAL_USER_TEMPLATE,
    CLOUD_SYSTEM_PROMPT,
    CLOUD_USER_TEMPLATE,
    CATEGORIES,
)

logger = logging.getLogger(__name__)


class HybridClassifier:
    def __init__(self, config):
        llm_config = config["llm"]
        local_cfg = llm_config["local"]
        cloud_cfg = llm_config["cloud"]

        self.confidence_threshold = llm_config["confidence_threshold"]
        self.local_enabled = local_cfg["enabled"]

        if self.local_enabled:
            self.local = LocalLLM(
                server_url=local_cfg["server_url"],
                max_tokens=local_cfg["max_tokens"],
                timeout=local_cfg["timeout_seconds"],
            )
        else:
            self.local = None

        self.cloud = CloudLLM(provider=cloud_cfg["provider"])
        self.max_cloud_per_hour = cloud_cfg["max_classifications_per_hour"]

    def classify(self, email, cloud_count_last_hour=0):
        """
        Classify an email using hybrid approach.

        Returns:
            dict with keys: category, summary, confidence, routing
            routing is one of: "local", "cloud", "cloud_escalated"
        """
        # Step 1: Try local first-pass (binary: relevant yes/no)
        local_result = None
        if self.local_enabled and self.local and self.local.is_available():
            user_prompt = LOCAL_USER_TEMPLATE.format(
                from_name=email["from_name"],
                from_addr=email["from_addr"],
                subject=email["subject"],
                snippet=email["snippet"],
            )
            local_result = self.local.classify(LOCAL_SYSTEM_PROMPT, user_prompt)
            if local_result:
                logger.info(
                    "Local: relevant=%s confidence=%.2f for '%s'",
                    local_result.get("relevant"),
                    local_result.get("confidence", 0),
                    email["subject"],
                )

        # Step 2: Decide routing based on local result
        if local_result:
            relevant = local_result.get("relevant", False)
            confidence = local_result.get("confidence", 0)

            # High confidence not-relevant: skip
            if not relevant and confidence >= self.confidence_threshold:
                return {
                    "category": "not_relevant",
                    "summary": None,
                    "confidence": confidence,
                    "routing": "local",
                    "cost": 0.0,
                }

            # High confidence relevant: escalate to cloud for category + summary
            if relevant and confidence >= self.confidence_threshold:
                if cloud_count_last_hour < self.max_cloud_per_hour:
                    return self._cloud_classify(email, routing="cloud_escalated")
                else:
                    logger.warning("Cloud rate limit reached, using local-only result")
                    return {
                        "category": "not_relevant",
                        "summary": email["subject"],
                        "confidence": confidence,
                        "routing": "local",
                        "cost": 0.0,
                    }

        # Step 3: Ambiguous or local unavailable -> cloud
        if cloud_count_last_hour < self.max_cloud_per_hour:
            return self._cloud_classify(email, routing="cloud")
        else:
            logger.warning("Cloud rate limit reached, skipping email: %s", email["subject"])
            return {
                "category": "not_relevant",
                "summary": None,
                "confidence": 0.0,
                "routing": "skipped",
                "cost": 0.0,
            }

    def _cloud_classify(self, email, routing="cloud"):
        """Full classification via cloud API."""
        user_prompt = CLOUD_USER_TEMPLATE.format(
            from_name=email["from_name"],
            from_addr=email["from_addr"],
            subject=email["subject"],
            date=email["date"],
            body=email["body"][:1500],
        )
        try:
            result, cost = self.cloud.classify(CLOUD_SYSTEM_PROMPT, user_prompt)
            category = result.get("category", "not_relevant")
            if category not in CATEGORIES:
                category = "not_relevant"
            return {
                "category": category,
                "summary": result.get("summary"),
                "confidence": result.get("confidence", 0.8),
                "routing": routing,
                "cost": cost,
            }
        except Exception as e:
            logger.error("Cloud classification failed: %s", e)
            return {
                "category": "not_relevant",
                "summary": None,
                "confidence": 0.0,
                "routing": "error",
                "cost": 0.0,
            }
