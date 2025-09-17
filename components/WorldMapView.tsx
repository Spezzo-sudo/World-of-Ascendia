import React, { useEffect, useMemo, useRef, useState, useCallback } from "react";
import { GameState, MapCoordinate, MapScan, MapRouteMetrics } from "../types";
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
type TerrainDefinition = {
  key: "plain" | "woods" | "hills" | "swamp" | "cliff";
  label: string;
  base: number;
  blocked: boolean;
  palette: [string, string, string];
  accent: string;
};

const TERRAINS: readonly TerrainDefinition[] = [
  {
    key: "plain",
    label: "Sonnenwiese",
    base: 1.0,
    blocked: false,
    palette: ["#84f1a5", "#34d399", "#059669"],
    accent: "rgba(74, 222, 128, 0.45)",
  },
  {
    key: "woods",
    label: "Bernsteinwald",
    base: 1.35,
    blocked: false,
    palette: ["#a7f3d0", "#22c55e", "#166534"],
    accent: "rgba(34, 197, 94, 0.45)",
  },
  {
    key: "hills",
    label: "Kupferhügel",
    base: 1.6,
    blocked: false,
    palette: ["#fed7aa", "#f97316", "#b45309"],
    accent: "rgba(251, 191, 36, 0.5)",
  },
  {
    key: "swamp",
    label: "Kristallsumpf",
    base: 1.9,
    blocked: false,
    palette: ["#bfdbfe", "#38bdf8", "#1d4ed8"],
    accent: "rgba(56, 189, 248, 0.4)",
  },
  {
    key: "cliff",
    label: "Basaltklippe",
    base: 1.0,
    blocked: true,
    palette: ["#cbd5f5", "#6366f1", "#312e81"],
    accent: "rgba(129, 140, 248, 0.55)",
  },
] as const;

type Owner = "ally" | "enemy" | "neutral";

type Hex = { q: number; r: number; terrain: TerrainDefinition; owner: Owner; variant: number };

type Pos = MapCoordinate;

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

const coordsEqual = (a: Pos | null, b: Pos | null) => {
  if (!a && !b) return true;
  if (!a || !b) return false;
  return a.q === b.q && a.r === b.r;
};

const coordArrayEqual = (a: Pos[], b: Pos[]) =>
  a.length === b.length && a.every((coord, index) => coordsEqual(coord, b[index] ?? null));

const scansEqual = (a: MapScan[], b: MapScan[]) =>
  a.length === b.length && a.every((scan, index) => {
    const other = b[index];
    return !!other && coordsEqual(scan.center, other.center) && scan.expiresAt === other.expiresAt;
  });

const metricsEqual = (a: MapRouteMetrics, b: MapRouteMetrics) =>
  a.totalCost === b.totalCost && a.etaSeconds === b.etaSeconds && a.distance === b.distance;

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

const OWNER_STYLES: Record<Owner, { fill: string; stroke: string; glow: string }> = {
  ally: { fill: "#38bdf8", stroke: "#bae6fd", glow: "rgba(59, 130, 246, 0.4)" },
  enemy: { fill: "#f87171", stroke: "#fecaca", glow: "rgba(239, 68, 68, 0.45)" },
  neutral: { fill: "#f8fafc", stroke: "#cbd5f5", glow: "rgba(148, 163, 184, 0.25)" },
};

function terrainGradient(
  ctx: CanvasRenderingContext2D,
  cx: number,
  cy: number,
  size: number,
  terrain: TerrainDefinition,
  variant: number,
) {
  const angle = ((variant % 6) / 6) * Math.PI * 2;
  const dx = Math.cos(angle) * size;
  const dy = Math.sin(angle) * size;
  const gradient = ctx.createLinearGradient(cx - dx, cy - dy, cx + dx, cy + dy);
  const [c0, c1, c2] = terrain.palette;
  gradient.addColorStop(0, c0);
  gradient.addColorStop(0.5, c1);
  gradient.addColorStop(1, c2);
  return gradient;
}

function formatETA(sec: number) {
  if (!isFinite(sec)) return "—";
  if (sec < 60) return `${Math.round(sec)}s`;
  const m = Math.floor(sec / 60);
  const s = Math.round(sec % 60).toString().padStart(2, "0");
  return `${m}:${s} min`;
}

// --- Hauptkomponente ---
interface WorldMapViewProps {
  gameState: GameState;
  setGameState: React.Dispatch<React.SetStateAction<GameState>>;
}

const WorldMapView: React.FC<WorldMapViewProps> = ({ gameState, setGameState }) => {
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
  const { start, waypoints, entrenchments: entrench, scans, routeMetrics } = gameState.mapState;
  const [dragIndex, setDragIndex] = useState<number | null>(null);
  const [showOverlay, setShowOverlay] = useState({ fog: true });
  const [pulseTick, setPulseTick] = useState(0);
  const [viewportHexBounds, setViewportHexBounds] = useState<{ minQ: number; maxQ: number; minR: number; maxR: number } | null>(null);
  const miniMapRef = useRef<HTMLCanvasElement | null>(null);
  const initialCenterApplied = useRef(false);

  const updateMapState = useCallback((updater: (prev: GameState['mapState']) => GameState['mapState']) => {
    setGameState(prev => {
      const nextMapState = updater(prev.mapState);
      if (
        coordsEqual(prev.mapState.start, nextMapState.start) &&
        coordArrayEqual(prev.mapState.waypoints, nextMapState.waypoints) &&
        coordArrayEqual(prev.mapState.entrenchments, nextMapState.entrenchments) &&
        scansEqual(prev.mapState.scans, nextMapState.scans) &&
        metricsEqual(prev.mapState.routeMetrics, nextMapState.routeMetrics)
      ) {
        return prev;
      }
      return { ...prev, mapState: nextMapState };
    });
  }, [setGameState]);

  const setStartPosition = useCallback((pos: Pos | null) => {
    updateMapState(mapState => {
      if (coordsEqual(mapState.start, pos)) {
        return mapState;
      }
      return { ...mapState, start: pos };
    });
  }, [updateMapState]);

  const updateWaypointsList = useCallback((recipe: (prev: Pos[]) => Pos[]) => {
    updateMapState(mapState => {
      const nextWaypoints = recipe(mapState.waypoints);
      if (coordArrayEqual(mapState.waypoints, nextWaypoints)) {
        return mapState;
      }
      return { ...mapState, waypoints: nextWaypoints };
    });
  }, [updateMapState]);

  const toggleEntrench = useCallback((pos: Pos) => {
    updateMapState(mapState => {
      const exists = mapState.entrenchments.some(p => p.q === pos.q && p.r === pos.r);
      const nextEntrenchments = exists
        ? mapState.entrenchments.filter(p => !(p.q === pos.q && p.r === pos.r))
        : [...mapState.entrenchments, pos];
      if (coordArrayEqual(mapState.entrenchments, nextEntrenchments)) {
        return mapState;
      }
      return { ...mapState, entrenchments: nextEntrenchments };
    });
  }, [updateMapState]);

  const addScan = useCallback((pos: Pos) => {
    updateMapState(mapState => ({
      ...mapState,
      scans: [...mapState.scans, { center: pos, expiresAt: Date.now() + 10_000 }],
    }));
  }, [updateMapState]);

  const removeExpiredScans = useCallback(() => {
    updateMapState(mapState => {
      const active = mapState.scans.filter(scan => scan.expiresAt > Date.now());
      if (scansEqual(mapState.scans, active)) {
        return mapState;
      }
      return { ...mapState, scans: active };
    });
  }, [updateMapState]);

  const updateRouteMetrics = useCallback((metrics: MapRouteMetrics) => {
    updateMapState(mapState => {
      if (metricsEqual(mapState.routeMetrics, metrics)) {
        return mapState;
      }
      return { ...mapState, routeMetrics: metrics };
    });
  }, [updateMapState]);

  const routePoints = useMemo(() => (start ? [start, ...waypoints] : waypoints), [start, waypoints]);

  const handleRemovePoint = useCallback((index: number) => {
    if (index <= 0) {
      if (playerVillage) {
        setStartPosition({ q: playerVillage.x, r: playerVillage.y });
      }
      return;
    }
    updateWaypointsList(prev => prev.filter((_, wpIndex) => wpIndex !== index - 1));
  }, [playerVillage, setStartPosition, updateWaypointsList]);

  const clearRoute = useCallback(() => {
    updateWaypointsList(() => []);
    if (playerVillage) {
      setStartPosition({ q: playerVillage.x, r: playerVillage.y });
    }
  }, [playerVillage, setStartPosition, updateWaypointsList]);

  const undoWaypoint = useCallback(() => {
    updateWaypointsList(prev => prev.slice(0, -1));
  }, [updateWaypointsList]);

  useEffect(() => {
    if (!scans.length) return;
    const timer = window.setInterval(removeExpiredScans, 1000);
    return () => window.clearInterval(timer);
  }, [scans.length, removeExpiredScans]);

  useEffect(() => {
    const interval = window.setInterval(() => {
      setPulseTick((tick) => (tick + 1) % 10_000);
    }, 60);
    return () => window.clearInterval(interval);
  }, []);

  const allVillages = useMemo(() => [...gameState.villages, ...dummyOpponents], [gameState.villages]);
  const hoveredVillage = useMemo(() => {
    if (!hoveredHex) return null;
    return allVillages.find(village => village.x === hoveredHex.q && village.y === hoveredHex.r) ?? null;
  }, [allVillages, hoveredHex]);
  const hoveredTile = hoveredHex && grid[hoveredHex.r] ? grid[hoveredHex.r][hoveredHex.q] : null;
  const entrenchSet = useMemo(() => new Set(entrench.map(p => `${p.q},${p.r}`)), [entrench]);
  const scanCenters = useMemo(() => new Set(scans.map(scan => `${scan.center.q},${scan.center.r}`)), [scans]);

  // Sichtbarkeit & Route
  const visionCenters = useMemo(() => {
    const own: Pos[] = gameState.villages.map(v => ({q: v.x, r: v.y}));
    const scanC = scans.filter((s) => s.expiresAt > Date.now()).map((s) => s.center);
    return [...own, ...entrench, ...scanC];
  }, [gameState.villages, entrench, scans]);
  const visible = useMemo(() => visibleSet(visionCenters, SIGHT_RADIUS), [visionCenters]);
  const route = useMemo(() => {
    if (!start) return { path: [] as Pos[], cost: 0, segments: [] as Segment[], etaTotal: 0 };
    const pts = routePoints;
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
  const routeDistance = route.path.length > 1 ? route.path.length - 1 : 0;
  const hoveredKey = hoveredHex ? `${hoveredHex.q},${hoveredHex.r}` : null;
  const hoveredVisible = hoveredKey ? visible.has(hoveredKey) : false;

  useEffect(() => {
    const metrics: MapRouteMetrics = {
      totalCost: Number.isFinite(route.cost) ? Number(route.cost.toFixed(2)) : Infinity,
      etaSeconds: Number.isFinite(route.etaTotal) ? Math.round(route.etaTotal) : Infinity,
      distance: routeDistance,
    };
    updateRouteMetrics(metrics);
  }, [route.cost, route.etaTotal, routeDistance, updateRouteMetrics]);

  // Canvas Setup & Zeichnen
  const configureCanvas = useCallback(() => {
    const cvs = canvasRef.current;
    if (!cvs) return;
    const dpr = window.devicePixelRatio || 1;
    const rect = cvs.getBoundingClientRect();
    cvs.width = Math.floor(rect.width * dpr);
    cvs.height = Math.floor(rect.height * dpr);
    const ctx = cvs.getContext("2d");
    if (ctx) {
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    }
  }, []);

  useEffect(() => {
    configureCanvas();
  }, [configureCanvas]);

  useEffect(() => {
    window.addEventListener('resize', configureCanvas);
    return () => window.removeEventListener('resize', configureCanvas);
  }, [configureCanvas]);

  useEffect(() => {
    const cvs = canvasRef.current!; const ctx = cvs.getContext("2d")!;
    const w = cvs.clientWidth; const h = cvs.clientHeight;
    ctx.clearRect(0, 0, w, h);
    const size = HEX_SIZE * zoom;

    let visibleMinQ = Number.POSITIVE_INFINITY;
    let visibleMaxQ = Number.NEGATIVE_INFINITY;
    let visibleMinR = Number.POSITIVE_INFINITY;
    let visibleMaxR = Number.NEGATIVE_INFINITY;

    for (let r = 0; r < GRID_H; r++) {
      for (let q = 0; q < GRID_W; q++) {
        const { x, y } = hexToPixel(q, r, size);
        const cx = pan.x + x; const cy = pan.y + y;
        if (cx < -size || cy < -size || cx > w + size || cy > h + size) continue;
        visibleMinQ = Math.min(visibleMinQ, q);
        visibleMaxQ = Math.max(visibleMaxQ, q);
        visibleMinR = Math.min(visibleMinR, r);
        visibleMaxR = Math.max(visibleMaxR, r);
        const tile = grid[r][q]; const v = getHexVertices(cx, cy, size * 0.95);
        const tracePolygon = () => {
          ctx.beginPath();
          v.forEach((p, i) => (i === 0 ? ctx.moveTo(p.x, p.y) : ctx.lineTo(p.x, p.y)));
          ctx.closePath();
        };
        tracePolygon();
        const key = `${q},${r}`;

        ctx.save();
        ctx.fillStyle = terrainGradient(ctx, cx, cy, size, tile.terrain, tile.variant);
        ctx.globalAlpha = hoveredHex && hoveredHex.q === q && hoveredHex.r === r ? 1 : 0.94;
        ctx.shadowColor = tile.terrain.accent;
        ctx.shadowBlur = 4 + (tile.variant % 5) * 1.5;
        ctx.fill();
        ctx.restore();

        ctx.strokeStyle = `rgba(15, 23, 42, ${0.18 + ((tile.variant % 4) * 0.08)})`;
        ctx.lineWidth = Math.max(1, size * 0.04);
        ctx.stroke();

        if (tile.owner !== "neutral") {
          const style = OWNER_STYLES[tile.owner];
          const pulse = 1 + 0.1 * Math.sin((pulseTick + tile.variant) * 0.15);
          ctx.save();
          const ownerGradient = ctx.createRadialGradient(
            cx,
            cy,
            0,
            cx,
            cy,
            size * (0.6 + 0.12 * pulse),
          );
          ownerGradient.addColorStop(0, style.fill);
          ownerGradient.addColorStop(0.7, style.fill);
          ownerGradient.addColorStop(1, "rgba(15, 23, 42, 0)");
          ctx.fillStyle = ownerGradient;
          ctx.globalAlpha = 0.85;
          ctx.fill();
          ctx.restore();

          ctx.save();
          ctx.shadowColor = style.glow;
          ctx.shadowBlur = 18;
          ctx.fillStyle = style.fill;
          ctx.beginPath();
          ctx.arc(cx, cy, size * 0.35, 0, Math.PI * 2);
          ctx.fill();
          ctx.strokeStyle = style.stroke;
          ctx.lineWidth = Math.max(1.5, size * 0.1);
          ctx.stroke();
          ctx.restore();
        }
        if (tile.terrain.blocked) {
          ctx.save();
          ctx.strokeStyle = "rgba(15, 23, 42, 0.65)";
          ctx.lineWidth = Math.max(3, size * 0.18);
          ctx.beginPath();
          ctx.moveTo(v[4].x, v[4].y);
          ctx.lineTo(v[1].x, v[1].y);
          ctx.moveTo(v[5].x, v[5].y);
          ctx.lineTo(v[2].x, v[2].y);
          ctx.stroke();
          ctx.restore();
        }
        if (entrenchSet.has(key)) {
          const pulse = 0.9 + 0.08 * Math.sin((pulseTick + q * 5 + r * 3) * 0.2);
          ctx.save();
          ctx.strokeStyle = 'rgba(16, 185, 129, 0.9)';
          ctx.lineWidth = Math.max(2, size * 0.12 * pulse);
          ctx.setLineDash([Math.max(2, size * 0.5), Math.max(2, size * 0.25)]);
          tracePolygon();
          ctx.stroke();
          ctx.restore();
        }
        if (scanCenters.has(key)) {
          const pulse = 0.8 + 0.15 * Math.sin((pulseTick + tile.variant) * 0.25);
          ctx.save();
          const scanGradient = ctx.createRadialGradient(cx, cy, size * 0.1, cx, cy, size * (0.55 * pulse + 0.15));
          scanGradient.addColorStop(0, "rgba(191, 219, 254, 0.6)");
          scanGradient.addColorStop(0.5, 'rgba(59, 130, 246, 0.45)');
          scanGradient.addColorStop(1, 'rgba(59, 130, 246, 0)');
          ctx.fillStyle = scanGradient;
          ctx.fill();
          ctx.restore();
        }
        if (hoveredHex && hoveredHex.q === q && hoveredHex.r === r) {
          ctx.save();
          ctx.strokeStyle = '#facc15';
          ctx.lineWidth = Math.max(2, size * 0.12);
          ctx.shadowColor = 'rgba(250, 204, 21, 0.65)';
          ctx.shadowBlur = 12;
          tracePolygon();
          ctx.stroke();
          ctx.restore();
        }
        if (showOverlay.fog && !visible.has(key)) {
          ctx.save();
          const fogGradient = ctx.createRadialGradient(cx, cy, 0, cx, cy, size * 1.2);
          fogGradient.addColorStop(0, "rgba(12, 16, 28, 0.65)");
          fogGradient.addColorStop(1, "rgba(12, 16, 28, 0.9)");
          ctx.fillStyle = fogGradient;
          ctx.fill();
          ctx.restore();
        }
      }
    }

    if (visibleMinQ !== Number.POSITIVE_INFINITY) {
      const bounds = {
        minQ: visibleMinQ,
        maxQ: visibleMaxQ,
        minR: visibleMinR,
        maxR: visibleMaxR,
      };
      setViewportHexBounds(prev => (
        prev &&
        prev.minQ === bounds.minQ &&
        prev.maxQ === bounds.maxQ &&
        prev.minR === bounds.minR &&
        prev.maxR === bounds.maxR
          ? prev
          : bounds
      ));
    }

    // Route & Punkte
    if (route.path.length > 1 && route.cost < Infinity) {
        ctx.save();
        ctx.lineCap = 'round';
        ctx.lineWidth = Math.max(2, size * 0.14);
        ctx.strokeStyle = "rgba(250, 204, 21, 0.85)";
        ctx.shadowColor = 'rgba(250, 204, 21, 0.45)';
        ctx.shadowBlur = 16;
        ctx.beginPath();
        for (let i = 1; i < route.path.length; i++) {
            const A = hexToPixel(route.path[i-1].q, route.path[i-1].r, size);
            const B = hexToPixel(route.path[i].q, route.path[i].r, size);
            ctx.moveTo(pan.x + A.x, pan.y + A.y);
            ctx.lineTo(pan.x + B.x, pan.y + B.y);
        }
        ctx.stroke();
        ctx.setLineDash([Math.max(10, size * 0.8), Math.max(6, size * 0.5)]);
        ctx.lineDashOffset = -pulseTick * 0.6;
        ctx.strokeStyle = "rgba(254, 249, 195, 0.9)";
        ctx.shadowBlur = 0;
        ctx.stroke();
        ctx.restore();

        const pts = start ? [start, ...waypoints] : waypoints;
        pts.forEach((p, i) => {
            const P = hexToPixel(p.q, p.r, size);
            const isStart = i === 0;
            const isEnd = i === pts.length - 1;
            const pulse = 1 + 0.25 * Math.sin((pulseTick + i * 15) * 0.12);
            ctx.save();
            ctx.fillStyle = isStart ? "#22c55e" : isEnd ? "#ef4444" : "#facc15";
            ctx.shadowColor = isEnd ? 'rgba(239, 68, 68, 0.65)' : isStart ? 'rgba(34, 197, 94, 0.65)' : 'rgba(250, 204, 21, 0.55)';
            ctx.shadowBlur = 18;
            ctx.beginPath(); ctx.arc(pan.x + P.x, pan.y + P.y, size * 0.25 * pulse, 0, Math.PI*2); ctx.fill();
            ctx.strokeStyle = "rgba(15, 23, 42, 0.9)";
            ctx.lineWidth = Math.max(2, size * 0.12);
            ctx.stroke();
            ctx.fillStyle = '#0f172a';
            ctx.font = `${Math.max(11, size * 0.38)}px 'Inter', sans-serif`;
            ctx.textAlign = 'center';
            ctx.textBaseline = 'middle';
            const label = isStart ? 'S' : isEnd ? 'Z' : `${i}`;
            ctx.fillText(label, pan.x + P.x, pan.y + P.y);
            ctx.restore();
        });
    }

  }, [grid, pan, zoom, showOverlay, entrenchSet, scanCenters, start, waypoints, visible, route, hoveredHex, pulseTick]);

  useEffect(() => {
    const canvas = miniMapRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const logicalWidth = 180;
    const logicalHeight = 140;
    const dpr = window.devicePixelRatio || 1;
    canvas.width = logicalWidth * dpr;
    canvas.height = logicalHeight * dpr;
    canvas.style.width = `${logicalWidth}px`;
    canvas.style.height = `${logicalHeight}px`;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

    ctx.clearRect(0, 0, logicalWidth, logicalHeight);
    ctx.fillStyle = "rgba(4, 7, 16, 0.92)";
    ctx.fillRect(0, 0, logicalWidth, logicalHeight);

    const cellW = logicalWidth / GRID_W;
    const cellH = logicalHeight / GRID_H;

    for (let r = 0; r < GRID_H; r++) {
      for (let q = 0; q < GRID_W; q++) {
        const tile = grid[r][q];
        let fill = "rgba(71, 85, 105, 0.55)";
        if (tile.owner === "ally") fill = "rgba(56, 189, 248, 0.85)";
        else if (tile.owner === "enemy") fill = "rgba(248, 113, 113, 0.85)";
        ctx.fillStyle = fill;
        ctx.fillRect(q * cellW, r * cellH, cellW + 0.5, cellH + 0.5);
      }
    }

    ctx.fillStyle = "rgba(16, 185, 129, 0.55)";
    entrench.forEach(pos => {
      ctx.fillRect(pos.q * cellW, pos.r * cellH, cellW, cellH);
    });

    ctx.fillStyle = "rgba(59, 130, 246, 0.25)";
    scans.forEach(scan => {
      ctx.beginPath();
      ctx.arc((scan.center.q + 0.5) * cellW, (scan.center.r + 0.5) * cellH, Math.max(cellW, cellH), 0, Math.PI * 2);
      ctx.fill();
    });

    routePoints.forEach((pos, index) => {
      const isStartPoint = start && pos.q === start.q && pos.r === start.r;
      const isEndPoint = index === routePoints.length - 1;
      ctx.fillStyle = isStartPoint ? "#22c55e" : isEndPoint ? "#ef4444" : "#facc15";
      ctx.beginPath();
      ctx.arc((pos.q + 0.5) * cellW, (pos.r + 0.5) * cellH, Math.max(2.5, cellW * 0.4), 0, Math.PI * 2);
      ctx.fill();
    });

    if (viewportHexBounds) {
      ctx.strokeStyle = "rgba(250, 204, 21, 0.9)";
      ctx.lineWidth = 1.5;
      ctx.strokeRect(
        viewportHexBounds.minQ * cellW,
        viewportHexBounds.minR * cellH,
        (viewportHexBounds.maxQ - viewportHexBounds.minQ + 1) * cellW,
        (viewportHexBounds.maxR - viewportHexBounds.minR + 1) * cellH
      );
    }
  }, [grid, entrench, scans, routePoints, start, viewportHexBounds]);
  
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

  const focusHex = useCallback((q: number, r: number) => {
    const cvs = canvasRef.current;
    if (!cvs) return;
    const size = HEX_SIZE * zoom;
    const { x, y } = hexToPixel(q, r, size);
    setPan({ x: cvs.clientWidth / 2 - x, y: cvs.clientHeight / 2 - y });
  }, [zoom]);

  const handleCenter = useCallback(() => {
    if (!playerVillage) return;
    focusHex(playerVillage.x, playerVillage.y);
    setStartPosition({ q: playerVillage.x, r: playerVillage.y });
  }, [playerVillage, focusHex, setStartPosition]);

  useEffect(() => {
    if (!playerVillage || initialCenterApplied.current) return;
    initialCenterApplied.current = true;
    focusHex(playerVillage.x, playerVillage.y);
  }, [playerVillage, focusHex]);

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
    for (let i = 0; i < routePoints.length; i++) {
      const point = routePoints[i];
      const P = hexToPixel(point.q, point.r, size);
      if (Math.hypot(evX - (pan.x + P.x), evY - (pan.y + P.y)) < size * 0.3) {
        const isStartPoint = start && point.q === start.q && point.r === start.r;
        if (isStartPoint) {
          return -1;
        }
        return start ? i - 1 : i;
      }
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
        if (dragIndex === -1) {
          setStartPosition(t);
        } else if (dragIndex !== null && dragIndex >= 0) {
          updateWaypointsList(prev => {
            if (dragIndex >= prev.length) {
              return prev;
            }
            const next = [...prev];
            next[dragIndex] = t;
            return next;
          });
        }
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
        if (mode === "selectStart") setStartPosition(t);
        else if (mode === "addWaypoint") updateWaypointsList((prev) => [...prev, t]);
        else if (mode === "setEnd") updateWaypointsList((prev) => (prev.length ? [...prev.slice(0, -1), t] : [t]));
        else if (mode === "scan") addScan(t);
        else if (mode === "entrench") toggleEntrench(t);
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
        focusHex(q, r);
    }
  };

  return (
    <div className="relative w-full h-full flex flex-col rounded-2xl overflow-hidden border border-slate-800/80 bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950 text-slate-50 shadow-2xl">
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_top,_rgba(56,189,248,0.12),_transparent_65%)]" />
      <div className="relative z-10 border-b border-slate-800/60 bg-slate-900/70 backdrop-blur-lg">
        <div className="px-3 py-3 flex flex-wrap items-center gap-3 justify-between">
          <div className="flex items-center gap-3">
            <span className="text-2xl leading-none drop-shadow-lg">🗺️</span>
            <div className="flex flex-col leading-tight">
              <span className="font-semibold text-lg sm:text-xl tracking-wide text-yellow-200">Weltkarte</span>
              <span className="text-[11px] uppercase tracking-[0.35em] text-slate-400">Lebendige Aufklärung</span>
            </div>
          </div>
          <div className="flex items-center gap-2 text-xs sm:text-sm bg-slate-900/60 px-3 py-2 rounded-xl border border-slate-700/70 shadow-inner">
            <input
              type="number"
              placeholder="X"
              value={jumpQ}
              onChange={(e) => setJumpQ(e.target.value)}
              className="w-16 bg-slate-800/80 px-2 py-1 rounded-md border border-slate-700 focus:ring-2 focus:ring-emerald-400 outline-none text-slate-100"
            />
            <input
              type="number"
              placeholder="Y"
              value={jumpR}
              onChange={(e) => setJumpR(e.target.value)}
              className="w-16 bg-slate-800/80 px-2 py-1 rounded-md border border-slate-700 focus:ring-2 focus:ring-emerald-400 outline-none text-slate-100"
            />
            <button
              onClick={handleJump}
              className="px-3 py-1 rounded-lg bg-gradient-to-r from-emerald-500 via-emerald-400 to-teal-400 text-slate-900 font-semibold shadow hover:from-emerald-400 hover:via-emerald-300 hover:to-teal-300 transition-colors"
            >
              Gehe zu
            </button>
          </div>
          <div className="flex items-center gap-4 text-xs sm:text-sm text-slate-300">
            <span>Zoom: <span className="text-emerald-300 font-semibold">{Math.round(zoom * 100)}%</span></span>
            <span className="hidden sm:inline">Hover: {hoveredHex ? `(${hoveredHex.q}, ${hoveredHex.r})` : '—'}</span>
          </div>
        </div>
        <div className="hidden sm:flex flex-wrap gap-4 px-3 pb-3 text-xs text-slate-300/90">
          <span className="flex items-center gap-1"><span className="text-emerald-300">🖱️ Ziehen</span> zum Verschieben</span>
          <span className="flex items-center gap-1"><span className="text-sky-300">Mausrad</span> oder <span className="text-sky-300">+/-</span> zum Zoomen</span>
          <span className="flex items-center gap-1"><span className="text-fuchsia-300">Shift + Klick</span> für präzise Wegpunkte</span>
          <span className="flex items-center gap-1"><span className="text-amber-300">🎯</span> zentriert auf dein Dorf</span>
        </div>
      </div>
      <div className="relative flex-1">
        <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_center,_rgba(8,47,73,0.32),_transparent_75%)]" />
        <canvas
          ref={canvasRef}
          className="relative z-10 w-full h-full touch-none"
          onPointerDown={onPointerDown}
          onPointerMove={onPointerMove}
          onPointerUp={onPointerUp}
          onPointerCancel={onPointerUp}
          onWheel={onWheel}
          onClick={onClick}
        />
        <div className="absolute top-3 right-3 z-20 flex flex-col items-end gap-3">
          <div className="p-3 bg-slate-900/85 border border-slate-700/60 rounded-xl shadow-lg backdrop-blur-md text-xs space-y-2 min-w-[140px]">
            <h4 className="text-[11px] uppercase tracking-[0.2em] text-slate-400">Overlays</h4>
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                className="toggle toggle-xs"
                checked={showOverlay.fog}
                onChange={(e) => setShowOverlay({ ...showOverlay, fog: e.target.checked })}
              />
              Nebel
            </label>
            <div className="flex flex-col gap-1 text-[11px] text-slate-300">
              <span>ETA: <span className="text-emerald-300">{formatETA(route.etaTotal)}</span></span>
              <span>Distanz: <span className="text-emerald-300">{routeDistance}</span> Felder</span>
            </div>
          </div>
          <div className="p-2 bg-slate-900/85 border border-slate-700/60 rounded-xl shadow-lg backdrop-blur-md text-[10px] uppercase tracking-[0.3em] text-slate-400 flex flex-col items-center gap-2">
            <canvas
              ref={miniMapRef}
              className="w-[180px] h-[140px] rounded-lg border border-slate-700/60 bg-slate-950/80 shadow-inner"
            />
            <span>Mini-Karte</span>
          </div>
        </div>
        <div className="hidden lg:flex flex-col gap-3 absolute top-1/2 left-3 z-20 -translate-y-1/2 bg-slate-900/75 border border-slate-700/60 rounded-xl p-3 text-xs max-w-xs backdrop-blur-md shadow-lg">
          <div>
            <h4 className="text-sm font-semibold text-emerald-300 mb-2">Eigene Dörfer</h4>
            <div className="space-y-1">
              {gameState.villages.map((v) => (
                <button
                  key={v.id}
                  onClick={() => focusHex(v.x, v.y)}
                  className="w-full text-left px-2 py-1 rounded-lg bg-slate-800/70 hover:bg-emerald-700/70 transition-colors"
                >
                  {v.name} ({v.x}|{v.y})
                </button>
              ))}
            </div>
          </div>
          <div>
            <h4 className="text-sm font-semibold text-rose-300 mb-2">Gegner & Ziele</h4>
            <div className="space-y-1">
              {dummyOpponents.map((v) => (
                <button
                  key={v.id}
                  onClick={() => focusHex(v.x, v.y)}
                  className="w-full text-left px-2 py-1 rounded-lg bg-slate-800/60 hover:bg-rose-600/70 transition-colors"
                >
                  {v.name} ({v.x}|{v.y})
                </button>
              ))}
            </div>
          </div>
        </div>
        <div className="absolute top-16 right-3 z-20 flex flex-col gap-2">
          <button
            onClick={() => handleZoom(1)}
            className="w-9 h-9 bg-slate-900/80 border border-slate-700/60 rounded-lg shadow-lg flex items-center justify-center text-lg hover:bg-slate-800 transition-colors"
            aria-label="Hineinzoomen"
          >
            +
          </button>
          <button
            onClick={() => handleZoom(-1)}
            className="w-9 h-9 bg-slate-900/80 border border-slate-700/60 rounded-lg shadow-lg flex items-center justify-center text-lg hover:bg-slate-800 transition-colors"
            aria-label="Herauszoomen"
          >
            −
          </button>
          <button
            onClick={handleCenter}
            className="w-9 h-9 bg-gradient-to-br from-emerald-500/90 via-emerald-400/90 to-teal-400/90 border border-emerald-500/40 rounded-lg shadow-lg flex items-center justify-center text-lg text-slate-900 hover:from-emerald-400 hover:via-emerald-300 hover:to-teal-300 transition-colors"
            aria-label="Auf Dorf zentrieren"
          >
            🎯
          </button>
        </div>
        {route.path.length > 0 && (
          <div className="absolute top-3 left-3 z-20 p-3 bg-slate-900/85 border border-slate-700/60 rounded-xl shadow-lg backdrop-blur-md text-sm space-y-2 max-w-xs">
            {route.cost === Infinity ? (
              <span className="text-red-400">Kein Pfad möglich</span>
            ) : (
              <>
                <div className="flex flex-col gap-1">
                  <span className="font-semibold text-yellow-200">Reiseübersicht</span>
                  <span>ETA: {formatETA(route.etaTotal)}</span>
                  <span>Distanz: {routeDistance} Felder</span>
                  <span>Kosten: {route.cost.toFixed(1)}</span>
                </div>
                {route.segments.length > 1 && (
                  <div className="max-h-40 overflow-y-auto pr-1 space-y-1 border-t border-slate-700 pt-2">
                    {route.segments.map((segment, index) => (
                      <div key={`${segment.from.q}-${segment.from.r}-${index}`} className="flex flex-col">
                        <span className="text-xs">{index + 1}. ({segment.from.q}|{segment.from.r}) → ({segment.to.q}|{segment.to.r})</span>
                        <span className="text-[11px] text-slate-300">Kosten {segment.cost.toFixed(1)} • {formatETA(segment.eta)}</span>
                      </div>
                    ))}
                  </div>
                )}
              </>
            )}
          </div>
        )}
        <div className="absolute left-3 bottom-40 z-20 space-y-3 max-w-xs">
          {hoveredHex && hoveredTile && (
            <div className="p-3 bg-slate-900/85 border border-slate-700/60 rounded-xl text-xs space-y-1 backdrop-blur-md shadow-lg">
              <span className="text-yellow-200 font-semibold">Feld ({hoveredHex.q}|{hoveredHex.r})</span>
              <span>Terrain: {hoveredTile.terrain.label} · Kosten {hoveredTile.terrain.base.toFixed(2)}</span>
              <span>Sicht: {hoveredVisible ? 'Erkundet' : 'Nebel'}</span>
              <span>Besitzer: {hoveredTile.owner === 'ally' ? 'Eigenes Gebiet' : hoveredTile.owner === 'enemy' ? 'Feindlich' : 'Neutral'}</span>
              {hoveredVillage && <span>Dorf: {hoveredVillage.name}</span>}
            </div>
          )}
          <div className="p-3 bg-slate-900/85 border border-slate-700/60 rounded-xl text-xs backdrop-blur-md shadow-lg space-y-2">
            <h4 className="text-sm font-semibold text-slate-200">Terrain-Legende</h4>
            <div className="grid grid-cols-2 gap-2">
              {TERRAINS.map((terrain) => (
                <div key={terrain.key} className="flex items-center gap-2">
                  <span
                    className="h-3 w-3 rounded-full shadow"
                    style={{
                      background: `linear-gradient(135deg, ${terrain.palette[0]}, ${terrain.palette[1]}, ${terrain.palette[2]})`,
                      boxShadow: `0 0 8px ${terrain.accent}`,
                    }}
                  />
                  <span className="text-[11px]">{terrain.label}</span>
                </div>
              ))}
            </div>
            <div className="grid grid-cols-3 gap-2 pt-2 border-t border-slate-700/60">
              {(["ally", "enemy", "neutral"] as Owner[]).map((owner) => (
                <div key={owner} className="flex items-center gap-2">
                  <span
                    className="h-3 w-3 rounded-full shadow"
                    style={{
                      background: OWNER_STYLES[owner].fill,
                      boxShadow: `0 0 10px ${OWNER_STYLES[owner].glow}`,
                    }}
                  />
                  <span className="text-[11px]">
                    {owner === 'ally' ? 'Eigenes' : owner === 'enemy' ? 'Feindlich' : 'Neutral'}
                  </span>
                </div>
              ))}
            </div>
          </div>
        </div>
        <div className="absolute right-3 bottom-40 z-20 max-w-xs p-3 bg-slate-900/85 border border-slate-700/60 rounded-xl shadow-lg backdrop-blur-md text-xs space-y-2">
          <h4 className="text-sm font-semibold text-slate-200">Steuerungstipps</h4>
          <ul className="space-y-1 text-[11px] list-disc list-inside text-slate-300">
            <li>Pfeiltasten oder Ziehen zum Navigieren</li>
            <li>Doppelklick auf Start/Ziel verschiebt Wegpunkte</li>
            <li>Scan deckt {SCAN_RADIUS} Felder für 10 Sek. auf</li>
            <li>Verschanzen beschleunigt Abmarsch an diesem Feld</li>
          </ul>
        </div>
        <div className="absolute bottom-0 inset-x-0 z-30 bg-slate-950/95 border-t border-slate-800/70">
          <div className="max-w-6xl mx-auto px-4 py-3 space-y-3">
            <div className="grid gap-3 lg:grid-cols-[minmax(0,1.1fr)_minmax(0,1.4fr)]">
              <div className="bg-slate-900/70 border border-slate-800/70 rounded-xl p-3 text-xs text-slate-300">
                <div className="flex items-center justify-between uppercase tracking-[0.3em] text-slate-500 text-[10px]">
                  <span>Aktive Route</span>
                  <span>{routePoints.length ? `${routePoints.length} Punkte` : 'Keine Route'}</span>
                </div>
                <div className="mt-2 grid grid-cols-2 sm:grid-cols-4 gap-2">
                  <div className="bg-slate-900/60 rounded-lg px-2 py-1">
                    <span className="block text-[10px] uppercase tracking-[0.25em] text-slate-500">Start</span>
                    <span className="text-sm text-slate-100">{start ? `${start.q}|${start.r}` : '—'}</span>
                  </div>
                  <div className="bg-slate-900/60 rounded-lg px-2 py-1">
                    <span className="block text-[10px] uppercase tracking-[0.25em] text-slate-500">Ziel</span>
                    <span className="text-sm text-slate-100">{routePoints.length > 0 ? `${routePoints[routePoints.length - 1].q}|${routePoints[routePoints.length - 1].r}` : '—'}</span>
                  </div>
                  <div className="bg-slate-900/60 rounded-lg px-2 py-1">
                    <span className="block text-[10px] uppercase tracking-[0.25em] text-slate-500">Distanz</span>
                    <span className="text-sm text-emerald-300">{routeMetrics.distance}</span>
                  </div>
                  <div className="bg-slate-900/60 rounded-lg px-2 py-1">
                    <span className="block text-[10px] uppercase tracking-[0.25em] text-slate-500">ETA</span>
                    <span className="text-sm text-emerald-300">{routeMetrics.etaSeconds === Infinity ? '—' : formatETA(routeMetrics.etaSeconds)}</span>
                  </div>
                </div>
                <div className="mt-2 bg-slate-900/60 rounded-lg px-2 py-1">
                  <span className="block text-[10px] uppercase tracking-[0.25em] text-slate-500">Kosten</span>
                  <span className="text-sm text-amber-300">{Number.isFinite(routeMetrics.totalCost) ? routeMetrics.totalCost.toFixed(1) : '—'}</span>
                </div>
              </div>
              <div className="bg-slate-900/70 border border-slate-800/70 rounded-xl p-3 text-xs text-slate-300">
                <div className="flex items-center justify-between gap-3 mb-2">
                  <h4 className="uppercase tracking-[0.3em] text-[10px] text-slate-500">Routenpunkte</h4>
                  <div className="flex gap-2">
                    <button
                      onClick={undoWaypoint}
                      disabled={waypoints.length === 0}
                      className={`px-2 py-1 rounded-lg border border-slate-700/70 transition-colors ${waypoints.length === 0 ? 'text-slate-600 cursor-not-allowed' : 'hover:bg-slate-800/80'}`}
                    >
                      Rückgängig
                    </button>
                    <button
                      onClick={clearRoute}
                      className="px-2 py-1 rounded-lg border border-slate-700/70 hover:bg-slate-800/80 transition-colors"
                    >
                      Zurücksetzen
                    </button>
                  </div>
                </div>
                <div className="flex flex-wrap gap-2 max-h-24 overflow-y-auto pr-1">
                  {routePoints.length === 0 && (
                    <span className="text-[11px] text-slate-500">Keine Punkte gesetzt.</span>
                  )}
                  {routePoints.map((point, index) => {
                    const isStartPoint = start && point.q === start.q && point.r === start.r;
                    const label = isStartPoint ? 'Start' : index === routePoints.length - 1 ? 'Ziel' : `WP ${index}`;
                    return (
                      <div
                        key={`${point.q}-${point.r}-${index}`}
                        className="flex items-center gap-1 bg-slate-900/80 border border-slate-800/80 rounded-lg px-2 py-1 shadow-inner"
                        onMouseEnter={() => setHoveredHex(point)}
                        onMouseLeave={() => setHoveredHex(null)}
                      >
                        <button
                          onClick={() => focusHex(point.q, point.r)}
                          className="text-xs text-slate-200 hover:text-emerald-300 transition-colors"
                        >
                          {label} ({point.q}|{point.r})
                        </button>
                        {index > 0 && (
                          <button
                            onClick={() => handleRemovePoint(index)}
                            className="text-slate-500 hover:text-rose-400 transition-colors"
                            aria-label="Punkt entfernen"
                          >
                            ✕
                          </button>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-2 text-xs">
              <button
                className={`py-2 rounded-lg flex flex-col items-center gap-1 transition-colors shadow ${mode === 'selectStart' ? 'bg-emerald-500/80 text-slate-900 font-semibold' : 'bg-slate-800/90 hover:bg-slate-700'}`}
                onClick={() => setMode('selectStart')}
              >
                ▶️ Start
              </button>
              <button
                className={`py-2 rounded-lg flex flex-col items-center gap-1 transition-colors shadow ${mode === 'addWaypoint' ? 'bg-emerald-500/80 text-slate-900 font-semibold' : 'bg-slate-800/90 hover:bg-slate-700'}`}
                onClick={() => setMode('addWaypoint')}
              >
                ➕ Wegpunkt
              </button>
              <button
                className={`py-2 rounded-lg flex flex-col items-center gap-1 transition-colors shadow ${mode === 'setEnd' ? 'bg-emerald-500/80 text-slate-900 font-semibold' : 'bg-slate-800/90 hover:bg-slate-700'}`}
                onClick={() => setMode('setEnd')}
              >
                🏁 Ende
              </button>
              <button
                className={`py-2 rounded-lg flex flex-col items-center gap-1 transition-colors shadow ${mode === 'scan' ? 'bg-emerald-500/80 text-slate-900 font-semibold' : 'bg-slate-800/90 hover:bg-slate-700'}`}
                onClick={() => setMode('scan')}
              >
                📡 Scan
              </button>
              <button
                className={`py-2 rounded-lg flex flex-col items-center gap-1 transition-colors shadow ${mode === 'entrench' ? 'bg-emerald-500/80 text-slate-900 font-semibold' : 'bg-slate-800/90 hover:bg-slate-700'}`}
                onClick={() => setMode('entrench')}
              >
                🛡️ Verschanzen
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export default WorldMapView;