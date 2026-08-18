import mongoose from 'mongoose';
import { getKpiSummary, getHrMetrics, getAdvancedCharts, getMonthlyTrends } from '../src/repositories/analyticsRepository.js';

const URI = process.env.MONGODB_URI;
const DB = process.env.MONGODB_DB_NAME || 'retentionai';
await mongoose.connect(URI, { dbName: DB });

console.log('\n--- TESTING WITH DEMO ORG (0 employees) ---');
const demoFilter = { organizationId: '60d5ec388832a828f8000000' };

const demoKpis = await getKpiSummary(demoFilter);
console.log('Demo Org KPIs:', JSON.stringify(demoKpis, null, 2));

const demoHr = await getHrMetrics(demoFilter);
console.log('Demo Org HR Metrics:', JSON.stringify(demoHr, null, 2));

const demoCharts = await getAdvancedCharts(demoFilter);
console.log('Demo Org Advanced Charts performanceDistribution sum:', demoCharts.performanceDistribution.reduce((a, b) => a + b.count, 0));

const demoTrends = await getMonthlyTrends(demoFilter);
console.log('Demo Org Monthly Trends total hires:', demoTrends.reduce((a, b) => a + b.hires, 0), 'total attrition:', demoTrends.reduce((a, b) => a + b.attrition, 0));

console.log('\n--- TESTING WITH NEW ORG (1 employee) ---');
const newOrgId = '6a7c55cf94512b05dc038939';
const newOrgFilter = { organizationId: newOrgId };

const newOrgKpis = await getKpiSummary(newOrgFilter);
console.log('New Org KPIs:', JSON.stringify(newOrgKpis, null, 2));

await mongoose.disconnect();
console.log('\nAll tests completed successfully!');
process.exit(0);
