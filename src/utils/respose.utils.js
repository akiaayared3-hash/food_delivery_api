/**
 * Express Response Formatters
 */

export const successResponse = (
  res,
  statusCode = 200,
  message = "Success",
  data = null,
) => {
  const response = {
    success: true,
    message,
  };

  if (data !== null) {
    response.data = data;
  }

  return res.status(statusCode).json(response);
};

export const paginatedResponse = (
  res,
  statusCode = 200,
  message = "Success",
  data = [],
  page = 1,
  limit = 10,
  total = 0,
) => {
  return res.status(statusCode).json({
    success: true,
    message,
    data,
    pagination: {
      page: Number(page),
      limit: Number(limit),
      total: Number(total),
      totalPages: Math.ceil(total / limit) || 1,
    },
  });
};

export const errorResponse = (
  res,
  statusCode = 500,
  message = "Internal Server Error",
  errors = null,
) => {
  const response = {
    success: false,
    message,
  };

  if (errors) {
    response.errors = errors;
  }

  return res.status(statusCode).json(response);
};
