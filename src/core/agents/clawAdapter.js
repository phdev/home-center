import { useEffect, useMemo, useState } from "react";
import { enhance } from "../../ai/openclaw";

const DEFAULT_CARD_TIMEOUT_MS = 6_000;

export function cardNeedsClaw(card) {
  return !!card?.shouldDisplay && !!card?.agent?.feature;
}

export async function augmentCardWithClaw(card, workerSettings, opts = {}) {
  if (!cardNeedsClaw(card)) return { ...card, enhanced: card?.enhanced ?? {} };

  const response = await enhance(
    {
      feature: card.agent.feature,
      state: card.agent.state,
      opts: { timeoutMs: opts.timeoutMs ?? DEFAULT_CARD_TIMEOUT_MS },
    },
    workerSettings,
  );

  return {
    ...card,
    enhanced: response.fields ?? {},
    enhancementSource: response.source,
  };
}

export async function augmentCardsWithClaw(cards, workerSettings, opts = {}) {
  return Promise.all(
    (cards ?? []).map((card) => augmentCardWithClaw(card, workerSettings, opts)),
  );
}

export function useClawAugmentedCards(cards, workerSettings, opts = {}) {
  const agentKeys = useMemo(
    () => (cards ?? []).filter(cardNeedsClaw).map((card) => agentKey(card, workerSettings)),
    [cards, workerSettings?.url, workerSettings?.token],
  );
  const [enhancements, setEnhancements] = useState({});

  useEffect(() => {
    let cancelled = false;
    const missing = (cards ?? []).filter((card) => {
      const key = agentKey(card, workerSettings);
      return cardNeedsClaw(card) && !enhancements[key];
    });
    if (missing.length === 0) return;

    (async () => {
      const next = await Promise.all(
        missing.map(async (card) => [
          agentKey(card, workerSettings),
          await augmentCardWithClaw(card, workerSettings, opts),
        ]),
      );
      if (cancelled) return;
      setEnhancements((current) => {
        const merged = { ...current };
        for (const [key, card] of next) {
          merged[key] = {
            enhanced: card.enhanced ?? {},
            enhancementSource: card.enhancementSource,
          };
        }
        return merged;
      });
    })();

    return () => {
      cancelled = true;
    };
  }, [
    agentKeys.join("|"),
    workerSettings?.url,
    workerSettings?.token,
    opts.timeoutMs,
  ]);

  return useMemo(
    () =>
      (cards ?? []).map((card) => {
        const cached = enhancements[agentKey(card, workerSettings)];
        return {
          ...card,
          enhanced: cached?.enhanced ?? card.enhanced ?? {},
          enhancementSource: cached?.enhancementSource ?? card.enhancementSource,
        };
      }),
    [cards, enhancements, workerSettings?.url, workerSettings?.token],
  );
}

function safeStringify(value) {
  try {
    return JSON.stringify(value);
  } catch {
    return String(value);
  }
}

function agentKey(card, workerSettings) {
  if (!cardNeedsClaw(card)) return card?.id ?? "__none__";
  return `${workerSettings?.url ?? "fallback"}:${card.id}:${card.agent.feature}:${safeStringify(card.agent.state)}`;
}
