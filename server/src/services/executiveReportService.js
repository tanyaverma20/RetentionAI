/**
 * @file executiveReportService.js
 * @description Sprint 8, Part 3 — Executive Reports (PDF/DOCX/CSV).
 *
 * Reports are built entirely from executiveService's existing composition
 * (which itself only reuses decisionService/employeeIntelligenceService/
 * explainService/knowledgeService/executiveRepository) — no new data
 * computation happens here, only formatting/layout.
 *
 * Scoping note on "Charts": server-side PDF/DOCX generation has no access
 * to the client's Recharts rendering — rather than adding a heavyweight
 * server-side charting/canvas dependency, reports include the underlying
 * chart DATA in tabular form (e.g. the 12-month risk trend as a table),
 * which carries the same information the chart would visualize.
 */

import PDFDocument from 'pdfkit';
import { Document, Packer, Paragraph, HeadingLevel, Table, TableRow, TableCell, TextRun, WidthType } from 'docx';
import { Parser as CsvParser } from 'json2csv';
import * as executiveService from './executiveService.js';

async function gatherReportData(organizationId, filter) {
  const [dashboard, intervention, roi, insights] = await Promise.all([
    executiveService.getExecutiveDashboard(organizationId, filter),
    executiveService.getInterventionAnalytics(organizationId, filter),
    executiveService.getRoiAnalytics(organizationId, filter),
    executiveService.generateExecutiveInsights(organizationId, filter),
  ]);
  return { dashboard, intervention, roi, insights, generatedAt: new Date() };
}

// ---------------------------------------------------------------------------
// PDF
// ---------------------------------------------------------------------------

export async function generatePdfReport(organizationId, filter = {}) {
  const data = await gatherReportData(organizationId, filter);
  const doc = new PDFDocument({ margin: 50 });
  const chunks = [];
  doc.on('data', (chunk) => chunks.push(chunk));
  const done = new Promise((resolve) => doc.on('end', () => resolve(Buffer.concat(chunks))));

  doc.fontSize(20).text('RetentionAI — Executive Workforce Intelligence Report', { align: 'center' });
  doc.moveDown(0.3);
  doc.fontSize(10).fillColor('#666').text(`Generated: ${data.generatedAt.toISOString()}`, { align: 'center' });
  doc.moveDown(1);

  doc.fillColor('#000').fontSize(14).text('Company Health');
  doc.fontSize(10);
  const ch = data.dashboard.companyHealth;
  doc.text(`Company Health Score: ${ch.score} / 100`);
  doc.text(`Overall Attrition Risk: ${ch.overallAttritionRisk}%`);
  doc.text(`Retention Score: ${ch.retentionScore}%`);
  doc.text(`Average Burnout: ${ch.avgBurnout}%`);
  doc.text(`Employee Satisfaction: ${ch.employeeSatisfaction}%`);
  doc.moveDown(1);

  doc.fontSize(14).text('Department Summaries');
  doc.fontSize(9);
  for (const d of data.dashboard.departmentHealth) {
    doc.text(
      `${d.departmentName} (${d.location}) — Risk: ${(d.avgRiskScore * 100).toFixed(0)}% | Burnout: ${(d.avgBurnoutScore * 100).toFixed(0)}% | Headcount: ${d.predictedCount} | Acceptance Rate: ${d.acceptanceRate != null ? (d.acceptanceRate * 100).toFixed(0) + '%' : 'N/A'}`,
    );
  }
  doc.moveDown(1);

  doc.fontSize(14).text('Risk Trend (last 12 months)');
  doc.fontSize(9);
  for (const t of data.dashboard.trends.attritionTrend) {
    doc.text(`${t.period}: avg risk ${t.avgRiskScore != null ? (t.avgRiskScore * 100).toFixed(1) + '%' : 'N/A'}, ${t.highRiskCount} high-risk employees`);
  }
  doc.moveDown(1);

  doc.fontSize(14).text('Recommendation & Intervention Statistics');
  doc.fontSize(9);
  const iv = data.intervention.overall;
  doc.text(`Created: ${iv.totalCreated} | Accepted: ${iv.accepted} | Rejected: ${iv.rejected} | Pending: ${iv.pending}`);
  doc.text(`Success Rate: ${iv.successRate != null ? (iv.successRate * 100).toFixed(0) + '%' : 'N/A'} | Avg. Completion Time: ${iv.avgCompletionTimeHours ?? 'N/A'} hours`);
  doc.moveDown(1);

  doc.fontSize(14).text('SHAP Summary — Top Global Risk Drivers');
  doc.fontSize(9);
  for (const f of data.dashboard.topShapDrivers.slice(0, 8)) {
    doc.text(`${f.displayName || f.feature}: importance ${(f.meanAbsShap ?? f.importance ?? 0).toFixed(3)}`);
  }
  doc.moveDown(1);

  doc.fontSize(14).text('NLP Summary — Top Topics');
  doc.fontSize(9);
  for (const t of data.dashboard.topNlpTopics.slice(0, 8)) {
    doc.text(`${t.topic}: mentioned ${t.count} times`);
  }
  doc.moveDown(1);

  doc.fontSize(14).text('Knowledge Base References');
  doc.fontSize(9);
  const kb = data.dashboard.topKnowledgeCategories || [];
  if (kb.length === 0) doc.text('No knowledge queries recorded yet.');
  for (const k of kb.slice(0, 8)) doc.text(`${k.policy || k.name || JSON.stringify(k)}`);
  doc.moveDown(1);

  doc.fontSize(14).text('ROI Analytics (estimates — see assumptions)');
  doc.fontSize(9);
  doc.text(`Employees Retained: ${data.roi.employeesRetained} | High-Value Retained: ${data.roi.highValueEmployeesRetained}`);
  doc.text(`Est. Hiring Cost Saved: $${data.roi.estimatedHiringCostSavedUsd.toLocaleString()}`);
  doc.text(`Est. Replacement Cost Avoided: $${data.roi.estimatedReplacementCostAvoidedUsd.toLocaleString()}`);
  doc.text(`Projected Future Savings (12mo): $${data.roi.projectedFutureSavingsUsd.toLocaleString()}`);
  doc.fontSize(7).fillColor('#666').text(`Assumptions: ${data.roi.assumptions.note}`);
  doc.moveDown(1);

  doc.fillColor('#000').fontSize(14).text('Executive Insights');
  doc.fontSize(9);
  for (const insight of data.insights) {
    doc.font('Helvetica-Bold').text(`[${insight.severity}] ${insight.title}`);
    doc.font('Helvetica').text(`Confidence: ${(insight.confidence * 100).toFixed(0)}% — Recommended action: ${insight.recommendedAction}`);
    doc.moveDown(0.3);
  }

  doc.end();
  return done;
}

// ---------------------------------------------------------------------------
// DOCX
// ---------------------------------------------------------------------------

function docxHeading(text) {
  return new Paragraph({ text, heading: HeadingLevel.HEADING_2, spacing: { before: 200, after: 100 } });
}

function docxTable(headers, rows) {
  const headerRow = new TableRow({
    children: headers.map((h) => new TableCell({ children: [new Paragraph({ children: [new TextRun({ text: h, bold: true })] })] })),
  });
  const dataRows = rows.map(
    (row) => new TableRow({ children: row.map((cell) => new TableCell({ children: [new Paragraph(String(cell))] })) }),
  );
  return new Table({ rows: [headerRow, ...dataRows], width: { size: 100, type: WidthType.PERCENTAGE } });
}

export async function generateDocxReport(organizationId, filter = {}) {
  const data = await gatherReportData(organizationId, filter);
  const ch = data.dashboard.companyHealth;

  const children = [
    new Paragraph({ text: 'RetentionAI — Executive Workforce Intelligence Report', heading: HeadingLevel.TITLE }),
    new Paragraph({ text: `Generated: ${data.generatedAt.toISOString()}` }),
    docxHeading('Company Health'),
    docxTable(
      ['Metric', 'Value'],
      [
        ['Company Health Score', `${ch.score} / 100`],
        ['Overall Attrition Risk', `${ch.overallAttritionRisk}%`],
        ['Retention Score', `${ch.retentionScore}%`],
        ['Average Burnout', `${ch.avgBurnout}%`],
        ['Employee Satisfaction', `${ch.employeeSatisfaction}%`],
      ],
    ),
    docxHeading('Department Summaries'),
    docxTable(
      ['Department', 'Location', 'Risk %', 'Burnout %', 'Headcount', 'Acceptance Rate'],
      data.dashboard.departmentHealth.map((d) => [
        d.departmentName,
        d.location,
        `${(d.avgRiskScore * 100).toFixed(0)}%`,
        `${(d.avgBurnoutScore * 100).toFixed(0)}%`,
        d.predictedCount,
        d.acceptanceRate != null ? `${(d.acceptanceRate * 100).toFixed(0)}%` : 'N/A',
      ]),
    ),
    docxHeading('Risk Trend (last 12 months)'),
    docxTable(
      ['Period', 'Avg Risk Score', 'High-Risk Count'],
      data.dashboard.trends.attritionTrend.map((t) => [t.period, t.avgRiskScore != null ? `${(t.avgRiskScore * 100).toFixed(1)}%` : 'N/A', t.highRiskCount]),
    ),
    docxHeading('Recommendation & Intervention Statistics'),
    docxTable(
      ['Metric', 'Value'],
      [
        ['Created', data.intervention.overall.totalCreated],
        ['Accepted', data.intervention.overall.accepted],
        ['Rejected', data.intervention.overall.rejected],
        ['Pending', data.intervention.overall.pending],
        ['Success Rate', data.intervention.overall.successRate != null ? `${(data.intervention.overall.successRate * 100).toFixed(0)}%` : 'N/A'],
        ['Avg Completion Time (hrs)', data.intervention.overall.avgCompletionTimeHours ?? 'N/A'],
      ],
    ),
    docxHeading('SHAP Summary — Top Global Risk Drivers'),
    docxTable(
      ['Feature', 'Importance'],
      data.dashboard.topShapDrivers.slice(0, 10).map((f) => [f.displayName || f.feature, (f.meanAbsShap ?? f.importance ?? 0).toFixed(3)]),
    ),
    docxHeading('NLP Summary — Top Topics'),
    docxTable(
      ['Topic', 'Mentions'],
      data.dashboard.topNlpTopics.slice(0, 10).map((t) => [t.topic, t.count]),
    ),
    docxHeading('ROI Analytics'),
    docxTable(
      ['Metric', 'Value'],
      [
        ['Employees Retained', data.roi.employeesRetained],
        ['High-Value Employees Retained', data.roi.highValueEmployeesRetained],
        ['Est. Hiring Cost Saved', `$${data.roi.estimatedHiringCostSavedUsd.toLocaleString()}`],
        ['Est. Replacement Cost Avoided', `$${data.roi.estimatedReplacementCostAvoidedUsd.toLocaleString()}`],
        ['Projected Future Savings (12mo)', `$${data.roi.projectedFutureSavingsUsd.toLocaleString()}`],
      ],
    ),
    new Paragraph({ text: data.roi.assumptions.note, spacing: { before: 100 } }),
    docxHeading('Executive Insights'),
    ...data.insights.flatMap((insight) => [
      new Paragraph({ children: [new TextRun({ text: `[${insight.severity}] ${insight.title}`, bold: true })] }),
      new Paragraph({ text: `Confidence: ${(insight.confidence * 100).toFixed(0)}% — Recommended action: ${insight.recommendedAction}` }),
    ]),
  ];

  const doc = new Document({ sections: [{ children }] });
  return Packer.toBuffer(doc);
}

// ---------------------------------------------------------------------------
// CSV
// ---------------------------------------------------------------------------

export async function generateCsvReport(organizationId, filter = {}) {
  const data = await gatherReportData(organizationId, filter);

  const rows = data.dashboard.departmentHealth.map((d) => ({
    department: d.departmentName,
    location: d.location,
    headcount: d.predictedCount,
    avgRiskScorePct: Number((d.avgRiskScore * 100).toFixed(1)),
    highRiskCount: d.highRiskCount,
    avgBurnoutScorePct: Number((d.avgBurnoutScore * 100).toFixed(1)),
    positiveSentimentRatePct: Number((d.positiveSentimentRate * 100).toFixed(1)),
    negativeSentimentRatePct: Number((d.negativeSentimentRate * 100).toFixed(1)),
    acceptanceRatePct: d.acceptanceRate != null ? Number((d.acceptanceRate * 100).toFixed(1)) : null,
    companyHealthScore: data.dashboard.companyHealth.score,
    reportGeneratedAt: data.generatedAt.toISOString(),
  }));

  const parser = new CsvParser({
    fields: [
      'department',
      'location',
      'headcount',
      'avgRiskScorePct',
      'highRiskCount',
      'avgBurnoutScorePct',
      'positiveSentimentRatePct',
      'negativeSentimentRatePct',
      'acceptanceRatePct',
      'companyHealthScore',
      'reportGeneratedAt',
    ],
  });
  return parser.parse(rows);
}
