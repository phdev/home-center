#!/usr/bin/env node

const args = Object.fromEntries(process.argv.slice(2).map((arg) => {
  const [key, ...rest] = arg.replace(/^--/, "").split("=");
  return [key, rest.join("=")];
}));

if (!args.topicKey || !args.title || !args.type || !args.url || !args.sourceUrl) {
  console.error([
    "Usage:",
    "node scripts/promote-curated-knowledge-asset.mjs --topicKey=ada-lovelace --title=\"Ada Lovelace\" --type=person --url=https://... --sourceUrl=https://... [--source=Archive] [--credit=Name] [--license=Public-domain] [--focalPoint=0.72,0.42] [--cropHint=right-subject]",
    "",
    "Paste the JSON output into CURATED_KNOWLEDGE_ASSETS_JSON or worker/src/curatedKnowledgeAssets.js after review.",
  ].join("\n"));
  process.exit(2);
}

const focalPoint = String(args.focalPoint || "")
  .split(",")
  .map((value) => Number(value.trim()));

const entry = {
  topicKey: args.topicKey,
  title: args.title,
  type: args.type,
  assetRole: "hero",
  heroImage: {
    url: args.url,
    source: args.source || "Curated",
    sourceUrl: args.sourceUrl,
    credit: args.credit || null,
    license: args.license || null,
    width: args.width ? Number(args.width) : null,
    height: args.height ? Number(args.height) : null,
    focalPoint: Number.isFinite(focalPoint[0]) && Number.isFinite(focalPoint[1])
      ? { x: focalPoint[0], y: focalPoint[1] }
      : { x: 0.66, y: 0.48 },
    cropHint: args.cropHint || "right-subject",
    tone: "home-center-dark",
  },
};

console.log(JSON.stringify(entry, null, 2));
