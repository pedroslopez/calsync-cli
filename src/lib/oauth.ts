import http from "http";
import readline from "readline";
import { URL } from "url";
import { google } from "googleapis";
import open from "open";
import * as store from "./store";

const SCOPES = ["https://www.googleapis.com/auth/calendar"];
const REDIRECT_PORT = 3000;
const REDIRECT_URI = `http://localhost:${REDIRECT_PORT}/oauth2callback`;

type GoogleAuthError = {
  message?: string;
  response?: {
    data?: {
      error?: string;
      error_description?: string;
    };
  };
};

function createOAuth2Client() {
  const creds = store.loadCredentials();
  if (!creds) {
    throw new Error(
      `No credentials found. Run: calsync auth setup <path-to-credentials.json>\n` +
        `Download OAuth credentials from Google Cloud Console → APIs & Services → Credentials.`
    );
  }
  return new google.auth.OAuth2(creds.client_id, creds.client_secret, REDIRECT_URI);
}

export function formatAuthFailure(err: unknown): string {
  const googleError = err as GoogleAuthError;
  const error = googleError.response?.data?.error;
  const description = googleError.response?.data?.error_description;
  const message = description || googleError.message || "Unknown error";

  if (error === "invalid_grant" || message.includes("invalid_grant")) {
    return (
      "Google rejected the authorization code (invalid_grant).\n" +
      "This usually means the code expired (they last ~10 minutes), was already used, or the\n" +
      "wrong browser session completed the sign-in.\n" +
      "Run `calsync auth add <name>` again and complete the sign-in in one pass."
    );
  }

  if (error === "access_denied") {
    return (
      "Google access was denied.\n" +
      "On the consent screen, click 'Allow' to grant calsync access to your calendar."
    );
  }

  if (error === "redirect_uri_mismatch") {
    return (
      "OAuth redirect URI mismatch.\n" +
      `Make sure http://localhost:${REDIRECT_PORT}/oauth2callback is listed as an authorized\n` +
      "redirect URI in your Google Cloud Console → OAuth client → Authorized redirect URIs."
    );
  }

  return message ? `Authentication failed: ${message}` : "Authentication failed.";
}

export function buildHeadlessAuthMessage(authUrl: string): string {
  return [
    "────────────────────────────────────────────────────────────",
    "  No browser detected — manual authorization required",
    "────────────────────────────────────────────────────────────",
    "",
    "1. Open this URL in any browser:",
    "",
    `   ${authUrl}`,
    "",
    "2. Sign in and approve access.",
    "",
    `3. After approving, your browser will redirect to http://localhost:${REDIRECT_PORT}/...`,
    "   The page may show a connection error — that is expected.",
    "   Copy the FULL URL from the browser address bar and paste it below.",
    "",
    "   (You can also paste just the authorization code if you see one.)",
    "────────────────────────────────────────────────────────────",
  ].join("\n");
}

export function extractCodeFromInput(input: string): string | null {
  const trimmed = input.trim();
  if (!trimmed) return null;

  // Try to parse as a URL and extract ?code=
  try {
    const url = new URL(trimmed);
    const code = url.searchParams.get("code");
    if (code) return code;
  } catch {
    // Not a URL — treat as a raw code
  }

  // Accept raw code: no spaces, looks like an auth code
  if (/^[A-Za-z0-9/_\-]+$/.test(trimmed)) {
    return trimmed;
  }

  return null;
}

function promptForCode(): Promise<string> {
  return new Promise((resolve) => {
    const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
    rl.question("\nPaste the redirect URL (or auth code): ", (answer) => {
      rl.close();
      resolve(answer);
    });
  });
}

async function tryOpenBrowser(authUrl: string): Promise<boolean> {
  if (!process.stdout.isTTY || !process.stdin.isTTY) {
    return false;
  }

  try {
    await open(authUrl);
    return true;
  } catch {
    return false;
  }
}

export function getAuthenticatedClient(accountName: string) {
  const tokens = store.loadTokens(accountName);
  if (!tokens) {
    throw new Error(
      `Account "${accountName}" not found. Run: calsync auth add ${accountName}`
    );
  }
  const client = createOAuth2Client();
  client.setCredentials(tokens);
  client.on("tokens", (newTokens) => {
    const existing = store.loadTokens(accountName);
    store.saveTokens(accountName, { ...existing, ...newTokens } as any);
  });
  return client;
}

async function finishWithCode(
  client: ReturnType<typeof createOAuth2Client>,
  code: string,
  accountName: string
): Promise<string> {
  let tokens;
  try {
    ({ tokens } = await client.getToken(code));
  } catch (err) {
    throw new Error(formatAuthFailure(err));
  }

  store.saveTokens(accountName, tokens as any);
  client.setCredentials(tokens);

  const calendar = google.calendar({ version: "v3", auth: client });
  const calList = await calendar.calendarList.get({ calendarId: "primary" });
  return calList.data.id || "unknown";
}

async function runHeadlessAuthFlow(
  client: ReturnType<typeof createOAuth2Client>,
  authUrl: string,
  accountName: string
): Promise<string> {
  console.log(buildHeadlessAuthMessage(authUrl));

  const input = await promptForCode();
  const code = extractCodeFromInput(input);
  if (!code) {
    throw new Error(
      "Could not find an authorization code in the pasted input.\n" +
        "Make sure you copied the full URL from the browser address bar after approving access."
    );
  }

  return finishWithCode(client, code, accountName);
}

async function runBrowserAuthFlow(
  client: ReturnType<typeof createOAuth2Client>,
  authUrl: string,
  accountName: string
): Promise<string> {
  return new Promise((resolve, reject) => {
    let settled = false;

    const server = http.createServer(async (req, res) => {
      try {
        if (!req.url) {
          res.writeHead(400);
          res.end("Missing request URL.");
          return;
        }

        const url = new URL(req.url, `http://localhost:${REDIRECT_PORT}`);
        if (url.pathname !== "/oauth2callback") {
          res.writeHead(404);
          res.end("Not found.");
          return;
        }

        const oauthError = url.searchParams.get("error");
        if (oauthError) {
          const description = url.searchParams.get("error_description");
          throw new Error(description ? `${oauthError}: ${description}` : oauthError);
        }

        const code = url.searchParams.get("code");
        if (!code) {
          res.writeHead(400);
          res.end("Missing authorization code.");
          return;
        }

        const email = await finishWithCode(client, code, accountName);

        res.writeHead(200, { "Content-Type": "text/html" });
        res.end(
          `<html><body><h2>✅ calsync: Account "${accountName}" authenticated!</h2>` +
            `<p>Signed in as ${email}. You can close this tab.</p></body></html>`
        );

        if (!settled) {
          settled = true;
          server.close();
          resolve(email);
        }
      } catch (err: any) {
        const message = formatAuthFailure(err);
        res.writeHead(500);
        res.end(message);
        if (!settled) {
          settled = true;
          server.close();
          reject(new Error(message));
        }
      }
    });

    server.on("error", (err: NodeJS.ErrnoException) => {
      if (settled) return;
      settled = true;
      if (err.code === "EADDRINUSE") {
        reject(
          new Error(
            `Port ${REDIRECT_PORT} is already in use.\n` +
              `Stop whatever is using port ${REDIRECT_PORT} and try again, or run on a different machine.`
          )
        );
      } else {
        reject(err);
      }
    });

    server.listen(REDIRECT_PORT, async () => {
      const opened = await tryOpenBrowser(authUrl);
      if (opened) {
        console.log(`Opening browser for authentication...`);
        console.log(`Waiting for Google to redirect to http://localhost:${REDIRECT_PORT}/oauth2callback`);
      } else {
        // Browser open failed even though TTY was available — fall back to headless prompt
        server.close();
        runHeadlessAuthFlow(client, authUrl, accountName).then(resolve, reject);
      }
    });
  });
}

export async function runAuthFlow(accountName: string): Promise<string> {
  const client = createOAuth2Client();
  const authUrl = client.generateAuthUrl({
    access_type: "offline",
    prompt: "consent",
    scope: SCOPES,
  });

  const isHeadless = !process.stdout.isTTY || !process.stdin.isTTY;
  if (isHeadless) {
    return runHeadlessAuthFlow(client, authUrl, accountName);
  }

  return runBrowserAuthFlow(client, authUrl, accountName);
}
