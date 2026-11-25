import { useEffect, useRef } from 'react';
import type { SessionStatus } from '../types/companion';

interface AcousticBreathCanvasProps {
  status: SessionStatus;
  isMuted: boolean;
  isDark: boolean;
  inputAnalyserRef: React.RefObject<AnalyserNode | null>;
  outputAnalyserRef: React.RefObject<AnalyserNode | null>;
}

export function AcousticBreathCanvas({
  status,
  isMuted,
  isDark,
  inputAnalyserRef,
  outputAnalyserRef,
}: AcousticBreathCanvasProps) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const smoothEnergyRef = useRef(0.06);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    let rafId = 0;
    let phase = 0;

    const computeAverageAmplitude = (analyser: AnalyserNode | null): number => {
      if (!analyser) return 0;
      const data = new Uint8Array(analyser.frequencyBinCount);
      analyser.getByteFrequencyData(data);
      let sum = 0;
      const limit = Math.min(data.length, 32);
      for (let i = 0; i < limit; i++) {
        sum += data[i];
      }
      return sum / (limit * 255);
    };

    const render = () => {
      const dpr = window.devicePixelRatio || 1;
      const width = canvas.clientWidth;
      const height = canvas.clientHeight;
      if (width === 0 || height === 0) {
        rafId = requestAnimationFrame(render);
        return;
      }

      if (canvas.width !== Math.floor(width * dpr) || canvas.height !== Math.floor(height * dpr)) {
        canvas.width = Math.floor(width * dpr);
        canvas.height = Math.floor(height * dpr);
      }

      ctx.save();
      ctx.scale(dpr, dpr);
      ctx.clearRect(0, 0, width, height);

      const inputLevel = isMuted ? 0 : computeAverageAmplitude(inputAnalyserRef.current);
      const outputLevel = computeAverageAmplitude(outputAnalyserRef.current);

      let targetEnergy = 0.05;
      if (status === 'listening') {
        targetEnergy = 0.1 + inputLevel * 0.95;
      } else if (status === 'speaking') {
        targetEnergy = 0.14 + outputLevel * 1.1;
      } else if (status === 'thinking' || status === 'connecting') {
        targetEnergy = 0.12;
      }

      smoothEnergyRef.current += (targetEnergy - smoothEnergyRef.current) * 0.14;
      const energy = smoothEnergyRef.current;

      if (!prefersReducedMotion) {
        phase += status === 'speaking' ? 0.036 : status === 'listening' ? 0.024 : 0.012;
      }

      const cx = width / 2;
      const cy = height / 2;
      const baseRadius = Math.min(width, height) * 0.25;

      // Palette tuned for warm editorial restraint (60-30-10)
      const sagePrimary = isDark ? '90, 158, 138' : '47, 93, 80';
      const amberWarm = isDark ? '214, 140, 84' : '180, 101, 42';
      const inkRing = isDark ? '242, 239, 233' : '31, 30, 28';

      // Subtle concentric harmonic breath rings
      const ringCount = 3;
      for (let r = 0; r < ringCount; r++) {
        const ringOffset = r * 0.95;
        const breath = prefersReducedMotion ? 0 : Math.sin(phase * 0.7 - ringOffset) * 5;
        const radius = baseRadius + r * 24 + energy * (36 + r * 14) + breath;
        const alpha = Math.max(0.05, 0.24 - r * 0.065);

        ctx.beginPath();
        const segments = 96;
        for (let i = 0; i <= segments; i++) {
          const theta = (i / segments) * Math.PI * 2;
          const ripple = prefersReducedMotion
            ? 0
            : Math.sin(theta * (3 + r) + phase * (1.2 + r * 0.35)) * (2 + energy * 16) +
              Math.cos(theta * (5 - r) - phase * 0.9) * (1 + energy * 8);
          const rad = radius + ripple;
          const x = cx + Math.cos(theta) * rad;
          const y = cy + Math.sin(theta) * rad;
          if (i === 0) {
            ctx.moveTo(x, y);
          } else {
            ctx.lineTo(x, y);
          }
        }
        ctx.closePath();

        if (status === 'speaking') {
          ctx.strokeStyle = `rgba(${sagePrimary}, ${alpha + 0.14})`;
        } else if (status === 'listening' && inputLevel > 0.04) {
          ctx.strokeStyle = `rgba(${amberWarm}, ${alpha + 0.16})`;
        } else {
          ctx.strokeStyle = `rgba(${inkRing}, ${alpha * 0.7})`;
        }
        ctx.lineWidth = r === 0 ? 1.8 : 1.1;
        ctx.stroke();
      }

      // Inner warm acoustic core fill
      const coreBreath = prefersReducedMotion ? 0 : Math.sin(phase * 0.8) * 3.5;
      const coreRadius = baseRadius * 0.82 + energy * 24 + coreBreath;
      const gradient = ctx.createRadialGradient(cx, cy, 4, cx, cy, coreRadius * 1.25);

      if (status === 'speaking') {
        gradient.addColorStop(0, `rgba(${sagePrimary}, ${isDark ? 0.34 : 0.22})`);
        gradient.addColorStop(1, `rgba(${sagePrimary}, 0)`);
      } else if (status === 'listening') {
        const activeTint = inputLevel > 0.05 ? amberWarm : sagePrimary;
        gradient.addColorStop(0, `rgba(${activeTint}, ${isDark ? 0.26 : 0.17})`);
        gradient.addColorStop(1, `rgba(${activeTint}, 0)`);
      } else {
        gradient.addColorStop(0, `rgba(${sagePrimary}, ${isDark ? 0.14 : 0.09})`);
        gradient.addColorStop(1, `rgba(${sagePrimary}, 0)`);
      }

      ctx.beginPath();
      ctx.arc(cx, cy, coreRadius * 1.25, 0, Math.PI * 2);
      ctx.fillStyle = gradient;
      ctx.fill();

      // Horizontal harmonic acoustic ribbon across the center
      const ribbonWidth = Math.min(width * 0.72, 420);
      const startX = cx - ribbonWidth / 2;
      const layers = 2;
      for (let l = 0; l < layers; l++) {
        ctx.beginPath();
        const points = 80;
        for (let i = 0; i <= points; i++) {
          const t = i / points;
          const x = startX + t * ribbonWidth;
          // Hann envelope so ends taper cleanly to zero
          const envelope = Math.sin(t * Math.PI);
          const freq = l === 0 ? 5.5 : 8.5;
          const speed = l === 0 ? 1.8 : -1.3;
          const amp = (4 + energy * 42) * envelope * (l === 0 ? 1 : 0.55);
          const y =
            cy +
            Math.sin(t * Math.PI * freq + phase * speed) *
              amp *
              (prefersReducedMotion ? 0.2 : 1);
          if (i === 0) {
            ctx.moveTo(x, y);
          } else {
            ctx.lineTo(x, y);
          }
        }
        const strokeColor =
          status === 'listening' && inputLevel > 0.04
            ? amberWarm
            : sagePrimary;
        ctx.strokeStyle = `rgba(${strokeColor}, ${l === 0 ? 0.65 : 0.3})`;
        ctx.lineWidth = l === 0 ? 2 : 1.2;
        ctx.stroke();
      }

      ctx.restore();
      rafId = requestAnimationFrame(render);
    };

    rafId = requestAnimationFrame(render);
    return () => cancelAnimationFrame(rafId);
  }, [inputAnalyserRef, isDark, isMuted, outputAnalyserRef, status]);

  return (
    <canvas
      ref={canvasRef}
      aria-label="실시간 음성 파형 시각화"
      className="h-full w-full block"
    />
  );
}
