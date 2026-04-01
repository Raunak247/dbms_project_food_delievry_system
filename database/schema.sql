CREATE DATABASE IF NOT EXISTS food_ordering;
USE food_ordering;

CREATE TABLE IF NOT EXISTS users (
    id INT AUTO_INCREMENT PRIMARY KEY,
    name VARCHAR(100) NOT NULL,
    email VARCHAR(100) UNIQUE NOT NULL,
    password VARCHAR(255) NOT NULL
);

CREATE TABLE IF NOT EXISTS restaurants (
    id INT AUTO_INCREMENT PRIMARY KEY,
    name VARCHAR(100) NOT NULL UNIQUE
);

CREATE TABLE IF NOT EXISTS menu (
    id INT AUTO_INCREMENT PRIMARY KEY,
    restaurant_id INT NOT NULL,
    item_name VARCHAR(100) NOT NULL,
    price DECIMAL(10,2) NOT NULL,
    UNIQUE KEY uq_restaurant_item (restaurant_id, item_name),
    FOREIGN KEY (restaurant_id) REFERENCES restaurants(id)
);

CREATE TABLE IF NOT EXISTS orders (
    id INT AUTO_INCREMENT PRIMARY KEY,
    user_id INT NOT NULL,
    total DECIMAL(10,2) NOT NULL,
    status VARCHAR(50) DEFAULT 'PLACED',
    payment_reference VARCHAR(120) NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id)
);

CREATE TABLE IF NOT EXISTS order_items (
    id INT AUTO_INCREMENT PRIMARY KEY,
    order_id INT NOT NULL,
    menu_id INT NOT NULL,
    quantity INT NOT NULL,
    FOREIGN KEY (order_id) REFERENCES orders(id),
    FOREIGN KEY (menu_id) REFERENCES menu(id)
);

CREATE TABLE IF NOT EXISTS recovery_logs (
    id BIGINT AUTO_INCREMENT PRIMARY KEY,
    event_type VARCHAR(50) NOT NULL,
    order_id INT NULL,
    details JSON NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_orders_user_created ON orders(user_id, created_at);
CREATE INDEX idx_order_items_order ON order_items(order_id);

INSERT INTO restaurants (name)
VALUES ('Pizza Palace'), ('Burger Barn'), ('Sushi Spot')
ON DUPLICATE KEY UPDATE name = VALUES(name);

INSERT INTO menu (restaurant_id, item_name, price)
VALUES
    (1, 'Margherita Pizza', 249.00),
    (1, 'Farmhouse Pizza', 299.00),
    (2, 'Classic Veg Burger', 149.00),
    (2, 'Cheese Burger', 179.00),
    (3, 'California Roll', 220.00),
    (3, 'Veg Tempura', 190.00)
ON DUPLICATE KEY UPDATE price = VALUES(price);

-- View for join-based reporting
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
GROUP BY o.id, o.user_id, u.name, u.email, o.total, o.status, o.created_at;

-- Optional Advanced: Trigger to auto move status to PREPARING after insert
DROP TRIGGER IF EXISTS trg_orders_after_insert;
DELIMITER $$
CREATE TRIGGER trg_orders_after_insert
AFTER INSERT ON orders
FOR EACH ROW
BEGIN
    UPDATE orders
    SET status = 'PREPARING'
    WHERE id = NEW.id;

    INSERT INTO recovery_logs(event_type, order_id, details)
    VALUES ('ORDER_INSERT', NEW.id, JSON_OBJECT('total', NEW.total, 'user_id', NEW.user_id));
END $$
DELIMITER ;

-- Optional Advanced: Stored procedure for placing order shell
DROP PROCEDURE IF EXISTS sp_place_order;
DELIMITER $$
CREATE PROCEDURE sp_place_order(
    IN p_user_id INT,
    IN p_total DECIMAL(10,2),
    IN p_payment_reference VARCHAR(120)
)
BEGIN
    INSERT INTO orders (user_id, total, status)
    VALUES (p_user_id, p_total, 'PLACED');

    UPDATE orders
    SET payment_reference = p_payment_reference
    WHERE id = LAST_INSERT_ID();
END $$
DELIMITER ;
