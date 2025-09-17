import React, { useEffect, useMemo, useRef, useState, useCallback } from "react";
import { GameState } from "../types";
import { dummyOpponents } from "../constants";

// === Interaktive Karten-UI – Iteration 6 (Fokus auf Navigation & 2D-Klarheit) ===
// Änderungen laut deinem Wunsch:
//  • Klares, flaches 2D-Hex-Gitter für maximale Lesbarkeit.
//  • Verbesserte Navigation: Zoom-Buttons, "Auf Dorf zentrieren"-Button, Tastatursteuerung.
//  • "Gehe zu"-Funktion, um schnell zu Koordinaten zu springen.
//  • Anzeige der Hex-Koordinaten bei Mouse-Over.
//  • Beibehaltung der leistungsstarken A*-Routenplanung.

// --- Konfiguration ---
const GRID_W = 46; // axial q (Spalten)
const GRID_H = 30; // axial r (Zeilen)
const HEX_SIZE = 28; // Grundradius des Hex (Pixel) bei zoom=1
const MAX_ZOOM = 3.0;
const MIN_ZOOM = 0.5;
const SPEED_SEC_PER_COST = 6;
const SIGHT_RADIUS = 4;
const SCAN_RADIUS = 4;

// Terrain (neutral)
const TERRAINS = [
  { key: "plain", label: "Ebene", base: 1.0, blocked: false, color: "#a7d3a7" },
  { key: "woods", label: "Wald", base: 1.35, blocked: false, color: "#7cb47c" },
  { key: "hills", label: "Hügel", base: 1.6, blocked: false, color: "#c0ac8e" },
  { key: "swamp", label: "Sumpf", base: 1.9, blocked: false, color: "#809d8e" },
  { key: "cliff", label: "Abbruch", base: 1.0, blocked: true, color: "#8e8e99" },
] as const;

type Owner = "ally" | "enemy" | "neutral";

type Hex = { q: number; r: number; terrain: typeof TERRAINS[number]; owner: Owner; variant: number };

type Pos = { q: number; r: number };

type Segment = { from: Pos; to: Pos; cost: number; eta: number };

// --- Utilities ---
function mulberry32(a: number) {
  return function () {
    let t = (a += 0x6d2b79f5);
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// Axial ↔ Pixel
function hexToPixel(q: number, r: number, size: number) {
  const x = size * (Math.sqrt(3) * q + (Math.sqrt(3) / 2) * r);
  const y = size * ((3 / 2) * r);
  return { x, y };
}

function pixelToHex(px: number, py: number, size: number) {
  const q = ((Math.sqrt(3) / 3) * px - (1 / 3) * py) / size;
  const r = ((2 / 3) * py) / size;
  return hexRound(q, r);
}

function hexRound(qf: number, rf: number) {
  const xf = qf;
  const zf = rf;
  const yf = -xf - zf;
  let x = Math.round(xf),
    y = Math.round(yf),
    z = Math.round(zf);
  const x_diff = Math.abs(x - xf),
    y_diff = Math.abs(y - yf),
    z_diff = Math.abs(z - zf);
  if (x_diff > y_diff && x_diff > z_diff) x = -y - z;
  else if (y_diff > z_diff) y = -x - z;
  else z = -x - y;
  return { q: x, r: z };
}

const HEX_DIRS = [
  { q: 1, r: 0 }, { q: 1, r: -1 }, { q: 0, r: -1 },
  { q: -1, r: 0 }, { q: -1, r: 1 }, { q: 0, r: 1 },
];

function inBounds(q: number, r: number) {
  return q >= 0 && r >= 0 && q < GRID_W && r < GRID_H;
}

function hexNeighbors(q: number, r: number) {
  return HEX_DIRS.map((d) => ({ q: q + d.q, r: r + d.r })).filter((p) => inBounds(p.q, p.r));
}

function hexDistance(a: Pos, b: Pos) {
  return (Math.abs(a.q - b.q) + Math.abs(a.q + a.r - b.q - b.r) + Math.abs(a.r - b.r)) / 2;
}

function aStarHex(start: Pos, goal: Pos, grid: Hex[][]) {
  const key = (p: Pos) => `${p.q},${p.r}`;
  const open: Pos[] = [start];
  const g: Record<string, number> = { [key(start)]: 0 };
  const f: Record<string, number> = { [key(start)]: hexDistance(start, goal) };
  const came: Record<string, Pos | null> = { [key(start)]: null };

  while (open.length) {
    let best = 0;
    for (let i = 1; i < open.length; i++) if (f[key(open[i])] < f[key(open[best])]) best = i;
    const cur = open.splice(best, 1)[0];
    if (cur.q === goal.q && cur.r === goal.r) {
      const path: Pos[] = [];
      let p: Pos | null = cur;
      while (p) { path.push(p); p = came[key(p)] ?? null; }
      path.reverse();
      let cost = 0;
      for (let i = 1; i < path.length; i++) cost += grid[path[i].r][path[i].q].terrain.base;
      return { path, cost };
    }
    for (const n of hexNeighbors(cur.q, cur.r)) {
      const tile = grid[n.r][n.q];
      if (tile.terrain.blocked) continue;
      const step = tile.terrain.base;
      const nk = key(n);
      const tentative = g[key(cur)] + step;
      if (!(nk in g) || tentative < g[nk]) {
        g[nk] = tentative;
        f[nk] = tentative + hexDistance(n, goal);
        came[nk] = cur;
        if (!open.find((p) => p.q === n.q && p.r === n.r)) open.push(n);
      }
    }
  }
  return { path: [], cost: Infinity };
}

function visibleSet(centers: Pos[], radius: number) {
  const set = new Set<string>();
  for (const c of centers) {
    for (let dr = -radius; dr <= radius; dr++) {
      for (let dq = -radius; dq <= radius; dq++) {
        const q = c.q + dq; const r = c.r + dr;
        if (inBounds(q, r) && hexDistance(c, { q, r }) <= radius) set.add(`${q},${r}`);
      }
    }
  }
  return set;
}

// --- Daten ---
function useGrid(seed = 777, gameState: GameState) {
    const rnd = useMemo(() => mulberry32(seed), [seed]);
    const villagePositionsKey = useMemo(() => JSON.stringify([...gameState.villages, ...dummyOpponents].map(v => `${v.id}:${v.x},${v.y}`)), [gameState.villages]);

    return useMemo<Hex[][]>(() => {
        const arr: Hex[][] = [];
        const allVillages = [...gameState.villages, ...dummyOpponents];
        for (let r = 0; r < GRID_H; r++) {
            const row: Hex[] = [];
            for (let q = 0; q < GRID_W; q++) {
                const villageHere = allVillages.find(v => v.x === q && v.y === r);
                const owner: Owner = villageHere ? (gameState.villages.some(v => v.id === villageHere.id) ? "ally" : "enemy") : "neutral";
                const rr = rnd();
                const t = !villageHere && rr < 0.05 ? TERRAINS[4] : rr < 0.22 ? TERRAINS[3] : rr < 0.45 ? TERRAINS[2] : rr < 0.68 ? TERRAINS[1] : TERRAINS[0];
                row.push({ q, r, terrain: t, owner, variant: Math.floor(rr * 100) });
            }
            arr.push(row);
        }
        return arr;
    }, [rnd, villagePositionsKey, gameState.villages]);
}

// --- Zeichenhilfen ---
function getHexVertices(cx: number, cy: number, size: number) {
  const points: { x: number; y: number }[] = [];
  for (let i = 0; i < 6; i++) {
    const angle = (Math.PI / 3) * i + Math.PI / 6;
    points.push({ x: cx + size * Math.cos(angle), y: cy + size * Math.sin(angle) });
  }
  return points;
}

function formatETA(sec: number) {
  if (!isFinite(sec)) return "—";
  if (sec < 60) return `${Math.round(sec)}s`;
  const m = Math.floor(sec / 60);
  const s = Math.round(sec % 60).toString().padStart(2, "0");
  return `${m}:${s} min`;
}

// --- Hauptkomponente ---
interface WorldMapViewProps { gameState: GameState; }

const WorldMapView: React.FC<WorldMapViewProps> = ({ gameState }) => {
  const grid = useGrid(2025, gameState);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  // Zustand
  const [zoom, setZoom] = useState(1);
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const [hoveredHex, setHoveredHex] = useState<Pos | null>(null);
  const [jumpQ, setJumpQ] = useState("");
  const [jumpR, setJumpR] = useState("");
  type Mode = "selectStart" | "addWaypoint" | "setEnd" | "scan" | "entrench";
  const [mode, setMode] = useState<Mode>("setEnd");
  const playerVillage = gameState.villages[0];
  const [start, setStart] = useState<Pos | null>(playerVillage ? { q: playerVillage.x, r: playerVillage.y } : null);
  const [waypoints, setWaypoints] = useState<Pos[]>([]);
  const [dragIndex, setDragIndex] = useState<number | null>(null);
  const [entrench, setEntrench] = useState<Pos[]>([]);
  const [scans, setScans] = useState<{ center: Pos; until: number }[]>([]);
  const [showOverlay, setShowOverlay] = useState({ fog: true });

  // Sichtbarkeit & Route
  const visionCenters = useMemo(() => {
    const own: Pos[] = gameState.villages.map(v => ({q: v.x, r: v.y}));
    const scanC = scans.filter((s) => s.until > Date.now()).map((s) => s.center);
    return [...own, ...entrench, ...scanC];
  }, [gameState.villages, entrench, scans]);
  const visible = useMemo(() => visibleSet(visionCenters, SIGHT_RADIUS), [visionCenters]);
  const route = useMemo(() => {
    if (!start) return { path: [] as Pos[], cost: 0, segments: [] as Segment[], etaTotal: 0 };
    const pts = [start, ...waypoints];
    if (pts.length < 2) return { path: [start], cost: 0, segments: [], etaTotal: 0 };
    let all: Pos[] = [pts[0]]; let costSum = 0; const segs: Segment[] = [];
    for (let i = 0; i < pts.length - 1; i++) {
      const seg = aStarHex(pts[i], pts[i + 1], grid);
      if (!seg.path.length) return { path: [], cost: Infinity, segments: [], etaTotal: Infinity };
      if (i > 0) seg.path.shift();
      const boost = entrench.some((e) => e.q === pts[i].q && e.r === pts[i].r) ? 0.85 : 1.0;
      all = all.concat(seg.path);
      costSum += seg.cost * boost;
      segs.push({ from: pts[i], to: pts[i + 1], cost: seg.cost * boost, eta: seg.cost * boost * SPEED_SEC_PER_COST });
    }
    return { path: all, cost: costSum, segments: segs, etaTotal: costSum * SPEED_SEC_PER_COST };
  }, [start, waypoints, grid, entrench]);

  // Canvas Setup & Zeichnen
  useEffect(() => {
    const cvs = canvasRef.current!; const dpr = window.devicePixelRatio || 1;
    const rect = cvs.getBoundingClientRect();
    cvs.width = Math.floor(rect.width * dpr); cvs.height = Math.floor(rect.height * dpr);
    const ctx = cvs.getContext("2d")!;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  }, []);

  useEffect(() => {
    const cvs = canvasRef.current!; const ctx = cvs.getContext("2d")!;
    const w = cvs.clientWidth; const h = cvs.clientHeight;
    ctx.clearRect(0, 0, w, h);
    const size = HEX_SIZE * zoom;

    for (let r = 0; r < GRID_H; r++) {
      for (let q = 0; q < GRID_W; q++) {
        const { x, y } = hexToPixel(q, r, size);
        const cx = pan.x + x; const cy = pan.y + y;
        if (cx < -size || cy < -size || cx > w + size || cy > h + size) continue;
        const tile = grid[r][q]; const v = getHexVertices(cx, cy, size * 0.95);
        ctx.fillStyle = tile.terrain.color;
        ctx.beginPath(); v.forEach((p, i) => i === 0 ? ctx.moveTo(p.x, p.y) : ctx.lineTo(p.x, p.y));
        ctx.closePath(); ctx.fill();
        ctx.strokeStyle = "rgba(15, 23, 42, 0.2)"; ctx.lineWidth = 1; ctx.stroke();

        if (tile.owner !== "neutral") {
          ctx.fillStyle = tile.owner === 'ally' ? '#3b82f6' : '#ef4444';
          ctx.beginPath(); ctx.arc(cx, cy, size * 0.4, 0, Math.PI * 2); ctx.fill();
          ctx.strokeStyle = tile.owner === 'ally' ? '#93c5fd' : '#fca5a5';
          ctx.lineWidth = Math.max(1, size*0.08); ctx.stroke();
        }
        if (tile.terrain.blocked) {
          ctx.strokeStyle = "#44403c"; ctx.lineWidth = Math.max(2, size*0.15);
          ctx.beginPath(); ctx.moveTo(v[4].x, v[4].y); ctx.lineTo(v[1].x, v[1].y); ctx.stroke();
        }
        if (showOverlay.fog && !visible.has(`${q},${r}`)) {
          ctx.fillStyle = "rgba(14,17,22,0.65)"; ctx.fill();
        }
      }
    }
    
    // Route & Punkte
    if (route.path.length > 1 && route.cost < Infinity) {
        ctx.lineWidth = Math.max(2, size * 0.1); ctx.lineCap = 'round';
        for (let i = 1; i < route.path.length; i++) {
            const A = hexToPixel(route.path[i-1].q, route.path[i-1].r, size);
            const B = hexToPixel(route.path[i].q, route.path[i].r, size);
            ctx.strokeStyle = "rgba(15, 23, 42, 0.8)";
            ctx.beginPath(); ctx.moveTo(pan.x + A.x, pan.y + A.y); ctx.lineTo(pan.x + B.x, pan.y + B.y); ctx.stroke();
        }
        const pts = [start!, ...waypoints];
        pts.forEach((p, i) => {
            const P = hexToPixel(p.q, p.r, size);
            ctx.fillStyle = i === 0 ? "#16a34a" : i === pts.length - 1 ? "#dc2626" : "#f59e0b";
            ctx.beginPath(); ctx.arc(pan.x + P.x, pan.y + P.y, size * 0.22, 0, Math.PI*2); ctx.fill();
            ctx.strokeStyle = "#0f172a"; ctx.lineWidth = 2; ctx.stroke();
        });
    }

  }, [grid, pan, zoom, showOverlay, entrench, scans, start, waypoints, visible, route]);
  
  // --- Interaktion ---
  const handleZoom = useCallback((direction: number, pivot?: {x: number, y: number}) => {
    const old = zoom; const neu = Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, +(old * (1 + direction * 0.15)).toFixed(3)));
    const cvs = canvasRef.current!; const rect = cvs.getBoundingClientRect();
    const mx = pivot ? pivot.x : rect.width / 2;
    const my = pivot ? pivot.y : rect.height / 2;
    const scale = neu / old;
    setPan({ x: mx - (mx - pan.x) * scale, y: my - (my - pan.y) * scale });
    setZoom(neu);
  }, [pan, zoom]);

  const handleCenter = useCallback(() => {
    if (!playerVillage) return;
    const size = HEX_SIZE * zoom; const { x, y } = hexToPixel(playerVillage.x, playerVillage.y, size);
    const cvs = canvasRef.current!;
    setPan({ x: cvs.clientWidth / 2 - x, y: cvs.clientHeight / 2 - y });
  }, [playerVillage, zoom]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
        const panSpeed = 25;
        if (document.activeElement?.tagName === 'INPUT') return;
        switch (e.key) {
            case 'ArrowUp': setPan(p => ({ ...p, y: p.y + panSpeed })); e.preventDefault(); break;
            case 'ArrowDown': setPan(p => ({ ...p, y: p.y - panSpeed })); e.preventDefault(); break;
            case 'ArrowLeft': setPan(p => ({ ...p, x: p.x + panSpeed })); e.preventDefault(); break;
            case 'ArrowRight': setPan(p => ({ ...p, x: p.x - panSpeed })); e.preventDefault(); break;
            case '+': case '=': handleZoom(1); e.preventDefault(); break;
            case '-': handleZoom(-1); e.preventDefault(); break;
        }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [handleZoom]);

  const clientToHex = (evX: number, evY: number) => {
    const size = HEX_SIZE * zoom; const hx = evX - pan.x; const hy = evY - pan.y;
    const { q, r } = pixelToHex(hx, hy, size);
    return inBounds(q, r) ? { q, r } : null;
  }
  const hitPoint = (evX: number, evY: number) => {
    const size = HEX_SIZE * zoom;
    const pts = [start, ...waypoints].filter(Boolean) as Pos[];
    for (let i = 0; i < pts.length; i++) {
      const P = hexToPixel(pts[i].q, pts[i].r, size);
      if (Math.hypot(evX - (pan.x + P.x), evY - (pan.y + P.y)) < size * 0.3) return i - 1;
    }
    return null;
  }
  const dragging = useRef<{ kind: "map" | "point"; lastX: number; lastY: number } | null>(null);
  const onPointerDown: React.PointerEventHandler<HTMLCanvasElement> = (e) => {
    (e.target as HTMLCanvasElement).setPointerCapture(e.pointerId);
    const rect = (e.target as HTMLCanvasElement).getBoundingClientRect();
    const x = e.clientX - rect.left, y = e.clientY - rect.top;
    const h = hitPoint(x, y);
    if (h !== null) { dragging.current = { kind: "point", lastX: x, lastY: y }; setDragIndex(h); return; }
    dragging.current = { kind: "map", lastX: x, lastY: y };
  };
  const onPointerMove: React.PointerEventHandler<HTMLCanvasElement> = (e) => {
    const rect = (e.target as HTMLCanvasElement).getBoundingClientRect();
    const x = e.clientX - rect.left, y = e.clientY - rect.top;
    setHoveredHex(clientToHex(x, y));
    if (!dragging.current) return;
    if (dragging.current.kind === "map") {
      setPan((p) => ({ x: p.x + (x - dragging.current!.lastX), y: p.y + (y - dragging.current!.lastY) }));
      dragging.current = { kind: "map", lastX: x, lastY: y };
    } else {
      const t = clientToHex(x, y);
      if (t) {
        if (dragIndex === -1 && start) setStart(t);
        else if (dragIndex !== null && dragIndex >= 0) setWaypoints((prev) => { const n = [...prev]; n[dragIndex] = t; return n; });
      }
    }
  };
  const onPointerUp: React.PointerEventHandler<HTMLCanvasElement> = () => { dragging.current = null; setDragIndex(null); };
  const onClick: React.MouseEventHandler<HTMLCanvasElement> = (e) => {
    if (e.detail > 1) return;
    const rect = (e.target as HTMLCanvasElement).getBoundingClientRect();
    const x = e.clientX - rect.left, y = e.clientY - rect.top;
    setTimeout(() => {
        if(dragging.current) return;
        const h = hitPoint(x, y); if (h !== null) return;
        const t = clientToHex(x, y); if (!t) return;
        if (mode === "selectStart") setStart(t);
        else if (mode === "addWaypoint") setWaypoints((prev) => [...prev, t]);
        else if (mode === "setEnd") setWaypoints((prev) => (prev.length ? [...prev.slice(0, -1), t] : [t]));
        else if (mode === "scan") setScans((prev) => [...prev, { center: t, until: Date.now() + 10_000 }]);
        else if (mode === "entrench") setEntrench((prev) => (prev.find((p) => p.q === t.q && p.r === t.r) ? prev.filter((p) => !(p.q === t.q && p.r === t.r)) : [...prev, t]));
    }, 50);
  };
  const onWheel: React.WheelEventHandler<HTMLCanvasElement> = (e) => {
    e.preventDefault();
    const rect = (e.target as HTMLCanvasElement).getBoundingClientRect();
    handleZoom(e.deltaY > 0 ? -1 : 1, {x: e.clientX - rect.left, y: e.clientY - rect.top});
  };
  const handleJump = () => {
    const q = parseInt(jumpQ, 10); const r = parseInt(jumpR, 10);
    if (!isNaN(q) && !isNaN(r) && inBounds(q, r)) {
        const size = HEX_SIZE * zoom; const { x, y } = hexToPixel(q, r, size);
        const cvs = canvasRef.current!;
        setPan({ x: cvs.clientWidth / 2 - x, y: cvs.clientHeight / 2 - y, });
    }
  };

  return (
    <div className="w-full h-full flex flex-col bg-slate-900 text-slate-50 rounded-lg overflow-hidden border border-slate-700">
      <div className="p-2 flex items-center justify-between flex-wrap gap-2 border-b border-slate-800 bg-slate-900/80 backdrop-blur-sm">
        <span className="text-lg font-semibold px-2">Weltkarte</span>
        <div className="flex items-center gap-2 text-sm">
          <input type="number" placeholder="X" value={jumpQ} onChange={e => setJumpQ(e.target.value)} className="w-16 bg-slate-800 p-1 rounded border border-slate-700 focus:ring-2 focus:ring-yellow-400 outline-none" />
          <input type="number" placeholder="Y" value={jumpR} onChange={e => setJumpR(e.target.value)} className="w-16 bg-slate-800 p-1 rounded border border-slate-700 focus:ring-2 focus:ring-yellow-400 outline-none" />
          <button onClick={handleJump} className="px-3 py-1 bg-slate-700 hover:bg-slate-600 rounded transition-colors">Gehe zu</button>
        </div>
        <div className="hidden sm:flex items-center gap-4 text-sm px-2">
            <span>Zoom: {Math.round(zoom * 100)}%</span>
            <span>Hover: {hoveredHex ? `(${hoveredHex.q}, ${hoveredHex.r})` : 'N/A'}</span>
        </div>
      </div>
      <div className="flex-1 relative">
        <canvas ref={canvasRef} className="w-full h-full touch-none" onPointerDown={onPointerDown} onPointerMove={onPointerMove} onPointerUp={onPointerUp} onPointerCancel={onPointerUp} onWheel={onWheel} onClick={onClick}/>
        <div className="absolute top-3 right-3 p-2 bg-slate-800/85 rounded-lg shadow-lg backdrop-blur-md text-xs space-y-1">
          <label className="flex items-center gap-2 cursor-pointer">
            <input type="checkbox" className="toggle toggle-xs" checked={showOverlay.fog} onChange={(e) => setShowOverlay({ ...showOverlay, fog: e.target.checked })} /> Nebel
          </label>
        </div>
        <div className="absolute top-14 right-3 flex flex-col gap-2">
            <button onClick={() => handleZoom(1)} className="w-8 h-8 bg-slate-800/85 rounded-md shadow-lg flex items-center justify-center text-lg hover:bg-slate-700 transition-colors" aria-label="Hineinzoomen">+</button>
            <button onClick={() => handleZoom(-1)} className="w-8 h-8 bg-slate-800/85 rounded-md shadow-lg flex items-center justify-center text-lg hover:bg-slate-700 transition-colors" aria-label="Herauszoomen">-</button>
            <button onClick={handleCenter} className="w-8 h-8 bg-slate-800/85 rounded-md shadow-lg flex items-center justify-center text-lg hover:bg-slate-700 transition-colors" aria-label="Auf Dorf zentrieren">🎯</button>
        </div>
         {route.path.length > 0 && (
             <div className="absolute top-3 left-3 p-2 px-3 bg-slate-800/85 rounded-lg shadow-lg backdrop-blur-md text-sm">
                {route.cost === Infinity ? <span className="text-red-400">Kein Pfad möglich</span> : `ETA: ${formatETA(route.etaTotal)}`}
             </div>
         )}
        <div className="absolute bottom-0 inset-x-0 bg-slate-900/95 border-t border-slate-800 p-2 sm:p-3">
          <div className="grid grid-cols-5 gap-2 text-xs">
            <button className={`py-2 rounded-lg flex flex-col items-center gap-1 ${mode === "selectStart" ? "bg-emerald-700" : "bg-slate-800 hover:bg-slate-700"}`} onClick={() => setMode("selectStart")}>▶️ Start</button>
            <button className={`py-2 rounded-lg flex flex-col items-center gap-1 ${mode === "addWaypoint" ? "bg-emerald-700" : "bg-slate-800 hover:bg-slate-700"}`} onClick={() => setMode("addWaypoint")}>➕ Wegpunkt</button>
            <button className={`py-2 rounded-lg flex flex-col items-center gap-1 ${mode === "setEnd" ? "bg-emerald-700" : "bg-slate-800 hover:bg-slate-700"}`} onClick={() => setMode("setEnd")}>🏁 Ende</button>
            <button className={`py-2 rounded-lg flex flex-col items-center gap-1 ${mode === "scan" ? "bg-emerald-700" : "bg-slate-800 hover:bg-slate-700"}`} onClick={() => setMode("scan")}>📡 Scan</button>
            <button className={`py-2 rounded-lg flex flex-col items-center gap-1 ${mode === "entrench" ? "bg-emerald-700" : "bg-slate-800 hover:bg-slate-700"}`} onClick={() => setMode("entrench")}>🛡️ Verschanzen</button>
          </div>
          <div className="mt-2 flex gap-2">
            <button className="flex-1 py-2 rounded-xl bg-slate-800 hover:bg-slate-700" onClick={() => { setStart(playerVillage ? { q: playerVillage.x, r: playerVillage.y } : null); setWaypoints([]); }}>Reset</button>
            <button className="flex-1 py-2 rounded-xl bg-slate-800 hover:bg-slate-700" onClick={() => setWaypoints((prev) => prev.slice(0, -1))}>Undo</button>
          </div>
        </div>
      </div>
    </div>
  );
}

export default WorldMapView;