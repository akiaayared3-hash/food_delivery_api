import pool from "../config/db.js";

class PaymentService {
  /**
   * 1. Initiate a Payment Intent for an Order
   */
  async createPaymentIntent(userId, { order_id, payment_method }) {
    let connection;

    try {
      connection = await pool.getConnection();
      await connection.beginTransaction();

      // Lock order record to prevent duplicate payment attempts
      const [orders] = await connection.query(
        "SELECT id, customer_id, total_cents, status FROM orders WHERE id = ? FOR UPDATE",
        [order_id],
      );

      if (orders.length === 0) {
        throw new Error("Order not found");
      }

      const order = orders[0];

      if (order.customer_id !== userId) {
        throw new Error("Unauthorized: Order does not belong to you");
      }

      if (order.status === "cancelled") {
        throw new Error("Cannot initiate payment for a cancelled order");
      }

      // Check if a payment already exists
      const [existingPayments] = await connection.query(
        "SELECT id, status FROM payments WHERE order_id = ?",
        [order_id],
      );

      if (existingPayments.length > 0) {
        if (existingPayments[0].status === "completed") {
          throw new Error("Payment has already been completed for this order");
        }
        // Return existing pending payment if already initialized
        await connection.commit();
        return this.getPaymentByOrderId(order_id);
      }

      // Simulate Gateway Reference ID
      const mockGatewayRef = `pi_mock_${Date.now()}_${Math.floor(Math.random() * 1000)}`;

      // FIXED: Uses 'provider' and 'transaction_id' to match initDb.js schema
      const [result] = await connection.query(
        `INSERT INTO payments (order_id, provider, transaction_id, amount_cents, status)
         VALUES (?, ?, ?, ?, 'pending')`,
        [order_id, payment_method, mockGatewayRef, order.total_cents],
      );

      await connection.commit();

      return {
        payment_id: result.insertId,
        order_id,
        amount_cents: order.total_cents,
        payment_method,
        payment_gateway_ref: mockGatewayRef,
        status: "pending",
      };
    } catch (error) {
      if (connection) await connection.rollback();
      throw error;
    } finally {
      if (connection) connection.release();
    }
  }

  /**
   * 2. Confirm Payment Settlement (Simulated Gateway Success / Webhook)
   */
  async confirmPayment(orderId, paymentGatewayRef) {
    let connection;

    try {
      connection = await pool.getConnection();
      await connection.beginTransaction();

      // Lock payment row
      const [payments] = await connection.query(
        "SELECT id, order_id, status FROM payments WHERE order_id = ? FOR UPDATE",
        [orderId],
      );

      if (payments.length === 0) {
        throw new Error("Payment record not found for this order");
      }

      const payment = payments[0];

      if (payment.status === "completed") {
        await connection.commit();
        return {
          message: "Payment already marked as completed",
          order_id: orderId,
        };
      }

      // FIXED: Updates 'transaction_id' instead of 'payment_gateway_ref'
      await connection.query(
        `UPDATE payments 
         SET status = 'completed', transaction_id = COALESCE(?, transaction_id) 
         WHERE id = ?`,
        [paymentGatewayRef || null, payment.id],
      );

      // Transition parent order status from created -> accepted
      await connection.query(
        `UPDATE orders SET status = 'accepted' WHERE id = ? AND status = 'created'`,
        [orderId],
      );

      await connection.commit();

      return { payment_id: payment.id, order_id: orderId, status: "completed" };
    } catch (error) {
      if (connection) await connection.rollback();
      throw error;
    } finally {
      if (connection) connection.release();
    }
  }

  /**
   * 3. Handle Payment Failure
   */
  async failPayment(orderId, reason) {
    const [result] = await pool.query(
      `UPDATE payments SET status = 'failed' WHERE order_id = ? AND status = 'pending'`,
      [orderId],
    );

    if (result.affectedRows === 0) {
      throw new Error("Pending payment not found for this order");
    }

    return {
      orderId,
      status: "failed",
      reason: reason || "Payment transaction rejected",
    };
  }

  /**
   * 4. Retrieve Payment Details by Order ID
   */
  async getPaymentByOrderId(orderId) {
    // FIXED: Selecting existing columns from payments table
    const [rows] = await pool.query(
      `SELECT id, order_id, provider AS payment_method, transaction_id AS payment_gateway_ref, amount_cents, status, created_at 
       FROM payments 
       WHERE order_id = ?`,
      [orderId],
    );

    if (rows.length === 0) {
      throw new Error("No payment details found for this order");
    }

    return rows[0];
  }
}

export default new PaymentService();
