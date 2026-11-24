// post-x-promote-make-your-own-bounty-01: entry program (Node 22, standard
// library only).
//
// The entry is the X post itself. This program only hands POST.json to the
// grader: it reads POST.json from the bot directory, checks that it names an
// X post address, and copies it byte for byte into the output directory.
// It reads nothing from the network, no environment secrets and no files
// outside the repository, and it writes the same bytes on every run.

import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";

const BOT_DIR = process.env.MAKEFUN_BOT_DIR ?? "/bot";
const OUTPUT_DIR = process.env.MAKEFUN_OUTPUT_DIR ?? "/output";
const POST_FILE = "POST.json";
// The gate refuses a POST.json larger than this.
const MAX_POST_JSON_BYTES = 16384;

const POST_HOSTS = new Set([
  "x.com",
  "www.x.com",
  "mobile.x.com",
  "twitter.com",
  "www.twitter.com",
  "mobile.twitter.com",
]);

function die(message: string): never {
  console.error(`main.ts: ${message}`);
  process.exit(1);
}

function readPostFile(botDir: string): { raw: Buffer; url: string } {
  const path = join(botDir, POST_FILE);
  if (!existsSync(path)) die(`no ${POST_FILE} in ${botDir}`);
  const raw = readFileSync(path);
  if (raw.length > MAX_POST_JSON_BYTES) {
    die(`${POST_FILE} is ${raw.length} bytes, over the ${MAX_POST_JSON_BYTES} byte cap`);
  }
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw.toString("utf8"));
  } catch {
    die(`${POST_FILE} is not valid JSON`);
  }
  if (typeof parsed !== "object" || parsed === null || Array.isArray(parsed)) {
    die(`${POST_FILE} must be a JSON object with a url field`);
  }
  const url = (parsed as Record<string, unknown>).url;
  if (typeof url !== "string" || url.length === 0) {
    die(`${POST_FILE} must carry a url string`);
  }
  return { raw, url };
}

function isPlaceholder(url: string): boolean {
  return url.includes("<handle>") || url.includes("<id>");
}

function validatePostUrl(url: string): void {
  if (/\s/.test(url)) die(`url must not contain whitespace: ${url}`);
  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch {
    die(`url is not a valid URL: ${url}`);
  }
  if (parsed.protocol !== "https:") die(`url must use https: ${url}`);
  if (!POST_HOSTS.has(parsed.hostname.toLowerCase())) {
    die(`url must be an x.com or twitter.com post address: ${url}`);
  }
  // An X handle is 1-15 characters of letters, digits and underscore; the
  // status id is digits only. The /i/web/status/<id> form has no handle.
  const direct = /^\/([A-Za-z0-9_]{1,15})\/status\/(\d+)$/.exec(parsed.pathname);
  const webClient = /^\/i\/web\/status\/(\d+)$/.exec(parsed.pathname);
  if (!direct && !webClient) {
    die(`url must look like https://x.com/<handle>/status/<id>: ${url}`);
  }
}

function main(): void {
  const { raw, url } = readPostFile(BOT_DIR);
  if (isPlaceholder(url)) {
    console.error(
      "main.ts: warning: POST.json still holds the placeholder address; replace it with the real post URL before submitting.",
    );
  } else {
    validatePostUrl(url);
  }
  mkdirSync(OUTPUT_DIR, { recursive: true });
  writeFileSync(join(OUTPUT_DIR, POST_FILE), raw);
}

main();
