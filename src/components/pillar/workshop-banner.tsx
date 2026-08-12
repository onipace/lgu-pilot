'use client';

import { useState, useEffect } from 'react';
import { X, GraduationCap } from 'lucide-react';

interface WorkshopBannerProps {
  subTopic: string;
  dismissible?: boolean;
}

const DISMISS_KEY = 'pillar_banner_dismissed';

export default function WorkshopBanner({
  subTopic,
  dismissible = true,
}: WorkshopBannerProps) {
  const [dismissed, setDismissed] = useState(false);

  useEffect(() => {
    if (typeof window !== 'undefined') {
      setDismissed(sessionStorage.getItem(DISMISS_KEY) === '1');
    }
  }, []);

  if (dismissed) return null;

  const handleDismiss = () => {
    sessionStorage.setItem(DISMISS_KEY, '1');
    setDismissed(true);
  };

  return (
    <div className="workshop-banner flex h-9 shrink-0 items-center justify-between px-4 lg:px-6">
      <div className="flex items-center gap-2 min-w-0">
        <GraduationCap className="h-3.5 w-3.5 shrink-0" />
        <span className="truncate">
          <span className="font-bold">eSANGGUNI Module 1</span>
          <span className="mx-1.5 opacity-50">·</span>
          <span className="font-medium">{subTopic}</span>
        </span>
      </div>
      {dismissible && (
        <button
          onClick={handleDismiss}
          className="ml-3 flex h-5 w-5 shrink-0 items-center justify-center rounded opacity-60 hover:opacity-100 transition-opacity"
          aria-label="Dismiss banner"
        >
          <X className="h-3 w-3" />
        </button>
      )}
    </div>
  );
}
