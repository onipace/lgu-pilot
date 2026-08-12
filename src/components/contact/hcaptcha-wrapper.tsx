'use client';

import { useEffect, useState } from 'react';

// hCaptcha wrapper component for CR-001 Demo Booking System
// Graceful degradation: renders nothing when NEXT_PUBLIC_HCAPTCHA_SITE_KEY is not set

interface HCaptchaWrapperProps {
  onVerify: (token: string) => void;
  onExpire?: () => void;
  onError?: (error: unknown) => void;
}

export default function HCaptchaWrapper({ onVerify, onExpire, onError }: HCaptchaWrapperProps) {
  const [isLoaded, setIsLoaded] = useState(false);
  const [HCaptchaComponent, setHCaptchaComponent] = useState<any>(null);
  const siteKey = process.env.NEXT_PUBLIC_HCAPTCHA_SITE_KEY;

  useEffect(() => {
    if (!siteKey) return;

    // Dynamic import to avoid SSR issues
    import('@hcaptcha/react-hcaptcha')
      .then((mod) => {
        setHCaptchaComponent(() => mod.default);
        setIsLoaded(true);
      })
      .catch((err) => {
        console.error('[hCaptcha] Failed to load:', err);
        onError?.(err);
      });
  }, [siteKey, onError]);

  // Graceful degradation: render nothing if site key not configured
  if (!siteKey) {
    return null;
  }

  if (!isLoaded || !HCaptchaComponent) {
    return (
      <div className="flex items-center justify-center rounded-lg border border-[hsl(var(--pillar-border))] bg-[hsl(var(--pillar-surface))] p-4">
        <span className="text-xs text-[hsl(var(--pillar-muted))]">Loading verification...</span>
      </div>
    );
  }

  return (
    <div className="flex justify-center">
      <HCaptchaComponent
        sitekey={siteKey}
        onVerify={onVerify}
        onExpire={onExpire}
        onError={onError}
        theme="light"
        size="normal"
      />
    </div>
  );
}
