import path from 'path';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';
import mongoose from 'mongoose';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
dotenv.config({ path: path.join(__dirname, '../.env') });

const MONGODB_URI = process.env.MONGODB_URI;

if (!MONGODB_URI) {
  console.error('ERROR: MONGODB_URI is not set in environment.');
  process.exit(1);
}

async function runReferentialIntegrityCheck() {
  console.log('=== RETENTIONAI REFERENTIAL INTEGRITY AUDIT (READ-ONLY) ===');
  const startTime = Date.now();

  try {
    await mongoose.connect(MONGODB_URI, {
      serverSelectionTimeoutMS: 15000,
      tlsAllowInvalidCertificates: true,
    });

    const db = mongoose.connection.db;
    const collections = await db.listCollections().toArray();
    const collectionNames = collections.map((c) => c.name);

    console.log(`Auditing ${collectionNames.length} MongoDB collections...`);

    let violationsFound = 0;
    const report = {
      timestamp: new Date().toISOString(),
      collectionsAudited: collectionNames.length,
      violations: [],
    };

    // 1. Audit Employees -> Organization
    if (collectionNames.includes('employees')) {
      const employees = db.collection('employees');

      const orphanOrgEmployees = await employees
        .aggregate([
          {
            $lookup: {
              from: 'organizations',
              localField: 'organizationId',
              foreignField: '_id',
              as: 'org',
            },
          },
          { $match: { org: { $size: 0 } } },
          { $project: { _id: 1, organizationId: 1 } },
        ])
        .toArray();

      if (orphanOrgEmployees.length > 0) {
        violationsFound += orphanOrgEmployees.length;
        report.violations.push({
          type: 'ORPHANED_ORGANIZATION_REFERENCE',
          collection: 'employees',
          count: orphanOrgEmployees.length,
          sampleIds: orphanOrgEmployees.slice(0, 5).map((e) => e._id),
        });
      }
    }

    // 2. Audit Predictions -> Employee
    if (collectionNames.includes('predictions')) {
      const predictions = db.collection('predictions');

      const orphanPredictions = await predictions
        .aggregate([
          {
            $lookup: {
              from: 'employees',
              localField: 'employeeId',
              foreignField: '_id',
              as: 'emp',
            },
          },
          { $match: { emp: { $size: 0 } } },
          { $project: { _id: 1, employeeId: 1 } },
        ])
        .toArray();

      if (orphanPredictions.length > 0) {
        violationsFound += orphanPredictions.length;
        report.violations.push({
          type: 'ORPHANED_EMPLOYEE_REFERENCE',
          collection: 'predictions',
          count: orphanPredictions.length,
          sampleIds: orphanPredictions.slice(0, 5).map((p) => p._id),
        });
      }
    }

    // 3. Audit Explanations -> Employee
    if (collectionNames.includes('explanations')) {
      const explanations = db.collection('explanations');

      const orphanExplanations = await explanations
        .aggregate([
          {
            $lookup: {
              from: 'employees',
              localField: 'employeeId',
              foreignField: '_id',
              as: 'emp',
            },
          },
          { $match: { emp: { $size: 0 } } },
          { $project: { _id: 1, employeeId: 1 } },
        ])
        .toArray();

      if (orphanExplanations.length > 0) {
        violationsFound += orphanExplanations.length;
        report.violations.push({
          type: 'ORPHANED_EMPLOYEE_EXPLANATION',
          collection: 'explanations',
          count: orphanExplanations.length,
          sampleIds: orphanExplanations.slice(0, 5).map((e) => e._id),
        });
      }
    }

    const durationSec = ((Date.now() - startTime) / 1000).toFixed(2);
    console.log(`Audit completed in ${durationSec}s.`);
    console.log(`Total Referential Integrity Discrepancies Detected: ${violationsFound}`);

    if (violationsFound > 0) {
      console.log('AUDIT DISCREPANCY DETAILS:');
      console.log(JSON.stringify(report, null, 2));
      console.log('REFERENTIAL INTEGRITY AUDIT: COMPLETED (Discrepancies Reported)');
      // Zero mutation occurred
      process.exit(0);
    } else {
      console.log('REFERENTIAL INTEGRITY AUDIT: PASSED (100% Consistent)');
      process.exit(0);
    }
  } catch (err) {
    console.error('Error executing referential integrity audit:', err.message);
    process.exit(1);
  } finally {
    await mongoose.disconnect();
  }
}

runReferentialIntegrityCheck();
