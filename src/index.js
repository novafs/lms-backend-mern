import express from 'express';
import dotenv from 'dotenv';
import cors from 'cors';
import bodyParser from 'body-parser';
import globalRoutes from './routes/globalRoutes.js';
import authRoutes from './routes/authRoutes.js';
import connectDB from './utils/database.js';
import paymentRoutes from './routes/paymentRoutes.js';
import courseRoutes from './routes/courseRoutes.js';
import studentRoutes from './routes/studentRoutes.js';
import overviewRoutes from './routes/overviewRoutes.js';

const app = express();

dotenv.config();

connectDB();

const port = process.env.PORT || 3000;

app.use(cors());
app.use(bodyParser.json());
app.use(express.static('public'));

app.get('/', (req, res) => {
    res.json({text: 'Hello, World guys!'});
});

app.use("/api", globalRoutes);
app.use('/api', paymentRoutes);
app.use('/api', authRoutes);
app.use('/api', courseRoutes);
app.use('/api', studentRoutes);
app.use('/api', overviewRoutes);

app.listen(port, () => {
    console.log(`Server is running on http://localhost:${port}`);
});