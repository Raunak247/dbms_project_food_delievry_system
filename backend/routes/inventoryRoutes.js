const express = require("express");
const {
  getInventory,
  getRestaurantInventory,
  checkInventory,
  updateInventory,
  getInventoryLogs,
  getLowStockItems,
} = require("../controllers/inventoryController");

const router = express.Router();

// GET - Get all inventory
router.get("/", getInventory);

// GET - Get low stock items
router.get("/low-stock", getLowStockItems);

// GET - Get inventory for a restaurant
router.get("/restaurant/:restaurant_id", getRestaurantInventory);

// POST - Check inventory availability
router.post("/check", checkInventory);

// PUT - Update inventory
router.put("/:menu_id", updateInventory);

// GET - Get inventory logs for an item
router.get("/logs/:menu_id", getInventoryLogs);

module.exports = router;
