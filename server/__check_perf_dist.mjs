import mongoose from 'mongoose';
import dotenv from 'dotenv';
dotenv.config();
await mongoose.connect(process.env.MONGODB_URI);
const db = mongoose.connection.db;
const latestPerf = await db.collection('performances').aggregate([
  { $sort: { reviewPeriod: -1 } },
  { $group: { _id: '$employeeId', score: { $first: '$performanceScore' } } },
]).toArray();
const scores = latestPerf.map(p => p.score).filter(s => typeof s === 'number');
const counts = {};
scores.forEach(s => { counts[s] = (counts[s]||0)+1; });
console.log('latest performanceScore distribution:', JSON.stringify(counts), 'n=', scores.length);

const latestEng = await db.collection('surveys').aggregate([
  { $sort: { surveyDate: -1 } },
  { $group: { _id: '$employeeId', score: { $first: '$engagementScore' } } },
]).toArray();
const engScores = latestEng.map(p => p.score).filter(s => typeof s === 'number');
function percentile(arr, p) { const s=[...arr].sort((a,b)=>a-b); return s[Math.floor(p/100*(s.length-1))]; }
console.log('latest engagementScore: n=%s p10=%s p25=%s p50=%s p75=%s p90=%s', engScores.length,
  percentile(engScores,10).toFixed(2), percentile(engScores,25).toFixed(2), percentile(engScores,50).toFixed(2),
  percentile(engScores,75).toFixed(2), percentile(engScores,90).toFixed(2));

await mongoose.disconnect();
