import pool from "../config/db.js";
import bcrypt from "bcrypt";
import jwt from "jsonwebtoken";

const JWT_SECRET =
  process.env.JWT_SECRET || "super_secret_jwt_key_change_in_prod";

class AuthService {
  // 🔒 Public registration: STRICTLY forces role = 'customer'
  async registerCustomer({ full_name, email, password, phone_number }) {
    const [existing] = await pool.query(
      `SELECT id FROM users WHERE email = ? OR phone_number = ?`,
      [email, phone_number],
    );
    if (existing.length > 0) {
      throw new Error("Email or phone number already registered");
    }

    const hashedPassword = await bcrypt.hash(password, 10);
    const role = "customer";

    const [result] = await pool.query(
      `INSERT INTO users (full_name, email, password_hash, phone_number, role) VALUES (?, ?, ?, ?, ?)`,
      [full_name, email, hashedPassword, phone_number, role],
    );

    const userId = result.insertId;
    const token = jwt.sign({ id: userId, role }, JWT_SECRET, {
      expiresIn: "7d",
    });

    return {
      token,
      user: { id: userId, full_name, email, phone_number, role },
    };
  }

  // 🛡️ Admin-only creation: Onboard drivers, restaurant owners, or other admins
  async registerPrivilegedUser({
    full_name,
    email,
    password,
    phone_number,
    role,
  }) {
    const allowedRoles = ["restaurant_owner", "driver", "admin"];
    if (!allowedRoles.includes(role)) {
      throw new Error(
        "Invalid role specified. Must be 'restaurant_owner', 'driver', or 'admin'.",
      );
    }

    const [existing] = await pool.query(
      `SELECT id FROM users WHERE email = ? OR phone_number = ?`,
      [email, phone_number],
    );
    if (existing.length > 0) {
      throw new Error("Email or phone number already registered");
    }

    const hashedPassword = await bcrypt.hash(password, 10);

    const [result] = await pool.query(
      `INSERT INTO users (full_name, email, password_hash, phone_number, role) VALUES (?, ?, ?, ?, ?)`,
      [full_name, email, hashedPassword, phone_number, role],
    );

    return {
      id: result.insertId,
      full_name,
      email,
      phone_number,
      role,
    };
  }

  // Login
  async login({ email, password }) {
    const [rows] = await pool.query(`SELECT * FROM users WHERE email = ?`, [
      email,
    ]);
    if (rows.length === 0) {
      throw new Error("Invalid email or password");
    }

    const user = rows[0];
    if (!user.is_active) {
      throw new Error("User account is disabled");
    }

    const match = await bcrypt.compare(password, user.password_hash);
    if (!match) {
      throw new Error("Invalid email or password");
    }

    const token = jwt.sign({ id: user.id, role: user.role }, JWT_SECRET, {
      expiresIn: "7d",
    });

    return {
      token,
      user: {
        id: user.id,
        full_name: user.full_name,
        email: user.email,
        phone_number: user.phone_number,
        role: user.role,
      },
    };
  }

  // Get Profile (For /auth/me)
  async getMe(userId) {
    const [rows] = await pool.query(
      `SELECT id, full_name, email, phone_number, role, is_active, created_at 
             FROM users 
             WHERE id = ?`,
      [userId],
    );

    if (rows.length === 0) {
      throw new Error("User not found");
    }

    return rows[0];
  }
}

export default new AuthService();
