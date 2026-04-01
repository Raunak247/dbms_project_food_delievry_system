const db = require("../config/db");
const { calculateDiscount } = require("./promoController");
const { emitToAll, emitToUser } = require("../utils/socket");

async function placeOrder(req, res, next) {
  const connection = await db.getConnection();

  try {
    const { items, promo_code } = req.body;
    const user_id = req.user?.id || req.body.user_id;

    if (!user_id || !Array.isArray(items) || items.length === 0) {
      connection.release();
      return res.status(400).json({ message: "user_id and items are required" });
    }

    await connection.beginTransaction();

    // Lock selected menu rows during pricing read to avoid concurrent anomalies.
    const menuIds = items.map((item) => item.menu_id);
    const placeholders = menuIds.map(() => "?").join(",");
    const [menuRows] = await connection.query(
      `SELECT id, price, inventory_count FROM menu WHERE id IN (${placeholders}) FOR UPDATE`,
      menuIds
    );

    if (menuRows.length !== menuIds.length) {
      await connection.rollback();
      connection.release();
      return res.status(400).json({ message: "One or more menu items are invalid" });
    }

    // Validate stock before creating the order.
    const inventoryMap = new Map(menuRows.map((row) => [row.id, Number(row.inventory_count ?? 0)]));
    for (const item of items) {
      const available = inventoryMap.get(item.menu_id);
      if (available === undefined) {
        await connection.rollback();
        connection.release();
        return res.status(400).json({ message: `Menu item ${item.menu_id} not found` });
      }

      if (available < item.quantity) {
        await connection.rollback();
        connection.release();
        return res.status(400).json({
          message: `Insufficient inventory for menu item ${item.menu_id}. Available: ${available}, requested: ${item.quantity}`
        });
      }
    }

    const priceMap = new Map(menuRows.map((row) => [row.id, Number(row.price)]));
    const computedTotal = items.reduce((sum, item) => {
      const qty = Number(item.quantity || 0);
      return sum + priceMap.get(item.menu_id) * qty;
    }, 0);

    let finalTotal = computedTotal;
    let promoDetails = null;

    if (promo_code) {
      const [promos] = await connection.query(
        "SELECT * FROM promo_codes WHERE code = ? FOR UPDATE",
        [String(promo_code).toUpperCase()]
      );

      if (promos.length === 0) {
        await connection.rollback();
        connection.release();
        return res.status(400).json({ message: "Invalid promo code" });
      }

      const promo = promos[0];
      const now = new Date();

      if (!promo.is_active || new Date(promo.valid_from) > now || (promo.valid_until && new Date(promo.valid_until) < now)) {
        await connection.rollback();
        connection.release();
        return res.status(400).json({ message: "Promo code is not active" });
      }

      if (promo.usage_limit !== null && promo.used_count >= promo.usage_limit) {
        await connection.rollback();
        connection.release();
        return res.status(400).json({ message: "Promo code usage limit reached" });
      }

      if (computedTotal < Number(promo.min_order_amount)) {
        await connection.rollback();
        connection.release();
        return res.status(400).json({
          message: `Minimum order amount for this promo is Rs. ${promo.min_order_amount}`
        });
      }

      const discountAmount = calculateDiscount(computedTotal, promo);
      finalTotal = Math.max(0, computedTotal - discountAmount);
      promoDetails = {
        id: promo.id,
        code: promo.code,
        discount_amount: Number(discountAmount.toFixed(2))
      };
    }

    const [orderResult] = await connection.query(
      "INSERT INTO orders (user_id, total, status) VALUES (?, ?, 'PLACED')",
      [user_id, Number(finalTotal.toFixed(2))]
    );

    const orderId = orderResult.insertId;

    for (const item of items) {
      await connection.query(
        "INSERT INTO order_items (order_id, menu_id, quantity) VALUES (?, ?, ?)",
        [orderId, item.menu_id, item.quantity]
      );

      const previousQuantity = inventoryMap.get(item.menu_id);
      const newQuantity = previousQuantity - item.quantity;

      await connection.query("UPDATE menu SET inventory_count = ? WHERE id = ?", [
        newQuantity,
        item.menu_id
      ]);

      await connection.query(
        `INSERT INTO inventory_logs (menu_id, order_id, quantity_change, previous_quantity, new_quantity, change_type)
         VALUES (?, ?, ?, ?, ?, 'ORDER_PLACED')`,
        [item.menu_id, orderId, -item.quantity, previousQuantity, newQuantity]
      );

      inventoryMap.set(item.menu_id, newQuantity);
    }

    if (promoDetails) {
      await connection.query(
        `INSERT INTO order_promotions (order_id, promo_code_id, original_total, discount_amount, final_total)
         VALUES (?, ?, ?, ?, ?)`,
        [
          orderId,
          promoDetails.id,
          Number(computedTotal.toFixed(2)),
          promoDetails.discount_amount,
          Number(finalTotal.toFixed(2))
        ]
      );

      await connection.query(
        "UPDATE promo_codes SET used_count = used_count + 1 WHERE id = ?",
        [promoDetails.id]
      );
    }

    await connection.query(
      "INSERT INTO recovery_logs (event_type, order_id, details) VALUES ('ORDER_PLACED', ?, ?)",
      [orderId, JSON.stringify({ user_id, subtotal: computedTotal, final_total: finalTotal, promo_code: promoDetails?.code || null, items })]
    );

    await connection.commit();
    connection.release();

    emitToAll("orderPlaced", {
      order_id: orderId,
      user_id,
      total: Number(finalTotal.toFixed(2)),
      promo: promoDetails,
    });
    emitToUser(user_id, "orderStatusUpdated", {
      order_id: orderId,
      status: "PLACED",
      total: Number(finalTotal.toFixed(2)),
    });

    return res.status(201).json({
      message: "Order placed",
      order_id: orderId,
      subtotal: Number(computedTotal.toFixed(2)),
      total: Number(finalTotal.toFixed(2)),
      promo: promoDetails
    });
  } catch (error) {
    await connection.rollback();
    try {
      await connection.query(
        "INSERT INTO recovery_logs (event_type, details) VALUES ('ORDER_ROLLBACK', ?)",
        [JSON.stringify({ reason: error.message })]
      );
    } catch (logError) {
      console.error("Failed to write rollback log", logError.message);
    }
    connection.release();
    return next(error);
  }
}

async function getUserOrders(req, res, next) {
  try {
    const userId = req.user?.id || req.params.userId;

    const [orders] = await db.query(
      `SELECT o.id, o.user_id, o.total, o.status, o.created_at,
              oi.menu_id, oi.quantity, m.item_name, m.price, m.restaurant_id
       FROM orders o
       LEFT JOIN order_items oi ON oi.order_id = o.id
       LEFT JOIN menu m ON m.id = oi.menu_id
       WHERE o.user_id = ?
       ORDER BY o.created_at DESC, oi.id ASC`,
      [userId]
    );

    const grouped = [];
    const map = new Map();

    for (const row of orders) {
      if (!map.has(row.id)) {
        map.set(row.id, {
          id: row.id,
          user_id: row.user_id,
          total: Number(row.total),
          status: row.status,
          created_at: row.created_at,
          restaurant_id: row.restaurant_id || null,
          items: []
        });
        grouped.push(map.get(row.id));
      }

      if (!map.get(row.id).restaurant_id && row.restaurant_id) {
        map.get(row.id).restaurant_id = row.restaurant_id;
      }

      if (row.menu_id) {
        map.get(row.id).items.push({
          menu_id: row.menu_id,
          item_name: row.item_name,
          price: Number(row.price),
          quantity: row.quantity
        });
      }
    }

    return res.json(grouped);
  } catch (error) {
    return next(error);
  }
}

async function getOrderSummary(req, res, next) {
  try {
    const [rows] = await db.query("SELECT * FROM order_summary_view ORDER BY created_at DESC");
    return res.json(rows);
  } catch (error) {
    return next(error);
  }
}

async function getTopUsers(req, res, next) {
  try {
    const [rows] = await db.query(
      `SELECT u.id, u.name, u.email,
              (SELECT COUNT(*) FROM orders o WHERE o.user_id = u.id) AS total_orders,
              (SELECT COALESCE(SUM(o.total), 0) FROM orders o WHERE o.user_id = u.id) AS total_spent
       FROM users u
       WHERE u.id IN (
         SELECT user_id
         FROM orders
         GROUP BY user_id
         HAVING COUNT(*) >= 1
       )
       ORDER BY total_spent DESC, total_orders DESC
       LIMIT 5`
    );

    return res.json(rows.map((row) => ({ ...row, total_spent: Number(row.total_spent) })));
  } catch (error) {
    return next(error);
  }
}

async function getRecoveryLogs(req, res, next) {
  try {
    const [rows] = await db.query(
      "SELECT id, event_type, order_id, details, created_at FROM recovery_logs ORDER BY id DESC LIMIT 50"
    );
    return res.json(rows);
  } catch (error) {
    return next(error);
  }
}

async function updateOrderStatus(req, res, next) {
  try {
    const { orderId } = req.params;
    const { status } = req.body;

    if (!status) {
      return res.status(400).json({ message: "status is required" });
    }

    const [existing] = await db.query("SELECT user_id, status FROM orders WHERE id = ?", [orderId]);
    if (existing.length === 0) {
      return res.status(404).json({ message: "Order not found" });
    }

    await db.query("UPDATE orders SET status = ? WHERE id = ?", [status, orderId]);
    await db.query(
      "INSERT INTO recovery_logs (event_type, order_id, details) VALUES ('ORDER_STATUS_UPDATE', ?, ?)",
      [orderId, JSON.stringify({ previous_status: existing[0].status, new_status: status })]
    );

    emitToUser(existing[0].user_id, "orderStatusUpdated", {
      order_id: Number(orderId),
      status,
    });
    emitToAll("orderStatusUpdated", {
      order_id: Number(orderId),
      status,
    });

    return res.json({ message: "Order status updated", order_id: Number(orderId), status });
  } catch (error) {
    return next(error);
  }
}

module.exports = {
  placeOrder,
  getUserOrders,
  getOrderSummary,
  getTopUsers,
  getRecoveryLogs,
  updateOrderStatus,
};
