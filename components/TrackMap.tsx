"use client";

import { useEffect, useRef } from "react";
import type { LocationPoint, TrackPoint } from "@/types/f1";
import { hexToRgba } from "@/lib/f1/display";

export interface DriverMeta {
  color: string; // hex with leading '#'
  acronym: string;
  position: number;
}

interface Props {
  trackPoints: TrackPoint[];
  locations: LocationPoint[];
  driverMeta: Record<number, DriverMeta>;
  onVisibleChange?: (visible: boolean) => void;
}

interface Bounds {
  minX: number;
  maxX: number;
  minY: number;
  maxY: number;
}

const PAD = 22;
const EASE = 0.18;
const TRAIL_MAX = 6;

function computeBounds(pts: TrackPoint[]): Bounds {
  const xs = pts.map((p) => p.x);
  const ys = pts.map((p) => p.y);
  const minX = Math.min(...xs);
  const maxX = Math.max(...xs);
  const minY = Math.min(...ys);
  const maxY = Math.max(...ys);
  const mx = (maxX - minX) * 0.08 || 100;
  const my = (maxY - minY) * 0.08 || 100;
  return { minX: minX - mx, maxX: maxX + mx, minY: minY - my, maxY: maxY + my };
}

export function TrackMap({ trackPoints, locations, driverMeta, onVisibleChange }: Props) {
  const wrapRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);

  const boundsRef = useRef<Bounds | null>(null);
  const pointsRef = useRef<TrackPoint[]>([]);
  const targetsRef = useRef<Record<number, { x: number; y: number }>>({});
  const currentRef = useRef<Record<number, { x: number; y: number }>>({});
  const historyRef = useRef<Record<number, { x: number; y: number }[]>>({});
  const metaRef = useRef<Record<number, DriverMeta>>({});
  const rafRef = useRef<number | null>(null);
  const sizeRef = useRef({ w: 0, h: 0 });

  // Keep meta current without restarting the loop.
  metaRef.current = driverMeta;

  // ---- seed track outline ----
  useEffect(() => {
    if (trackPoints.length < 3) return;
    pointsRef.current = trackPoints;
    boundsRef.current = computeBounds(trackPoints);
    ensureLoop();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [trackPoints]);

  // ---- update car targets ----
  useEffect(() => {
    if (!locations.length) return;
    // dedupe latest per driver
    const latest: Record<number, LocationPoint> = {};
    for (const p of locations) {
      const n = p.driverNumber;
      if (!n) continue;
      if (p.x === 0 && p.y === 0) continue;
      if (!Number.isFinite(p.x) || !Number.isFinite(p.y)) continue;
      if (!latest[n] || p.date > latest[n].date) latest[n] = p;
    }
    for (const n of Object.keys(latest)) {
      const num = Number(n);
      const t = { x: latest[num].x, y: latest[num].y };
      targetsRef.current[num] = t;
      if (!currentRef.current[num]) currentRef.current[num] = { ...t };
      const hist = (historyRef.current[num] ??= []);
      hist.push({ x: t.x, y: t.y });
      if (hist.length > TRAIL_MAX) hist.shift();
    }
    ensureLoop();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [locations]);

  // ---- canvas sizing + visibility ----
  useEffect(() => {
    const canvas = canvasRef.current;
    const wrap = wrapRef.current;
    if (!canvas || !wrap) return;

    const resize = () => {
      const dpr = window.devicePixelRatio || 1;
      const w = wrap.clientWidth;
      const h = wrap.clientWidth; // square
      sizeRef.current = { w, h };
      canvas.width = Math.round(w * dpr);
      canvas.height = Math.round(h * dpr);
      canvas.style.width = `${w}px`;
      canvas.style.height = `${h}px`;
      const ctx = canvas.getContext("2d");
      if (ctx) ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      draw();
    };

    let t: ReturnType<typeof setTimeout>;
    const onResize = () => {
      clearTimeout(t);
      t = setTimeout(resize, 200);
    };
    resize();
    window.addEventListener("resize", onResize);

    const io = new IntersectionObserver(
      ([entry]) => onVisibleChange?.(entry.isIntersecting),
      { threshold: 0.05 },
    );
    io.observe(wrap);

    return () => {
      window.removeEventListener("resize", onResize);
      clearTimeout(t);
      io.disconnect();
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
      rafRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function toCanvas(x: number, y: number) {
    const b = boundsRef.current!;
    const { w, h } = sizeRef.current;
    const innerW = w - PAD * 2;
    const innerH = h - PAD * 2;
    const rangeX = b.maxX - b.minX || 1;
    const rangeY = b.maxY - b.minY || 1;
    return {
      x: PAD + ((x - b.minX) / rangeX) * innerW,
      y: PAD + (1 - (y - b.minY) / rangeY) * innerH, // Y flip
    };
  }

  function step(): boolean {
    const b = boundsRef.current;
    if (!b) return false;
    const eps = ((b.maxX - b.minX) + (b.maxY - b.minY)) * 0.0004 || 1;
    let moving = false;
    for (const key of Object.keys(targetsRef.current)) {
      const num = Number(key);
      const tgt = targetsRef.current[num];
      const cur = (currentRef.current[num] ??= { ...tgt });
      const dx = tgt.x - cur.x;
      const dy = tgt.y - cur.y;
      if (Math.abs(dx) > eps || Math.abs(dy) > eps) {
        cur.x += dx * EASE;
        cur.y += dy * EASE;
        moving = true;
      } else {
        cur.x = tgt.x;
        cur.y = tgt.y;
      }
    }
    return moving;
  }

  function strokePath(ctx: CanvasRenderingContext2D, width: number, color: string) {
    const pts = pointsRef.current;
    ctx.beginPath();
    pts.forEach((p, i) => {
      const c = toCanvas(p.x, p.y);
      if (i === 0) ctx.moveTo(c.x, c.y);
      else ctx.lineTo(c.x, c.y);
    });
    ctx.closePath();
    ctx.lineWidth = width;
    ctx.strokeStyle = color;
    ctx.lineJoin = "round";
    ctx.lineCap = "round";
    ctx.stroke();
  }

  function draw() {
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext("2d");
    if (!ctx) return;
    const { w, h } = sizeRef.current;
    ctx.clearRect(0, 0, w, h);
    if (!boundsRef.current || pointsRef.current.length < 3) return;

    // track ribbon
    strokePath(ctx, 11, "rgba(255,255,255,0.10)");
    strokePath(ctx, 7, "rgba(20,20,26,0.95)");
    strokePath(ctx, 2, "rgba(225,6,0,0.55)");

    // start/finish checker
    const s = toCanvas(pointsRef.current[0].x, pointsRef.current[0].y);
    const sq = 3;
    for (let r = 0; r < 2; r++) {
      for (let c = 0; c < 2; c++) {
        ctx.fillStyle = (r + c) % 2 === 0 ? "#fff" : "#111";
        ctx.fillRect(s.x - sq + c * sq, s.y - sq + r * sq, sq, sq);
      }
    }

    // trails
    for (const key of Object.keys(historyRef.current)) {
      const num = Number(key);
      const hist = historyRef.current[num];
      if (!hist || hist.length < 2) continue;
      const color = metaRef.current[num]?.color ?? "#e10600";
      ctx.beginPath();
      hist.forEach((p, i) => {
        const c = toCanvas(p.x, p.y);
        if (i === 0) ctx.moveTo(c.x, c.y);
        else ctx.lineTo(c.x, c.y);
      });
      ctx.strokeStyle = hexToRgba(color, 0.28);
      ctx.lineWidth = 2;
      ctx.stroke();
    }

    // cars
    for (const key of Object.keys(currentRef.current)) {
      const num = Number(key);
      const cur = currentRef.current[num];
      const m = metaRef.current[num];
      const color = m?.color ?? "#e10600";
      const isLeader = m?.position === 1;
      const pos = toCanvas(cur.x, cur.y);

      ctx.beginPath();
      ctx.arc(pos.x, pos.y, isLeader ? 12 : 10, 0, Math.PI * 2);
      ctx.fillStyle = hexToRgba(color, 0.22);
      ctx.fill();

      ctx.beginPath();
      ctx.arc(pos.x, pos.y, isLeader ? 7 : 6, 0, Math.PI * 2);
      ctx.fillStyle = color;
      ctx.fill();
      ctx.lineWidth = isLeader ? 2 : 1.5;
      ctx.strokeStyle = isLeader ? "rgba(255,215,0,0.95)" : "rgba(255,255,255,0.75)";
      ctx.stroke();

      if (m?.acronym) {
        ctx.font = "700 10px system-ui,sans-serif";
        ctx.fillStyle = "rgba(0,0,0,0.55)";
        ctx.fillText(m.acronym, pos.x + 10, pos.y + 1);
        ctx.fillStyle = "rgba(242,243,247,0.95)";
        ctx.fillText(m.acronym, pos.x + 9, pos.y);
      }
    }
  }

  function loop() {
    const moving = step();
    draw();
    rafRef.current = moving ? requestAnimationFrame(loop) : null;
  }

  function ensureLoop() {
    if (rafRef.current == null) rafRef.current = requestAnimationFrame(loop);
  }

  return (
    <div ref={wrapRef} className="w-full">
      <canvas
        ref={canvasRef}
        className="block w-full rounded-2xl border border-white/10 bg-black/60"
      />
    </div>
  );
}
