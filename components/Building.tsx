
import React from 'react';
import { GameState, Building as BuildingType, ResourceType } from '../types';
import { gameConfig } from '../constants';

interface BuildingProps {
  building: BuildingType;
  gameState: GameState;
  setGameState: React.Dispatch<React.SetStateAction<GameState>>;
}

const BuildingComponent: React.FC<BuildingProps> = ({ building, gameState, setGameState }) => {
  const config = gameConfig.buildings[building.type];
  const nextLevel = building.level + 1;
  const isMaxLevel = building.level >= config.maxLevel;

  const canAfford = !isMaxLevel &&
    gameState.resources.wood >= config.cost[ResourceType.Wood][building.level] &&
    gameState.resources.clay >= config.cost[ResourceType.Clay][building.level] &&
    gameState.resources.iron >= config.cost[ResourceType.Iron][building.level];
    
  const handleUpgrade = () => {
    if (!canAfford || isMaxLevel) return;

    setGameState(prevState => {
      const newState = { ...prevState };
      newState.resources.wood -= config.cost[ResourceType.Wood][building.level];
      newState.resources.clay -= config.cost[ResourceType.Clay][building.level];
      newState.resources.iron -= config.cost[ResourceType.Iron][building.level];

      const village = newState.villages.find(v => v.id === 1)!;
      const b = village.buildings.find(b => b.id === building.id)!;
      b.level += 1;
      
      if (building.type === 'warehouse') {
        newState.warehouseCapacity = gameConfig.buildings.warehouse.capacity[b.level - 1];
      }

      return newState;
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
            <p className="flex justify-between"><span>Holz:</span> <span className={gameState.resources.wood < config.cost.wood[building.level] ? 'text-red-500' : 'text-green-400'}>{config.cost.wood[building.level]}</span></p>
            <p className="flex justify-between"><span>Lehm:</span> <span className={gameState.resources.clay < config.cost.clay[building.level] ? 'text-red-500' : 'text-green-400'}>{config.cost.clay[building.level]}</span></p>
            <p className="flex justify-between"><span>Eisen:</span> <span className={gameState.resources.iron < config.cost.iron[building.level] ? 'text-red-500' : 'text-green-400'}>{config.cost.iron[building.level]}</span></p>
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
