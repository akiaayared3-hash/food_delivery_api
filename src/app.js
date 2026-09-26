import express from 'express';
import cors from 'cors'
import helmet from 'helmet';
import pool from './config/db.js';
import { initDb } from './config/initDb.js'
//import config from './config/db.js';
import 'dotenv/config'
import { inherits } from 'node:util';


const app = express()

// security
app.use(express.json())
app.use(cors());
app.use(helmet())

// test my request
app.get('/', (req, res) => {
    res.send("api is working")
})


const startServer = async () => {

 try {
    await initDb();

    const connection = await pool.getConnection()
    console.log("✅ Connected to MySQL Database successfully.");
    connection.release()
    //server listen

    const port = process.env.PORT || 3000;
    app.listen(port, () => {
      console.log(`server is listen on port http://localhost:${port}`)
    })

    
 } catch (error) {
    console.log(error)
 }
}

startServer();