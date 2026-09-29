export const isValidEmail = (email) => {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email);
};

export const isValidPhone = (phone) => {
  const phoneRegex = /^\+?[1-9]\d{1,14}$/; // E.164 format check
  return phoneRegex.test(phone);
};

export const isValidCoordinates = (lat, lng) => {
  const isLatValid = lat >= -90 && lat <= 90;
  const isLngValid = lng >= -180 && lng <= 180;
  return isLatValid && isLngValid;
};

/**
 * Format amounts into cents (integer) for precise financial transactions
 */
export const dollarsToCents = (dollars) => {
  return Math.round(parseFloat(dollars) * 100);
};

export const centsToDollars = (cents) => {
  return (cents / 100).toFixed(2);
};
