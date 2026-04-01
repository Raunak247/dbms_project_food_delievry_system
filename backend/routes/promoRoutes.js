const express = require("express");
const {
  getActivePromos,
  validatePromo,
  createPromo,
} = require("../controllers/promoController");

const router = express.Router();

// GET - Get all active promo codes
router.get("/", getActivePromos);

// POST - Validate promo code with subtotal
router.post("/validate", validatePromo);

// POST - Create new promo code (admin)
router.post("/", createPromo);

module.exports = router;
