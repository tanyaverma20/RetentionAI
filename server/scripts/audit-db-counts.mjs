/**
 * One-time DB audit script.
 * Run: node --env-file=.env scripts/audit-db-counts.mjs
 */
import mongoose from 'mongoose';

const URI = process.env.MONGODB_URI;
const DB = process.env.MONGODB_DB_NAME || 'retentionai';
if (!URI) { console.error('MONGODB_URI not set'); process.exit(1); }

await mongoose.connect(URI, { dbName: DB });
const db = mongoose.connection.db;

const collections = ['employees','departments','performances','employeefeedbacks',
  'attendances','traininghistories','promotionhistories','surveys','predictions','decisions'];

console.log('\n=== Collection counts (all orgs) ===');
for (const c of collections) {
  try {
    const total = await db.collection(c).countDocuments({});
    console.log(`  ${c}: ${total}`);
  } catch {}
}

const DEMO_ORG = '60d5ec388832a828f8000000';
const oid = new mongoose.Types.ObjectId(DEMO_ORG);
console.log(`\n=== Counts scoped to DEMO org (${DEMO_ORG}) ===`);
for (const c of collections) {
  try {
    const count = await db.collection(c).countDocuments({ organizationId: oid });
    const countStr = await db.collection(c).countDocuments({ organizationId: DEMO_ORG });
    console.log(`  ${c}: ObjectId=${count}, string=${countStr}`);
  } catch {}
}

// Sample a Performance doc to see organizationId type
const perfSample = await db.collection('performances').findOne({});
if (perfSample) {
  console.log('\n=== Sample Performance doc ===');
  console.log('  organizationId:', perfSample.organizationId, '(type:', typeof perfSample.organizationId, ')');
  console.log('  promotionRecommendation:', perfSample.promotionRecommendation);
}

const feedSample = await db.collection('employeefeedbacks').findOne({});
if (feedSample) {
  console.log('\n=== Sample EmployeeFeedback doc ===');
  console.log('  organizationId:', feedSample.organizationId, '(type:', typeof feedSample.organizationId, ')');
}

const empSample = await db.collection('employees').findOne({});
if (empSample) {
  console.log('\n=== Sample Employee doc ===');
  console.log('  organizationId:', empSample.organizationId, '(type:', typeof empSample.organizationId, ')');
  console.log('  status:', empSample.status);
  console.log('  isDeleted:', empSample.isDeleted);
}

// Check what organizationIds Performance docs actually use
const orgIds = await db.collection('performances').distinct('organizationId');
console.log('\n=== Distinct organizationIds in performances ===', orgIds.slice(0, 5));

const feedOrgIds = await db.collection('employeefeedbacks').distinct('organizationId');
console.log('=== Distinct organizationIds in employeefeedbacks ===', feedOrgIds.slice(0, 5));

const empOrgIds = await db.collection('employees').distinct('organizationId');
console.log('=== Distinct organizationIds in employees ===', empOrgIds.slice(0, 5));

await mongoose.disconnect();
console.log('\nDone.');
process.exit(0);
