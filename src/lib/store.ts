import fs from "fs";
import path from "path";
import os from "os";
import { CalSyncConfig, DEFAULT_CONFIG, StoredTokens } from "../types";

const CONFIG_DIR = path.join(os.homedir(), ".config", "calsync");
const TOKENS_DIR = path.join(CONFIG_DIR, "tokens");
const CONFIG_PATH = path.join(CONFIG_DIR, "config.json");
const CREDENTIALS_PATH = path.join(CONFIG_DIR, "credentials.json");

function ensureDirs(): void {
  fs.mkdirSync(TOKENS_DIR, { recursive: true });
}

export function getConfigDir(): string {
  return CONFIG_DIR;
}

export function getCredentialsPath(): string {
  return CREDENTIALS_PATH;
}

export function loadCredentials(): { client_id: string; client_secret: string; redirect_uris: string[] } | null {
  if (!fs.existsSync(CREDENTIALS_PATH)) return null;
  const raw = JSON.parse(fs.readFileSync(CREDENTIALS_PATH, "utf-8"));
  return raw.installed || raw.web || null;
}

export function loadConfig(): CalSyncConfig {
  ensureDirs();
  if (!fs.existsSync(CONFIG_PATH)) return { ...DEFAULT_CONFIG };
  return { ...DEFAULT_CONFIG, ...JSON.parse(fs.readFileSync(CONFIG_PATH, "utf-8")) };
}

export function saveConfig(config: CalSyncConfig): void {
  ensureDirs();
  fs.writeFileSync(CONFIG_PATH, JSON.stringify(config, null, 2));
}

export function tokenPath(accountName: string): string {
  return path.join(TOKENS_DIR, `${accountName}.json`);
}

export function loadTokens(accountName: string): StoredTokens | null {
  ensureDirs();
  const p = tokenPath(accountName);
  if (!fs.existsSync(p)) return null;
  return JSON.parse(fs.readFileSync(p, "utf-8"));
}

export function saveTokens(accountName: string, tokens: StoredTokens): void {
  ensureDirs();
  fs.writeFileSync(tokenPath(accountName), JSON.stringify(tokens, null, 2));
}

export function removeTokens(accountName: string): boolean {
  const p = tokenPath(accountName);
  if (!fs.existsSync(p)) return false;
  fs.unlinkSync(p);
  return true;
}

export function listAccounts(): string[] {
  ensureDirs();
  return fs
    .readdirSync(TOKENS_DIR)
    .filter((f) => f.endsWith(".json"))
    .map((f) => f.replace(".json", ""));
}
