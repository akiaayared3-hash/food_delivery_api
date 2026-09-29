import paymentService from "../service/payment.service.js";

/**
 * POST /api/v1/payments/intent
 */
export const createPaymentIntent = async (req, res) => {
  try {
    const { order_id, payment_method } = req.body;

    if (!order_id || !payment_method) {
      return res.status(400).json({
        message: "order_id and payment_method are required",
      });
    }

    const validMethods = ["card", "wallet", "cash_on_delivery"];

    if (!validMethods.includes(payment_method)) {
      return res.status(400).json({
        message: "Invalid payment_method specified",
      });
    }

    const intent = await paymentService.createPaymentIntent(req.user.id, {
      order_id,
      payment_method,
    });

    return res.status(201).json({
      message: "Payment intent initialized",
      payment: intent,
    });
  } catch (error) {
    return res.status(400).json({
      message: error.message,
    });
  }
};

/**
 * POST /api/v1/payments/confirm
 */
export const confirmPayment = async (req, res) => {
  try {
    const { order_id, payment_gateway_ref } = req.body;

    if (!order_id) {
      return res.status(400).json({
        message: "order_id is required",
      });
    }

    const result = await paymentService.confirmPayment(
      req.user.id,
      order_id,
      payment_gateway_ref,
    );

    return res.status(200).json({
      message: "Payment processed successfully",
      ...result,
    });
  } catch (error) {
    return res.status(400).json({
      message: error.message,
    });
  }
};

/**
 * POST /api/v1/payments/webhook
 */
export const handleWebhook = async (req, res) => {
  try {
    const { event_type, order_id, payment_gateway_ref } = req.body;

    if (!event_type || !order_id) {
      return res.status(400).json({
        message: "event_type and order_id are required",
      });
    }

    if (event_type === "payment_intent.succeeded") {
      await paymentService.confirmPaymentFromWebhook(
        order_id,
        payment_gateway_ref,
      );
    } else if (event_type === "payment_intent.payment_failed") {
      await paymentService.failPayment(order_id, "Webhook reported failure");
    }

    return res.status(200).json({
      received: true,
    });
  } catch (error) {
    return res.status(400).json({
      message: error.message,
    });
  }
};

/**
 * GET /api/v1/payments/orders/:orderId
 */
export const getPaymentByOrderId = async (req, res) => {
  try {
    const payment = await paymentService.getPaymentByOrderId(
      req.params.orderId,
      req.user.id,
      req.user.role,
    );

    return res.status(200).json({
      payment,
    });
  } catch (error) {
    return res.status(404).json({
      message: error.message,
    });
  }
};
