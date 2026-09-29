import pool from "./db.js";

export const initDb = async () => {
  let connection;
  try {
    connection = await pool.getConnection();

    // 1. Users table
    await connection.query(`
      CREATE TABLE IF NOT EXISTS users (
        id INT AUTO_INCREMENT PRIMARY KEY,
        full_name VARCHAR(100) NOT NULL,
        email VARCHAR(225) UNIQUE NOT NULL,
        password_hash VARCHAR(225) NOT NULL,
        phone_number VARCHAR(20) UNIQUE NOT NULL,
        role ENUM('customer', 'restaurant_owner', 'driver', 'admin') NOT NULL DEFAULT 'customer',
        is_active BOOLEAN DEFAULT true,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
      );
    `);

    // 2. Addresses table
    await connection.query(`
      CREATE TABLE IF NOT EXISTS addresses (
        id INT AUTO_INCREMENT PRIMARY KEY,
        user_id INT NOT NULL,
        address_line_1 VARCHAR(225) NOT NULL,
        address_line_2 VARCHAR(225),
        city VARCHAR(225) NOT NULL,
        postal_code VARCHAR(225) NOT NULL,
        is_default BOOLEAN DEFAULT false,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
      );
    `);

    // 3. Restaurants table
    await connection.query(`
      CREATE TABLE IF NOT EXISTS restaurants (
        id INT AUTO_INCREMENT PRIMARY KEY,
        owner_id INT NOT NULL,
        name VARCHAR(225) NOT NULL,
        phone_number VARCHAR(20) NOT NULL,
        address VARCHAR(225),
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        FOREIGN KEY (owner_id) REFERENCES users(id)
      );
    `);

    // 4. Menu categories
    await connection.query(`
      CREATE TABLE IF NOT EXISTS menu_categories (
        id INT AUTO_INCREMENT PRIMARY KEY,
        restaurant_id INT NOT NULL,
        name VARCHAR(225) NOT NULL,
        display_order INT DEFAULT 0,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (restaurant_id) REFERENCES restaurants(id) ON DELETE CASCADE
      );
    `);

    // 5. Menu items
    await connection.query(`
      CREATE TABLE IF NOT EXISTS menu_items (
        id INT AUTO_INCREMENT PRIMARY KEY,
        category_id INT NOT NULL,
        name VARCHAR(225) NOT NULL,
        price_cents INT NOT NULL,
        image_url VARCHAR(500),
        is_available BOOLEAN DEFAULT true,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        FOREIGN KEY (category_id) REFERENCES menu_categories(id) ON DELETE CASCADE
      );
    `);

    // 6. Menu options
    await connection.query(`
      CREATE TABLE IF NOT EXISTS menu_options (
        id INT AUTO_INCREMENT PRIMARY KEY,
        menu_item_id INT NOT NULL,
        name VARCHAR(225) NOT NULL,
        additional_price_cents INT NOT NULL DEFAULT 0,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (menu_item_id) REFERENCES menu_items(id) ON DELETE CASCADE
      );
    `);

    // 7. Orders table (FIXED: references addresses(id))
    await connection.query(`
      CREATE TABLE IF NOT EXISTS orders (
        id INT AUTO_INCREMENT PRIMARY KEY,
        customer_id INT NOT NULL,
        restaurant_id INT NOT NULL,
        delivery_address_id INT NOT NULL,
        status ENUM('created', 'accepted', 'preparing', 'out_for_delivery', 'delivered', 'cancelled') NOT NULL DEFAULT 'created',
        subtotal_cents INT NOT NULL,
        delivery_fee_cents INT NOT NULL,
        total_cents INT NOT NULL,
        special_instruction TEXT,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        FOREIGN KEY (customer_id) REFERENCES users(id),
        FOREIGN KEY (restaurant_id) REFERENCES restaurants(id),
        FOREIGN KEY (delivery_address_id) REFERENCES addresses(id)
      );
    `);

    // 8. Order items
    await connection.query(`
      CREATE TABLE IF NOT EXISTS order_items (
        id INT AUTO_INCREMENT PRIMARY KEY,
        order_id INT NOT NULL,
        menu_item_id INT NOT NULL,
        item_name VARCHAR(225) NOT NULL,
        unit_price_cents INT NOT NULL,
        quantity INT NOT NULL CHECK(quantity > 0),
        FOREIGN KEY (order_id) REFERENCES orders(id) ON DELETE CASCADE,
        FOREIGN KEY (menu_item_id) REFERENCES menu_items(id)
      );
    `);

    // 9. Order item options
    await connection.query(`
      CREATE TABLE IF NOT EXISTS order_item_options (
        id INT AUTO_INCREMENT PRIMARY KEY,
        order_item_id INT NOT NULL,
        menu_option_id INT NOT NULL,
        option_name VARCHAR(225) NOT NULL,
        price_cents INT NOT NULL,
        FOREIGN KEY (order_item_id) REFERENCES order_items(id) ON DELETE CASCADE,
        FOREIGN KEY (menu_option_id) REFERENCES menu_options(id)
      );
    `);

    // 10. Payments table
    await connection.query(`
      CREATE TABLE IF NOT EXISTS payments (
        id INT AUTO_INCREMENT PRIMARY KEY,
        order_id INT NOT NULL UNIQUE,
        amount_cents INT NOT NULL,
        provider VARCHAR(225) NOT NULL,
        transaction_id VARCHAR(225) UNIQUE,
        status ENUM('pending', 'completed', 'failed', 'refunded') NOT NULL DEFAULT 'pending',
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        FOREIGN KEY (order_id) REFERENCES orders(id)
      );
    `);

    // 11. Deliveries table
    await connection.query(`
      CREATE TABLE IF NOT EXISTS deliveries (
        id INT AUTO_INCREMENT PRIMARY KEY,
        orders_id INT NOT NULL UNIQUE,
        driver_id INT NOT NULL,
        status ENUM('assigned', 'picked_up', 'en_route', 'delivered') NOT NULL DEFAULT 'assigned',
        pickup_time TIMESTAMP NULL,
        delivery_time TIMESTAMP NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (orders_id) REFERENCES orders(id) ON DELETE CASCADE,
        FOREIGN KEY (driver_id) REFERENCES users(id)
      );
    `);

    console.log("✅ All MySQL database tables created successfully");
  } catch (error) {
    console.error("❌ Error initializing database tables:", error);
    throw error;
  } finally {
    if (connection) connection.release();
  }
};
