const db = require("../config/db");

async function getInventory(req, res, next) {
  try {
    const [inventory] = await db.query(`
      SELECT 
        m.id,
        m.item_name,
        r.name AS restaurant_name,
        m.price,
        m.inventory_count,
        CASE 
          WHEN m.inventory_count = 0 THEN 'Out of Stock'
          WHEN m.inventory_count <= 10 THEN 'Low Stock'
          ELSE 'In Stock'
        END AS stock_status
      FROM menu m
      JOIN restaurants r ON r.id = m.restaurant_id
      ORDER BY r.name, m.item_name
    `);

    res.json(inventory);
  } catch (error) {
    next(error);
  }
}

async function getRestaurantInventory(req, res, next) {
  try {
    const { restaurant_id } = req.params;

    const [inventory] = await db.query(
      `SELECT 
        id,
        item_name,
        price,
        inventory_count,
        CASE 
          WHEN inventory_count = 0 THEN 'Out of Stock'
          WHEN inventory_count <= 10 THEN 'Low Stock'
          ELSE 'In Stock'
        END AS stock_status
      FROM menu
      WHERE restaurant_id = ?
      ORDER BY item_name`,
      [restaurant_id]
    );

    const lowStockItems = inventory.filter((item) => item.stock_status !== "In Stock");

    res.json({
      restaurant_id,
      total_items: inventory.length,
      low_stock_count: lowStockItems.length,
      inventory: inventory,
    });
  } catch (error) {
    next(error);
  }
}

async function checkInventory(req, res, next) {
  try {
    const { items } = req.body;

    if (!Array.isArray(items) || items.length === 0) {
      return res.status(400).json({ message: "items array is required" });
    }

    const menuIds = items.map((item) => item.menu_id);
    const [dbItems] = await db.query(
      `SELECT id, item_name, inventory_count FROM menu WHERE id IN (${menuIds.map(() => "?").join(",")})`,
      menuIds
    );

    const itemMap = new Map(dbItems.map((item) => [item.id, item]));
    const availabilityStatus = items.map((item) => {
      const dbItem = itemMap.get(item.menu_id);
      if (!dbItem) {
        return { menu_id: item.menu_id, available: false, message: "Item not found" };
      }

      const requested = item.quantity;
      const available = dbItem.inventory_count;

      return {
        menu_id: item.menu_id,
        item_name: dbItem.item_name,
        requested,
        available,
        in_stock: available >= requested,
        message: available >= requested ? "Available" : `Only ${available} available`,
      };
    });

    const allAvailable = availabilityStatus.every((item) => item.in_stock);

    res.json({
      all_available: allAvailable,
      items: availabilityStatus,
    });
  } catch (error) {
    next(error);
  }
}

async function updateInventory(req, res, next) {
  const connection = await db.getConnection();

  try {
    const { menu_id } = req.params;
    const { quantity_change, notes, change_type = "MANUAL" } = req.body;

    if (!menu_id || quantity_change === undefined) {
      connection.release();
      return res.status(400).json({ message: "menu_id and quantity_change are required" });
    }

    await connection.beginTransaction();

    // Lock and fetch current inventory
    const [items] = await connection.query(
      "SELECT inventory_count FROM menu WHERE id = ? FOR UPDATE",
      [menu_id]
    );

    if (items.length === 0) {
      await connection.rollback();
      connection.release();
      return res.status(404).json({ message: "Menu item not found" });
    }

    const previousQuantity = items[0].inventory_count;
    const newQuantity = previousQuantity + quantity_change;

    if (newQuantity < 0) {
      await connection.rollback();
      connection.release();
      return res.status(400).json({
        message: `Cannot reduce inventory below 0. Current: ${previousQuantity}, Change: ${quantity_change}`,
      });
    }

    // Update menu inventory
    await connection.query("UPDATE menu SET inventory_count = ? WHERE id = ?", [newQuantity, menu_id]);

    // Log the change
    await connection.query(
      `INSERT INTO inventory_logs (menu_id, quantity_change, previous_quantity, new_quantity, change_type, notes)
       VALUES (?, ?, ?, ?, ?, ?)`,
      [menu_id, quantity_change, previousQuantity, newQuantity, change_type, notes || null]
    );

    await connection.commit();
    connection.release();

    res.json({
      message: "Inventory updated successfully",
      menu_id,
      previous_quantity: previousQuantity,
      new_quantity: newQuantity,
      change: quantity_change,
    });
  } catch (error) {
    await connection.rollback();
    connection.release();
    next(error);
  }
}

async function getInventoryLogs(req, res, next) {
  try {
    const { menu_id } = req.params;
    const limit = req.query.limit || 50;

    const [logs] = await db.query(
      `SELECT 
        il.id,
        il.menu_id,
        m.item_name,
        il.order_id,
        il.quantity_change,
        il.previous_quantity,
        il.new_quantity,
        il.change_type,
        il.notes,
        il.created_at
      FROM inventory_logs il
      LEFT JOIN menu m ON m.id = il.menu_id
      WHERE il.menu_id = ?
      ORDER BY il.created_at DESC
      LIMIT ?`,
      [menu_id, Number(limit)]
    );

    res.json({
      menu_id,
      total_logs: logs.length,
      logs,
    });
  } catch (error) {
    next(error);
  }
}

async function getLowStockItems(req, res, next) {
  try {
    const threshold = req.query.threshold || 10;

    const [lowStockItems] = await db.query(
      `SELECT 
        m.id,
        m.item_name,
        m.inventory_count,
        r.name AS restaurant_name,
        m.price
      FROM menu m
      JOIN restaurants r ON r.id = m.restaurant_id
      WHERE m.inventory_count <= ?
      ORDER BY m.inventory_count ASC, r.name`,
      [Number(threshold)]
    );

    res.json({
      threshold: Number(threshold),
      low_stock_count: lowStockItems.length,
      items: lowStockItems,
    });
  } catch (error) {
    next(error);
  }
}

module.exports = {
  getInventory,
  getRestaurantInventory,
  checkInventory,
  updateInventory,
  getInventoryLogs,
  getLowStockItems,
};
