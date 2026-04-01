const express = require("express");
const {
  getRestaurants,
  getRestaurantMenu
} = require("../controllers/restaurantController");

const router = express.Router();

router.get("/", getRestaurants);
router.get("/:id/menu", getRestaurantMenu);

module.exports = router;
