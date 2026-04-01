const db = require("../config/db");
const { getCachedJson, setCachedJson, deleteCachedKey } = require("../utils/cache");

function calculateDiscount(subtotal, promo) {
  if (promo.discount_type === "PERCENTAGE") {
    const percentageDiscount = (subtotal * promo.discount_value) / 100;
    if (promo.max_discount_amount) {
      return Math.min(percentageDiscount, promo.max_discount_amount);
    }
    return percentageDiscount;
  }

  if (promo.discount_type === "FIXED") {
    return Math.min(promo.discount_value, subtotal);
  }

  return 0;
}

async function getActivePromos(req, res, next) {
  try {
    const cacheKey = "promos:active";
    const cached = await getCachedJson(cacheKey);
    if (cached) {
      return res.json(cached);
    }

    const [promos] = await db.query(
      `SELECT 
        id,
        code,
        description,
        discount_type,
        discount_value,
        min_order_amount,
        max_discount_amount,
        usage_limit,
        used_count,
        valid_from,
        valid_until,
        is_active
      FROM promo_codes
      WHERE is_active = TRUE
        AND valid_from <= NOW()
        AND (valid_until IS NULL OR valid_until >= NOW())
        AND (usage_limit IS NULL OR used_count < usage_limit)
      ORDER BY created_at DESC`
    );

    await setCachedJson(cacheKey, promos, 180);
    res.json(promos);
  } catch (error) {
    next(error);
  }
}

async function validatePromo(req, res, next) {
  try {
    const { code, subtotal } = req.body;

    if (!code || subtotal === undefined) {
      return res.status(400).json({ message: "code and subtotal are required" });
    }

    const [promos] = await db.query(
      `SELECT * FROM promo_codes WHERE code = ?`,
      [code.toUpperCase()]
    );

    if (promos.length === 0) {
      return res.status(404).json({ valid: false, message: "Promo code not found" });
    }

    const promo = promos[0];

    if (!promo.is_active) {
      return res.status(400).json({ valid: false, message: "Promo code is inactive" });
    }

    const now = new Date();
    if (new Date(promo.valid_from) > now) {
      return res.status(400).json({ valid: false, message: "Promo code is not yet active" });
    }

    if (promo.valid_until && new Date(promo.valid_until) < now) {
      return res.status(400).json({ valid: false, message: "Promo code has expired" });
    }

    if (promo.usage_limit !== null && promo.used_count >= promo.usage_limit) {
      return res.status(400).json({ valid: false, message: "Promo code usage limit reached" });
    }

    if (Number(subtotal) < Number(promo.min_order_amount)) {
      return res.status(400).json({
        valid: false,
        message: `Minimum order amount is Rs. ${promo.min_order_amount}`,
      });
    }

    const discountAmount = calculateDiscount(Number(subtotal), promo);
    const finalTotal = Math.max(0, Number(subtotal) - discountAmount);

    res.json({
      valid: true,
      promo: {
        id: promo.id,
        code: promo.code,
        description: promo.description,
        discount_type: promo.discount_type,
        discount_value: Number(promo.discount_value),
      },
      pricing: {
        subtotal: Number(subtotal),
        discount_amount: Number(discountAmount.toFixed(2)),
        final_total: Number(finalTotal.toFixed(2)),
      },
    });
  } catch (error) {
    next(error);
  }
}

async function createPromo(req, res, next) {
  try {
    const {
      code,
      description,
      discount_type,
      discount_value,
      min_order_amount = 0,
      max_discount_amount,
      usage_limit,
      valid_until,
      is_active = true,
    } = req.body;

    if (!code || !discount_type || !discount_value) {
      return res.status(400).json({
        message: "code, discount_type, and discount_value are required",
      });
    }

    if (!["PERCENTAGE", "FIXED"].includes(discount_type)) {
      return res.status(400).json({ message: "discount_type must be PERCENTAGE or FIXED" });
    }

    const [existing] = await db.query("SELECT id FROM promo_codes WHERE code = ?", [code.toUpperCase()]);
    if (existing.length > 0) {
      return res.status(400).json({ message: "Promo code already exists" });
    }

    const [result] = await db.query(
      `INSERT INTO promo_codes (
        code, description, discount_type, discount_value, min_order_amount,
        max_discount_amount, usage_limit, valid_until, is_active
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        code.toUpperCase(),
        description || null,
        discount_type,
        discount_value,
        min_order_amount,
        max_discount_amount || null,
        usage_limit || null,
        valid_until || null,
        is_active,
      ]
    );

    await deleteCachedKey("promos:active");

    res.status(201).json({
      message: "Promo code created successfully",
      promo_id: result.insertId,
    });
  } catch (error) {
    next(error);
  }
}

module.exports = {
  getActivePromos,
  validatePromo,
  createPromo,
  calculateDiscount,
};
