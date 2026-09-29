import pool from "../config/db.js";

class RestaurantService {
  // Helper: Verify restaurant ownership
  async verifyOwnerShip(restaurantId, ownerId) {
    const [rows] = await pool.query(
      `SELECT id, owner_id
       FROM restaurants
       WHERE id = ?`,
      [restaurantId],
    );

    if (rows.length === 0) {
      throw new Error("Restaurant not found");
    }

    if (Number(rows[0].owner_id) !== Number(ownerId)) {
      throw new Error("Unauthorized: You do not own this restaurant");
    }

    return rows[0];
  }

  // 1. Create restaurant
  async createRestaurant(
    ownerId,
    { name, description, address, phone_number },
  ) {
    const [result] = await pool.query(
      `INSERT INTO restaurants
        (owner_id, name, description, address, phone_number)
       VALUES (?, ?, ?, ?, ?)`,
      [ownerId, name, description || null, address, phone_number],
    );

    return this.getRestaurantById(result.insertId);
  }

  // 2. Get all restaurants
  async getAllRestaurants() {
    const [rows] = await pool.query(
      `SELECT
         id,
         owner_id,
         name,
         description,
         address,
         phone_number,
         created_at
       FROM restaurants
       ORDER BY name ASC`,
    );

    return rows;
  }

  // 3. Get restaurant by ID
  async getRestaurantById(id) {
    const [rows] = await pool.query(
      `SELECT
         id,
         owner_id,
         name,
         description,
         address,
         phone_number,
         created_at
       FROM restaurants
       WHERE id = ?`,
      [id],
    );

    if (rows.length === 0) {
      throw new Error("Restaurant not found");
    }

    return rows[0];
  }

  // 4. Add category
  async addCategory(restaurantId, ownerId, { name, display_order }) {
    await this.verifyOwnerShip(restaurantId, ownerId);

    const order =
      display_order === undefined || display_order === null
        ? 0
        : Number(display_order);

    const [result] = await pool.query(
      `INSERT INTO menu_categories
        (restaurant_id, name, display_order)
       VALUES (?, ?, ?)`,
      [restaurantId, name, order],
    );

    return {
      id: result.insertId,
      restaurant_id: restaurantId,
      name,
      display_order: order,
    };
  }

  // 5. Add menu item
  async addMenuItem(
    restaurantId,
    ownerId,
    categoryId,
    { name, description, price_cents, image_url },
  ) {
    // Verify restaurant ownership
    await this.verifyOwnerShip(restaurantId, ownerId);

    // Verify category belongs to restaurant
    const [categoryRows] = await pool.query(
      `SELECT id
       FROM menu_categories
       WHERE id = ?
       AND restaurant_id = ?`,
      [categoryId, restaurantId],
    );

    if (categoryRows.length === 0) {
      throw new Error("Menu category not found on this restaurant");
    }

    const [result] = await pool.query(
      `INSERT INTO menu_items
        (
          category_id,
          name,
          description,
          price_cents,
          image_url
        )
       VALUES (?, ?, ?, ?, ?)`,
      [categoryId, name, description || null, price_cents, image_url || null],
    );

    return {
      id: result.insertId,
      category_id: categoryId,
      name,
      description: description || null,
      price_cents,
      image_url: image_url || null,
      is_available: true,
    };
  }

  // 6. Get full menu
  async getFullMenu(restaurantId) {
    // Get categories
    const [categories] = await pool.query(
      `SELECT
         id,
         name,
         display_order
       FROM menu_categories
       WHERE restaurant_id = ?
       ORDER BY display_order ASC, name ASC`,
      [restaurantId],
    );

    if (categories.length === 0) {
      return [];
    }

    const categoryIds = categories.map((category) => category.id);

    // Get available menu items
    const [items] = await pool.query(
      `SELECT
         id,
         category_id,
         name,
         description,
         price_cents,
         is_available,
         image_url
       FROM menu_items
       WHERE category_id IN (?)
       AND is_available = TRUE
       ORDER BY name ASC`,
      [categoryIds],
    );

    // Nest items inside categories
    return categories.map((category) => ({
      ...category,
      items: items.filter((item) => item.category_id === category.id),
    }));
  }

  // 7. Toggle menu item availability
  async toggleMenuItemAvailability(restaurantId, ownerId, itemId, isAvailable) {
    await this.verifyOwnerShip(restaurantId, ownerId);

    const [result] = await pool.query(
      `UPDATE menu_items mi
       JOIN menu_categories mc
         ON mi.category_id = mc.id
       SET mi.is_available = ?
       WHERE mi.id = ?
       AND mc.restaurant_id = ?`,
      [isAvailable, itemId, restaurantId],
    );

    if (result.affectedRows === 0) {
      throw new Error("Menu item not found or unauthorized");
    }

    return {
      itemId,
      is_available: isAvailable,
    };
  }
}

export default new RestaurantService();
