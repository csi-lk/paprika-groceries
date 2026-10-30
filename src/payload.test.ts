import { describe, expect, test } from "bun:test";
import { ensureLists } from "./groceries";
import type { GroceryItem, GroceryList } from "./paprika";
import { buildPayload } from "./payload";

const lists: GroceryList[] = [
  { uid: "main", name: "My Grocery List", is_default: true, order_flag: 0 },
  { uid: "costco", name: "Costco", is_default: false, order_flag: 1 },
];

const items: GroceryItem[] = [
  { uid: "1", name: "2 eggplants", ingredient: "eggplant", aisle: "Produce", list_uid: "main", purchased: 0 },
  { uid: "2", name: "1 kg rice", ingredient: "rice", aisle: "Baking Goods", list_uid: "main", purchased: 1 },
  { uid: "3", name: "Oats", ingredient: "oats", aisle: "Baking Goods", list_uid: "costco" },
];

describe("payload", () => {
  test("builds the default list with search links and purchased state", () => {
    const payload = buildPayload(lists, items, null, { fetchedAt: "2026-10-30T00:00:00.000Z" });
    expect(payload.list?.uid).toBe("main");
    expect(payload.items.map((item) => item.uid)).toEqual(["2", "1"]);
    expect(payload.items.find((item) => item.uid === "2")?.purchased).toBe(true);
    expect(payload.items.find((item) => item.uid === "1")?.searchTerm).toBe("eggplant");
    expect(payload.lists.find((list) => list.uid === "main")?.remaining).toBe(1);
    expect(payload.lists.find((list) => list.uid === "costco")?.remaining).toBe(1);
  });

  test("static payloads expose only the selected list", () => {
    const payload = buildPayload(lists, items, "costco", { fetchedAt: "2026-10-30T00:00:00.000Z", static: true });
    expect(payload.list?.uid).toBe("costco");
    expect(payload.lists.map((list) => list.uid)).toEqual(["costco"]);
    expect(payload.items.map((item) => item.uid)).toEqual(["3"]);
    expect(payload.static).toBe(true);
  });

  test("derives lists when the grocerylists endpoint is unavailable", () => {
    const derived = ensureLists([], items);
    expect(derived).toHaveLength(2);
    expect(derived[0]?.is_default).toBe(true);
    expect(buildPayload([], items, null, { fetchedAt: "2026-10-30T00:00:00.000Z" }).list?.uid).toBe("main");
  });

  test("returns an empty payload when there are no lists or items", () => {
    const payload = buildPayload([], [], null, { fetchedAt: "2026-10-30T00:00:00.000Z" });
    expect(payload.list).toBeNull();
    expect(payload.items).toEqual([]);
    expect(payload.lists).toEqual([]);
  });
});
