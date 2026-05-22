# Home Center — developer-facing make targets.
#
# Design Claw workflow. See docs/design_claw.md for the full story.

.PHONY: design-explore design-daily design-send design-feedback design-review

## Generate three structural UI alternatives (one-shot explorer).
## Requires OPENAI_API_KEY.
design-explore:
	python scripts/run_design_explorer.py

## Generate today's single design concept (rotates through daily_topics.json).
## Requires OPENAI_API_KEY.
design-daily:
	python scripts/run_daily_design_claw.py

## Send the most recent daily concept to Telegram.
## Requires TELEGRAM_BOT_TOKEN + TELEGRAM_CHAT_ID.
design-send:
	python scripts/send_telegram_digest.py

## Parse natural-language feedback and merge it into design_memory/.
## Usage: make design-feedback FEEDBACK="Avoid anything that feels like a productivity app"
## Requires OPENAI_API_KEY.
design-feedback:
	@test -n "$(FEEDBACK)" || (echo 'usage: make design-feedback FEEDBACK="..."'; exit 2)
	python scripts/parse_design_feedback.py --feedback "$(FEEDBACK)" --apply

## Weekly synthesis of recent daily concepts + memory.
## Requires OPENAI_API_KEY.
design-review:
	python scripts/run_design_review.py
