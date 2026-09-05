/**
 * ReportExportControls Component for PulseDesk Reports.
 *
 * Provides accessible, professional export buttons for CSV and PDF formats,
 * with concurrent request prevention, loading states, and feedback banners.
 */

import { useState } from 'react';
import { FileSpreadsheet, FileText, Loader2, CheckCircle, AlertCircle, X } from 'lucide-react';
import { Button } from '../../../components/ui/Button';
import {
  downloadReportCsv,
  type ReportExportDataset,
} from '../utils/csvGenerator';
import { downloadReportPdf } from '../utils/pdfGenerator';

interface ReportExportControlsProps {
  dataset: ReportExportDataset;
  isDisabled?: boolean;
  canExport?: boolean;
  className?: string;
}

export function ReportExportControls({
  dataset,
  isDisabled = false,
  canExport = true,
  className = '',
}: ReportExportControlsProps) {
  const [isExportingCsv, setIsExportingCsv] = useState(false);
  const [isExportingPdf, setIsExportingPdf] = useState(false);
  const [statusMessage, setStatusMessage] = useState<{
    type: 'success' | 'error';
    text: string;
  } | null>(null);

  if (!canExport) {
    return null;
  }

  const isExporting = isExportingCsv || isExportingPdf;
  const disableButtons = isDisabled || isExporting;

  const handleExportCsv = async () => {
    if (disableButtons) return;
    setIsExportingCsv(true);
    setStatusMessage(null);
    try {
      // Allow UI to render loading state briefly for responsive feedback
      await new Promise((resolve) => setTimeout(resolve, 100));
      downloadReportCsv(dataset);
      setStatusMessage({
        type: 'success',
        text: 'CSV report downloaded successfully.',
      });
    } catch {
      setStatusMessage({
        type: 'error',
        text: 'Unable to export the report. Please try again.',
      });
    } finally {
      setIsExportingCsv(false);
    }
  };

  const handleExportPdf = async () => {
    if (disableButtons) return;
    setIsExportingPdf(true);
    setStatusMessage(null);
    try {
      await new Promise((resolve) => setTimeout(resolve, 100));
      downloadReportPdf(dataset);
      setStatusMessage({
        type: 'success',
        text: 'PDF report downloaded successfully.',
      });
    } catch {
      setStatusMessage({
        type: 'error',
        text: 'Unable to export the report. Please try again.',
      });
    } finally {
      setIsExportingPdf(false);
    }
  };

  return (
    <div className={`flex flex-col gap-2 sm:items-end ${className}`}>
      <div className="flex items-center gap-2">
        <Button
          variant="outline"
          size="sm"
          onClick={handleExportCsv}
          disabled={disableButtons}
          aria-label="Export report as CSV"
          className="gap-1.5 text-xs h-9 border-border bg-card hover:bg-accent focus-visible:ring-2 focus-visible:ring-ring"
        >
          {isExportingCsv ? (
            <>
              <Loader2 className="h-3.5 w-3.5 animate-spin text-primary" aria-hidden="true" />
              <span>Exporting...</span>
            </>
          ) : (
            <>
              <FileSpreadsheet className="h-3.5 w-3.5 text-emerald-600 dark:text-emerald-400" aria-hidden="true" />
              <span>Export CSV</span>
            </>
          )}
        </Button>

        <Button
          variant="outline"
          size="sm"
          onClick={handleExportPdf}
          disabled={disableButtons}
          aria-label="Export report as PDF"
          className="gap-1.5 text-xs h-9 border-border bg-card hover:bg-accent focus-visible:ring-2 focus-visible:ring-ring"
        >
          {isExportingPdf ? (
            <>
              <Loader2 className="h-3.5 w-3.5 animate-spin text-primary" aria-hidden="true" />
              <span>Exporting...</span>
            </>
          ) : (
            <>
              <FileText className="h-3.5 w-3.5 text-rose-600 dark:text-rose-400" aria-hidden="true" />
              <span>Export PDF</span>
            </>
          )}
        </Button>
      </div>

      {/* Accessible Feedback Alert */}
      {statusMessage && (
        <div
          role="status"
          aria-live="polite"
          className={`flex items-center gap-2 text-xs py-1.5 px-2.5 rounded-md border animate-in fade-in slide-in-from-top-1 ${
            statusMessage.type === 'success'
              ? 'bg-emerald-500/10 text-emerald-700 dark:text-emerald-300 border-emerald-500/20'
              : 'bg-destructive/10 text-destructive border-destructive/20'
          }`}
        >
          {statusMessage.type === 'success' ? (
            <CheckCircle className="h-3.5 w-3.5 text-emerald-600 shrink-0" aria-hidden="true" />
          ) : (
            <AlertCircle className="h-3.5 w-3.5 text-destructive shrink-0" aria-hidden="true" />
          )}
          <span>{statusMessage.text}</span>
          <button
            type="button"
            onClick={() => setStatusMessage(null)}
            className="ml-1 p-0.5 rounded text-muted-foreground hover:text-foreground focus:outline-none focus:ring-1 focus:ring-ring"
            aria-label="Dismiss export alert"
          >
            <X className="h-3 w-3" />
          </button>
        </div>
      )}
    </div>
  );
}
