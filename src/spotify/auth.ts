import * as http from "node:http";
import * as fs from "node:fs";
import * as path from "node:path";

const REDIRECT_URI = "http://127.0.0.1:8888/callback";
const TOKEN_PATH = path.resolve(__dirname, "..", "..", "data", "tokens.json");

export class AuthExpiredError extends Error {
  constructor() {
    super(
      "Spotify auth expired. Delete data/tokens.json and restart to re-authorize.",
    );
  }
}

interface TokenData {
  access_token: string;
  refresh_token: string;
  expires_at: number;
}

function ensureDataDir(): void {
  const dir = path.dirname(TOKEN_PATH);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
}

function saveTokens(tokens: TokenData): void {
  ensureDataDir();
  fs.writeFileSync(TOKEN_PATH, JSON.stringify(tokens, null, 2));
}

function loadTokens(): TokenData | null {
  if (!fs.existsSync(TOKEN_PATH)) return null;
  return JSON.parse(fs.readFileSync(TOKEN_PATH, "utf-8")) as TokenData;
}

export async function handleCallback(
  code: string,
  clientId: string,
  clientSecret: string,
): Promise<void> {
  const params = new URLSearchParams({
    grant_type: "authorization_code",
    code,
    redirect_uri: REDIRECT_URI,
  });

  const res = await fetch("https://accounts.spotify.com/api/token", {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
      Authorization: `Basic ${Buffer.from(`${clientId}:${clientSecret}`).toString("base64")}`,
    },
    body: params.toString(),
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Token exchange failed: ${res.status} ${text}`);
  }

  const data = (await res.json()) as {
    access_token: string;
    refresh_token: string;
    expires_in: number;
  };

  saveTokens({
    access_token: data.access_token,
    refresh_token: data.refresh_token,
    expires_at: Date.now() + data.expires_in * 1000,
  });
}

export async function startAuth(
  clientId: string,
  clientSecret: string,
  scopes: string[],
): Promise<void> {
  const authUrl = new URL("https://accounts.spotify.com/authorize");
  authUrl.searchParams.set("client_id", clientId);
  authUrl.searchParams.set("response_type", "code");
  authUrl.searchParams.set("redirect_uri", REDIRECT_URI);
  authUrl.searchParams.set("scope", scopes.join(" "));

  return new Promise<void>((resolve, reject) => {
    const server = http.createServer(async (req, res) => {
      if (!req.url?.startsWith("/callback")) return;

      const url = new URL(req.url, "http://localhost:8888");
      const code = url.searchParams.get("code");
      const error = url.searchParams.get("error");

      if (error || !code) {
        res.writeHead(400, { "Content-Type": "text/html" });
        res.end("<h1>Authorization failed</h1>");
        server.close();
        reject(new Error(`Auth error: ${error || "no code received"}`));
        return;
      }

      try {
        await handleCallback(code, clientId, clientSecret);
        res.writeHead(200, { "Content-Type": "text/html" });
        res.end(
          "<h1>Authorization successful!</h1><p>You can close this window.</p>",
        );
        server.close();
        resolve();
      } catch (err) {
        res.writeHead(500, { "Content-Type": "text/html" });
        res.end("<h1>Token exchange failed</h1>");
        server.close();
        reject(err);
      }
    });

    server.listen(8888, async () => {
      console.log("Waiting for Spotify authorization...");
      // Dynamic import for ESM-only 'open' package
      const { default: open } = await import("open");
      await open(authUrl.toString());
    });
  });
}

export async function getAccessToken(
  clientId: string,
  clientSecret: string,
): Promise<string> {
  let tokens = loadTokens();
  if (!tokens) {
    // First time — run OAuth flow
    const scopes = [
      "user-read-recently-played",
      "user-top-read",
      "playlist-modify-public",
      "playlist-modify-private",
      "playlist-read-private",
    ];
    await startAuth(clientId, clientSecret, scopes);
    tokens = loadTokens();
    if (!tokens) {
      throw new AuthExpiredError();
    }
  }

  // Return current token if not expired (with 60s buffer)
  if (tokens.expires_at > Date.now() + 60_000) {
    return tokens.access_token;
  }

  // Refresh the token
  const params = new URLSearchParams({
    grant_type: "refresh_token",
    refresh_token: tokens.refresh_token,
  });

  let res: Response;
  try {
    res = await fetch("https://accounts.spotify.com/api/token", {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
        Authorization: `Basic ${Buffer.from(`${clientId}:${clientSecret}`).toString("base64")}`,
      },
      body: params.toString(),
    });
  } catch {
    throw new AuthExpiredError();
  }

  if (!res.ok) {
    throw new AuthExpiredError();
  }

  const data = (await res.json()) as {
    access_token: string;
    refresh_token?: string;
    expires_in: number;
  };

  const newTokens: TokenData = {
    access_token: data.access_token,
    refresh_token: data.refresh_token ?? tokens.refresh_token,
    expires_at: Date.now() + data.expires_in * 1000,
  };

  saveTokens(newTokens);
  return newTokens.access_token;
}
