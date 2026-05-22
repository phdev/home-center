"""Cloud LLM providers (OpenAI and Anthropic) for email classification."""

import os
import json
import logging

logger = logging.getLogger(__name__)

# Estimated costs per 1K tokens (input/output)
COST_PER_1K = {
    "openai": {"input": 0.00015, "output": 0.0006},       # GPT-4o-mini
    "anthropic": {"input": 0.00025, "output": 0.00125},    # Claude Haiku
}


class CloudLLM:
    def __init__(self, provider="anthropic"):
        self.provider = provider
        self._openai_client = None
        self._anthropic_client = None

    def _get_openai(self):
        if not self._openai_client:
            import openai
            api_key = os.environ.get("OPENAI_API_KEY")
            if not api_key:
                raise ValueError("OPENAI_API_KEY environment variable not set")
            self._openai_client = openai.OpenAI(api_key=api_key)
        return self._openai_client

    def _get_anthropic(self):
        if not self._anthropic_client:
            import anthropic
            api_key = os.environ.get("ANTHROPIC_API_KEY")
            if not api_key:
                raise ValueError("ANTHROPIC_API_KEY environment variable not set")
            self._anthropic_client = anthropic.Anthropic(api_key=api_key)
        return self._anthropic_client

    def classify(self, system_prompt, user_prompt):
        """Classify email using cloud API. Returns (result_dict, estimated_cost)."""
        if self.provider == "openai":
            return self._classify_openai(system_prompt, user_prompt)
        elif self.provider == "anthropic":
            return self._classify_anthropic(system_prompt, user_prompt)
        else:
            raise ValueError(f"Unknown provider: {self.provider}")

    def _classify_openai(self, system_prompt, user_prompt):
        client = self._get_openai()
        resp = client.chat.completions.create(
            model="gpt-4o-mini",
            messages=[
                {"role": "system", "content": system_prompt},
                {"role": "user", "content": user_prompt},
            ],
            max_tokens=200,
            temperature=0.1,
            response_format={"type": "json_object"},
        )
        content = resp.choices[0].message.content
        usage = resp.usage
        cost = (
            (usage.prompt_tokens / 1000) * COST_PER_1K["openai"]["input"]
            + (usage.completion_tokens / 1000) * COST_PER_1K["openai"]["output"]
        )
        logger.info(
            "OpenAI: %d input + %d output tokens, cost: $%.6f",
            usage.prompt_tokens, usage.completion_tokens, cost,
        )
        return json.loads(content), cost

    def _classify_anthropic(self, system_prompt, user_prompt):
        client = self._get_anthropic()
        resp = client.messages.create(
            model="claude-haiku-4-5-20251001",
            max_tokens=200,
            system=system_prompt,
            messages=[{"role": "user", "content": user_prompt}],
        )
        content = resp.content[0].text
        usage = resp.usage
        cost = (
            (usage.input_tokens / 1000) * COST_PER_1K["anthropic"]["input"]
            + (usage.output_tokens / 1000) * COST_PER_1K["anthropic"]["output"]
        )
        logger.info(
            "Anthropic: %d input + %d output tokens, cost: $%.6f",
            usage.input_tokens, usage.output_tokens, cost,
        )
        return json.loads(content), cost
