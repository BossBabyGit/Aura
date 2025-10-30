#!/usr/bin/env node
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const API_KEY = process.env.RAINBET_API_KEY;
const BASE_URL = process.env.RAINBET_API_URL ?? "https://services.rainbet.com/v1/external/affiliates";

if (!API_KEY) {
  console.error("RAINBET_API_KEY is required");
  process.exit(1);
}

function formatDate(date) {
  const year = date.getUTCFullYear();
  const month = String(date.getUTCMonth() + 1).padStart(2, "0");
  const day = String(date.getUTCDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function getDateRange() {
  const now = new Date();
  const start = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));
  const end = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + 1, 0));
  return {
    start: formatDate(start),
    end: formatDate(end),
  };
}

function normalizeEntries(payload) {
  const collection = Array.isArray(payload?.affiliates)
    ? payload.affiliates
    : Array.isArray(payload?.entries)
    ? payload.entries
    : [];

  const parsed = collection
    .map((item) => {
      const username =
        typeof item?.username === "string"
          ? item.username
          : typeof item?.user === "string"
          ? item.user
          : null;
      const wagerRaw = item?.wagered ?? item?.wagered_amount ?? item?.wageredAmount;
      const wagered =
        typeof wagerRaw === "string"
          ? Number.parseFloat(wagerRaw)
          : typeof wagerRaw === "number"
          ? wagerRaw
          : Number.NaN;
      if (!username || !Number.isFinite(wagered)) {
        return null;
      }
      return { username, wagered };
    })
    .filter(Boolean);

  parsed.sort((a, b) => b.wagered - a.wagered);
  return parsed.slice(0, 10);
}

async function main() {
  const { start, end } = getDateRange();
  const params = new URLSearchParams({
    start_at: process.env.RAINBET_START_AT ?? start,
    end_at: process.env.RAINBET_END_AT ?? end,
    key: API_KEY,
  });

  const response = await fetch(`${BASE_URL}?${params.toString()}`);
  if (!response.ok) {
    const body = await response.text();
    throw new Error(`Request failed with status ${response.status}: ${body}`);
  }

  const payload = await response.json();
  const entries = normalizeEntries(payload);

  if (entries.length === 0) {
    throw new Error("Leaderboard payload did not contain any entries");
  }

  const __filename = fileURLToPath(import.meta.url);
  const __dirname = path.dirname(__filename);
  const outputDir = path.resolve(__dirname, "../public/data");
  await mkdir(outputDir, { recursive: true });

  const output = {
    updatedAt: new Date().toISOString(),
    sourceUpdatedAt:
      typeof payload?.updatedAt === "string"
        ? payload.updatedAt
        : typeof payload?.cache_updated_at === "string"
        ? payload.cache_updated_at
        : null,
    entries,
  };

  const outputPath = path.join(outputDir, "leaderboard.json");
  await writeFile(outputPath, `${JSON.stringify(output, null, 2)}\n`, "utf8");
  console.log(`Saved ${entries.length} leaderboard entries to ${outputPath}`);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
