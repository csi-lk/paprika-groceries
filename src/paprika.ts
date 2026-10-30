import { chmodSync, existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname } from "node:path";
import { gunzipSync } from "node:zlib";

const baseUrl = "https://www.paprikaapp.com/api";

export type GroceryItem = {
  uid: string;
  name: string;
  ingredient?: string | null;
  quantity?: string | null;
  aisle?: string | null;
  recipe?: string | null;
  recipe_uid?: string | null;
  instruction?: string | null;
  purchased?: boolean | number;
  order_flag?: number;
  separate?: boolean;
  list_uid?: string | null;
  deleted?: boolean;
};

export type GroceryList = {
  uid: string;
  name: string;
  order_flag?: number;
  is_default?: boolean;
  deleted?: boolean;
};

type ErrorPayload = { error?: { message?: unknown } };
type ResultPayload<T> = { result?: T } & ErrorPayload;

export class PaprikaError extends Error {
  constructor(message: string, readonly status: number) {
    super(message);
    this.name = "PaprikaError";
  }
}

/** Minimal client for the unofficial Paprika Cloud Sync API used by the apps. */
export class PaprikaClient {
  private token: string | null;

  constructor(
    private readonly email: string,
    private readonly password: string,
    private readonly tokenPath?: string,
  ) {
    this.token = this.readToken();
  }

  async groceryLists(): Promise<GroceryList[]> {
    const lists = await this.request<GroceryList[]>("/v2/sync/grocerylists/");
    return lists.filter((list) => !list.deleted);
  }

  async groceries(): Promise<GroceryItem[]> {
    const items = await this.request<GroceryItem[]>("/v2/sync/groceries/");
    return items.filter((item) => !item.deleted);
  }

  private readToken(): string | null {
    if (!this.tokenPath || !existsSync(this.tokenPath)) return null;
    try {
      const parsed = JSON.parse(readFileSync(this.tokenPath, "utf8")) as { token?: unknown };
      return typeof parsed.token === "string" && parsed.token.length > 0 ? parsed.token : null;
    } catch {
      return null;
    }
  }

  private saveToken(token: string): void {
    if (!this.tokenPath) return;
    try {
      mkdirSync(dirname(this.tokenPath), { recursive: true, mode: 0o700 });
      writeFileSync(this.tokenPath, JSON.stringify({ token }), { mode: 0o600 });
      chmodSync(this.tokenPath, 0o600);
    } catch {
      // A token cache is a convenience only; authentication still works without it.
    }
  }

  private async ensureToken(): Promise<string> {
    if (this.token) return this.token;
    return this.authenticate();
  }

  private async authenticate(): Promise<string> {
    const credentials = Buffer.from(`${this.email}:${this.password}`, "utf8").toString("base64");
    let response: Response;
    try {
      response = await fetch(`${baseUrl}/v1/account/login/`, {
        method: "POST",
        headers: {
          Authorization: `Basic ${credentials}`,
          "Content-Type": "application/x-www-form-urlencoded",
        },
        body: new URLSearchParams({ email: this.email, password: this.password }),
        signal: AbortSignal.timeout(20_000),
      });
    } catch {
      throw new PaprikaError("Could not reach Paprika Cloud Sync.", 502);
    }

    const payload = (await readPayload(response)) as ResultPayload<{ token?: unknown }> | null;
    const token = payload?.result?.token;
    if (!response.ok || typeof token !== "string" || token.length === 0) {
      const message = typeof payload?.error?.message === "string" ? payload.error.message : `HTTP ${response.status}`;
      throw new PaprikaError(`Paprika login failed (${message}). Check the email and password.`, 502);
    }

    this.token = token;
    this.saveToken(token);
    return token;
  }

  private async authenticatedGet(path: string, token: string): Promise<Response> {
    try {
      return await fetch(`${baseUrl}${path}`, {
        headers: {
          Authorization: `Bearer ${token}`,
          Accept: "application/json",
        },
        signal: AbortSignal.timeout(20_000),
      });
    } catch {
      throw new PaprikaError("Could not reach Paprika Cloud Sync.", 502);
    }
  }

  private async request<T>(path: string): Promise<T> {
    let response = await this.authenticatedGet(path, await this.ensureToken());
    if (response.status === 401) {
      this.token = null;
      response = await this.authenticatedGet(path, await this.ensureToken());
    }

    const payload = (await readPayload(response)) as ResultPayload<T> | null;
    if (!response.ok || !payload || !("result" in payload)) {
      const message = typeof payload?.error?.message === "string" ? payload.error.message : `HTTP ${response.status}`;
      throw new PaprikaError(`Paprika request failed (${message}).`, 502);
    }
    return payload.result as T;
  }
}

/** Some Paprika responses are gzipped without a matching Content-Encoding header. */
async function readPayload(response: Response): Promise<unknown> {
  const bytes = new Uint8Array(await response.arrayBuffer());
  const text = bytes[0] === 0x1f && bytes[1] === 0x8b
    ? gunzipSync(bytes).toString("utf8")
    : new TextDecoder().decode(bytes);
  try {
    return JSON.parse(text) as unknown;
  } catch {
    return null;
  }
}
