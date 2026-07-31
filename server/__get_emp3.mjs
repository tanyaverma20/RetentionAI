import mongoose from 'mongoose';
import dotenv from 'dotenv';
import fs from 'fs';
dotenv.config();
await mongoose.connect(process.env.MONGODB_URI);
const db = mongoose.connection.db;
const emp = await db.collection('employees').findOne({ _id: new mongoose.Types.ObjectId('6a6c72d9e34039694163f434') });
fs.writeFileSync('__req_quota.json', JSON.stringify({employeeId:'6a6c72d9e34039694163f434', employeeData: emp, userId:'test'}, (k,v)=> v instanceof mongoose.Types.ObjectId ? v.toString(): v));
await mongoose.disconnect();
