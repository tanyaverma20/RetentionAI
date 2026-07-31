import mongoose from 'mongoose';
import dotenv from 'dotenv';
dotenv.config();
await mongoose.connect(process.env.MONGODB_URI);
const db = mongoose.connection.db;

function percentile(arr, p) {
  const sorted = [...arr].sort((a,b)=>a-b);
  const idx = Math.floor(p/100 * (sorted.length-1));
  return sorted[idx];
}

// Latest prediction per employee
const preds = await db.collection('predictions').aggregate([
  { $sort: { createdAt: -1 } },
  { $group: { _id: '$employeeId', riskScore: { $first: '$riskScore' }, riskLevel: { $first: '$riskLevel' } } },
]).toArray();
const scores = preds.map(p => p.riskScore).filter(s => typeof s === 'number');
console.log('Total predictions:', scores.length);
console.log('riskLevel counts:', preds.reduce((acc,p)=>{acc[p.riskLevel]=(acc[p.riskLevel]||0)+1;return acc;},{}));
console.log('riskScore percentiles: p50=%s p75=%s p85=%s p90=%s p95=%s p99=%s max=%s',
  percentile(scores,50).toFixed(4), percentile(scores,75).toFixed(4), percentile(scores,85).toFixed(4),
  percentile(scores,90).toFixed(4), percentile(scores,95).toFixed(4), percentile(scores,99).toFixed(4), Math.max(...scores).toFixed(4));

const highScores = preds.filter(p => p.riskLevel === 'HIGH').map(p => p.riskScore);
console.log('Among HIGH bucket (n=' + highScores.length + '): min=%s p25=%s p50=%s p75=%s p90=%s max=%s',
  Math.min(...highScores).toFixed(4), percentile(highScores,25).toFixed(4), percentile(highScores,50).toFixed(4),
  percentile(highScores,75).toFixed(4), percentile(highScores,90).toFixed(4), Math.max(...highScores).toFixed(4));

// Performance distribution
const perfDist = await db.collection('employees').aggregate([
  { $match: { status: 'ACTIVE' } },
  { $group: { _id: '$performanceRating', count: { $sum: 1 } } },
  { $sort: { _id: 1 } }
]).toArray();
console.log('performanceRating (on employee doc) distribution:', JSON.stringify(perfDist));

// Check Performance collection too
const perfCol = await db.collection('performances').aggregate([
  { $sort: { reviewDate: -1 } },
  { $group: { _id: '$employeeId', rating: { $first: '$rating' } } },
]).toArray();
const perfCounts = perfCol.reduce((acc,p)=>{acc[p.rating]=(acc[p.rating]||0)+1;return acc;},{});
console.log('Performance collection latest-rating distribution:', JSON.stringify(perfCounts), 'n=', perfCol.length);

await mongoose.disconnect();
