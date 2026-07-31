import mongoose from 'mongoose';
import dotenv from 'dotenv';
dotenv.config();
await mongoose.connect(process.env.MONGODB_URI);
const db = mongoose.connection.db;
const sample = await db.collection('employees').findOne({ status: 'ACTIVE' });
console.log(Object.keys(sample).join('\n'));
await mongoose.disconnect();
