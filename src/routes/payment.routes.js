import { Router } from "express";

import {
  createPaymentIntent,
  confirmPayment,
  handleWebhook,
  getPaymentByOrderId,
} from "../controller/payment.controller.js";

import { authenticate, authorize } from "../middleware/auth.middleware.js";

const router = Router();

/*
 * PAYMENT PROVIDER WEBHOOK
 *
 * Public endpoint.
 * Do NOT use JWT authentication here.
 *
 * The webhook controller/service must verify
 * the payment provider's signature.
 */
router.post("/webhook", handleWebhook);

/*
 * Everything below requires a logged-in user.
 */
router.use(authenticate);

/*
 * Create payment intent.
 */
router.post("/intent", authorize("customer"), createPaymentIntent);

/*
 * Confirm payment created by the authenticated customer.
 *
 * Ownership is checked again inside payment.service.js.
 */
router.post("/confirm", authorize("customer"), confirmPayment);

/*
 * Get payment information.
 *
 * Authorization is handled inside the service:
 * - customer -> own order
 * - restaurant owner -> their restaurant's order
 * - admin -> allowed
 */
router.get(
  "/orders/:orderId",
  authorize("customer", "restaurant_owner", "admin"),
  getPaymentByOrderId,
);

export default router;
