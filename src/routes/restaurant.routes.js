import { Router } from 'express';
import {
    createRestaurants, 
    getAllRestaurants, 
    getRestaurantsById,
    addCategories, 
    addMenuItem, 
    getFullMenu, 
    toggleItemAvailability
} from '../controller/restaurant.controller.js';
import { authenticate, authorize } from '../middleware/auth.middleware.js';


const router = Router();


// Public Routes

router.get('/', getAllRestaurants);
router.get('/:id', getRestaurantsById);
router.get('/:id/menu', getFullMenu);


// Owner / Admin Protected Routes
router.post(
  '/',
  authenticate,
  authorize('restaurant_owner', 'admin'),
  createRestaurants
);

router.post(
  '/:id/categories',
  authenticate,
  authorize('restaurant_owner', 'admin'),
  addCategories
);

router.post(
  '/:id/categories/:categoryId/items',
  authenticate,
  authorize('restaurant_owner', 'admin'),
  addMenuItem
);

router.patch(
  '/:id/items/:itemId/availability',
  authenticate,
  authorize('restaurant_owner', 'admin'),
  toggleItemAvailability
);

export default router;