'use client';

import { Download } from 'lucide-react';

interface ExportButtonProps {
  sessionId: string;
}

export default function ExportButton({ sessionId }: ExportButtonProps) {
  const handleExport = (format: 'csv' | 'json') => {
    const params = new URLSearchParams({ session: sessionId, format });
    window.open(`/api/admin/export?${params}`, '_blank');
  };

  return (
    <div className="flex items-center gap-2">
      <button
        onClick={() => handleExport('csv')}
        className="flex items-center gap-2 rounded-xl border border-[hsl(224_27%_25%)] bg-[hsl(224_35%_17%)] px-4 py-2 text-sm font-medium text-[hsl(214_100%_97%)] transition-all hover:border-[hsl(239_84%_67%/0.5)] hover:bg-[hsl(239_84%_67%/0.08)] hover:text-white"
      >
        <Download className="h-4 w-4" />
        Export CSV
      </button>
      <button
        onClick={() => handleExport('json')}
        className="flex items-center gap-2 rounded-xl border border-[hsl(224_27%_25%)] bg-[hsl(224_35%_17%)] px-4 py-2 text-sm font-medium text-[hsl(216_20%_60%)] transition-all hover:border-[hsl(239_84%_67%/0.5)] hover:text-white"
      >
        <Download className="h-4 w-4" />
        Export JSON
      </button>
    </div>
  );
}
