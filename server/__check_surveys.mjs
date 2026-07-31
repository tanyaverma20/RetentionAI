import mongoose from 'mongoose';
import dotenv from 'dotenv';
dotenv.config();
await mongoose.connect(process.env.MONGODB_URI);
const db = mongoose.connection.db;
const counts = await db.collection('surveys').aggregate([
  { $group: { _id: '$employeeId', n: { $sum: 1 } } },
  { $group: { _id: '$n', employees: { $sum: 1 } } },
  { $sort: { _id: 1 } }
]).toArray();
console.log('surveys per employee distribution:', JSON.stringify(counts));
const sample = await db.collection('surveys').find({}).sort({surveyDate:-1}).limit(2).toArray();
console.log(JSON.stringify(sample, null, 2));
await mongoose.disconnect();
