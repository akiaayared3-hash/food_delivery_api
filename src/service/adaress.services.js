import pool from "../config/db.js";
import { AppError } from "../utils/index.utils.js";

class AddressService {
  async getUserAddress(userId) {
    const [rows] = await pool.query(
      `SELECT id, user_id, address_line_1, address_line_2, city, postal_code, is_default 
       FROM addresses WHERE user_id = ?`,
      [userId],
    );
    return rows;
  }

  async createAddress(
    userId,
    { address_line_1, address_line_2, city, postal_code, is_default },
  ) {
    const connection = await pool.getConnection();

    try {
      await connection.beginTransaction();

      // If new address is set to default, unset any previous default addresses for this user
      if (is_default) {
        await connection.query(
          `UPDATE addresses SET is_default = FALSE WHERE user_id = ?`,
          [userId],
        );
      }

      const [result] = await connection.query(
        `INSERT INTO addresses (user_id, address_line_1, address_line_2, city, postal_code, is_default)
         VALUES (?, ?, ?, ?, ?, ?)`,
        [
          userId,
          address_line_1,
          address_line_2 || null,
          city,
          postal_code,
          is_default || false,
        ],
      );

      await connection.commit();

      return {
        id: result.insertId,
        user_id: userId,
        address_line_1,
        address_line_2: address_line_2 || null,
        city,
        postal_code,
        is_default: !!is_default,
      };
    } catch (error) {
      await connection.rollback();
      throw error;
    } finally {
      connection.release();
    }
  }

  async updateAddress(addressId, userId, data) {
    const { address_line_1, address_line_2, city, postal_code, is_default } =
      data;

    const [existing] = await pool.query(
      `SELECT id FROM addresses WHERE id = ? AND user_id = ?`,
      [addressId, userId],
    );

    if (existing.length === 0) {
      throw new AppError("Address not found or unauthorized", 404);
    }

    if (is_default) {
      await pool.query(
        `UPDATE addresses SET is_default = FALSE WHERE user_id = ?`,
        [userId],
      );
    }

    await pool.query(
      `UPDATE addresses 
       SET address_line_1 = COALESCE(?, address_line_1),
           address_line_2 = COALESCE(?, address_line_2),
           city = COALESCE(?, city),
           postal_code = COALESCE(?, postal_code),
           is_default = COALESCE(?, is_default)
       WHERE id = ? AND user_id = ?`,
      [
        address_line_1 || null,
        address_line_2 || null,
        city || null,
        postal_code || null,
        is_default !== undefined ? is_default : null,
        addressId,
        userId,
      ],
    );

    const [updated] = await pool.query(`SELECT * FROM addresses WHERE id = ?`, [
      addressId,
    ]);
    return updated[0];
  }

  async deleteAddress(addressId, userId) {
    const [result] = await pool.query(
      `DELETE FROM addresses WHERE id = ? AND user_id = ?`,
      [addressId, userId],
    );

    if (result.affectedRows === 0) {
      throw new AppError("Address not found or unauthorized", 404);
    }

    return true;
  }
}

export default new AddressService();
