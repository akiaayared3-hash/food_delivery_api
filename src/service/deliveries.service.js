import pool from "../config/db.js";

class DeliveryService {
  /**
   * 1. Assign a driver to an order
   *
   * Authorized users:
   * - admin
   * - restaurant_owner
   * - driver (self-assignment only)
   */
  async assignDriver(
    orderId,
    requestingUserId,
    requestingUserRole,
    requestedDriverId,
  ) {
    let connection;

    try {
      connection = await pool.getConnection();
      await connection.beginTransaction();

      /*
       * Lock the order while checking and assigning.
       *
       * We need restaurant_id and current status to determine
       * whether the authenticated user is allowed to assign.
       */
      const [orders] = await connection.query(
        `SELECT
           o.id,
           o.restaurant_id,
           o.customer_id,
           o.status
         FROM orders o
         WHERE o.id = ?
         FOR UPDATE`,
        [orderId],
      );

      if (orders.length === 0) {
        throw new Error("Order not found");
      }

      const order = orders[0];

      /*
       * An order that is already completed/cancelled cannot
       * receive a driver.
       */
      if (order.status === "cancelled" || order.status === "delivered") {
        throw new Error(
          "Cannot assign driver to a cancelled or completed order",
        );
      }

      /*
       * Driver self-assignment:
       *
       * A driver can ONLY assign themselves.
       *
       * They cannot send another driver's ID.
       */
      if (requestingUserRole === "driver") {
        if (
          requestedDriverId &&
          Number(requestedDriverId) !== Number(requestingUserId)
        ) {
          throw new Error("A driver can only assign themselves");
        }

        requestedDriverId = requestingUserId;
      }

      /*
       * Only these roles may assign drivers.
       */
      if (
        requestingUserRole !== "admin" &&
        requestingUserRole !== "restaurant_owner" &&
        requestingUserRole !== "driver"
      ) {
        throw new Error("You are not authorized to assign a driver");
      }

      /*
       * Restaurant owner can only assign a driver
       * to an order belonging to their restaurant.
       */
      if (requestingUserRole === "restaurant_owner") {
        const [restaurants] = await connection.query(
          `SELECT id
           FROM restaurants
           WHERE id = ?
             AND owner_id = ?`,
          [order.restaurant_id, requestingUserId],
        );

        if (restaurants.length === 0) {
          throw new Error(
            "You are not authorized to assign a driver to this order",
          );
        }
      }

      /*
       * Driver must exist and actually have driver role.
       *
       * We deliberately do not trust driver_id from the client.
       */
      const [drivers] = await connection.query(
        `SELECT id, role
         FROM users
         WHERE id = ?
         FOR UPDATE`,
        [requestedDriverId],
      );

      if (drivers.length === 0) {
        throw new Error("Driver not found");
      }

      if (drivers[0].role !== "driver") {
        throw new Error("Selected user is not a driver");
      }

      /*
       * Check whether this order already has a delivery.
       */
      const [existingDeliveries] = await connection.query(
        `SELECT id, driver_id, status
         FROM deliveries
         WHERE orders_id = ?
         FOR UPDATE`,
        [orderId],
      );

      if (existingDeliveries.length > 0) {
        throw new Error("Order is already assigned to a driver");
      }

      /*
       * Assignment should happen while the order is
       * actually ready to go into delivery.
       *
       * According to the order state machine:
       *
       * created -> accepted -> preparing -> out_for_delivery
       */
      if (order.status !== "preparing") {
        throw new Error(
          "Driver can only be assigned when the order is preparing",
        );
      }

      /*
       * Create delivery assignment.
       */
      const [result] = await connection.query(
        `INSERT INTO deliveries
          (orders_id, driver_id, status)
         VALUES (?, ?, 'assigned')`,
        [orderId, requestedDriverId],
      );

      /*
       * Move order into delivery.
       */
      await connection.query(
        `UPDATE orders
         SET status = 'out_for_delivery'
         WHERE id = ?
           AND status = 'preparing'`,
        [orderId],
      );

      await connection.commit();

      return this.getDeliveryById(
        result.insertId,
        requestingUserId,
        requestingUserRole,
      );
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
   * 2. Update driver's GPS location
   *
   * Only the assigned driver can update the delivery location.
   */
  async updateLocation(deliveryId, driverId, { latitude, longitude }) {
    /*
     * Basic coordinate validation.
     */
    const lat = Number(latitude);
    const lng = Number(longitude);

    if (!Number.isFinite(lat) || lat < -90 || lat > 90) {
      throw new Error("Invalid latitude");
    }

    if (!Number.isFinite(lng) || lng < -180 || lng > 180) {
      throw new Error("Invalid longitude");
    }

    const [deliveries] = await pool.query(
      `SELECT id
       FROM deliveries
       WHERE id = ?
         AND driver_id = ?
         AND status IN ('assigned', 'picked_up', 'en_route')`,
      [deliveryId, driverId],
    );

    if (deliveries.length === 0) {
      throw new Error("Active delivery not found or unauthorized");
    }

    /*
     * NOTE:
     * Your current schema apparently does not have a GPS
     * column in deliveries, so this only validates ownership
     * and returns the coordinates.
     *
     * If you add latitude/longitude columns later, update them
     * here.
     */
    return {
      deliveryId,
      current_latitude: lat,
      current_longitude: lng,
    };
  }

  /**
   * 3. Update delivery status
   *
   * Only the assigned driver can update delivery status.
   */
  async updateDeliveryStatus(deliveryId, driverId, newStatus) {
    const validStatuses = ["assigned", "picked_up", "en_route", "delivered"];

    if (!validStatuses.includes(newStatus)) {
      throw new Error("Invalid delivery status");
    }

    let connection;

    try {
      connection = await pool.getConnection();
      await connection.beginTransaction();

      /*
       * Lock delivery so two requests cannot change its
       * state simultaneously.
       */
      const [deliveries] = await connection.query(
        `SELECT
           id,
           orders_id,
           driver_id,
           status
         FROM deliveries
         WHERE id = ?
         FOR UPDATE`,
        [deliveryId],
      );

      if (deliveries.length === 0) {
        throw new Error("Delivery not found");
      }

      const delivery = deliveries[0];

      /*
       * Authorization:
       * only the assigned driver can change delivery status.
       */
      if (Number(delivery.driver_id) !== Number(driverId)) {
        throw new Error("You are not authorized to update this delivery");
      }

      /*
       * Prevent changing a completed delivery.
       */
      if (delivery.status === "delivered") {
        throw new Error("Delivered orders cannot change delivery status");
      }

      /*
       * Explicit state machine.
       *
       * assigned -> picked_up
       * picked_up -> en_route
       * en_route -> delivered
       */
      const allowedTransitions = {
        assigned: ["picked_up"],
        picked_up: ["en_route"],
        en_route: ["delivered"],
        delivered: [],
      };

      if (!allowedTransitions[delivery.status].includes(newStatus)) {
        throw new Error(
          `Invalid delivery transition: ${delivery.status} -> ${newStatus}`,
        );
      }

      let timestampColumn = "";

      if (newStatus === "picked_up") {
        timestampColumn = ", pickup_time = CURRENT_TIMESTAMP";
      }

      if (newStatus === "delivered") {
        timestampColumn = ", delivery_time = CURRENT_TIMESTAMP";
      }

      await connection.query(
        `UPDATE deliveries
         SET status = ? ${timestampColumn}
         WHERE id = ?
           AND driver_id = ?
           AND status = ?`,
        [newStatus, deliveryId, driverId, delivery.status],
      );

      /*
       * Keep orders.status synchronized.
       */
      if (newStatus === "delivered") {
        await connection.query(
          `UPDATE orders
           SET status = 'delivered'
           WHERE id = ?
             AND status = 'out_for_delivery'`,
          [delivery.orders_id],
        );
      }

      await connection.commit();

      return {
        deliveryId,
        status: newStatus,
      };
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
   * 4. Get delivery by ID
   *
   * Authorization:
   * - admin -> any delivery
   * - assigned driver -> own delivery
   * - restaurant owner -> their restaurant's delivery
   * - customer -> their own order's delivery
   */
  async getDeliveryById(deliveryId, userId, userRole) {
    let query;
    let params;

    if (userRole === "admin") {
      query = `
        SELECT
          d.id,
          d.orders_id,
          d.driver_id,
          d.status,
          d.pickup_time,
          d.delivery_time,
          d.created_at,
          u.full_name AS driver_name,
          u.phone_number AS driver_phone
        FROM deliveries d
        JOIN users u ON d.driver_id = u.id
        WHERE d.id = ?
      `;

      params = [deliveryId];
    } else {
      query = `
        SELECT
          d.id,
          d.orders_id,
          d.driver_id,
          d.status,
          d.pickup_time,
          d.delivery_time,
          d.created_at,
          u.full_name AS driver_name,
          u.phone_number AS driver_phone
        FROM deliveries d
        JOIN users u ON d.driver_id = u.id
        JOIN orders o ON o.id = d.orders_id
        LEFT JOIN restaurants r
          ON r.id = o.restaurant_id
        WHERE d.id = ?
          AND (
            d.driver_id = ?
            OR o.customer_id = ?
            OR r.owner_id = ?
          )
      `;

      params = [deliveryId, userId, userId, userId];
    }

    const [rows] = await pool.query(query, params);

    if (rows.length === 0) {
      throw new Error(
        "Delivery not found or you are not authorized to view it",
      );
    }

    return rows[0];
  }

  /**
   * 5. Get delivery by order ID
   *
   * Authorization is performed here.
   */
  async getDeliveryByOrderId(orderId, userId, userRole) {
    let query;
    let params;

    if (userRole === "admin") {
      query = `
        SELECT
          d.id,
          d.orders_id,
          d.driver_id,
          d.status,
          d.pickup_time,
          d.delivery_time,
          d.created_at,
          u.full_name AS driver_name,
          u.phone_number AS driver_phone
        FROM deliveries d
        JOIN users u ON d.driver_id = u.id
        WHERE d.orders_id = ?
      `;

      params = [orderId];
    } else {
      query = `
        SELECT
          d.id,
          d.orders_id,
          d.driver_id,
          d.status,
          d.pickup_time,
          d.delivery_time,
          d.created_at,
          u.full_name AS driver_name,
          u.phone_number AS driver_phone
        FROM deliveries d
        JOIN users u ON d.driver_id = u.id
        JOIN orders o ON o.id = d.orders_id
        LEFT JOIN restaurants r
          ON r.id = o.restaurant_id
        WHERE d.orders_id = ?
          AND (
            o.customer_id = ?
            OR d.driver_id = ?
            OR r.owner_id = ?
          )
      `;

      params = [orderId, userId, userId, userId];
    }

    const [rows] = await pool.query(query, params);

    if (rows.length === 0) {
      throw new Error(
        "Delivery not found or you are not authorized to view it",
      );
    }

    return rows[0];
  }
}

export default new DeliveryService();
