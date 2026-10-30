import type { GroceryItem, GroceryList } from "./paprika";

export const woolworthsSearchBase = "https://www.woolworths.com.au/shop/search/products?searchTerm=";

/** Paprika keeps a lower-case canonical ingredient; prefer it over the display name. */
export function searchTermFor(item: Pick<GroceryItem, "ingredient" | "name">): string {
  const ingredient = (item.ingredient ?? "").trim();
  const value = ingredient.length > 0 ? ingredient : item.name;
  return value.replace(/\s+/g, " ").trim();
}

export function woolworthsSearchUrl(item: Pick<GroceryItem, "ingredient" | "name">): string {
  const term = searchTermFor(item);
  return term.length > 0 ? `${woolworthsSearchBase}${encodeURIComponent(term)}` : "https://www.woolworths.com.au/shop";
}

export function defaultList(lists: GroceryList[]): GroceryList | undefined {
  return lists.find((list) => list.is_default) ?? lists[0];
}

/** Older or partial API responses may omit grocerylists; derive them from items. */
export function ensureLists(lists: GroceryList[], items: GroceryItem[]): GroceryList[] {
  if (lists.length > 0) return lists;
  const uids = [...new Set(items.map((item) => item.list_uid).filter((uid): uid is string => Boolean(uid)))];
  return uids.map((uid, index) => ({
    uid,
    name: index === 0 ? "My Grocery List" : `Grocery list ${index + 1}`,
    is_default: index === 0,
    order_flag: index,
  }));
}

/** Paprika has returned 0/1 and booleans over its lifetime; treat both consistently. */
export function isPurchased(value: unknown): boolean {
  return value === true || value === 1 || value === "1" || value === "true";
}

export function itemsForList(items: GroceryItem[], listUid: string): GroceryItem[] {
  const target = listUid.toLowerCase();
  return items.filter((item) => !item.deleted && (item.list_uid ?? "").toLowerCase() === target);
}
