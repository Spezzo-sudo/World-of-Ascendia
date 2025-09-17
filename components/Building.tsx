
import React from 'react';
import { GameState, Building as BuildingState, ResourceType, BuildingType } from '../types';
import { gameConfig } from '../constants';

interface BuildingProps {
  building: BuildingState;
  gameState: GameState;
  setGameState: React.Dispatch<React.SetStateAction<GameState>>;
}

const BuildingComponent: React.FC<BuildingProps> = ({ building, gameState, setGameState }) => {
  const config = gameConfig.buildings[building.type];
  const nextLevel = building.level + 1;
  const isMaxLevel = building.level >= config.maxLevel;

  const woodCost = config.cost[ResourceType.Wood][building.level] ?? Infinity;
  const clayCost = config.cost[ResourceType.Clay][building.level] ?? Infinity;
  const ironCost = config.cost[ResourceType.Iron][building.level] ?? Infinity;

  const canAfford = !isMaxLevel &&
    gameState.resources[ResourceType.Wood] >= woodCost &&
    gameState.resources[ResourceType.Clay] >= clayCost &&
    gameState.resources[ResourceType.Iron] >= ironCost;

  const handleUpgrade = () => {
    if (!canAfford || isMaxLevel) return;

    setGameState(prevState => {
      const villageIndex = prevState.villages.findIndex(village =>
        village.buildings.some(b => b.id === building.id)
      );
      if (villageIndex === -1) {
        return prevState;
      }

      const village = prevState.villages[villageIndex];
      const buildingState = village.buildings.find(b => b.id === building.id);
      if (!buildingState) {
        return prevState;
      }

      const currentLevel = buildingState.level;
      const nextLevel = currentLevel + 1;

      const resources = {
        ...prevState.resources,
        [ResourceType.Wood]: prevState.resources[ResourceType.Wood] - woodCost,
        [ResourceType.Clay]: prevState.resources[ResourceType.Clay] - clayCost,
        [ResourceType.Iron]: prevState.resources[ResourceType.Iron] - ironCost,
      };

      const updatedBuildings = village.buildings.map(b =>
        b.id === building.id ? { ...b, level: nextLevel } : { ...b }
      );

      const villages = prevState.villages.map((v, idx) =>
        idx === villageIndex ? { ...v, buildings: updatedBuildings } : v
      );

      let warehouseCapacity = prevState.warehouseCapacity;
      if (building.type === BuildingType.Warehouse) {
        const warehouseConfig = gameConfig.buildings[BuildingType.Warehouse];
        const recomputedCapacity = villages.reduce((max, villageState) => {
          const warehouse = villageState.buildings.find(b => b.type === BuildingType.Warehouse);
          if (!warehouse || !warehouseConfig.capacity) {
            return max;
          }
          const idx = Math.max(0, Math.min(warehouse.level - 1, warehouseConfig.capacity.length - 1));
          return Math.max(max, warehouseConfig.capacity[idx]);
        }, warehouseConfig.capacity?.[0] ?? prevState.warehouseCapacity);
        warehouseCapacity = Math.max(recomputedCapacity, prevState.warehouseCapacity);
      }

      return {
        ...prevState,
        resources,
        villages,
        warehouseCapacity,
      };
    });
  };

  return (
    <div className="bg-gray-900 bg-opacity-70 p-4 rounded-lg border border-gray-600 shadow-lg transition-all duration-300 hover:border-yellow-400 hover:shadow-yellow-400/20">
      <div className="flex justify-between items-center mb-2">
        <h3 className="text-xl font-bold text-yellow-200">{config.name}</h3>
        <span className="text-lg font-bold bg-gray-700 px-3 py-1 rounded-full text-white">St. {building.level}</span>
      </div>
      <p className="text-gray-400 mb-4 h-12">{config.description}</p>
      
      {!isMaxLevel && (
        <div className="space-y-2">
          <p className="font-bold text-lg text-center">Ausbau auf Stufe {nextLevel}</p>
          <div className="text-sm space-y-1 bg-gray-800 p-2 rounded">
            <p className="flex justify-between"><span>Holz:</span> <span className={gameState.resources[ResourceType.Wood] < woodCost ? 'text-red-500' : 'text-green-400'}>{woodCost}</span></p>
            <p className="flex justify-between"><span>Lehm:</span> <span className={gameState.resources[ResourceType.Clay] < clayCost ? 'text-red-500' : 'text-green-400'}>{clayCost}</span></p>
            <p className="flex justify-between"><span>Eisen:</span> <span className={gameState.resources[ResourceType.Iron] < ironCost ? 'text-red-500' : 'text-green-400'}>{ironCost}</span></p>
            <p className="flex justify-between"><span>Dauer:</span> <span>{new Date(config.buildTime[building.level] * 1000).toISOString().substr(11, 8)}</span></p>
          </div>
          <button
            onClick={handleUpgrade}
            disabled={!canAfford}
            className={`w-full py-2 text-lg font-bold uppercase rounded transition-all duration-300 ${
              canAfford
                ? 'bg-yellow-600 hover:bg-yellow-500 text-gray-900'
                : 'bg-gray-700 text-gray-500 cursor-not-allowed'
            }`}
          >
            Ausbauen
          </button>
        </div>
      )}
      {isMaxLevel && (
          <p className="text-center font-bold text-green-400 mt-4">Maximale Stufe erreicht</p>
      )}
    </div>
  );
};

export default BuildingComponent;
