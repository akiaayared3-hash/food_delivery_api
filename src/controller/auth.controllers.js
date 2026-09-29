import authService from "../service/auth.services.js";

// Public Customer Registration
export const register = async (req, res) => {
  try {
    const { full_name, email, password, phone_number } = req.body;

    if (!full_name || !email || !password || !phone_number) {
      return res.status(400).json({
        message: "full_name, email, password, and phone_number are required",
      });
    }

    const result = await authService.registerCustomer({
      full_name,
      email,
      password,
      phone_number,
    });

    return res.status(201).json({
      message: "User registered successfully",
      ...result,
    });
  } catch (error) {
    return res.status(400).json({ message: error.message });
  }
};

// Login
export const login = async (req, res) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res
        .status(400)
        .json({ message: "email and password are required" });
    }

    const result = await authService.login({ email, password });
    return res.status(200).json(result);
  } catch (error) {
    return res.status(401).json({ message: error.message });
  }
};

// Protected GET /auth/me
export const getMe = async (req, res) => {
  try {
    // req.user is set by authenticate middleware
    const user = await authService.getMe(req.user.id);
    return res.status(200).json({
      success: true,
      user,
    });
  } catch (error) {
    return res.status(404).json({ message: error.message });
  }
};

// Admin Endpoint: Create Drivers or Owners
export const createPrivilegedUser = async (req, res) => {
  try {
    const { full_name, email, password, phone_number, role } = req.body;

    if (!full_name || !email || !password || !phone_number || !role) {
      return res.status(400).json({
        message:
          "full_name, email, password, phone_number, and role are required",
      });
    }

    const user = await authService.registerPrivilegedUser({
      full_name,
      email,
      password,
      phone_number,
      role,
    });

    return res.status(201).json({
      message: `${role} account created successfully`,
      user,
    });
  } catch (error) {
    return res.status(400).json({ message: error.message });
  }
};
