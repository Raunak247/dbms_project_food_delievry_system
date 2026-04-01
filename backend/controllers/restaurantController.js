const db = require("../config/db");
const { getCachedJson, setCachedJson } = require("../utils/cache");

async function getRestaurants(req, res, next) {
  try {
    const cacheKey = "restaurants:all";
    const cached = await getCachedJson(cacheKey);
    if (cached) {
      return res.json(cached);
    }

    const [rows] = await db.query("SELECT id, name FROM restaurants ORDER BY id");
    await setCachedJson(cacheKey, rows, 600);
    return res.json(rows);
  } catch (error) {
    return next(error);
  }
}

async function getRestaurantMenu(req, res, next) {
  try {
    const { id } = req.params;
    const cacheKey = `restaurants:${id}:menu`;
    const cached = await getCachedJson(cacheKey);
    if (cached) {
      return res.json(cached);
    }

    const [rows] = await db.query(
      "SELECT id, item_name, price, inventory_count FROM menu WHERE restaurant_id = ? ORDER BY id",
      [id]
    );
    await setCachedJson(cacheKey, rows, 300);
    return res.json(rows);
  } catch (error) {
    return next(error);
  }
}

module.exports = {
  getRestaurants,
  getRestaurantMenu
};
