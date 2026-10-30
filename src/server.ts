import { join } from "node:path";
import { mockGroceries } from "./mock";
import { PaprikaClient, PaprikaError, type GroceryItem, type GroceryList } from "./paprika";
import { buildPayload } from "./payload";

const appRoot = join(import.meta.dir, "..");
const publicRoot = join(appRoot, "public");

const email = process.env.PAPRIKA_EMAIL?.trim() ?? "";
const password = process.env.PAPRIKA_PASSWORD ?? "";
const configured = email.length > 0 && password.length > 0;
const useMock = process.env.PAPRIKA_MOCK === "1";
const port = Number(process.env.PORT ?? 8787);
const hostname = process.env.HOST ?? "127.0.0.1";
const cacheMs = Math.max(0, Number(process.env.CACHE_SECONDS ?? 60)) * 1000;

const client = configured
  ? new PaprikaClient(email, password, join(appRoot, ".cache", "paprika-token.json"))
  : null;

type Snapshot = { at: number; lists: GroceryList[]; items: GroceryItem[] };
let snapshot: Snapshot | null = null;
let inflight: Promise<Snapshot> | null = null;

async function fetchSnapshot(): Promise<Snapshot> {
  if (useMock) return { at: Date.now(), ...mockGroceries() };
  if (!client) throw new PaprikaError("Paprika credentials are not configured.", 503);

  const [listsResult, itemsResult] = await Promise.allSettled([client.groceryLists(), client.groceries()]);
  if (itemsResult.status === "rejected") throw itemsResult.reason;
  const items = itemsResult.value;

  let lists = listsResult.status === "fulfilled" ? listsResult.value : [];
  return {
    at: Date.now(),
    lists,
    items,
  };
}

async function getSnapshot(force: boolean): Promise<Snapshot> {
  if (!force && snapshot && Date.now() - snapshot.at < cacheMs) return snapshot;
  if (!inflight) {
    inflight = fetchSnapshot()
      .then((next) => {
        snapshot = next;
        return next;
      })
      .finally(() => {
        inflight = null;
      });
  }
  return inflight;
}

function json(payload: unknown, status = 200): Response {
  return Response.json(payload, {
    status,
    headers: { "Cache-Control": "no-store" },
  });
}

async function handleGroceries(url: URL): Promise<Response> {
  try {
    const current = await getSnapshot(url.searchParams.get("refresh") === "1");
    const payload = buildPayload(current.lists, current.items, url.searchParams.get("list"), {
      fetchedAt: new Date(current.at).toISOString(),
      mock: useMock,
    });
    return json({ configured: true, ...payload });
  } catch (error) {
    if (error instanceof PaprikaError) {
      return json({ configured, error: "paprika_error", message: error.message }, error.status);
    }
    console.error(`Groceries request failed: ${error instanceof Error ? error.message : String(error)}`);
    return json({ configured, error: "unknown", message: "Unexpected error loading the grocery list." }, 500);
  }
}

const assets = new Map<string, { file: string; type: string }>([
  ["/", { file: "index.html", type: "text/html; charset=utf-8" }],
  ["/index.html", { file: "index.html", type: "text/html; charset=utf-8" }],
  ["/index", { file: "index.html", type: "text/html; charset=utf-8" }],
  ["/app.js", { file: "app.js", type: "text/javascript; charset=utf-8" }],
  ["/styles.css", { file: "styles.css", type: "text/css; charset=utf-8" }],
  ["/manifest.webmanifest", { file: "manifest.webmanifest", type: "application/manifest+json" }],
  ["/icon.svg", { file: "icon.svg", type: "image/svg+xml" }],
  ["/robots.txt", { file: "robots.txt", type: "text/plain; charset=utf-8" }],
]);

async function serveAsset(pathname: string): Promise<Response | null> {
  const asset = assets.get(pathname);
  if (!asset) return null;
  const file = Bun.file(join(publicRoot, asset.file));
  if (!(await file.exists())) return new Response("Not found", { status: 404 });
  return new Response(file, {
    headers: {
      "Content-Type": asset.type,
      "Cache-Control": "no-cache",
    },
  });
}

async function handle(request: Request): Promise<Response> {
  const url = new URL(request.url);
  const pathname = url.pathname.replace(/\/{2,}/g, "/");

  if (request.method !== "GET" && request.method !== "HEAD") {
    return new Response("Method not allowed", { status: 405, headers: { Allow: "GET, HEAD" } });
  }

  if (pathname === "/api/groceries") return handleGroceries(url);
  if (pathname === "/api/health") {
    return json({ ok: true, configured, mock: useMock, cached: snapshot !== null });
  }

  const asset = await serveAsset(pathname);
  if (asset) return asset;

  // Tolerate stray HTML paths (for example // or a bookmark with a path) by
  // serving the app shell. API and asset misses still return 404.
  if (!pathname.startsWith("/api/") && request.headers.get("accept")?.includes("text/html")) {
    const index = await serveAsset("/index.html");
    if (index) return index;
  }
  return new Response("Not found", { status: 404 });
}

const server = Bun.serve({
  hostname,
  port,
  fetch: handle,
});

console.log(`Paprika groceries: http://${server.hostname}:${server.port}${useMock ? " (mock data)" : ""}`);
if (!useMock && !configured) {
  console.log("Missing PAPRIKA_EMAIL / PAPRIKA_PASSWORD. Copy .env.example to .env and restart.");
}
