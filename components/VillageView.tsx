import React from 'react';
import { GameState } from '../types';
import BuildingComponent from './Building';
import { gameConfig } from '../constants';
import { WoodIcon, ClayIcon, IronIcon } from './Icons';
import { ResourceType } from '../types';

interface VillageViewProps {
  gameState: GameState;
  setGameState: React.Dispatch<React.SetStateAction<GameState>>;
}

const VillageView: React.FC<VillageViewProps> = ({ gameState, setGameState }) => {
  const village = gameState.villages[0];

  const production = {
    [ResourceType.Wood]: 0,
    [ResourceType.Clay]: 0,
    [ResourceType.Iron]: 0,
  };

  village.buildings.forEach(building => {
    if (building.level > 0) {
        const buildingConfig = gameConfig.buildings[building.type];
        if('production' in buildingConfig && 'resourceType' in buildingConfig) {
             production[buildingConfig.resourceType] += buildingConfig.production[building.level - 1];
        }
    }
  });

  return (
    <div className="bg-gray-800 bg-opacity-50 p-6 rounded-lg shadow-2xl border border-gray-700 backdrop-blur-sm">
      <h2 className="text-3xl font-bold mb-4 text-center text-yellow-300 font-medieval">{village.name}</h2>
      
      <div className="bg-gray-900 bg-opacity-50 p-3 rounded-lg mb-6 border border-gray-600">
        <h3 className="text-lg font-semibold text-center mb-2 text-gray-300 uppercase tracking-wider">Produktion pro Stunde</h3>
        <div className="flex justify-center items-center space-x-4 md:space-x-8">
          <div className="flex items-center" title="Holzproduktion">
            <WoodIcon className="h-6 w-6 text-yellow-700" />
            <span className="ml-2 text-lg font-bold text-white">{production.wood}/h</span>
          </div>
          <div className="flex items-center" title="Lehmproduktion">
            <ClayIcon className="h-6 w-6 text-orange-500" />
            <span className="ml-2 text-lg font-bold text-white">{production.clay}/h</span>
          </div>
          <div className="flex items-center" title="Eisenproduktion">
            <IronIcon className="h-6 w-6 text-gray-400" />
            <span className="ml-2 text-lg font-bold text-white">{production.iron}/h</span>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {village.buildings.map((building) => (
          <BuildingComponent
            key={building.id}
            building={building}
            gameState={gameState}
            setGameState={setGameState}
          />
        ))}
      </div>
    </div>
  );
};

export default VillageView;