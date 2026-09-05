/**
 * PDF Generator for PulseDesk Reports using jsPDF.
 *
 * Generates an authentic, structured, multi-page vector PDF report
 * containing all operational metrics for the active organization and filter date range.
 */

import { jsPDF } from 'jspdf';
import type { ReportExportDataset } from './csvGenerator';

function formatDurationSeconds(seconds: number): string {
  if (!seconds || seconds <= 0) return '0s';
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = Math.floor(seconds % 60);
  const parts: string[] = [];
  if (h > 0) parts.push(`${h}h`);
  if (m > 0) parts.push(`${m}m`);
  if (s > 0 || parts.length === 0) parts.push(`${s}s`);
  return parts.join(' ');
}

/**
 * Builds a jsPDF document containing the complete report dataset.
 */
export function generateReportPdfDoc(dataset: ReportExportDataset): jsPDF {
  const doc = new jsPDF({
    orientation: 'portrait',
    unit: 'pt',
    format: 'letter', // 612 x 792 pt
  });

  // ================= PAGE 1 =================
  // 1. Top Header Banner
  doc.setFillColor(37, 56, 110); // Indigo-900 / Primary Navy
  doc.rect(0, 0, 612, 65, 'F');

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(18);
  doc.setTextColor(255, 255, 255);
  doc.text('PulseDesk Operational Report', 36, 32);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9);
  doc.setTextColor(210, 225, 255);
  doc.text(
    `Organization: ${dataset.organizationName} (${dataset.organizationId})`,
    36,
    50
  );

  // 2. Metadata Box
  doc.setFillColor(248, 249, 252);
  doc.setDrawColor(220, 226, 238);
  doc.setLineWidth(1);
  doc.roundedRect(36, 75, 540, 52, 4, 4, 'FD');

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8);
  doc.setTextColor(80, 95, 120);
  doc.text('DATE RANGE:', 48, 93);
  doc.text('GENERATED:', 48, 112);
  doc.text('GRANULARITY:', 330, 93);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8.5);
  doc.setTextColor(30, 35, 45);
  doc.text(
    `${dataset.dateRange.start.slice(0, 10)} to ${dataset.dateRange.end.slice(0, 10)}`,
    125,
    93
  );
  doc.text(
    new Date().toLocaleString('en-US', { dateStyle: 'medium', timeStyle: 'short' }),
    125,
    112
  );
  doc.text(dataset.granularity.toUpperCase(), 415, 93);

  // 3. Section 1: Incident Overview Summary
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(12);
  doc.setTextColor(25, 35, 60);
  doc.text('1. Incident Overview Summary', 36, 150);

  doc.setDrawColor(220, 226, 238);
  doc.setLineWidth(0.75);
  doc.line(36, 156, 576, 156);

  const metrics = [
    { label: 'Total Incidents', value: String(dataset.summary?.total_incidents ?? 0) },
    { label: 'Open Incidents', value: String(dataset.summary?.open_incidents ?? 0) },
    { label: 'Resolved Incidents', value: String(dataset.summary?.resolved_incidents ?? 0) },
    { label: 'Closed Incidents', value: String(dataset.summary?.closed_incidents ?? 0) },
    { label: 'Unassigned', value: String(dataset.summary?.unassigned_incidents ?? 0) },
    { label: 'Critical (P1)', value: String(dataset.summary?.critical_incidents ?? 0) },
  ];

  metrics.forEach((m, idx) => {
    const col = idx % 3;
    const row = Math.floor(idx / 3);
    const x = 36 + col * 184;
    const y = 168 + row * 46;

    doc.setFillColor(250, 251, 254);
    doc.setDrawColor(225, 230, 240);
    doc.setLineWidth(0.5);
    doc.roundedRect(x, y, 172, 38, 3, 3, 'FD');

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(7.5);
    doc.setTextColor(100, 115, 135);
    doc.text(m.label, x + 10, y + 14);

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(13);
    doc.setTextColor(25, 35, 60);
    doc.text(m.value, x + 10, y + 30);
  });

  // 4. Section 2: Incidents by Status Table
  const statusStartY = 280;
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(12);
  doc.setTextColor(25, 35, 60);
  doc.text('2. Incidents by Status', 36, statusStartY);

  doc.setDrawColor(220, 226, 238);
  doc.setLineWidth(0.75);
  doc.line(36, statusStartY + 6, 576, statusStartY + 6);

  // Table header
  doc.setFillColor(238, 242, 249);
  doc.rect(36, statusStartY + 14, 540, 20, 'F');

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8);
  doc.setTextColor(60, 75, 100);
  doc.text('STATUS', 46, statusStartY + 27);
  doc.text('INCIDENT COUNT', 460, statusStartY + 27);

  const statuses = [
    { label: 'OPEN', count: dataset.status?.OPEN ?? 0 },
    { label: 'ACKNOWLEDGED', count: dataset.status?.ACKNOWLEDGED ?? 0 },
    { label: 'IN_PROGRESS', count: dataset.status?.IN_PROGRESS ?? 0 },
    { label: 'RESOLVED', count: dataset.status?.RESOLVED ?? 0 },
    { label: 'CLOSED', count: dataset.status?.CLOSED ?? 0 },
  ];

  statuses.forEach((st, idx) => {
    const y = statusStartY + 34 + idx * 18;
    if (idx % 2 === 1) {
      doc.setFillColor(250, 251, 254);
      doc.rect(36, y, 540, 18, 'F');
    }
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8);
    doc.setTextColor(40, 50, 65);
    doc.text(st.label, 46, y + 12);

    doc.setFont('helvetica', 'bold');
    doc.text(String(st.count), 460, y + 12);

    doc.setDrawColor(235, 240, 248);
    doc.setLineWidth(0.5);
    doc.line(36, y + 18, 576, y + 18);
  });

  // 5. Section 3: Incidents by Priority Table
  const priorityStartY = 450;
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(12);
  doc.setTextColor(25, 35, 60);
  doc.text('3. Incidents by Priority', 36, priorityStartY);

  doc.setDrawColor(220, 226, 238);
  doc.setLineWidth(0.75);
  doc.line(36, priorityStartY + 6, 576, priorityStartY + 6);

  // Table header
  doc.setFillColor(238, 242, 249);
  doc.rect(36, priorityStartY + 14, 540, 20, 'F');

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8);
  doc.setTextColor(60, 75, 100);
  doc.text('PRIORITY LEVEL', 46, priorityStartY + 27);
  doc.text('SEVERITY', 240, priorityStartY + 27);
  doc.text('INCIDENT COUNT', 460, priorityStartY + 27);

  const priorities = [
    { level: 'P1', name: 'Critical', count: dataset.priority?.P1 ?? 0 },
    { level: 'P2', name: 'High', count: dataset.priority?.P2 ?? 0 },
    { level: 'P3', name: 'Medium', count: dataset.priority?.P3 ?? 0 },
    { level: 'P4', name: 'Low', count: dataset.priority?.P4 ?? 0 },
  ];

  priorities.forEach((p, idx) => {
    const y = priorityStartY + 34 + idx * 18;
    if (idx % 2 === 1) {
      doc.setFillColor(250, 251, 254);
      doc.rect(36, y, 540, 18, 'F');
    }
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(8);
    doc.setTextColor(40, 50, 65);
    doc.text(p.level, 46, y + 12);

    doc.setFont('helvetica', 'normal');
    doc.setTextColor(80, 95, 115);
    doc.text(p.name, 240, y + 12);

    doc.setFont('helvetica', 'bold');
    doc.setTextColor(40, 50, 65);
    doc.text(String(p.count), 460, y + 12);

    doc.setDrawColor(235, 240, 248);
    doc.setLineWidth(0.5);
    doc.line(36, y + 18, 576, y + 18);
  });

  // Footer for Page 1
  doc.setDrawColor(220, 226, 238);
  doc.setLineWidth(0.5);
  doc.line(36, 755, 576, 755);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(7.5);
  doc.setTextColor(120, 135, 155);
  doc.text('PulseDesk Enterprise Incident Operations • Confidential Report', 36, 768);
  doc.text('Page 1 of 2', 530, 768);

  // ================= PAGE 2 =================
  doc.addPage();

  // Top Slim Banner
  doc.setFillColor(37, 56, 110);
  doc.rect(0, 0, 612, 40, 'F');

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(12);
  doc.setTextColor(255, 255, 255);
  doc.text('PulseDesk Operational Report (Continued)', 36, 25);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8.5);
  doc.setTextColor(210, 225, 255);
  doc.text(dataset.organizationName, 440, 25);

  // 6. Section 4: SLA Performance & Resolution Times
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(12);
  doc.setTextColor(25, 35, 60);
  doc.text('4. SLA Performance & Resolution Times', 36, 68);

  doc.setDrawColor(220, 226, 238);
  doc.setLineWidth(0.75);
  doc.line(36, 74, 576, 74);

  const slaMetrics = [
    {
      label: 'SLA Compliance Rate',
      value: `${(dataset.sla?.compliance_percentage ?? 0).toFixed(1)}%`,
    },
    { label: 'Compliant Incidents', value: String(dataset.sla?.compliant_incidents ?? 0) },
    { label: 'Breached Incidents', value: String(dataset.sla?.breached_incidents ?? 0) },
    {
      label: 'Avg Resolution Time',
      value: formatDurationSeconds(dataset.resolution?.average_resolution_seconds ?? 0),
    },
  ];

  slaMetrics.forEach((m, idx) => {
    const x = 36 + idx * 138;
    const y = 86;

    doc.setFillColor(250, 251, 254);
    doc.setDrawColor(225, 230, 240);
    doc.setLineWidth(0.5);
    doc.roundedRect(x, y, 126, 44, 3, 3, 'FD');

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(7.5);
    doc.setTextColor(100, 115, 135);
    doc.text(m.label, x + 8, y + 15);

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(12);
    doc.setTextColor(25, 35, 60);
    doc.text(m.value, x + 8, y + 33);
  });

  // 7. Section 5: Incidents by Category
  const catStartY = 155;
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(12);
  doc.setTextColor(25, 35, 60);
  doc.text('5. Incidents by Category', 36, catStartY);

  doc.setDrawColor(220, 226, 238);
  doc.setLineWidth(0.75);
  doc.line(36, catStartY + 6, 576, catStartY + 6);

  doc.setFillColor(238, 242, 249);
  doc.rect(36, catStartY + 14, 540, 20, 'F');

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8);
  doc.setTextColor(60, 75, 100);
  doc.text('CATEGORY NAME', 46, catStartY + 27);
  doc.text('INCIDENT COUNT', 460, catStartY + 27);

  const categories = dataset.category?.categories || [];
  if (categories.length > 0) {
    categories.slice(0, 6).forEach((cat, idx) => {
      const y = catStartY + 34 + idx * 18;
      if (idx % 2 === 1) {
        doc.setFillColor(250, 251, 254);
        doc.rect(36, y, 540, 18, 'F');
      }
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(8);
      doc.setTextColor(40, 50, 65);
      doc.text(cat.category_name, 46, y + 12);

      doc.setFont('helvetica', 'bold');
      doc.text(String(cat.count), 460, y + 12);

      doc.setDrawColor(235, 240, 248);
      doc.setLineWidth(0.5);
      doc.line(36, y + 18, 576, y + 18);
    });
  } else {
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8);
    doc.setTextColor(100, 115, 135);
    doc.text('No category records available for selected date range', 46, catStartY + 46);
  }

  // 8. Section 6: Escalation Activity
  const escStartY = 310;
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(12);
  doc.setTextColor(25, 35, 60);
  doc.text('6. Escalation Activity', 36, escStartY);

  doc.setDrawColor(220, 226, 238);
  doc.setLineWidth(0.75);
  doc.line(36, escStartY + 6, 576, escStartY + 6);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8.5);
  doc.setTextColor(70, 85, 105);
  doc.text(
    `Total Escalation Events: ${dataset.escalation?.total_escalation_events ?? 0}`,
    36,
    escStartY + 24
  );

  // Sub-table 1: By Level
  doc.setFillColor(238, 242, 249);
  doc.rect(36, escStartY + 36, 260, 20, 'F');
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8);
  doc.setTextColor(60, 75, 100);
  doc.text('BY LEVEL', 46, escStartY + 49);
  doc.text('COUNT', 250, escStartY + 49);

  const levels = Object.entries(dataset.escalation?.by_level || {});
  if (levels.length > 0) {
    levels.forEach(([lvl, count], idx) => {
      const y = escStartY + 56 + idx * 18;
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(8);
      doc.setTextColor(40, 50, 65);
      doc.text(`Level ${lvl}`, 46, y + 12);
      doc.setFont('helvetica', 'bold');
      doc.text(String(count), 250, y + 12);
      doc.setDrawColor(235, 240, 248);
      doc.line(36, y + 18, 296, y + 18);
    });
  } else {
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8);
    doc.setTextColor(100, 115, 135);
    doc.text('No level events', 46, escStartY + 72);
  }

  // Sub-table 2: By Trigger Type
  doc.setFillColor(238, 242, 249);
  doc.rect(316, escStartY + 36, 260, 20, 'F');
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8);
  doc.setTextColor(60, 75, 100);
  doc.text('BY TRIGGER TYPE', 326, escStartY + 49);
  doc.text('COUNT', 530, escStartY + 49);

  const triggers = Object.entries(dataset.escalation?.by_trigger_type || {});
  if (triggers.length > 0) {
    triggers.forEach(([trg, count], idx) => {
      const y = escStartY + 56 + idx * 18;
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(8);
      doc.setTextColor(40, 50, 65);
      doc.text(trg, 326, y + 12);
      doc.setFont('helvetica', 'bold');
      doc.text(String(count), 530, y + 12);
      doc.setDrawColor(235, 240, 248);
      doc.line(316, y + 18, 576, y + 18);
    });
  } else {
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8);
    doc.setTextColor(100, 115, 135);
    doc.text('No trigger events', 326, escStartY + 72);
  }

  // Footer for Page 2
  doc.setDrawColor(220, 226, 238);
  doc.setLineWidth(0.5);
  doc.line(36, 755, 576, 755);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(7.5);
  doc.setTextColor(120, 135, 155);
  doc.text('PulseDesk Enterprise Incident Operations • Confidential Report', 36, 768);
  doc.text('Page 2 of 2', 530, 768);

  return doc;
}

/**
 * Returns a downloadable PDF Blob using jsPDF.
 */
export function generateReportPdfBlob(dataset: ReportExportDataset): Blob {
  const doc = generateReportPdfDoc(dataset);
  return doc.output('blob');
}

/**
 * Downloads a generated PDF report in the browser using jsPDF.
 */
export function downloadReportPdf(dataset: ReportExportDataset): void {
  const orgSlug = dataset.organizationName.toLowerCase().replace(/[^a-z0-9]+/g, '-');
  const startDate = dataset.dateRange.start.slice(0, 10);
  const endDate = dataset.dateRange.end.slice(0, 10);
  const filename = `pulsedesk-report-${orgSlug}-${startDate}-to-${endDate}.pdf`;

  const blob = generateReportPdfBlob(dataset);
  const objectUrl = URL.createObjectURL(blob);

  try {
    const link = document.createElement('a');
    link.href = objectUrl;
    link.setAttribute('download', filename);
    link.style.display = 'none';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  } finally {
    setTimeout(() => {
      URL.revokeObjectURL(objectUrl);
    }, 1000);
  }
}
