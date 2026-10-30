const storeKeys = {
  list: "paprika.list",
  showDone: "paprika.showDone",
  picked: (listUid) => `paprika.picked.${listUid}`,
};

const els = {
  subtitle: document.querySelector("#subtitle"),
  picker: document.querySelector("#list-picker"),
  select: document.querySelector("#list-select"),
  refresh: document.querySelector("#refresh"),
  banner: document.querySelector("#banner"),
  progress: document.querySelector("#progress"),
  remaining: document.querySelector("#remaining"),
  progressMeta: document.querySelector("#progress-meta"),
  progressPercent: document.querySelector("#progress-percent"),
  progressTrack: document.querySelector("#progress-track"),
  progressBar: document.querySelector("#progress-bar"),
  toolbar: document.querySelector("#toolbar"),
  search: document.querySelector("#search"),
  showDone: document.querySelector("#show-done"),
  copy: document.querySelector("#copy"),
  print: document.querySelector("#print"),
  content: document.querySelector("#content"),
  toast: document.querySelector("#toast"),
};

const state = {
  data: null,
  listUid: localStorage.getItem(storeKeys.list) ?? "",
  picked: new Set(),
  showDone: localStorage.getItem(storeKeys.showDone) === "1",
  query: "",
  loading: false,
  hideTimer: 0,
};

const embeddedData = window.__PAPRIKA_DATA__ && typeof window.__PAPRIKA_DATA__ === "object"
  ? window.__PAPRIKA_DATA__
  : null;
const isStatic = Boolean(embeddedData);

els.showDone.checked = state.showDone;

function escapeHtml(value) {
  return String(value ?? "").replace(/[&<>"']/g, (character) => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#39;",
  })[character]);
}

function formatTime(iso) {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return "";
  return new Intl.DateTimeFormat("en-AU", { hour: "numeric", minute: "2-digit" }).format(date);
}

function toast(message) {
  els.toast.textContent = message;
  els.toast.classList.add("visible");
  window.clearTimeout(toast.timer);
  toast.timer = window.setTimeout(() => els.toast.classList.remove("visible"), 2200);
}

function isDone(item) {
  return Boolean(item.purchased) || state.picked.has(item.uid);
}

function matchesQuery(item) {
  if (!state.query) return true;
  const haystack = [item.name, item.ingredient, item.aisle, item.recipe]
    .filter(Boolean)
    .join(" ")
    .toLowerCase();
  return haystack.includes(state.query);
}

function readPicked(listUid) {
  if (!listUid) return new Set();
  try {
    const stored = JSON.parse(localStorage.getItem(storeKeys.picked(listUid)) ?? "[]");
    return new Set(Array.isArray(stored) ? stored.filter((uid) => typeof uid === "string") : []);
  } catch {
    return new Set();
  }
}

function savePicked() {
  if (!state.listUid) return;
  localStorage.setItem(storeKeys.picked(state.listUid), JSON.stringify([...state.picked]));
}

function updateSummary() {
  const data = state.data;
  if (!data) return;

  const items = data.items ?? [];
  const total = items.length;
  const done = items.filter(isDone).length;
  const remaining = total - done;
  const percent = total === 0 ? 0 : Math.round((done / total) * 100);
  const synced = formatTime(data.fetchedAt);

  els.subtitle.textContent = total === 0
    ? `No items · synced ${synced}`
    : remaining === 0
      ? `All done · synced ${synced}`
      : `${remaining} item${remaining === 1 ? "" : "s"} left · synced ${synced}`;

  els.progress.hidden = total === 0;
  if (total > 0) {
    els.remaining.textContent = remaining === 0 ? "Everything collected" : `${remaining} item${remaining === 1 ? "" : "s"} left`;
    els.progressMeta.textContent = `${done} of ${total} collected`;
    els.progressPercent.textContent = `${percent}%`;
    els.progressBar.style.width = `${percent}%`;
    els.progressTrack.setAttribute("aria-valuenow", String(percent));
  }
}

function renderBanner() {
  if (state.data?.static) {
    els.banner.hidden = false;
    els.banner.className = "banner";
    els.banner.textContent = state.data.mock
      ? "Static demo with sample data. Self-host the app or enable live snapshots to use your own list."
      : `Static snapshot generated ${formatTime(state.data.fetchedAt)}. Refresh the page to reload; ticks stay in this browser.`;
  } else if (state.data?.mock) {
    els.banner.hidden = false;
    els.banner.className = "banner";
    els.banner.textContent = "Sample data for preview. Add Paprika credentials to load your real grocery list.";
  } else {
    els.banner.hidden = true;
    els.banner.textContent = "";
  }
}

function renderListPicker() {
  const lists = state.data?.lists ?? [];
  if (lists.length <= 1) {
    els.picker.hidden = true;
    return;
  }
  els.picker.hidden = false;
  const selected = state.data?.list?.uid;
  els.select.innerHTML = lists
    .map((list) => `<option value="${escapeHtml(list.uid)}"${list.uid === selected ? " selected" : ""}>${escapeHtml(list.name)} (${list.remaining})</option>`)
    .join("");
}

function groupByAisle(items) {
  const groups = new Map();
  for (const item of items) {
    const aisle = (item.aisle ?? "").trim() || "Other";
    if (!groups.has(aisle)) groups.set(aisle, []);
    groups.get(aisle).push(item);
  }
  return [...groups.entries()].sort(([left], [right]) => {
    if (left === "Other") return 1;
    if (right === "Other") return -1;
    return left.localeCompare(right, "en", { sensitivity: "base" });
  });
}

function aisleHue(aisle) {
  let hash = 0;
  for (let index = 0; index < aisle.length; index += 1) {
    hash = (hash * 31 + aisle.charCodeAt(index)) >>> 0;
  }
  return hash % 360;
}

function itemRow(item) {
  const done = isDone(item);
  const meta = [];
  if (item.recipe) meta.push(`<span class="recipe">${escapeHtml(item.recipe)}</span>`);
  if (item.instruction) meta.push(`<span class="note">${escapeHtml(item.instruction)}</span>`);

  return `
    <li class="item${done ? " is-done" : ""}" data-uid="${escapeHtml(item.uid)}">
      <label class="tick">
        <input type="checkbox" data-uid="${escapeHtml(item.uid)}"${done ? " checked" : ""}${item.purchased ? " disabled" : ""} aria-label="${item.purchased ? "Already collected in Paprika" : `Mark ${escapeHtml(item.name)} as collected`}" />
        <span class="tick-box" aria-hidden="true">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3.2" stroke-linecap="round" stroke-linejoin="round"><path d="m4.5 12.5 5 5 10-11" /></svg>
        </span>
      </label>
      <div class="item-body">
        <p class="item-name">${escapeHtml(item.name)}</p>
        ${meta.length > 0 ? `<p class="item-meta">${meta.join("")}</p>` : ""}
      </div>
      <a class="shop-link" href="${escapeHtml(item.woolworthsUrl)}" target="_blank" rel="noopener noreferrer" title="Search Woolworths for ${escapeHtml(item.searchTerm)}">
        <span class="shop-word">Woolworths</span>
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M7 17 17 7" /><path d="M8 7h9v9" /></svg>
      </a>
    </li>`;
}

function aisleSection(aisle, items) {
  return `
    <details class="aisle" open>
      <summary>
        <span class="aisle-heading"><span class="dot" style="--hue:${aisleHue(aisle)}"></span>${escapeHtml(aisle)}<span class="aisle-count">${items.length}</span></span>
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="m6 9 6 6 6-6" /></svg>
      </summary>
      <ul class="items">${items.map(itemRow).join("")}</ul>
    </details>`;
}

function emptyCard({ emoji, title, body, extra = "" }) {
  return `
    <div class="empty-card">
      <div class="empty-emoji" aria-hidden="true">${emoji}</div>
      <h2>${title}</h2>
      <p>${body}</p>
      ${extra}
    </div>`;
}

function renderContent() {
  const data = state.data;
  if (!data) return;

  const items = data.items ?? [];
  const visible = items.filter((item) => (state.showDone || !isDone(item)) && matchesQuery(item));

  if (items.length === 0) {
    els.content.innerHTML = emptyCard({
      emoji: "🧺",
      title: "Your list is empty",
      body: "Add ingredients in Paprika, then tap refresh. New items sync down within a minute.",
    });
    return;
  }

  if (visible.length === 0 && state.query) {
    els.content.innerHTML = emptyCard({
      emoji: "🔎",
      title: "No matches",
      body: `Nothing on this list matches “${escapeHtml(state.query)}”.`,
      extra: '<button class="empty-button" type="button" data-action="clear-search">Clear filter</button>',
    });
    return;
  }

  if (visible.length === 0) {
    els.content.innerHTML = emptyCard({
      emoji: "✓",
      title: "All done",
      body: "Every item is checked off. Enjoy the shop.",
      extra: '<button class="empty-button" type="button" data-action="show-done">Show collected items</button>',
    });
    return;
  }

  els.content.innerHTML = groupByAisle(visible)
    .map(([aisle, aisleItems]) => aisleSection(aisle, aisleItems))
    .join("");
}

function render() {
  renderBanner();
  renderListPicker();
  updateSummary();
  els.toolbar.hidden = (state.data?.items?.length ?? 0) === 0;
  renderContent();
}

function showSetup() {
  state.data = null;
  els.subtitle.textContent = "Not connected";
  els.banner.hidden = true;
  els.progress.hidden = true;
  els.toolbar.hidden = true;
  els.picker.hidden = true;
  els.content.innerHTML = `
    <div class="empty-card">
      <div class="empty-emoji" aria-hidden="true">🔌</div>
      <h2>Connect Paprika</h2>
      <p>Create <code>apps/paprika-groceries/.env</code> with the email and password you use for Paprika Cloud Sync.</p>
      <pre>PAPRIKA_EMAIL=you@example.com
PAPRIKA_PASSWORD=your-paprika-password</pre>
      <p>Then restart the app with <code>bun run start</code>.</p>
    </div>`;
}

function showError(message) {
  state.data = null;
  els.subtitle.textContent = "Couldn't load groceries";
  els.banner.hidden = true;
  els.progress.hidden = true;
  els.toolbar.hidden = true;
  els.picker.hidden = true;
  els.content.innerHTML = emptyCard({
    emoji: "⚠️",
    title: "Couldn't load your list",
    body: escapeHtml(message || "Something went wrong talking to Paprika."),
    extra: '<button class="empty-button" type="button" data-action="retry">Try again</button>',
  });
}

async function load({ force = false } = {}) {
  if (state.loading) return;
  state.loading = true;
  els.refresh.disabled = true;
  els.refresh.classList.add("spinning");

  const params = new URLSearchParams();
  if (state.listUid) params.set("list", state.listUid);
  if (force) params.set("refresh", "1");

  try {
    const response = await fetch(`api/groceries?${params}`, { cache: "no-store" });
    const payload = await response.json().catch(() => null);

    if (!response.ok || !payload) {
      if (payload?.error === "paprika_error" && !payload.configured) {
        showSetup();
      } else {
        showError(payload?.message);
      }
      return;
    }

    state.data = payload;
    state.listUid = payload.list?.uid ?? "";
    if (state.listUid) localStorage.setItem(storeKeys.list, state.listUid);
    state.picked = readPicked(state.listUid);
    render();
  } catch {
    showError("The local app server could not be reached. Is it still running?");
  } finally {
    state.loading = false;
    els.refresh.disabled = false;
    els.refresh.classList.remove("spinning");
  }
}

function copyText(text) {
  if (navigator.clipboard?.writeText) {
    return navigator.clipboard.writeText(text).then(() => true).catch(() => fallbackCopy(text));
  }
  return Promise.resolve(fallbackCopy(text));
}

function fallbackCopy(text) {
  const textarea = document.createElement("textarea");
  textarea.value = text;
  textarea.setAttribute("readonly", "");
  textarea.style.position = "fixed";
  textarea.style.opacity = "0";
  document.body.append(textarea);
  textarea.select();
  const copied = document.execCommand("copy");
  textarea.remove();
  return copied;
}

function buildCopyText() {
  const items = (state.data?.items ?? []).filter((item) => !isDone(item) && matchesQuery(item));
  const lines = [];
  for (const [aisle, aisleItems] of groupByAisle(items)) {
    if (lines.length > 0) lines.push("");
    lines.push(aisle.toUpperCase());
    for (const item of aisleItems) lines.push(`- ${item.name}`);
  }
  return lines.join("\n");
}

els.refresh.addEventListener("click", () => {
  if (isStatic) {
    window.location.reload();
    return;
  }
  load({ force: true });
});

els.search.addEventListener("input", (event) => {
  state.query = event.target.value.trim().toLowerCase();
  renderContent();
});

els.showDone.addEventListener("change", (event) => {
  state.showDone = event.target.checked;
  localStorage.setItem(storeKeys.showDone, state.showDone ? "1" : "0");
  renderContent();
});

els.content.addEventListener("change", (event) => {
  const input = event.target;
  if (!(input instanceof HTMLInputElement) || !input.matches("input[data-uid]")) return;
  const item = state.data?.items?.find((candidate) => candidate.uid === input.dataset.uid);
  if (!item || item.purchased) return;

  if (input.checked) state.picked.add(item.uid);
  else state.picked.delete(item.uid);
  savePicked();

  const row = input.closest(".item");
  if (row) row.classList.toggle("is-done", isDone(item));
  updateSummary();

  window.clearTimeout(state.hideTimer);
  if (input.checked && !state.showDone) {
    state.hideTimer = window.setTimeout(() => {
      renderContent();
      updateSummary();
      if ((state.data?.items ?? []).filter((candidate) => !isDone(candidate)).length === 0) {
        toast("List complete");
      }
    }, 230);
  } else {
    renderContent();
  }
});

els.content.addEventListener("click", (event) => {
  const button = event.target.closest("[data-action]");
  if (!button) return;

  if (button.dataset.action === "retry") {
    load({ force: true });
  } else if (button.dataset.action === "clear-search") {
    state.query = "";
    els.search.value = "";
    renderContent();
    els.search.focus();
  } else if (button.dataset.action === "show-done") {
    state.showDone = true;
    els.showDone.checked = true;
    localStorage.setItem(storeKeys.showDone, "1");
    renderContent();
  }
});

els.select.addEventListener("change", (event) => {
  state.listUid = event.target.value;
  localStorage.setItem(storeKeys.list, state.listUid);
  state.picked = readPicked(state.listUid);
  load();
});

els.copy.addEventListener("click", async () => {
  const text = buildCopyText();
  if (!text) {
    toast("Nothing left to copy");
    return;
  }
  const copied = await copyText(text);
  toast(copied ? "List copied" : "Couldn't access the clipboard");
});

els.print.addEventListener("click", () => {
  const closed = [...document.querySelectorAll(".aisle:not([open])")];
  for (const section of closed) section.open = true;
  const restore = () => {
    for (const section of closed) section.open = false;
  };
  window.addEventListener("afterprint", restore, { once: true });
  window.setTimeout(restore, 60_000);
  window.print();
});

document.addEventListener("keydown", (event) => {
  if (event.key !== "/" || event.metaKey || event.ctrlKey || event.altKey) return;
  const tag = document.activeElement?.tagName;
  if (tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT") return;
  event.preventDefault();
  els.search.focus();
});

if (isStatic) {
  const note = document.querySelector(".footer p");
  if (note) {
    note.textContent = "Static snapshot. Ticks and filters stay in this browser; nothing is written back to Paprika.";
  }
}

if (!isStatic) {
  window.setInterval(() => {
    if (document.visibilityState === "visible") load();
  }, 120_000);

  load();
} else {
  state.data = embeddedData;
  state.listUid = embeddedData.list?.uid ?? "";
  state.picked = readPicked(state.listUid);
  render();
}
