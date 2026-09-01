'use client';

// src/components/likha/camera-scanner.tsx
// LIKHA Scanner Mode A+ — Multi-device camera document scanner.
// Supports: laptop webcam, USB webcam, Samsung Fold 7 / phone camera (wireless),
// and any video input device enumerable via navigator.mediaDevices.
//
// Features:
// - Device picker (enumerateDevices) for selecting camera source
// - High-resolution capture (requests up to 4K)
// - OpenCV.js edge detection + perspective correction (auto)
// - Manual crop fallback when edge detection fails
// - Multi-page scanning → single PDF via jsPDF
// - Image enhancement (contrast, brightness, grayscale)
// - Direct upload to LIKHA pipeline (POST /api/likha/upload)

import { useRef, useState, useEffect, useCallback } from 'react';
import {
  Camera,
  RotateCcw,
  Upload,
  X,
  Loader2,
  CheckCircle2,
  AlertTriangle,
  Zap,
  Scan,
  Monitor,
  Smartphone,
  ChevronDown,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { processDocumentImage, assemblePagesToPDF, loadOpenCV, isCVReady } from '@/lib/likha/document-processor';
import ScanEffect from '@/components/likha/scan-effect';
import type { LikhaUploadResponse } from '@/types/likha';

// ── Types ──

interface PageData {
  id: string;
  blob: Blob;
  thumbnail: string; // data URL for preview
  width: number;
  height: number;
  edgesDetected: boolean;
}

interface CameraScannerProps {
  disabled?: boolean;
  onBatchAccepted?: (result: LikhaUploadResponse) => void;
  onError?: (message: string) => void;
  className?: string;
}

type ScannerState = 'idle' | 'loading-cv' | 'camera-ready' | 'captured' | 'processing' | 'uploading';

// ── Helpers ──

function formatResolution(w: number, h: number): string {
  if (w >= 3840) return '4K';
  if (w >= 1920) return '1080p';
  if (w >= 1280) return '720p';
  return `${w}×${h}`;
}

function deviceIcon(label: string) {
  const lower = label.toLowerCase();
  if (lower.includes('phone') || lower.includes('mobile') || lower.includes('android') || lower.includes('fold')) {
    return <Smartphone className="h-3.5 w-3.5 shrink-0" />;
  }
  if (lower.includes('usb') || lower.includes('external') || lower.includes('webcam')) {
    return <Monitor className="h-3.5 w-3.5 shrink-0" />;
  }
  return <Camera className="h-3.5 w-3.5 shrink-0" />;
}

// ── Component ──

export default function CameraScanner({
  disabled = false,
  onBatchAccepted,
  onError,
  className,
}: CameraScannerProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const overlayRef = useRef<HTMLCanvasElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const animFrameRef = useRef<number>(0);

  const [state, setState] = useState<ScannerState>('idle');
  const [devices, setDevices] = useState<MediaDeviceInfo[]>([]);
  const [selectedDeviceId, setSelectedDeviceId] = useState<string>('');
  const [showDevices, setShowDevices] = useState(false);
  const [resolution, setResolution] = useState({ width: 0, height: 0 });
  const [cvReady, setCvReady] = useState(false);
  const [cvLoading, setCvLoading] = useState(false);
  const [pages, setPages] = useState<PageData[]>([]);
  const [autoEdge, setAutoEdge] = useState(true);
  const [grayscale, setGrayscale] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);

  // ── Scan effect (cinematic scanner bar animation for demo) ──
  const [showScanEffect, setShowScanEffect] = useState(false);
  const scanStreamRef = useRef<MediaStream | null>(null);

  // ── Two-pane output: persist the last captured document in the right pane ──
  const [lastCapture, setLastCapture] = useState<{ url: string; at: string } | null>(null);

  // ── IP Camera mode (MJPEG stream from phone — zero laptop software) ──
  const [useIpCamera, setUseIpCamera] = useState(false);
  const [mjpegUrl, setMjpegUrl] = useState('');
  const [mjpegConnected, setMjpegConnected] = useState(false);

  // ── Initialize: enumerate devices + preload OpenCV.js ──

  useEffect(() => {
    if (disabled) return;

    // Enumerate devices (may need permission first)
    async function init() {
      try {
        // Request temporary camera access to get device labels
        const tempStream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: 'environment' },
          audio: false,
        });
        tempStream.getTracks().forEach((t) => t.stop());

        const allDevices = await navigator.mediaDevices.enumerateDevices();
        const cameras = allDevices.filter((d) => d.kind === 'videoinput');
        setDevices(cameras);

        // Auto-select: prefer environment-facing, then last device
        const envCam = cameras.find((d) =>
          d.label.toLowerCase().includes('back') ||
          d.label.toLowerCase().includes('environment') ||
          d.label.toLowerCase().includes('rear')
        );
        setSelectedDeviceId((envCam || cameras[cameras.length - 1])?.deviceId || '');
      } catch {
        // Permission denied or no cameras — still enumerate (labels may be empty)
        try {
          const allDevices = await navigator.mediaDevices.enumerateDevices();
          const cameras = allDevices.filter((d) => d.kind === 'videoinput');
          setDevices(cameras);
          if (cameras.length > 0) setSelectedDeviceId(cameras[0].deviceId);
        } catch {
          setError('Cannot access camera devices. Check browser permissions.');
        }
      }
    }

    init();

    // Preload OpenCV.js in background (non-blocking)
    if (!isCVReady()) {
      setCvLoading(true);
      loadOpenCV()
        .then(() => {
          setCvReady(true);
          setCvLoading(false);
        })
        .catch((err) => {
          console.warn('[CameraScanner] OpenCV.js failed to load:', err);
          setCvLoading(false);
        });
    } else {
      setCvReady(true);
    }

    return () => {
      stopCamera();
    };
  }, [disabled]);

  // ── Camera lifecycle ──

  const stopCamera = useCallback(() => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((t) => t.stop());
      streamRef.current = null;
    }
    if (animFrameRef.current) {
      cancelAnimationFrame(animFrameRef.current);
      animFrameRef.current = 0;
    }
  }, []);

  const startCamera = useCallback(
    async (deviceId?: string) => {
      stopCamera();
      setError(null);

      const targetId = deviceId || selectedDeviceId;
      if (!targetId) {
        setError('No camera device selected');
        return;
      }

      try {
        // Request high resolution from the selected device
        const constraints: MediaStreamConstraints = {
          video: {
            deviceId: { exact: targetId },
            width: { ideal: 3840 },
            height: { ideal: 2160 },
            facingMode: deviceId ? undefined : 'environment',
          },
          audio: false,
        };

        const stream = await navigator.mediaDevices.getUserMedia(constraints);
        streamRef.current = stream;

        const video = videoRef.current!;
        video.srcObject = stream;
        await video.play();

        const settings = stream.getVideoTracks()[0].getSettings();
        setResolution({
          width: settings.width || video.videoWidth,
          height: settings.height || video.videoHeight,
        });
        setState('camera-ready');

        // Start edge detection overlay loop (if OpenCV is ready)
        startOverlayLoop();
      } catch (err: any) {
        console.error('[CameraScanner] Camera start failed:', err);
        if (err.name === 'OverconstrainedError') {
          // Retry with relaxed constraints
          try {
            const stream = await navigator.mediaDevices.getUserMedia({
              video: { deviceId: targetId ? { exact: targetId } : undefined },
              audio: false,
            });
            streamRef.current = stream;
            const video = videoRef.current!;
            video.srcObject = stream;
            await video.play();
            const settings = stream.getVideoTracks()[0].getSettings();
            setResolution({
              width: settings.width || video.videoWidth,
              height: settings.height || video.videoHeight,
            });
            setState('camera-ready');
            startOverlayLoop();
          } catch {
            setError('Camera not accessible. Try a different device or check permissions.');
          }
        } else if (err.name === 'NotAllowedError') {
          setError('Camera permission denied. Allow camera access in browser settings.');
        } else {
          setError('Failed to start camera. Is the device connected?');
        }
      }
    },
    [selectedDeviceId, stopCamera]
  );

  // ── Edge detection overlay loop (live preview) ──

  const startOverlayLoop = useCallback(
    () => {
      if (!isCVReady() || !autoEdge) return;

      const overlay = overlayRef.current;
      if (!overlay) return;

      let frameCount = 0;

      function drawFrame() {
        if (!videoRef.current || videoRef.current.paused || videoRef.current.ended) return;

        const cv = (window as any).cv;
        if (!cv) return;

        const vw = videoRef.current!.videoWidth;
        const vh = videoRef.current!.videoHeight;
        if (vw === 0 || vh === 0) {
          animFrameRef.current = requestAnimationFrame(drawFrame);
          return;
        }

        // Size overlay canvas to match video display size
        const displayWidth = videoRef.current!.clientWidth;
        const displayHeight = videoRef.current!.clientHeight;
        overlay!.width = displayWidth;
        overlay!.height = displayHeight;

        const ctx = overlay!.getContext('2d')!;
        ctx.clearRect(0, 0, displayWidth, displayHeight);

        // Run edge detection every 3rd frame for performance
        frameCount++;
        if (frameCount % 3 === 0) {
          try {
            // Draw video frame to a small temp canvas for processing
            const procW = Math.min(vw, 640);
            const procH = Math.round((procW / vw) * vh);
            const tempCanvas = document.createElement('canvas');
            tempCanvas.width = procW;
            tempCanvas.height = procH;
            const tempCtx = tempCanvas.getContext('2d')!;
            tempCtx.drawImage(videoRef.current!, 0, 0, procW, procH);
            const imageData = tempCtx.getImageData(0, 0, procW, procH);

            // Grayscale → blur → edge detection
            const gray = cv.matFromImageData(imageData);
            const blurred = new cv.Mat();
            cv.GaussianBlur(gray, blurred, new cv.Size(5, 5), 0);
            const edges = new cv.Mat();
            cv.Canny(blurred, edges, 50, 150);

            // Find contours
            const contours = new cv.MatVector();
            const hierarchy = new cv.Mat();
            cv.findContours(edges, contours, hierarchy, cv.RETR_EXTERNAL, cv.CHAIN_APPROX_SIMPLE);

            // Find largest 4-sided contour
            let bestPoints: { x: number; y: number }[] | null = null;
            let bestArea = 0;
            const totalArea = procW * procH;

            for (let i = 0; i < contours.size(); i++) {
              const contour = contours.get(i);
              const area = cv.contourArea(contour);
              if (area > totalArea * 0.1 && area < totalArea * 0.95 && area > bestArea) {
                const peri = cv.arcLength(contour, true);
                const approx = new cv.Mat();
                cv.approxPolyDP(contour, approx, 0.02 * peri, true);
                if (approx.rows === 4) {
                  bestPoints = [];
                  for (let j = 0; j < 4; j++) {
                    bestPoints.push({
                      x: approx.floatAt(j, 0) * (displayWidth / procW),
                      y: approx.floatAt(j, 1) * (displayHeight / procH),
                    });
                  }
                  bestArea = area;
                  contour.delete();
                } else {
                  approx.delete();
                }
              }
              contour.delete();
            }

            // Clean up
            gray.delete();
            blurred.delete();
            edges.delete();
            contours.delete();
            hierarchy.delete();

            // Draw detected document outline
            if (bestPoints) {
              ctx.strokeStyle = '#22C55E';
              ctx.lineWidth = 2;
              ctx.setLineDash([]);
              ctx.beginPath();
              ctx.moveTo(bestPoints[0].x, bestPoints[0].y);
              for (let i = 1; i < bestPoints.length; i++) {
                ctx.lineTo(bestPoints[i].x, bestPoints[i].y);
              }
              ctx.closePath();
              ctx.stroke();

              // Corner markers
              ctx.fillStyle = '#22C55E';
              for (const p of bestPoints) {
                ctx.beginPath();
                ctx.arc(p.x, p.y, 5, 0, Math.PI * 2);
                ctx.fill();
              }
            }
          } catch {
            // Silently skip failed frames
          }
        }

        animFrameRef.current = requestAnimationFrame(drawFrame);
      }

      animFrameRef.current = requestAnimationFrame(drawFrame);
    },
    [autoEdge]
  );

  // ── Capture a single page ──

  const capturePage = useCallback(async () => {
    const video = videoRef.current;
    if (!video || state !== 'camera-ready') return;

    setState('processing');

    try {
      const result = await processDocumentImage(video, {
        autoEdgeDetect: autoEdge && cvReady,
        quality: 0.92,
        grayscale,
      });

      // Create thumbnail
      const thumbCanvas = document.createElement('canvas');
      const thumbSize = 120;
      const aspect = result.width / result.height;
      thumbCanvas.width = aspect > 1 ? thumbSize : Math.round(thumbSize * aspect);
      thumbCanvas.height = aspect > 1 ? Math.round(thumbSize / aspect) : thumbSize;
      const thumbCtx = thumbCanvas.getContext('2d')!;
      const thumbImg = new Image();
      await new Promise<void>((resolve) => {
        thumbImg.onload = () => {
          thumbCtx.drawImage(thumbImg, 0, 0, thumbCanvas.width, thumbCanvas.height);
          resolve();
        };
        thumbImg.src = URL.createObjectURL(result.blob);
      });

      const page: PageData = {
        id: crypto.randomUUID(),
        blob: result.blob,
        thumbnail: thumbCanvas.toDataURL('image/jpeg', 0.7),
        width: result.width,
        height: result.height,
        edgesDetected: result.edgesDetected,
      };

      setPages((prev) => [...prev, page]);
      setState('camera-ready');
    } catch (err) {
      console.error('[CameraScanner] Capture failed:', err);
      setError('Failed to process image. Try again.');
      setState('camera-ready');
    }
  }, [state, autoEdge, cvReady, grayscale]);

  // ── Scan effect: launch cinematic scanner bar animation ──

  const startScanEffect = useCallback(() => {
    if (state !== 'camera-ready') return;

    if (useIpCamera && mjpegConnected) {
      // IP camera mode — no stream cloning needed, ScanEffect uses imageSrc
      setShowScanEffect(true);
    } else if (streamRef.current) {
      // Local camera mode — clone the stream for ScanEffect
      const clonedStream = new MediaStream(
        streamRef.current.getTracks().map((t) => t.clone())
      );
      scanStreamRef.current = clonedStream;
      setShowScanEffect(true);
    }
  }, [state, useIpCamera, mjpegConnected]);

  const handleScanComplete = useCallback(
    async (capturedBlob: Blob) => {
      setShowScanEffect(false);

      // Clean up cloned stream
      if (scanStreamRef.current) {
        scanStreamRef.current.getTracks().forEach((t) => t.stop());
        scanStreamRef.current = null;
      }

      try {
        // Persist the captured document in the right pane until the next scan
        const previewUrl = URL.createObjectURL(capturedBlob);
        setLastCapture((prev) => {
          if (prev) URL.revokeObjectURL(prev.url);
          return { url: previewUrl, at: new Date().toLocaleTimeString() };
        });

        // Create thumbnail from the captured blob
        const thumbCanvas = document.createElement('canvas');
        const thumbSize = 120;
        const img = new Image();
        await new Promise<void>((resolve) => {
          img.onload = () => resolve();
          img.src = URL.createObjectURL(capturedBlob);
        });

        const aspect = img.naturalWidth / img.naturalHeight;
        thumbCanvas.width = aspect > 1 ? thumbSize : Math.round(thumbSize * aspect);
        thumbCanvas.height = aspect > 1 ? Math.round(thumbSize / aspect) : thumbSize;
        const thumbCtx = thumbCanvas.getContext('2d')!;
        thumbCtx.drawImage(img, 0, 0, thumbCanvas.width, thumbCanvas.height);

        const page: PageData = {
          id: crypto.randomUUID(),
          blob: capturedBlob,
          thumbnail: thumbCanvas.toDataURL('image/jpeg', 0.7),
          width: img.naturalWidth,
          height: img.naturalHeight,
          edgesDetected: true, // scan effect always produces a clean result
        };

        setPages((prev) => [...prev, page]);
        setState('camera-ready');
      } catch (err) {
        console.error('[CameraScanner] Scan effect completion failed:', err);
        setError('Scan completed but processing failed.');
        setState('camera-ready');
      }
    },
    []
  );

  // ── Retake last page ──

  const retakeLast = useCallback(() => {
    setPages((prev) => prev.slice(0, -1));
    setState('camera-ready');
  }, []);

  // ── Upload all pages to LIKHA pipeline ──

  const uploadPages = useCallback(async () => {
    if (pages.length === 0 || uploading) return;
    setUploading(true);
    setError(null);

    try {
      let filesToUpload: File[];

      if (pages.length === 1) {
        // Single page: upload as JPEG
        filesToUpload = [
          new File([pages[0].blob], `scan-${Date.now()}.jpg`, { type: 'image/jpeg' }),
        ];
      } else {
        // Multi-page: assemble into PDF
        const pdfBlob = await assemblePagesToPDF(pages.map((p) => p.blob));
        filesToUpload = [
          new File([pdfBlob], `scan-${Date.now()}.pdf`, { type: 'application/pdf' }),
        ];
      }

      const formData = new FormData();
      for (const f of filesToUpload) {
        formData.append('files', f);
      }

      const res = await fetch('/api/likha/upload', { method: 'POST', body: formData });
      const body = (await res.json().catch(() => null)) as
        | LikhaUploadResponse
        | { error?: string }
        | null;

      if (!res.ok || !body) {
        const message = body && 'error' in body && body.error ? body.error : 'Upload failed';
        setError(message);
        onError?.(message);
        setUploading(false);
        return;
      }

      const result = body as LikhaUploadResponse;

      // Clear pages and notify parent
      setPages([]);
      setState('idle');
      onBatchAccepted?.(result);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Upload failed';
      setError(message);
      onError?.(message);
    } finally {
      setUploading(false);
    }
  }, [pages, uploading, onBatchAccepted, onError]);

  // ── Device switch handler ──

  const handleDeviceChange = useCallback(
    (deviceId: string) => {
      setSelectedDeviceId(deviceId);
      if (state === 'camera-ready') {
        startCamera(deviceId);
      }
    },
    [state, startCamera]
  );

  // ── Render ──

  return (
    <div className={cn('space-y-4', className)}>
      {/* ── Available cameras (collapsible, collapsed by default) ── */}
      {devices.length > 0 && (
        <div className="rounded-xl border border-[#283147] bg-[#1E293B]">
          <button
            type="button"
            onClick={() => setShowDevices((v) => !v)}
            aria-expanded={showDevices}
            className="flex min-h-11 w-full items-center justify-between px-4 py-2 text-left"
          >
            <span className="flex items-center gap-2 text-[10px] font-semibold uppercase tracking-widest text-[#94A3B8]">
              <Camera className="h-3.5 w-3.5 text-[#22D3EE]" />
              Available Cameras
              <span className="rounded bg-[#22D3EE]/10 px-1.5 py-0.5 text-[9px] font-bold text-[#22D3EE]">
                {devices.length}
              </span>
            </span>
            <ChevronDown
              className={cn('h-4 w-4 text-[#475569] transition-transform', showDevices && 'rotate-180')}
            />
          </button>
          {showDevices && (
            <div className="border-t border-[#283147] px-4 py-3">
              <ul className="space-y-1">
                {devices.map((d, i) => (
                  <li key={d.deviceId} className="flex items-center gap-2 text-[11px] text-[#94A3B8]">
                    {deviceIcon(d.label || '')}
                    <span>{d.label || `Camera ${i + 1}`}</span>
                    {d.label.toLowerCase().includes('usb') && (
                      <span className="rounded bg-[#22D3EE]/10 px-1.5 py-0.5 text-[9px] text-[#22D3EE]">
                        USB
                      </span>
                    )}
                    {(d.label.toLowerCase().includes('fold') ||
                      d.label.toLowerCase().includes('phone') ||
                      d.label.toLowerCase().includes('mobile')) && (
                      <span className="rounded bg-[#A855F7]/10 px-1.5 py-0.5 text-[9px] text-[#A855F7]">
                        Wireless
                      </span>
                    )}
                  </li>
                ))}
              </ul>
              <p className="mt-2 text-[10px] text-[#475569]">
                💡 Plug in a USB webcam or open this page on your phone to scan wirelessly.
                Samsung Fold 7 users: fold the phone ~100° and place it on the table for a hands-free scan.
              </p>
            </div>
          )}
        </div>
      )}

      {/* ── Device selector bar ── */}
      <div className="flex flex-wrap items-center gap-3 rounded-xl border border-[#283147] bg-[#1E293B] p-3">
        {/* Camera picker */}
        <div className="flex items-center gap-2">
          <Scan className="h-4 w-4 text-[#22D3EE]" />
          <select
            value={selectedDeviceId}
            onChange={(e) => handleDeviceChange(e.target.value)}
            disabled={disabled || uploading}
            className="min-h-9 rounded-md border border-[#283147] bg-[#0F1729] px-3 text-xs text-white"
          >
            {devices.length === 0 && <option value="">No cameras detected</option>}
            {devices.map((d) => (
              <option key={d.deviceId} value={d.deviceId}>
                {d.label || `Camera ${devices.indexOf(d) + 1}`}
              </option>
            ))}
          </select>
        </div>

        {/* Resolution badge */}
        {resolution.width > 0 && (
          <span className="rounded bg-[#0038A8] px-2 py-0.5 text-[10px] font-bold text-white">
            {formatResolution(resolution.width, resolution.height)}
          </span>
        )}

        {/* OpenCV status */}
        {cvReady ? (
          <span className="flex items-center gap-1 text-[10px] text-[#22C55E]">
            <Zap className="h-3 w-3" />
            Auto-detect ON
          </span>
        ) : cvLoading ? (
          <span className="flex items-center gap-1 text-[10px] text-[#FACC15]">
            <Loader2 className="h-3 w-3 animate-spin" />
            Loading AI engine…
          </span>
        ) : null}

        {/* Spacer */}
        <div className="flex-1" />

        {/* Quick settings */}
        <label className="flex items-center gap-1.5 text-[10px] text-[#94A3B8]">
          <input
            type="checkbox"
            checked={autoEdge}
            onChange={(e) => setAutoEdge(e.target.checked)}
            className="accent-[#22D3EE]"
          />
          Edge detect
        </label>
        <label className="flex items-center gap-1.5 text-[10px] text-[#94A3B8]">
          <input
            type="checkbox"
            checked={grayscale}
            onChange={(e) => setGrayscale(e.target.checked)}
            className="accent-[#22D3EE]"
          />
          B&amp;W
        </label>
      </div>

      {/* ── IP Camera mode (Phone as wireless scanner — zero laptop software) ── */}
      <div className="rounded-xl border border-[#283147] bg-[#1E293B] p-3">
        <div className="flex items-center gap-3">
          <label className="flex items-center gap-2 text-xs font-semibold text-[#94A3B8]">
            <input
              type="checkbox"
              checked={useIpCamera}
              onChange={(e) => {
                setUseIpCamera(e.target.checked);
                if (!e.target.checked) {
                  setMjpegConnected(false);
                  setMjpegUrl('');
                }
              }}
              className="accent-[#A855F7]"
            />
            <Smartphone className="h-4 w-4 text-[#A855F7]" />
            Phone Camera (wireless)
          </label>

          {useIpCamera && (
            <div className="flex flex-1 items-center gap-2">
              <input
                type="text"
                value={mjpegUrl}
                onChange={(e) => setMjpegUrl(e.target.value)}
                placeholder="http://192.168.1.x:8080/video"
                disabled={mjpegConnected}
                className="min-h-9 flex-1 rounded-md border border-[#283147] bg-[#0F1729] px-3 text-xs text-white placeholder:text-[#475569]"
              />
              {mjpegConnected ? (
                <button
                  type="button"
                  onClick={() => {
                    setMjpegConnected(false);
                    setState('idle');
                  }}
                  className="min-h-9 rounded-md bg-[#F87171] px-3 text-xs font-bold text-white"
                >
                  Disconnect
                </button>
              ) : (
                <button
                  type="button"
                  onClick={() => {
                    if (!mjpegUrl.trim()) return;
                    setMjpegConnected(true);
                    setState('camera-ready');
                  }}
                  disabled={!mjpegUrl.trim()}
                  className="min-h-9 rounded-md bg-[#A855F7] px-3 text-xs font-bold text-white disabled:opacity-50"
                >
                  Connect
                </button>
              )}
            </div>
          )}

          {useIpCamera && mjpegConnected && (
            <span className="flex items-center gap-1 text-[10px] text-[#22C55E]">
              <span className="h-2 w-2 rounded-full bg-[#22C55E] animate-pulse" />
              Live
            </span>
          )}
        </div>

        {useIpCamera && !mjpegConnected && (
          <div className="mt-2 text-[10px] text-[#475569]">
            Install <strong className="text-[#94A3B8]">IP Webcam</strong> (free) on your phone → Start Server → copy the MJPEG URL above.
            Works with any phone on the same WiFi — no laptop software needed.
          </div>
        )}
      </div>

      {/* ── Two-pane scanner: live view (left) + scanned output (right) ──
          Both cards use a vertical 3:4 "paper document" aspect ratio and the
          pair is centered (max-w caps the row so cards read like sheets of
          paper rather than full-width panels). */}
      <div className="mx-auto grid w-full max-w-[920px] grid-cols-1 gap-6 lg:grid-cols-2">
        {/* ── LEFT: live camera view ── */}
        <div className="flex flex-col gap-2">
          <div className="flex items-center justify-between px-1">
            <span className="text-[10px] font-semibold uppercase tracking-widest text-[#94A3B8]">
              ① Live Camera
            </span>
            {state === 'camera-ready' && !(useIpCamera && mjpegConnected) && (
              <span className="flex items-center gap-1 text-[10px] text-[#22C55E]">
                <span className="h-1.5 w-1.5 rounded-full bg-[#22C55E] animate-pulse" />
                Live
              </span>
            )}
          </div>
          <div className="relative aspect-[3/4] w-full overflow-hidden rounded-xl border-2 border-[#283147] bg-black">
        {/* MJPEG live preview (IP camera mode) */}
        {useIpCamera && mjpegConnected && (
          <img
            src={mjpegUrl}
            alt="IP Camera feed"
            crossOrigin="anonymous"
            className={cn(
              'h-full w-full bg-black transition-opacity',
              state === 'camera-ready' ? 'opacity-100' : 'opacity-0'
            )}
            style={{ objectFit: 'contain' }}
          />
        )}
        <video
          ref={videoRef}
          autoPlay
          playsInline
          muted
          className={cn(
            'h-full w-full bg-black transition-opacity',
            state === 'camera-ready' && !(useIpCamera && mjpegConnected) ? 'opacity-100' : 'opacity-0',
            useIpCamera && mjpegConnected && 'hidden'
          )}
          style={{ objectFit: 'contain' }}
        />

        {/* Edge detection overlay canvas (positioned over video) */}
        <canvas
          ref={overlayRef}
          className="pointer-events-none absolute inset-0 h-full w-full"
          style={{ objectFit: 'contain' }}
        />

        {/* Idle / loading state */}
        {state === 'idle' && (
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-4 p-8 text-center">
            <div className="rounded-full bg-[#1E293B] p-4">
              <Camera className="h-10 w-10 text-[#94A3B8]" />
            </div>
            <div>
              <p className="text-sm font-bold text-white">Camera Scanner Ready</p>
              <p className="mt-1 text-xs text-[#94A3B8]">
                Select a camera above, then click Start Camera
              </p>
            </div>
            <button
              type="button"
              onClick={() => startCamera()}
              disabled={!selectedDeviceId || disabled}
              className="min-h-11 rounded-lg bg-[#0038A8] px-6 text-sm font-bold text-white disabled:opacity-50"
            >
              Start Camera
            </button>
          </div>
        )}

        {/* Processing state */}
        {state === 'processing' && (
          <div className="absolute inset-0 flex items-center justify-center bg-black/60">
            <div className="flex flex-col items-center gap-2">
              <Loader2 className="h-8 w-8 animate-spin text-[#22D3EE]" />
              <p className="text-sm text-white">Processing document…</p>
            </div>
          </div>
        )}

        {/* Error overlay */}
        {error && (
          <div className="absolute bottom-3 left-3 right-3 flex items-center gap-2 rounded-lg border border-[#F87171]/30 bg-[#1E293B]/95 px-3 py-2">
            <AlertTriangle className="h-4 w-4 shrink-0 text-[#F87171]" />
            <p className="text-xs text-[#F87171]">{error}</p>
            <button
              type="button"
              onClick={() => setError(null)}
              className="ml-auto shrink-0 text-[#94A3B8] hover:text-white"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          </div>
        )}

          </div>
        </div>

        {/* ── RIGHT: scanned output (persists until next scan) ── */}
        <div className="flex flex-col gap-2">
          <div className="flex items-center justify-between px-1">
            <span className="text-[10px] font-semibold uppercase tracking-widest text-[#94A3B8]">
              ② Scanned Document
            </span>
            {lastCapture && !showScanEffect && (
              <span className="flex items-center gap-1 rounded bg-[#94A3B8]/15 px-1.5 py-0.5 text-[9px] font-bold text-[#CBD5E1]">
                <CheckCircle2 className="h-3 w-3" />
                Captured {lastCapture.at}
              </span>
            )}
          </div>

          {showScanEffect ? (
            <ScanEffect
              stream={useIpCamera ? undefined : scanStreamRef.current ?? undefined}
              imageSrc={useIpCamera && mjpegConnected ? mjpegUrl : undefined}
              onComplete={handleScanComplete}
            />
          ) : lastCapture ? (
            <div className="relative aspect-[3/4] w-full overflow-hidden rounded-xl border-2 border-[#94A3B8]/40 bg-black">
              <img
                src={lastCapture.url}
                alt="Last scanned document"
                className="h-full w-full bg-black"
                style={{ objectFit: 'contain' }}
              />
              <div className="absolute left-3 top-3 rounded bg-[#CBD5E1]/90 px-2 py-0.5 text-[10px] font-bold tracking-widest text-[#0F172A]">
                SCANNED
              </div>
            </div>
          ) : (
            <div className="flex aspect-[3/4] w-full flex-col items-center justify-center gap-3 rounded-xl border-2 border-dashed border-[#283147] bg-[#0F1729]/50 p-8 text-center">
              <div className="rounded-full bg-[#1E293B] p-4">
                <Scan className="h-8 w-8 text-[#475569]" />
              </div>
              <div>
                <p className="text-sm font-bold text-[#94A3B8]">Scanned document appears here</p>
                <p className="mt-1 text-xs text-[#475569]">
                  Click SCAN DOCUMENT — the captured page stays in this window until your next scan.
                </p>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* ── Capture controls ── */}
      {state === 'camera-ready' && !showScanEffect && (
        <div className="space-y-3">
          {/* Primary: Scan Document button (cinematic effect) */}
          <div className="flex items-center justify-center gap-4">
            <button
              type="button"
              onClick={retakeLast}
              disabled={pages.length === 0}
              className="flex min-h-11 items-center gap-2 rounded-lg border border-[#283147] px-4 text-xs font-semibold text-[#94A3B8] hover:text-white disabled:opacity-30"
            >
              <RotateCcw className="h-4 w-4" />
              Undo
            </button>

            <button
              type="button"
              onClick={startScanEffect}
              className="group flex min-h-14 items-center gap-3 rounded-xl bg-gradient-to-r from-[#0038A8] to-[#0050DD] px-8 text-sm font-bold text-white shadow-lg shadow-[#0038A8]/30 transition-all hover:scale-[1.03] hover:shadow-[#0038A8]/50 active:scale-[0.98]"
            >
              <Scan className="h-5 w-5 text-[#00DCFF] transition-transform group-hover:translate-y-0.5" />
              SCAN DOCUMENT
            </button>

            <button
              type="button"
              onClick={uploadPages}
              disabled={pages.length === 0 || uploading}
              className="flex min-h-11 items-center gap-2 rounded-lg bg-[#22C55E] px-4 text-xs font-bold text-white disabled:opacity-30"
            >
              {uploading ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Upload className="h-4 w-4" />
              )}
              Upload ({pages.length})
            </button>
          </div>

          {/* Secondary: Quick capture (instant, no animation) */}
          <div className="flex items-center justify-center gap-2">
            <button
              type="button"
              onClick={capturePage}
              className="flex items-center gap-1.5 text-[10px] text-[#475569] hover:text-[#94A3B8] transition-colors"
            >
              <Camera className="h-3 w-3" />
              Quick capture
            </button>
          </div>
        </div>
      )}

      {/* ── Scanning tips (context-aware) ── */}
      {state === 'camera-ready' && (
        <div className="rounded-lg border border-[#283147] bg-[#1E293B]/50 px-4 py-2">
          <p className="text-center text-[10px] text-[#94A3B8]">
            {devices.find((d) => d.deviceId === selectedDeviceId)?.label.toLowerCase().includes('fold') ||
             devices.find((d) => d.deviceId === selectedDeviceId)?.label.toLowerCase().includes('phone') ||
             devices.find((d) => d.deviceId === selectedDeviceId)?.label.toLowerCase().includes('mobile')
              ? '📱 Fold your phone ~100° and place it on the table — document underneath the camera. The green outline shows detected edges.'
              : '📄 Place the document on a flat, contrasting surface. Align within the green outline for best results. Good lighting helps.'}
          </p>
        </div>
      )}

      {/* ── Captured pages preview ── */}
      {pages.length > 0 && (
        <div className="space-y-2">
          <p className="text-[10px] font-semibold uppercase tracking-widest text-[#94A3B8]">
            Scanned Pages ({pages.length})
          </p>
          <div className="flex flex-wrap gap-2">
            {pages.map((page, idx) => (
              <div
                key={page.id}
                className="group relative overflow-hidden rounded-lg border border-[#283147] bg-[#1E293B]"
              >
                <img
                  src={page.thumbnail}
                  alt={`Page ${idx + 1}`}
                  className="h-20 w-auto object-cover"
                />
                <div className="absolute bottom-0 left-0 right-0 bg-black/60 px-1.5 py-0.5">
                  <span className="text-[9px] text-white">Page {idx + 1}</span>
                  {page.edgesDetected && (
                    <CheckCircle2 className="ml-1 inline h-2.5 w-2.5 text-[#22C55E]" />
                  )}
                </div>
                <button
                  type="button"
                  onClick={() => setPages((prev) => prev.filter((p) => p.id !== page.id))}
                  className="absolute right-0.5 top-0.5 rounded-full bg-black/60 p-0.5 opacity-0 transition-opacity group-hover:opacity-100"
                >
                  <X className="h-3 w-3 text-white" />
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

    </div>
  );
}
