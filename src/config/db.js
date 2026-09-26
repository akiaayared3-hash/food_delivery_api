import mysql2 from 'mysql2/promise';
import 'dotenv/config';
import { env } from './env.js'

const pool = mysql2.createPool({
  host: env.DB_HOST,
  port: env.DB_PORT,
  user: env.DB_USER,
  password: env.DB_PASSWORD,
  database: env.DB_DATABASE,
  waitForConnections: true,
  connectionLimit: 10

});

export default pool;