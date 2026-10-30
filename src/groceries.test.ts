import { describe, expect, test } from "bun:test";
import { defaultList, isPurchased, itemsForList, searchTermFor, woolworthsSearchUrl } from "./groceries";
import type { GroceryItem, GroceryList } from "./paprika";

describe("Woolworths search links", () => {
  test("prefers Paprika's canonical ingredient", () => {
    expect(searchTermFor({ name: "2 large eggplants", ingredient: "eggplant" })).toBe("eggplant");
  });

  test("falls back to the display name", () => {
    expect(searchTermFor({ name: "  Dishwashing   tablets ", ingredient: "" })).toBe("Dishwashing tablets");
  });

  test("encodes the search term", () => {
    expect(woolworthsSearchUrl({ name: "crème fraîche", ingredient: "crème fraîche" })).toBe(
      "https://www.woolworths.com.au/shop/search/products?searchTerm=cr%C3%A8me%20fra%C3%AEche",
    );
  });
});

describe("grocery lists", () => {
  const lists: GroceryList[] = [
    { uid: "one", name: "Weekly shop", is_default: false },
    { uid: "two", name: "My Grocery List", is_default: true },
  ];

  test("picks the default list", () => {
    expect(defaultList(lists)?.uid).toBe("two");
  });

  test("filters deleted items and other lists", () => {
    const items: GroceryItem[] = [
      { uid: "a", name: "milk", list_uid: "two" },
      { uid: "b", name: "bread", list_uid: "one" },
      { uid: "c", name: "eggs", list_uid: "two", deleted: true },
    ];
    expect(itemsForList(items, "two").map((item) => item.uid)).toEqual(["a"]);
  });

  test("matches list UIDs without case sensitivity", () => {
    const items: GroceryItem[] = [{ uid: "a", name: "milk", list_uid: "ABC-DEF" }];
    expect(itemsForList(items, "abc-def").map((item) => item.uid)).toEqual(["a"]);
  });

  test("treats booleans, 0/1 and string flags as purchased", () => {
    expect([true, 1, "1", "true"].every(isPurchased)).toBe(true);
    expect([false, 0, "0", "false", null, undefined].some(isPurchased)).toBe(false);
  });
});
