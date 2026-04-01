const db = require("./db");

async function ensureIndex(tableName, indexName, definition) {
  const [rows] = await db.query(
    `SELECT 1 FROM information_schema.statistics
     WHERE table_schema = DATABASE()
       AND table_name = ?
       AND index_name = ?
     LIMIT 1`,
    [tableName, indexName]
  );

  if (rows.length === 0) {
    await db.query(`CREATE INDEX ${indexName} ON ${tableName} (${definition})`);
  }
}

async function initDb() {
  await db.query(`
    CREATE TABLE IF NOT EXISTS users (
      id INT AUTO_INCREMENT PRIMARY KEY,
      name VARCHAR(100) NOT NULL,
      email VARCHAR(100) UNIQUE NOT NULL,
      password VARCHAR(255) NOT NULL
    )
  `);

  await db.query(`
    CREATE TABLE IF NOT EXISTS restaurants (
      id INT AUTO_INCREMENT PRIMARY KEY,
      name VARCHAR(100) NOT NULL UNIQUE
    )
  `);

  await db.query(`
    CREATE TABLE IF NOT EXISTS menu (
      id INT AUTO_INCREMENT PRIMARY KEY,
      restaurant_id INT NOT NULL,
      item_name VARCHAR(100) NOT NULL,
      price DECIMAL(10,2) NOT NULL,
      UNIQUE KEY uq_restaurant_item (restaurant_id, item_name),
      FOREIGN KEY (restaurant_id) REFERENCES restaurants(id)
    )
  `);

    // Add inventory column if it doesn't exist (for backward compatibility)
    const [menuColumns] = await db.query(
      `SELECT COLUMN_NAME FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_NAME = 'menu' AND COLUMN_NAME = 'inventory_count'`
    );
    if (menuColumns.length === 0) {
      await db.query(`ALTER TABLE menu ADD COLUMN inventory_count INT DEFAULT 100`);
    }

  await db.query(`
    CREATE TABLE IF NOT EXISTS orders (
      id INT AUTO_INCREMENT PRIMARY KEY,
      user_id INT NOT NULL,
      total DECIMAL(10,2) NOT NULL,
      status VARCHAR(50) DEFAULT 'PLACED',
      payment_reference VARCHAR(120) NULL,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (user_id) REFERENCES users(id)
    )
  `);

  await db.query(`
    CREATE TABLE IF NOT EXISTS order_items (
      id INT AUTO_INCREMENT PRIMARY KEY,
      order_id INT NOT NULL,
      menu_id INT NOT NULL,
      quantity INT NOT NULL,
      FOREIGN KEY (order_id) REFERENCES orders(id),
      FOREIGN KEY (menu_id) REFERENCES menu(id)
    )
  `);

  await db.query(`
    CREATE TABLE IF NOT EXISTS recovery_logs (
      id BIGINT AUTO_INCREMENT PRIMARY KEY,
      event_type VARCHAR(50) NOT NULL,
      order_id INT NULL,
      details JSON NULL,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )
  `);

  await db.query(`
    CREATE TABLE IF NOT EXISTS reviews (
      id INT AUTO_INCREMENT PRIMARY KEY,
      order_id INT NOT NULL,
      user_id INT NOT NULL,
      restaurant_id INT NOT NULL,
      rating INT CHECK (rating >= 1 AND rating <= 5) NOT NULL,
      comment TEXT NULL,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (order_id) REFERENCES orders(id),
      FOREIGN KEY (user_id) REFERENCES users(id),
      FOREIGN KEY (restaurant_id) REFERENCES restaurants(id)
    )
  `);

    await db.query(`
      CREATE TABLE IF NOT EXISTS inventory_logs (
        id BIGINT AUTO_INCREMENT PRIMARY KEY,
        menu_id INT NOT NULL,
        order_id INT NULL,
        quantity_change INT NOT NULL,
        previous_quantity INT NOT NULL,
        new_quantity INT NOT NULL,
        change_type VARCHAR(50) NOT NULL,
        notes TEXT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (menu_id) REFERENCES menu(id),
        FOREIGN KEY (order_id) REFERENCES orders(id)
      )
    `);

    await db.query(`
      CREATE TABLE IF NOT EXISTS promo_codes (
        id INT AUTO_INCREMENT PRIMARY KEY,
        code VARCHAR(50) NOT NULL UNIQUE,
        description VARCHAR(255) NULL,
        discount_type ENUM('PERCENTAGE', 'FIXED') NOT NULL,
        discount_value DECIMAL(10,2) NOT NULL,
        min_order_amount DECIMAL(10,2) DEFAULT 0,
        max_discount_amount DECIMAL(10,2) NULL,
        usage_limit INT DEFAULT NULL,
        used_count INT DEFAULT 0,
        is_active BOOLEAN DEFAULT TRUE,
        valid_from TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        valid_until TIMESTAMP NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);

    await db.query(`
      CREATE TABLE IF NOT EXISTS order_promotions (
        id INT AUTO_INCREMENT PRIMARY KEY,
        order_id INT NOT NULL,
        promo_code_id INT NOT NULL,
        original_total DECIMAL(10,2) NOT NULL,
        discount_amount DECIMAL(10,2) NOT NULL,
        final_total DECIMAL(10,2) NOT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (order_id) REFERENCES orders(id),
        FOREIGN KEY (promo_code_id) REFERENCES promo_codes(id)
      )
    `);

  await ensureIndex("orders", "idx_orders_user_created", "user_id, created_at");
  await ensureIndex("order_items", "idx_order_items_order", "order_id");

  await db.query(`
    INSERT INTO restaurants (name)
    VALUES ('Pizza Palace'), ('Burger Barn'), ('Sushi Spot')
    ON DUPLICATE KEY UPDATE name = VALUES(name)
  `);

  await db.query(`
    INSERT INTO menu (restaurant_id, item_name, price)
    VALUES
      (1, 'Margherita Pizza', 249.00),
      (1, 'Farmhouse Pizza', 299.00),
      (2, 'Classic Veg Burger', 149.00),
      (2, 'Cheese Burger', 179.00),
      (3, 'California Roll', 220.00),
      (3, 'Veg Tempura', 190.00)
    ON DUPLICATE KEY UPDATE price = VALUES(price)
  `);

  await db.query(`
    INSERT INTO promo_codes (code, description, discount_type, discount_value, min_order_amount, max_discount_amount, usage_limit, is_active)
    VALUES
      ('WELCOME20', '20% off on your first orders', 'PERCENTAGE', 20, 200, 100, 1000, TRUE),
      ('SAVE50', 'Flat Rs.50 off on orders above Rs.300', 'FIXED', 50, 300, NULL, 500, TRUE),
      ('WEEKEND15', '15% weekend special', 'PERCENTAGE', 15, 250, 80, 300, TRUE)
    ON DUPLICATE KEY UPDATE
      description = VALUES(description),
      discount_type = VALUES(discount_type),
      discount_value = VALUES(discount_value),
      min_order_amount = VALUES(min_order_amount),
      max_discount_amount = VALUES(max_discount_amount),
      usage_limit = VALUES(usage_limit),
      is_active = VALUES(is_active)
  `);

  await db.query(`
    CREATE OR REPLACE VIEW order_summary_view AS
    SELECT
      o.id AS order_id,
      o.user_id,
      u.name AS user_name,
      u.email,
      o.total,
      o.status,
      o.created_at,
      COUNT(oi.id) AS line_items,
      COALESCE(SUM(oi.quantity), 0) AS total_quantity
    FROM orders o
    JOIN users u ON u.id = o.user_id
    LEFT JOIN order_items oi ON oi.order_id = o.id
    GROUP BY o.id, o.user_id, u.name, u.email, o.total, o.status, o.created_at
  `);
}

module.exports = initDb;
