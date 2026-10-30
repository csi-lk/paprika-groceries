import type { GroceryItem, GroceryList } from "./paprika";

// A small, realistic fixture for developing the UI without cloud credentials.
const mainList = "MOCK-LIST-MAIN";
const costcoList = "MOCK-LIST-COSTCO";

export function mockGroceries(): { lists: GroceryList[]; items: GroceryItem[] } {
  const lists: GroceryList[] = [
    { uid: mainList, name: "My Grocery List", is_default: true, order_flag: 0 },
    { uid: costcoList, name: "Costco run", is_default: false, order_flag: 1 },
  ];

  const item = (
    uid: string,
    name: string,
    ingredient: string,
    aisle: string,
    recipe: string | null = null,
    purchased = false,
    list = mainList,
  ): GroceryItem => ({
    uid,
    name,
    ingredient,
    aisle,
    recipe,
    purchased,
    list_uid: list,
    order_flag: 0,
    quantity: "",
    instruction: "",
    recipe_uid: null,
  });

  const items: GroceryItem[] = [
    item("MOCK-01", "2 large eggplants", "eggplant", "Produce", "Eggplant in red curry"),
    item("MOCK-02", "1 bunch coriander", "coriander", "Produce", "Thai green curry"),
    item("MOCK-03", "3 limes", "lime", "Produce", "Thai green curry"),
    item("MOCK-04", "500 g tomatoes", "tomatoes", "Produce", "Roast tomato pasta"),
    item("MOCK-05", "500 g chicken thigh fillets", "chicken thigh fillets", "Meat", "Thai green curry"),
    item("MOCK-06", "1 L full cream milk", "full cream milk", "Dairy", null),
    item("MOCK-07", "200 g Greek yoghurt", "greek yoghurt", "Dairy", "Eggplant in red curry"),
    item("MOCK-08", "100 g unsalted butter", "unsalted butter", "Dairy", "Blueberry lemon scones"),
    item("MOCK-09", "1 sourdough loaf", "sourdough loaf", "Bakery", null),
    item("MOCK-10", "400 ml coconut milk", "coconut milk", "Canned and Jar Goods", "Thai green curry"),
    item("MOCK-11", "2 tbsp red curry paste", "red curry paste", "Canned and Jar Goods", "Eggplant in red curry"),
    item("MOCK-12", "1 jar fish sauce", "fish sauce", "Condiments and Sauces", "Thai green curry"),
    item("MOCK-13", "500 g frozen peas", "frozen peas", "Frozen", null),
    item("MOCK-14", "1 kg jasmine rice", "jasmine rice", "Baking Goods", null, true),
    item("MOCK-15", "Dishwashing tablets", "dishwashing tablets", "Household", null),
    item("MOCK-COSTCO-1", "2 kg rolled oats", "rolled oats", "Baking Goods", null, false, costcoList),
    item("MOCK-COSTCO-2", "1.5 kg peanut butter", "peanut butter", "Canned and Jar Goods", null, false, costcoList),
    item("MOCK-COSTCO-3", "36 rolls toilet paper", "toilet paper", "Household", null, false, costcoList),
  ];

  return { lists, items };
}
