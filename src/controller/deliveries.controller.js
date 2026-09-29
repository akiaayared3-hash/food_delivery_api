import deliveryService from "../service/deliveries.service.js";

/**
 * POST /api/v1/deliveries/assign
 *
 * Admin / restaurant_owner / driver
 *
 * - Admin can assign any valid driver.
 * - Restaurant owner can assign a driver only to their restaurant's order.
 * - Driver can only assign themselves.
 */
export const assignDriver = async (req, res) => {
  try {
    const { order_id, driver_id } = req.body;

    if (!order_id) {
      return res.status(400).json({
        message: "order_id is required",
      });
    }

    const delivery = await deliveryService.assignDriver(
      order_id,
      req.user.id,
      req.user.role,
      driver_id,
    );

    return res.status(201).json({
      message: "Driver assigned to order successfully",
      delivery,
    });
  } catch (error) {
    return res.status(400).json({
      message: error.message,
    });
  }
};

/**
 * PATCH /api/v1/deliveries/:id/location
 *
 * Only the assigned driver can update their delivery location.
 */
export const updateLocation = async (req, res) => {
  try {
    const { latitude, longitude } = req.body;

    if (latitude === undefined || longitude === undefined) {
      return res.status(400).json({
        message: "latitude and longitude are required",
      });
    }

    const result = await deliveryService.updateLocation(
      req.params.id,
      req.user.id,
      {
        latitude,
        longitude,
      },
    );

    return res.status(200).json({
      message: "Driver location updated",
      ...result,
    });
  } catch (error) {
    return res.status(400).json({
      message: error.message,
    });
  }
};

/**
 * PATCH /api/v1/deliveries/:id/status
 *
 * Only the assigned driver can update delivery status.
 */
export const updateDeliveryStatus = async (req, res) => {
  try {
    const { status } = req.body;

    if (!status) {
      return res.status(400).json({
        message: "status field is required",
      });
    }

    const result = await deliveryService.updateDeliveryStatus(
      req.params.id,
      req.user.id,
      status,
    );

    return res.status(200).json({
      message: "Delivery status updated",
      ...result,
    });
  } catch (error) {
    return res.status(400).json({
      message: error.message,
    });
  }
};

/**
 * GET /api/v1/deliveries/orders/:orderId
 *
 * Authorization is enforced by the service:
 * - admin
 * - customer who owns the order
 * - assigned driver
 * - restaurant owner
 */
export const getDeliveryByOrderId = async (req, res) => {
  try {
    const delivery = await deliveryService.getDeliveryByOrderId(
      req.params.orderId,
      req.user.id,
      req.user.role,
    );

    return res.status(200).json({
      delivery,
    });
  } catch (error) {
    return res.status(404).json({
      message: error.message,
    });
  }
};

/**
 * GET /api/v1/deliveries/:id
 *
 * Get a specific delivery.
 */
export const getDeliveryById = async (req, res) => {
  try {
    const delivery = await deliveryService.getDeliveryById(
      req.params.id,
      req.user.id,
      req.user.role,
    );

    return res.status(200).json({
      delivery,
    });
  } catch (error) {
    return res.status(404).json({
      message: error.message,
    });
  }
};
