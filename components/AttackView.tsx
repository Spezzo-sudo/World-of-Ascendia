import React, { useState, useMemo } from 'react';
import { GameState, Unit, UnitType, Village, ArmyMovement } from '../types';
import { dummyOpponents, gameConfig } from '../constants';

interface AttackViewProps {
  gameState: GameState;
  setGameState: React.Dispatch<React.SetStateAction<GameState>>;
}

const AttackView: React.FC<AttackViewProps> = ({ gameState, setGameState }) => {
  const playerVillage = gameState.villages[0];
  const [selectedTarget, setSelectedTarget] = useState<Village | null>(null);
  const [unitsToSend, setUnitsToSend] = useState<{ [key in UnitType]?: number }>({});

  const { start: mapStart, waypoints: mapWaypoints, routeMetrics } = gameState.mapState;

  const routePoints = useMemo(() => {
    if (!mapStart) {
      return mapWaypoints;
    }
    return [mapStart, ...mapWaypoints];
  }, [mapStart, mapWaypoints]);

  const mapRouteTarget = useMemo(() => {
    if (routePoints.length < 2) {
      return null;
    }
    const end = routePoints[routePoints.length - 1];
    return dummyOpponents.find(target => target.x === end.q && target.y === end.r) ?? null;
  }, [routePoints]);

  const handleUnitChange = (type: UnitType, value: number) => {
    const availableUnit = playerVillage.units.find(u => u.type === type);
    const maxCount = availableUnit ? availableUnit.count : 0;
    const sanitized = Number.isNaN(value) ? 0 : value;
    const newCount = Math.max(0, Math.min(maxCount, sanitized));
    setUnitsToSend(prev => ({ ...prev, [type]: newCount }));
  };

  const { travelTime, slowestSpeed } = useMemo(() => {
    if (!selectedTarget) return { travelTime: 0, slowestSpeed: 0 };

    const sentUnits = Object.entries(unitsToSend).filter(([, count]) => count && count > 0);
    if (sentUnits.length === 0) return { travelTime: 0, slowestSpeed: 0 };

    const slowest = Math.min(...sentUnits.map(([type]) => gameConfig.units[type as UnitType].speed));
    
    const distance = Math.sqrt(
      Math.pow(playerVillage.x - selectedTarget.x, 2) + Math.pow(playerVillage.y - selectedTarget.y, 2)
    );
    
    const timeInHours = distance / slowest;
    return { travelTime: timeInHours * 3600 * 1000, slowestSpeed: slowest }; // in milliseconds
  }, [selectedTarget, unitsToSend, playerVillage.x, playerVillage.y]);

  const handleAttack = () => {
    if (!selectedTarget || travelTime <= 0) return;
    
    const unitsForAttack: Unit[] = Object.entries(unitsToSend)
      .filter(([, count]) => count && count > 0)
      .map(([type, count]) => ({ type: type as UnitType, count: count! }));

    if (unitsForAttack.length === 0) return;

    const now = Date.now();
    const newMovement: ArmyMovement = {
      id: `attack-${now}`,
      type: 'attack',
      units: unitsForAttack,
      originVillage: { id: playerVillage.id, x: playerVillage.x, y: playerVillage.y },
      targetVillage: { id: selectedTarget.id, name: selectedTarget.name, x: selectedTarget.x, y: selectedTarget.y },
      departureTime: now,
      arrivalTime: now + travelTime,
    };

    setGameState(prev => {
      const villageIndex = prev.villages.findIndex(v => v.id === playerVillage.id);
      if (villageIndex === -1) {
        return prev;
      }

      const village = prev.villages[villageIndex];
      const unitMap = new Map<UnitType, number>(unitsForAttack.map(u => [u.type, u.count]));
      const updatedUnits = village.units
        .map(unit => ({
          ...unit,
          count: unit.count - (unitMap.get(unit.type) ?? 0),
        }))
        .filter(unit => unit.count > 0);

      const villages = prev.villages.map((v, idx) =>
        idx === villageIndex ? { ...v, units: updatedUnits } : v
      );

      return {
        ...prev,
        villages,
        armyMovements: [...prev.armyMovements, newMovement],
      };
    });

    // Reset form
    setSelectedTarget(null);
    setUnitsToSend({});
  };

  const handleAdoptRoute = () => {
    if (mapRouteTarget) {
      setSelectedTarget(mapRouteTarget);
    }
  };
  
  const formatDuration = (ms: number) => new Date(Math.max(ms, 0)).toISOString().substr(11, 8);

  return (
    <div className="bg-gray-800 bg-opacity-50 p-6 rounded-lg shadow-2xl border border-gray-700 backdrop-blur-sm">
      <h2 className="text-3xl font-bold mb-4 text-center text-yellow-300 font-medieval">Angriffszentrum</h2>
      
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Attack Planner */}
        <div className="bg-gray-900 bg-opacity-60 p-4 rounded-lg border border-gray-600">
          <h3 className="text-xl font-semibold mb-3 text-yellow-200">Angriff planen</h3>

          {routePoints.length > 1 && (
            <div className="mb-4 bg-gray-800/70 border border-gray-600 rounded-lg p-3 text-sm text-gray-300">
              <div className="flex items-center justify-between gap-2">
                <span className="font-semibold text-yellow-200">Route aus Karte</span>
                {mapRouteTarget && (
                  <button
                    onClick={handleAdoptRoute}
                    className="px-2 py-1 rounded-md bg-emerald-600 text-gray-900 font-semibold text-xs hover:bg-emerald-500 transition-colors"
                  >
                    Ziel übernehmen
                  </button>
                )}
              </div>
              <div className="mt-2 grid grid-cols-2 gap-2 text-xs text-gray-400">
                <span>Start: {`${routePoints[0].q}|${routePoints[0].r}`}</span>
                <span>Ziel: {`${routePoints[routePoints.length - 1].q}|${routePoints[routePoints.length - 1].r}`}</span>
                <span>Distanz: {routeMetrics.distance}</span>
                <span>ETA: {routeMetrics.etaSeconds === Infinity ? '—' : formatDuration(routeMetrics.etaSeconds * 1000)}</span>
                <span>Kosten: {Number.isFinite(routeMetrics.totalCost) ? routeMetrics.totalCost.toFixed(1) : '—'}</span>
                <span>{mapRouteTarget ? `Vorschlag: ${mapRouteTarget.name}` : 'Kein passendes Ziel gefunden'}</span>
              </div>
            </div>
          )}

          <div className="mb-4">
            <label className="block text-gray-300 mb-1">Ziel wählen:</label>
            <select
                onChange={(e) => setSelectedTarget(dummyOpponents.find(o => o.id === parseInt(e.target.value)) || null)}
                value={selectedTarget?.id || ""}
                className="w-full p-2 bg-gray-700 rounded border border-gray-500 text-white"
            >
              <option value="">-- Ziel auswählen --</option>
              {dummyOpponents.map(o => (
                <option key={o.id} value={o.id}>{o.name} ({o.x}|{o.y})</option>
              ))}
            </select>
          </div>

          <div className="mb-4">
            <h4 className="text-gray-300 mb-2">Truppen senden:</h4>
            <div className="space-y-2">
              {playerVillage.units.map(unit => (
                <div key={unit.type} className="flex items-center justify-between">
                  <label htmlFor={`unit-${unit.type}`} className="text-gray-300">{gameConfig.units[unit.type].name} ({unit.count})</label>
                  <input
                    type="number"
                    id={`unit-${unit.type}`}
                    value={unitsToSend[unit.type] || 0}
                    onChange={(e) => handleUnitChange(unit.type, parseInt(e.target.value))}
                    className="w-24 p-1 bg-gray-700 rounded border border-gray-500 text-white text-right"
                  />
                </div>
              ))}
            </div>
          </div>
          
          {selectedTarget && (
            <div className="bg-gray-800 p-3 rounded mt-4">
              <p className="flex justify-between"><span>Entfernung:</span> <span>{Math.sqrt(Math.pow(playerVillage.x - selectedTarget.x, 2) + Math.pow(playerVillage.y - selectedTarget.y, 2)).toFixed(2)} Felder</span></p>
              <p className="flex justify-between"><span>Langsamste Einheit:</span> <span>{slowestSpeed} Felder/h</span></p>
              <p className="flex justify-between"><span>Reisezeit:</span> <span>{formatDuration(travelTime)}</span></p>
            </div>
          )}

          <button
            onClick={handleAttack}
            disabled={!selectedTarget || travelTime <= 0}
            className="w-full mt-4 py-2 text-lg font-bold uppercase rounded transition-all duration-300 bg-red-700 hover:bg-red-600 disabled:bg-gray-600 disabled:cursor-not-allowed"
          >
            Angriff starten
          </button>
        </div>

        {/* Movements & Reports */}
        <div className="space-y-4">
          <div className="bg-gray-900 bg-opacity-60 p-4 rounded-lg border border-gray-600">
             <h3 className="text-xl font-semibold mb-3 text-yellow-200">Truppenbewegungen</h3>
             <div className="max-h-40 overflow-y-auto">
                {gameState.armyMovements.length === 0 ? <p className="text-gray-400">Keine aktiven Bewegungen.</p> :
                  gameState.armyMovements.map(m => (
                    <div key={m.id} className="text-sm p-2 bg-gray-800 rounded mb-2">
                      <p><strong>{m.type === 'attack' ? 'Angriff auf' : 'Rückkehr von'} {m.targetVillage.name}</strong></p>
                      <p>Ankunft in: {formatDuration(m.arrivalTime - Date.now())}</p>
                    </div>
                  ))
                }
             </div>
          </div>
          <div className="bg-gray-900 bg-opacity-60 p-4 rounded-lg border border-gray-600">
             <h3 className="text-xl font-semibold mb-3 text-yellow-200">Kampfberichte</h3>
             <div className="max-h-48 overflow-y-auto">
                {gameState.combatReports.length === 0 ? <p className="text-gray-400">Keine Berichte vorhanden.</p> :
                  gameState.combatReports.map(r => (
                    <div key={r.id} className={`text-sm p-2 border-l-4 ${r.attackerWon ? 'border-green-500' : 'border-red-500'} bg-gray-800 rounded mb-2`}>
                      <p><strong>{r.attackerWon ? 'Sieg' : 'Niederlage'}</strong> gegen {r.defender}</p>
                      <p className="text-gray-400">{new Date(r.timestamp).toLocaleString()}</p>
                    </div>
                  ))
                }
             </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default AttackView;