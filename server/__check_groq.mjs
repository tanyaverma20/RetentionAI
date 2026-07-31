import mongoose from 'mongoose';
import dotenv from 'dotenv';
dotenv.config();
await mongoose.connect(process.env.MONGODB_URI);
const db = mongoose.connection.db;
const emp = await db.collection('employees').findOne({ status: 'ACTIVE' });
console.log(JSON.stringify({ id: emp._id.toString() }));
await mongoose.disconnect();
