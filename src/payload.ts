import { defaultList, ensureLists, isPurchased, itemsForList, searchTermFor, woolworthsSearchUrl } from "./groceries";
import type { GroceryItem, GroceryList } from "./paprika";

export type PayloadItem = {
  uid: string;
  name: string;
  ingredient: string;
  quantity: string;
  aisle: string;
  recipe: string | null;
  recipeUid: string | null;
  instruction: string;
  purchased: boolean;
  orderFlag: number;
  searchTerm: string;
  woolworthsUrl: string;
};

export type PayloadList = {
  uid: string;
  name: string;
  isDefault: boolean;
  remaining: number;
};

export type GroceryPayload = {
  static: boolean;
  mock: boolean;
  fetchedAt: string;
  lists: PayloadList[];
  list: { uid: string; name: string } | null;
  items: PayloadItem[];
};

type PayloadOptions = {
  fetchedAt: string;
  static?: boolean;
  mock?: boolean;
};

/** Build the JSON shape shared by the server API and the static Pages build. */
export function buildPayload(
  lists: GroceryList[],
  items: GroceryItem[],
  requestedList: string | null,
  options: PayloadOptions,
): GroceryPayload {
  const available = ensureLists(lists, items).sort(
    (a, b) => (a.order_flag ?? 0) - (b.order_flag ?? 0) || a.name.localeCompare(b.name),
  );
  const list = available.find((candidate) => candidate.uid === requestedList) ?? defaultList(available);

  if (!list) {
    return {
      static: Boolean(options.static),
      mock: Boolean(options.mock),
      fetchedAt: options.fetchedAt,
      lists: [],
      list: null,
      items: [],
    };
  }

  const payloadItems = itemsForList(items, list.uid)
    .map((item) => ({
      uid: item.uid,
      name: item.name,
      ingredient: item.ingredient ?? "",
      quantity: item.quantity ?? "",
      aisle: item.aisle ?? "",
      recipe: item.recipe ?? null,
      recipeUid: item.recipe_uid ?? null,
      instruction: item.instruction ?? "",
      purchased: isPurchased(item.purchased),
      orderFlag: item.order_flag ?? 0,
      searchTerm: searchTermFor(item),
      woolworthsUrl: woolworthsSearchUrl(item),
    }))
    .sort((a, b) => (a.aisle || "\uffff").localeCompare(b.aisle || "\uffff") || a.name.localeCompare(b.name));

  const payloadLists = available.map((candidate) => ({
    uid: candidate.uid,
    name: candidate.name,
    isDefault: Boolean(candidate.is_default),
    remaining: itemsForList(items, candidate.uid).filter((item) => !isPurchased(item.purchased)).length,
  }));

  return {
    static: Boolean(options.static),
    mock: Boolean(options.mock),
    fetchedAt: options.fetchedAt,
    // A static snapshot cannot switch lists via the API; show the selected one only.
    lists: options.static ? payloadLists.filter((candidate) => candidate.uid === list.uid) : payloadLists,
    list: { uid: list.uid, name: list.name },
    items: payloadItems,
  };
}
