# Food Delivery API

A RESTful API for a food delivery system built with Node.js, Express, and MySQL.

This backend supports user authentication, restaurants, orders, deliveries, payments, and address management.

## Features

- User Authentication (Register / Login) with JWT
- Password hashing using bcrypt
- Restaurant management
- Order management
- Delivery management
- Payment handling
- User address management
- Input validation with Zod
- Centralized error handling
- Security with Helmet and CORS
- File upload support (Multer)
- Clean architecture (Controllers, Services, Routes, Middleware)

## Tech Stack

- **Runtime:** Node.js
- **Framework:** Express.js
- **Database:** MySQL
- **Authentication:** JWT + bcrypt
- **Validation:** Zod
- **Security:** Helmet, CORS
- **File Upload:** Multer
- **Testing:** Vitest + Supertest

## API Endpoints

Base URL: `/api/v1`

| Method | Endpoint              | Description                |
|--------|-----------------------|----------------------------|
| POST   | `/auth/register`      | Register a new user        |
| POST   | `/auth/login`         | Login user                 |
| GET    | `/restaurants`        | Get all restaurants        |
| POST   | `/restaurants`        | Create restaurant          |
| GET    | `/orders`             | Get user orders            |
| POST   | `/orders`             | Create new order           |
| GET    | `/deliveries`         | Get deliveries             |
| POST   | `/payments`           | Process payment            |
| GET    | `/addresses`          | Get user addresses         |
| POST   | `/addresses`          | Add new address            |

> Note: Some routes require authentication (Bearer Token).

## Project Structure

src/
├── config/          # Database and environment config
├── controller/      # Route controllers
├── middleware/      # Auth and other middlewares
├── routes/          # API routes
├── service/         # Business logic
├── utils/           # Helper functions and error handler
└── app.js           # Main application file
