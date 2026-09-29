import addressServices from "../service/adaress.services.js";
import { asyncHandler, successResponse, AppError } from "../utils/index.utils.js";

// GET /api/v1/addresses
const getUserAddress = asyncHandler(async (req, res) => {
  const address = await addressServices.getUserAddress(req.user.id);
  return successResponse(res, 200, "Addresses retrieved successfully", {
    address,
  });
});

// POST /api/v1/addresses
const createAddress = asyncHandler(async (req, res) => {
  const { address_line_1, address_line_2, city, postal_code, is_default } =
    req.body;

  if (!address_line_1 || !city || !postal_code) {
    throw new AppError(
      "Address line 1, city, and postal code are required",
      400,
    );
  }

  const newAddress = await addressServices.createAddress(req.user.id, {
    address_line_1,
    address_line_2,
    city,
    postal_code,
    is_default,
  });

  return successResponse(res, 201, "Address created successfully", {
    address: newAddress,
  });
});

// PUT /api/v1/addresses/:id
const updateAddress = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const updatedAddress = await addressServices.updateAddress(
    id,
    req.user.id,
    req.body,
  );

  return successResponse(res, 200, "Address updated successfully", {
    address: updatedAddress,
  });
});

// DELETE /api/v1/addresses/:id
const deleteAddress = asyncHandler(async (req, res) => {
  const { id } = req.params;
  await addressServices.deleteAddress(id, req.user.id);

  return successResponse(res, 200, "Address deleted successfully");
});

export { getUserAddress, createAddress, updateAddress, deleteAddress };
