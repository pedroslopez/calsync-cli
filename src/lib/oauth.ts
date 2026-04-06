import http from "http";
import { URL } from "url";
import { google } from "googleapis";
import open from "open";
import * as store from "./store";

const SCOPES = ["https://www.googleapis.com/auth/calendar"];
const REDIRECT_PORT = 3000;
const REDIRECT_URI = `http://localhost:${REDIRECT_PORT}/oauth2callback`;

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

export async function runAuthFlow(accountName: string): Promise<string> {
  const client = createOAuth2Client();
  const authUrl = client.generateAuthUrl({
    access_type: "offline",
    prompt: "consent",
    scope: SCOPES,
  });

  return new Promise((resolve, reject) => {
    const server = http.createServer(async (req, res) => {
      try {
        const url = new URL(req.url!, `http://localhost:${REDIRECT_PORT}`);
        if (url.pathname !== "/oauth2callback") return;

        const code = url.searchParams.get("code");
        if (!code) {
          res.writeHead(400);
          res.end("Missing authorization code.");
          return;
        }

        const { tokens } = await client.getToken(code);
        store.saveTokens(accountName, tokens as any);
        client.setCredentials(tokens);

        // Fetch email for display
        const calendar = google.calendar({ version: "v3", auth: client });
        const calList = await calendar.calendarList.get({ calendarId: "primary" });
        const email = calList.data.id || "unknown";

        res.writeHead(200, { "Content-Type": "text/html" });
        res.end(
          `<html><body><h2>✅ calsync: Account "${accountName}" authenticated!</h2>` +
            `<p>Signed in as ${email}. You can close this tab.</p></body></html>`
        );

        server.close();
        resolve(email);
      } catch (err) {
        res.writeHead(500);
        res.end("Authentication failed.");
        server.close();
        reject(err);
      }
    });

    server.listen(REDIRECT_PORT, () => {
      console.log(`Opening browser for authentication...`);
      open(authUrl);
    });

    server.on("error", (err: NodeJS.ErrnoException) => {
      if (err.code === "EADDRINUSE") {
        reject(
          new Error(
            `Port ${REDIRECT_PORT} is in use. Close other applications using it and try again.`
          )
        );
      } else {
        reject(err);
      }
    });
  });
}
