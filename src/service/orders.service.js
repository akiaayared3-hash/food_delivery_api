import pool from "../config/db.js";

class OrderService {
  /**
   * 1. Create a new order
   */
  async createOrder(
    customerId,
    {
      restaurant_id,
      delivery_address_id,
      items,
      special_instruction,
      delivery_fee_cents = 500,
    },
  ) {
    let connection;

    try {
      // Basic validation
      if (!restaurant_id) {
        throw new Error("Restaurant ID is required");
      }

      if (!delivery_address_id) {
        throw new Error("Delivery address is required");
      }

      if (!Array.isArray(items) || items.length === 0) {
        throw new Error("Order must contain at least one item");
      }

      if (
        !Number.isInteger(Number(delivery_fee_cents)) ||
        Number(delivery_fee_cents) < 0
      ) {
        throw new Error("Invalid delivery fee");
      }

      connection = await pool.getConnection();

      await connection.beginTransaction();

      // --------------------------------------------------
      // 1. Verify delivery address belongs to customer
      // --------------------------------------------------
      const [addressRows] = await connection.query(
        `SELECT id
         FROM addresses
         WHERE id = ?
         AND user_id = ?`,
        [delivery_address_id, customerId],
      );

      if (addressRows.length === 0) {
        throw new Error("Invalid or unauthorized delivery address");
      }

      // --------------------------------------------------
      // 2. Validate item IDs
      // --------------------------------------------------
      const itemIds = items.map((item) => {
        const id = Number(item.menu_item_id);

        if (!Number.isInteger(id) || id <= 0) {
          throw new Error("Invalid menu item ID");
        }

        return id;
      });

      // Prevent duplicate menu items
      const uniqueItemIds = [...new Set(itemIds)];

      if (uniqueItemIds.length !== itemIds.length) {
        throw new Error("Duplicate menu items are not allowed");
      }

      // --------------------------------------------------
      // 3. Lock menu items and get current database prices
      // --------------------------------------------------
      const [dbItems] = await connection.query(
        `SELECT
           mi.id,
           mi.name,
           mi.price_cents,
           mi.is_available,
           mc.restaurant_id
         FROM menu_items mi
         JOIN menu_categories mc
           ON mi.category_id = mc.id
         WHERE mi.id IN (?)
         FOR UPDATE`,
        [uniqueItemIds],
      );

      if (dbItems.length !== uniqueItemIds.length) {
        throw new Error("One or more selected menu items do not exist");
      }

      // --------------------------------------------------
      // 4. Verify restaurant exists
      // --------------------------------------------------
      const [restaurantRows] = await connection.query(
        `SELECT id
         FROM restaurants
         WHERE id = ?`,
        [restaurant_id],
      );

      if (restaurantRows.length === 0) {
        throw new Error("Restaurant not found");
      }

      // --------------------------------------------------
      // 5. Validate items
      // --------------------------------------------------
      let calculatedSubtotalCents = 0;

      const orderItemsToInsert = [];

      for (const reqItem of items) {
        const menuItem = dbItems.find(
          (dbItem) => Number(dbItem.id) === Number(reqItem.menu_item_id),
        );

        if (!menuItem) {
          throw new Error("Menu item not found");
        }

        // Item must belong to selected restaurant
        if (Number(menuItem.restaurant_id) !== Number(restaurant_id)) {
          throw new Error(
            `Item "${menuItem.name}" does not belong to the selected restaurant`,
          );
        }

        // Item must be available
        if (!menuItem.is_available) {
          throw new Error(`Item "${menuItem.name}" is currently unavailable`);
        }

        // Validate quantity
        const quantity = Number(reqItem.quantity);

        if (!Number.isInteger(quantity) || quantity <= 0) {
          throw new Error(`Invalid quantity for "${menuItem.name}"`);
        }

        // Prevent unreasonable quantities
        if (quantity > 100) {
          throw new Error(`Quantity for "${menuItem.name}" cannot exceed 100`);
        }

        // IMPORTANT:
        // Never trust price from frontend.
        // Always use database price.
        const unitPriceCents = Number(menuItem.price_cents);

        const itemTotal = unitPriceCents * quantity;

        calculatedSubtotalCents += itemTotal;

        orderItemsToInsert.push([
          menuItem.id,
          menuItem.name,
          unitPriceCents,
          quantity,
        ]);
      }

      // --------------------------------------------------
      // 6. Calculate total
      // --------------------------------------------------
      const deliveryFeeCents = Number(delivery_fee_cents);

      const totalCents = calculatedSubtotalCents + deliveryFeeCents;

      // --------------------------------------------------
      // 7. Create order
      // --------------------------------------------------
      const [orderResult] = await connection.query(
        `INSERT INTO orders
        (
          customer_id,
          restaurant_id,
          delivery_address_id,
          subtotal_cents,
          delivery_fee_cents,
          total_cents,
          special_instruction,
          status
        )
        VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          customerId,
          restaurant_id,
          delivery_address_id,
          calculatedSubtotalCents,
          deliveryFeeCents,
          totalCents,
          special_instruction || null,
          "created",
        ],
      );

      const orderId = orderResult.insertId;

      // --------------------------------------------------
      // 8. Insert order items
      // --------------------------------------------------
      const itemValues = orderItemsToInsert.map((item) => [
        orderId,
        item[0],
        item[1],
        item[2],
        item[3],
      ]);

      await connection.query(
        `INSERT INTO order_items
        (
          order_id,
          menu_item_id,
          item_name,
          unit_price_cents,
          quantity
        )
        VALUES ?`,
        [itemValues],
      );

      await connection.commit();

      return this.getOrderById(orderId, customerId, "customer");
    } catch (error) {
      if (connection) {
        await connection.rollback();
      }

      throw error;
    } finally {
      if (connection) {
        connection.release();
      }
    }
  }

  /**
   * 2. Get order by ID
   *
   * Authorization:
   * - customer → own orders
   * - restaurant_owner → restaurant orders
   * - driver → assigned orders
   * - admin → any order
   */
  async getOrderById(orderId, userId, userRole = "customer") {
    const [orders] = await pool.query(
      `SELECT
         o.*,
         r.name AS restaurant_name
       FROM orders o
       JOIN restaurants r
         ON o.restaurant_id = r.id
       WHERE o.id = ?`,
      [orderId],
    );

    if (orders.length === 0) {
      throw new Error("Order not found");
    }

    const order = orders[0];

    // -----------------------------------------
    // ADMIN
    // -----------------------------------------
    if (userRole === "admin") {
      // allowed
    }

    // -----------------------------------------
    // CUSTOMER
    // -----------------------------------------
    else if (userRole === "customer") {
      if (Number(order.customer_id) !== Number(userId)) {
        throw new Error("Unauthorized: You do not own this order");
      }
    }

    // -----------------------------------------
    // RESTAURANT OWNER
    // -----------------------------------------
    else if (userRole === "restaurant_owner" || userRole === "owner") {
      const [restaurantRows] = await pool.query(
        `SELECT id
           FROM restaurants
           WHERE id = ?
           AND owner_id = ?`,
        [order.restaurant_id, userId],
      );

      if (restaurantRows.length === 0) {
        throw new Error("Unauthorized: You do not own this restaurant");
      }
    }

    // -----------------------------------------
    // DRIVER
    // -----------------------------------------
    else if (userRole === "driver") {
      if (
        order.driver_id === null ||
        Number(order.driver_id) !== Number(userId)
      ) {
        throw new Error("Unauthorized: This order is not assigned to you");
      }
    } else {
      throw new Error("Unauthorized role");
    }

    // -----------------------------------------
    // Get order items
    // -----------------------------------------
    const [items] = await pool.query(
      `SELECT
         id,
         menu_item_id,
         item_name,
         unit_price_cents,
         quantity
       FROM order_items
       WHERE order_id = ?`,
      [orderId],
    );

    return {
      ...order,
      items,
    };
  }

  /**
   * 3. Get customer order history
   */
  async getCustomerOrders(customerId) {
    const [orders] = await pool.query(
      `SELECT
         o.*,
         r.name AS restaurant_name
       FROM orders o
       JOIN restaurants r
         ON o.restaurant_id = r.id
       WHERE o.customer_id = ?
       ORDER BY o.created_at DESC`,
      [customerId],
    );

    return orders;
  }

  /**
   * 4. Update order status
   *
   * Permissions:
   *
   * customer:
   *   created/accepted/preparing/out_for_delivery
   *   -> cancelled
   *
   * restaurant owner:
   *   created -> accepted
   *   accepted -> preparing
   *   preparing -> cancelled
   *
   * driver:
   *   preparing -> out_for_delivery
   *   out_for_delivery -> delivered
   *
   * admin:
   *   any valid transition
   */
  async updateOrderStatus(orderId, newStatus, userId, userRole) {
    const validStatuses = [
      "created",
      "accepted",
      "preparing",
      "out_for_delivery",
      "delivered",
      "cancelled",
    ];

    if (!validStatuses.includes(newStatus)) {
      throw new Error("Invalid order status");
    }

    // --------------------------------------------------
    // Get order
    // --------------------------------------------------
    const [orders] = await pool.query(
      `SELECT
         id,
         customer_id,
         restaurant_id,
         driver_id,
         status
       FROM orders
       WHERE id = ?`,
      [orderId],
    );

    if (orders.length === 0) {
      throw new Error("Order not found");
    }

    const order = orders[0];

    const currentStatus = order.status;

    // --------------------------------------------------
    // Define valid state transitions
    // --------------------------------------------------
    const transitions = {
      created: ["accepted", "cancelled"],
      accepted: ["preparing", "cancelled"],
      preparing: ["out_for_delivery", "cancelled"],
      out_for_delivery: ["delivered"],
      delivered: [],
      cancelled: [],
    };

    if (!transitions[currentStatus].includes(newStatus)) {
      throw new Error(
        `Cannot change order from "${currentStatus}" to "${newStatus}"`,
      );
    }

    // --------------------------------------------------
    // ADMIN
    // --------------------------------------------------
    if (userRole === "admin") {
      // Admin is allowed
    }

    // --------------------------------------------------
    // CUSTOMER
    // --------------------------------------------------
    else if (userRole === "customer") {
      if (Number(order.customer_id) !== Number(userId)) {
        throw new Error("Unauthorized: You do not own this order");
      }

      // Customer can ONLY cancel
      if (newStatus !== "cancelled") {
        throw new Error("Customers can only cancel orders");
      }
    }

    // --------------------------------------------------
    // RESTAURANT OWNER
    // --------------------------------------------------
    else if (userRole === "restaurant_owner" || userRole === "owner") {
      const [restaurantRows] = await pool.query(
        `SELECT id
           FROM restaurants
           WHERE id = ?
           AND owner_id = ?`,
        [order.restaurant_id, userId],
      );

      if (restaurantRows.length === 0) {
        throw new Error("Unauthorized: You do not own this restaurant");
      }

      const ownerAllowedStatuses = ["accepted", "preparing", "cancelled"];

      if (!ownerAllowedStatuses.includes(newStatus)) {
        throw new Error("Restaurant owner cannot set this status");
      }
    }

    // --------------------------------------------------
    // DRIVER
    // --------------------------------------------------
    else if (userRole === "driver") {
      if (
        order.driver_id === null ||
        Number(order.driver_id) !== Number(userId)
      ) {
        throw new Error("Unauthorized: This order is not assigned to you");
      }

      const driverAllowedStatuses = ["out_for_delivery", "delivered"];

      if (!driverAllowedStatuses.includes(newStatus)) {
        throw new Error("Driver cannot set this status");
      }
    }

    // --------------------------------------------------
    // UNKNOWN ROLE
    // --------------------------------------------------
    else {
      throw new Error("Unauthorized role");
    }

    // --------------------------------------------------
    // Update
    // --------------------------------------------------
    const [result] = await pool.query(
      `UPDATE orders
       SET status = ?
       WHERE id = ?
       AND status = ?`,
      [newStatus, orderId, currentStatus],
    );

    if (result.affectedRows === 0) {
      throw new Error("Order status was not updated");
    }

    return {
      orderId: Number(orderId),
      previousStatus: currentStatus,
      status: newStatus,
    };
  }
}

export default new OrderService();
