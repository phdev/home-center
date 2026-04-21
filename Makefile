# Home Center — developer-facing make targets.

.PHONY: design-explore

## Generate three structural UI alternatives for the current dashboard
## snapshot via the OpenAI Responses API. Output is written to
## design_outputs/. Requires OPENAI_API_KEY. See docs/design_explorer.md.
design-explore:
	python scripts/run_design_explorer.py
