import orderService from "../service/orders.service.js";
import {
  asyncHandler,
  successResponse,
  AppError,
} from "../utils/index.utils.js";

const VALID_STATUSES = [
  "created",
  "accepted",
  "preparing",
  "out_for_delivery",
  "delivered",
  "cancelled",
];

const STATUS_UPDATE_ROLES = [
  "customer",
  "restaurant_owner",
  "owner",
  "driver",
  "admin",
];

const parseId = (value, fieldName = "id") => {
  const id = Number(value);

  if (!Number.isSafeInteger(id) || id <= 0) {
    throw new AppError(`Invalid ${fieldName}`, 400);
  }

  return id;
};

/**
 * POST /api/v1/orders
 */
const createOrder = asyncHandler(async (req, res) => {
  const { restaurant_id, delivery_address_id, items, special_instruction } =
    req.body;

  const restaurantId = parseId(restaurant_id, "restaurant_id");

  const deliveryAddressId = parseId(delivery_address_id, "delivery_address_id");

  if (!Array.isArray(items) || items.length === 0) {
    throw new AppError("A non-empty items array is required", 400);
  }

  if (items.length > 50) {
    throw new AppError("An order cannot contain more than 50 items", 400);
  }

  for (const item of items) {
    if (!item || typeof item !== "object") {
      throw new AppError("Invalid order item", 400);
    }

    const menuItemId = Number(item.menu_item_id);
    const quantity = Number(item.quantity);

    if (!Number.isSafeInteger(menuItemId) || menuItemId <= 0) {
      throw new AppError("Each item must have a valid menu_item_id", 400);
    }

    if (!Number.isSafeInteger(quantity) || quantity <= 0 || quantity > 100) {
      throw new AppError("Each item quantity must be between 1 and 100", 400);
    }

    // Reject client-supplied prices.
    if (
      Object.hasOwn(item, "price") ||
      Object.hasOwn(item, "price_cents") ||
      Object.hasOwn(item, "unit_price_cents")
    ) {
      throw new AppError("Item prices are calculated by the server", 400);
    }
  }

  if (
    special_instruction !== undefined &&
    special_instruction !== null &&
    (typeof special_instruction !== "string" ||
      special_instruction.length > 1000)
  ) {
    throw new AppError(
      "special_instruction must be a string of at most 1000 characters",
      400,
    );
  }

  const order = await orderService.createOrder(req.user.id, {
    restaurant_id: restaurantId,
    delivery_address_id: deliveryAddressId,
    items,
    special_instruction,
    // Delivery fee is determined by the server.
  });

  return successResponse(res, 201, "Order placed successfully", { order });
});

/**
 * GET /api/v1/orders/me
 */
const getMyOrders = asyncHandler(async (req, res) => {
  const orders = await orderService.getCustomerOrders(req.user.id);

  return successResponse(res, 200, "Orders retrieved successfully", { orders });
});

/**
 * GET /api/v1/orders/:id
 */
const getOrderById = asyncHandler(async (req, res) => {
  const orderId = parseId(req.params.id, "order ID");

  const order = await orderService.getOrderById(
    orderId,
    req.user.id,
    req.user.role,
  );

  return successResponse(res, 200, "Order retrieved successfully", { order });
});

/**
 * PATCH /api/v1/orders/:id/status
 */
const updateOrderStatus = asyncHandler(async (req, res) => {
  const orderId = parseId(req.params.id, "order ID");
  const { status } = req.body;

  if (typeof status !== "string" || !VALID_STATUSES.includes(status)) {
    throw new AppError(
      `status must be one of: ${VALID_STATUSES.join(", ")}`,
      400,
    );
  }

  if (!STATUS_UPDATE_ROLES.includes(req.user.role)) {
    throw new AppError("You are not authorized to update order status", 403);
  }

  const result = await orderService.updateOrderStatus(
    orderId,
    status,
    req.user.id,
    req.user.role,
  );

  return successResponse(res, 200, "Order status updated successfully", result);
});

export { createOrder, getMyOrders, getOrderById, updateOrderStatus };
