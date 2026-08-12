'use client';

// src/components/likha/scan-effect.tsx
// LIKHA Scanner — Cinematic flatbed scanner bar animation.
// Renders a glowing cyan scan bar that sweeps top-to-bottom across the live
// camera feed, progressively revealing an enhanced (high-contrast, saturated)
// version of the document below. Includes trailing glow, particle effects,
// scan-line texture, and a synthesized audio sweep. Designed for big-screen
// demo impact when projected from a laptop browser.

import { useRef, useEffect, useState, useCallback } from 'react';

interface ScanEffectProps {
  /** The live camera stream (for local webcam / Camo) */
  stream?: MediaStream;
  /** Image source URL (for MJPEG IP camera streams) — takes priority over stream */
  imageSrc?: string;
  /** Called when scan completes (~3s). Returns the processed frame as a Blob. */
  onComplete: (capturedFrame: Blob) => void;
  /** Called if the user cancels the scan */
  onCancel?: () => void;
}

export default function ScanEffect({ stream, imageSrc, onComplete, onCancel }: ScanEffectProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const imgRef = useRef<HTMLImageElement>(null);
  const animRef = useRef<number>(0);
  const audioCtxRef = useRef<AudioContext | null>(null);
  const [phase, setPhase] = useState<'scanning' | 'complete'>('scanning');
  const [progress, setProgress] = useState(0);

  // Determine source mode: MJPEG image or MediaStream video
  const isMjpeg = !!imageSrc;

  // ── Audio: synthesized scanner sweep tone ──

  const playScanSound = useCallback(() => {
    try {
      const ctx = new AudioContext();
      audioCtxRef.current = ctx;

      // Primary sweep oscillator — rises in pitch over 3 seconds
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(180, ctx.currentTime);
      osc.frequency.linearRampToValueAtTime(900, ctx.currentTime + 2.8);
      gain.gain.setValueAtTime(0.06, ctx.currentTime);
      gain.gain.linearRampToValueAtTime(0.02, ctx.currentTime + 2.8);
      gain.gain.linearRampToValueAtTime(0, ctx.currentTime + 3.0);
      osc.connect(gain).connect(ctx.destination);
      osc.start();
      osc.stop(ctx.currentTime + 3.0);

      // Subtle harmonic overtone for richness
      const osc2 = ctx.createOscillator();
      const gain2 = ctx.createGain();
      osc2.type = 'triangle';
      osc2.frequency.setValueAtTime(360, ctx.currentTime);
      osc2.frequency.linearRampToValueAtTime(1800, ctx.currentTime + 2.8);
      gain2.gain.setValueAtTime(0.015, ctx.currentTime);
      gain2.gain.linearRampToValueAtTime(0, ctx.currentTime + 3.0);
      osc2.connect(gain2).connect(ctx.destination);
      osc2.start();
      osc2.stop(ctx.currentTime + 3.0);

      // Completion chime (two ascending notes)
      setTimeout(() => {
        const chime = ctx.createOscillator();
        const chimeGain = ctx.createGain();
        chime.type = 'sine';
        chime.frequency.setValueAtTime(880, ctx.currentTime);
        chimeGain.gain.setValueAtTime(0.08, ctx.currentTime);
        chimeGain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.3);
        chime.connect(chimeGain).connect(ctx.destination);
        chime.start();
        chime.stop(ctx.currentTime + 0.3);

        setTimeout(() => {
          const chime2 = ctx.createOscillator();
          const chimeGain2 = ctx.createGain();
          chime2.type = 'sine';
          chime2.frequency.setValueAtTime(1320, ctx.currentTime);
          chimeGain2.gain.setValueAtTime(0.08, ctx.currentTime);
          chimeGain2.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.4);
          chime2.connect(chimeGain2).connect(ctx.destination);
          chime2.start();
          chime2.stop(ctx.currentTime + 0.4);
        }, 150);
      }, 2800);
    } catch {
      // Audio not available — silent scan is fine
    }
  }, []);

  // ── Main scan animation loop ──

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    // The visual source element — either <video> for MediaStream or <img> for MJPEG
    const sourceEl = isMjpeg ? imgRef.current : videoRef.current;
    if (!sourceEl) return;

    if (isMjpeg && imageSrc) {
      // MJPEG mode: load the stream as an image (continuously refreshes)
      const img = imgRef.current!;
      img.src = imageSrc;
    } else if (stream) {
      // MediaStream mode: attach stream to video element
      const video = videoRef.current!;
      video.srcObject = stream;
      video.play().catch(() => {});
    } else {
      return;
    }

    playScanSound();

    const SCAN_DURATION = 3000; // ms — slow enough for dramatic big-screen effect
    const startTime = performance.now();

    // Particle system — tiny light motes that scatter along the scan bar
    const particles: Array<{
      x: number;
      y: number;
      vx: number;
      vy: number;
      size: number;
      alpha: number;
      life: number;
    }> = [];

    function animate(now: number) {
      const elapsed = now - startTime;
      const t = Math.min(elapsed / SCAN_DURATION, 1);

      // Ease-in-out for natural scanner motion (slight pause at start and end)
      const eased = t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2;

      const ctx = canvas!.getContext('2d')!;
      // Get dimensions from either video or image source
      const src = sourceEl as HTMLVideoElement & HTMLImageElement;
      const vw = (src.videoWidth || src.naturalWidth) || 1280;
      const vh = (src.videoHeight || src.naturalHeight) || 720;
      canvas!.width = vw;
      canvas!.height = vh;

      const scanY = Math.round(eased * vh);

      // ── Layer 1: Raw camera feed (full frame) ──
      ctx.drawImage(sourceEl as any, 0, 0, vw, vh);

      // ── Layer 2: Enhanced scan area below the bar ──
      if (scanY > 2) {
        ctx.save();
        ctx.beginPath();
        ctx.rect(0, 0, vw, scanY);
        ctx.clip();

        // Draw the same frame again, then enhance with canvas composite filters
        ctx.filter = 'contrast(1.45) brightness(1.12) saturate(0.25)';
        ctx.drawImage(sourceEl as any, 0, 0, vw, vh);
        ctx.filter = 'none';

        // Subtle blue-white tint overlay for "scanned document" feel
        ctx.globalAlpha = 0.06;
        ctx.fillStyle = '#E0F7FA';
        ctx.fillRect(0, 0, vw, scanY);
        ctx.globalAlpha = 1.0;

        ctx.restore();
      }

      // ── Layer 3: Trailing glow above the scan bar ──
      if (scanY > 0) {
        const glowHeight = Math.max(30, vh * 0.08);
        const glowTop = Math.max(0, scanY - glowHeight);

        const glowGrad = ctx.createLinearGradient(0, glowTop, 0, scanY);
        glowGrad.addColorStop(0, 'rgba(0, 220, 255, 0)');
        glowGrad.addColorStop(0.4, 'rgba(0, 220, 255, 0.03)');
        glowGrad.addColorStop(0.7, 'rgba(0, 220, 255, 0.08)');
        glowGrad.addColorStop(0.9, 'rgba(0, 240, 255, 0.18)');
        glowGrad.addColorStop(1, 'rgba(0, 255, 255, 0.30)');

        ctx.fillStyle = glowGrad;
        ctx.fillRect(0, glowTop, vw, scanY - glowTop);
      }

      // ── Layer 4: The scan bar itself ──
      // Wide soft glow
      const barGlow = ctx.createLinearGradient(0, scanY - 18, 0, scanY + 18);
      barGlow.addColorStop(0, 'rgba(0, 255, 255, 0)');
      barGlow.addColorStop(0.25, 'rgba(0, 255, 255, 0.08)');
      barGlow.addColorStop(0.45, 'rgba(0, 255, 255, 0.25)');
      barGlow.addColorStop(0.5, 'rgba(200, 255, 255, 0.7)');
      barGlow.addColorStop(0.55, 'rgba(0, 255, 255, 0.25)');
      barGlow.addColorStop(0.75, 'rgba(0, 255, 255, 0.08)');
      barGlow.addColorStop(1, 'rgba(0, 255, 255, 0)');
      ctx.fillStyle = barGlow;
      ctx.fillRect(0, scanY - 18, vw, 36);

      // Bright core line (the "light")
      ctx.fillStyle = 'rgba(255, 255, 255, 0.92)';
      ctx.fillRect(0, scanY - 1, vw, 3);

      // Inner cyan glow line
      ctx.fillStyle = 'rgba(0, 255, 255, 0.5)';
      ctx.fillRect(0, scanY - 4, vw, 9);

      // ── Layer 5: Edge light bloom (left and right edges glow brighter) ──
      const edgeBloom = ctx.createRadialGradient(vw / 2, scanY, vw * 0.3, vw / 2, scanY, vw * 0.7);
      edgeBloom.addColorStop(0, 'rgba(0, 255, 255, 0)');
      edgeBloom.addColorStop(0.8, 'rgba(0, 255, 255, 0.04)');
      edgeBloom.addColorStop(1, 'rgba(0, 255, 255, 0.12)');
      ctx.fillStyle = edgeBloom;
      ctx.fillRect(0, scanY - 30, vw, 60);

      // ── Layer 6: Scan-line texture (subtle horizontal lines in scanned area) ──
      if (scanY > 10) {
        ctx.save();
        ctx.globalAlpha = 0.03;
        ctx.strokeStyle = '#00FFFF';
        ctx.lineWidth = 1;
        for (let y = 0; y < scanY; y += 4) {
          ctx.beginPath();
          ctx.moveTo(0, y);
          ctx.lineTo(vw, y);
          ctx.stroke();
        }
        ctx.restore();
      }

      // ── Layer 7: Particles along the scan bar ──
      // Spawn new particles
      for (let i = 0; i < 3; i++) {
        particles.push({
          x: Math.random() * vw,
          y: scanY + (Math.random() - 0.5) * 8,
          vx: (Math.random() - 0.5) * 3,
          vy: -Math.random() * 2.5 - 0.5,
          size: Math.random() * 2.5 + 0.5,
          alpha: Math.random() * 0.6 + 0.3,
          life: 1.0,
        });
      }

      // Update and draw particles
      for (let i = particles.length - 1; i >= 0; i--) {
        const p = particles[i];
        p.x += p.vx;
        p.y += p.vy;
        p.life -= 0.025;
        p.alpha *= 0.97;

        if (p.life <= 0 || p.alpha < 0.01) {
          particles.splice(i, 1);
          continue;
        }

        ctx.beginPath();
        ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
        ctx.fillStyle = `rgba(0, 255, 255, ${p.alpha * p.life})`;
        ctx.fill();
      }

      // Keep particle count bounded
      while (particles.length > 150) particles.shift();

      // ── Layer 8: Vignette (darken edges for cinematic feel) ──
      const vignette = ctx.createRadialGradient(
        vw / 2, vh / 2, vh * 0.35,
        vw / 2, vh / 2, vh * 0.85
      );
      vignette.addColorStop(0, 'rgba(0, 0, 0, 0)');
      vignette.addColorStop(1, 'rgba(0, 0, 0, 0.35)');
      ctx.fillStyle = vignette;
      ctx.fillRect(0, 0, vw, vh);

      // ── Update progress ──
      setProgress(Math.round(t * 100));

      // ── Continue or complete ──
      if (t < 1) {
        animRef.current = requestAnimationFrame(animate);
      } else {
        // Scan complete — capture the enhanced frame
        setPhase('complete');

        // Draw final enhanced full frame
        ctx.filter = 'contrast(1.45) brightness(1.12) saturate(0.25)';
        ctx.drawImage(sourceEl as any, 0, 0, vw, vh);
        ctx.filter = 'none';

        canvas!.toBlob(
          (blob) => {
            if (blob) onComplete(blob);
          },
          'image/jpeg',
          0.92
        );

        // Clean up audio context
        if (audioCtxRef.current) {
          audioCtxRef.current.close().catch(() => {});
        }
      }
    }

    animRef.current = requestAnimationFrame(animate);

    return () => {
      cancelAnimationFrame(animRef.current);
      if (audioCtxRef.current) {
        audioCtxRef.current.close().catch(() => {});
      }
    };
  }, [stream, imageSrc, isMjpeg, onComplete, playScanSound]);

  return (
    <div className="relative w-full overflow-hidden rounded-xl border-2 border-[#00DCFF]/30 bg-black">
      {/* Scan canvas (renders video + all effects) */}
      <canvas
        ref={canvasRef}
        className="w-full"
        style={{ objectFit: 'contain', maxHeight: '70vh' }}
      />

      {/* Hidden video element (source for MediaStream mode) */}
      <video
        ref={videoRef}
        autoPlay
        playsInline
        muted
        className="hidden"
      />

      {/* Hidden image element (source for MJPEG IP camera mode) */}
      <img
        ref={imgRef}
        alt=""
        crossOrigin="anonymous"
        className="hidden"
      />

      {/* Scanning overlay — progress indicator */}
      {phase === 'scanning' && (
        <div className="absolute bottom-4 left-1/2 -translate-x-1/2 flex items-center gap-3 rounded-full bg-black/70 px-5 py-2 backdrop-blur-sm">
          <div className="h-2 w-2 rounded-full bg-[#00DCFF] animate-pulse" />
          <span className="text-sm font-mono font-bold text-[#00DCFF] tracking-wider">
            SCANNING {progress}%
          </span>
        </div>
      )}

      {/* Complete overlay — green flash + checkmark */}
      {phase === 'complete' && (
        <div className="absolute inset-0 flex items-center justify-center bg-[#22C55E]/10 animate-pulse">
          <div className="flex flex-col items-center gap-2 rounded-2xl bg-black/60 px-8 py-6 backdrop-blur-sm">
            <div className="flex h-16 w-16 items-center justify-center rounded-full bg-[#22C55E]/20">
              <svg
                className="h-10 w-10 text-[#22C55E]"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
                strokeWidth={3}
              >
                <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
              </svg>
            </div>
            <span className="text-lg font-bold tracking-widest text-[#22C55E]">
              SCAN COMPLETE
            </span>
          </div>
        </div>
      )}
    </div>
  );
}
