import restaurantServices from "../service/restaurant.services.js";

// 1. Create restaurant
const createRestaurants = async (req, res) => {
  try {
    const { name, description, address, phone_number } = req.body;

    if (!name || !address || !phone_number) {
      return res.status(400).json({
        message: "name, address, and phone_number fields are required",
      });
    }

    const restaurant = await restaurantServices.createRestaurant(req.user.id, {
      name,
      description,
      address,
      phone_number,
    });

    return res.status(201).json({
      message: "Created restaurant successfully",
      restaurant,
    });
  } catch (error) {
    return res.status(400).json({
      message: error.message,
    });
  }
};

// 2. Get all restaurants
const getAllRestaurants = async (req, res) => {
  try {
    const restaurants = await restaurantServices.getAllRestaurants();

    return res.status(200).json({
      restaurants,
    });
  } catch (error) {
    return res.status(500).json({
      message: error.message,
    });
  }
};

// 3. Get restaurant by ID
const getRestaurantsById = async (req, res) => {
  try {
    const restaurant = await restaurantServices.getRestaurantById(
      req.params.id,
    );

    return res.status(200).json({
      restaurant,
    });
  } catch (error) {
    return res.status(404).json({
      message: error.message,
    });
  }
};

// 4. Add category
const addCategories = async (req, res) => {
  try {
    const { name, display_order } = req.body;

    if (!name) {
      return res.status(400).json({
        message: "Category name is required",
      });
    }

    const category = await restaurantServices.addCategory(
      req.params.id,
      req.user.id,
      {
        name,
        display_order,
      },
    );

    return res.status(201).json({
      message: "Category added successfully",
      category,
    });
  } catch (error) {
    return res.status(400).json({
      message: error.message,
    });
  }
};

// 5. Add menu item
const addMenuItem = async (req, res) => {
  try {
    const { restaurantId, categoryId } = req.params;

    const { name, description, price_cents, image_url } = req.body;

    if (!name) {
      return res.status(400).json({
        message: "Menu item name is required",
      });
    }

    if (
      price_cents === undefined ||
      price_cents === null ||
      Number.isNaN(Number(price_cents))
    ) {
      return res.status(400).json({
        message: "Valid price_cents is required",
      });
    }

    const item = await restaurantServices.addMenuItem(
      restaurantId,
      req.user.id,
      categoryId,
      {
        name,
        description,
        price_cents: Number(price_cents),
        image_url,
      },
    );

    return res.status(201).json({
      message: "Menu item added successfully",
      item,
    });
  } catch (error) {
    return res.status(400).json({
      message: error.message,
    });
  }
};

// 6. Get full menu
const getFullMenu = async (req, res) => {
  try {
    const menu = await restaurantServices.getFullMenu(req.params.id);

    return res.status(200).json({
      menu,
    });
  } catch (error) {
    return res.status(500).json({
      message: error.message,
    });
  }
};

// 7. Toggle menu item availability
const toggleItemAvailability = async (req, res) => {
  try {
    const { id: restaurantId, itemId } = req.params;
    const { is_available } = req.body;

    if (typeof is_available !== "boolean") {
      return res.status(400).json({
        message: "is_available field must be a boolean",
      });
    }

    const result = await restaurantServices.toggleMenuItemAvailability(
      restaurantId,
      req.user.id,
      itemId,
      is_available,
    );

    return res.status(200).json({
      message: "Availability updated successfully",
      result,
    });
  } catch (error) {
    return res.status(400).json({
      message: error.message,
    });
  }
};

export {
  createRestaurants,
  getAllRestaurants,
  getRestaurantsById,
  addCategories,
  addMenuItem,
  getFullMenu,
  toggleItemAvailability,
};
