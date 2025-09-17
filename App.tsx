import React, { useState, useEffect, useCallback } from 'react';
import { GameState, Building, BuildingType, UnitType, ResourceType, ArmyMovement, Unit } from './types';
import { gameConfig, initialGameState, dummyOpponents } from './constants';
import Header from './components/Header';
import VillageView from './components/VillageView';
import WorldMapView from './components/WorldMapView';
import ArmyView from './components/ArmyView';
import TribeView from './components/TribeView';
import AttackView from './components/AttackView';
import Footer from './components/Footer';

type View = 'village' | 'map' | 'army' | 'tribe' | 'attack';

const App: React.FC = () => {
  const [gameState, setGameState] = useState<GameState>(initialGameState);
  const [activeView, setActiveView] = useState<View>('village');

  const resolveCombat = useCallback((movement: ArmyMovement) => {
    setGameState(prevState => {
      const newState = { ...prevState };
      const attacker = newState.villages.find(v => v.id === movement.originVillage.id);
      const defender = dummyOpponents.find(v => v.id === movement.targetVillage.id);

      if (!attacker || !defender) return newState;

      const attackerPower = movement.units.reduce((sum, unit) => {
        return sum + unit.count * gameConfig.units[unit.type].attack;
      }, 0) * (Math.random() * 0.2 + 0.9); // +/- 10% randomness

      const wall = defender.buildings.find(b => b.type === BuildingType.Wall);
      const wallBonus = wall && wall.level > 0 ? gameConfig.buildings.wall.defenseBonus[wall.level - 1] : 0;
      
      const defenderPower = defender.units.reduce((sum, unit) => {
        return sum + unit.count * gameConfig.units[unit.type].defense;
      }, 0) * (1 + wallBonus);
      
      const powerRatio = attackerPower / defenderPower;
      
      const attackerLosses: Unit[] = [];
      const defenderLosses: Unit[] = [];
      const survivingAttackers: Unit[] = [];
      let plunderedResources = { [ResourceType.Wood]: 0, [ResourceType.Clay]: 0, [ResourceType.Iron]: 0 };
      let attackerWon = false;

      if (powerRatio > 1) { // Attacker wins
        attackerWon = true;
        defender.units.forEach(u => defenderLosses.push({ ...u }));

        movement.units.forEach(unit => {
          const lossRate = 1 / powerRatio;
          const losses = Math.round(unit.count * lossRate);
          if (losses > 0) attackerLosses.push({ type: unit.type, count: losses });
          const survivors = unit.count - losses;
          if (survivors > 0) survivingAttackers.push({ type: unit.type, count: survivors });
        });

        // Simplified plunder logic
        const totalCarryCapacity = survivingAttackers.reduce((sum, unit) => {
            return sum + unit.count * gameConfig.units[unit.type].carryCapacity;
        }, 0);
        
        // Assume defender has 500 of each resource for simulation
        const availableResources = { wood: 500, clay: 500, iron: 500 }; 
        let capacityLeft = totalCarryCapacity;

        Object.keys(availableResources).forEach((res) => {
            const resourceType = res as ResourceType;
            const amountToPlunder = Math.min(capacityLeft, availableResources[resourceType] * 0.5); // Can plunder up to 50%
            plunderedResources[resourceType] = Math.floor(amountToPlunder);
            capacityLeft -= amountToPlunder;
        });

      } else { // Defender wins
        movement.units.forEach(u => attackerLosses.push({ ...u }));
        
        defender.units.forEach(unit => {
          const lossRate = powerRatio;
          const losses = Math.round(unit.count * lossRate);
          if (losses > 0) defenderLosses.push({ type: unit.type, count: losses });
        });
      }

      // Create combat report
      const reportId = `report-${Date.now()}`;
      newState.combatReports.unshift({
          id: reportId,
          attacker: attacker.name,
          defender: defender.name,
          attackerUnits: movement.units,
          defenderUnits: [...defender.units],
          attackerLosses,
          defenderLosses,
          plunderedResources,
          timestamp: Date.now(),
          attackerWon,
      });
      if (newState.combatReports.length > 20) newState.combatReports.pop();

      // Create return trip if there are survivors
      if (survivingAttackers.length > 0) {
        const travelTime = movement.arrivalTime - movement.departureTime;
        const returnMovement: ArmyMovement = {
            id: `return-${movement.id}`,
            type: 'return',
            units: survivingAttackers,
            originVillage: movement.originVillage,
            targetVillage: movement.targetVillage,
            departureTime: movement.arrivalTime,
            arrivalTime: movement.arrivalTime + travelTime,
            plunderedResources,
        };
        newState.armyMovements.push(returnMovement);
      }
      
      return newState;
    });
  }, []);
  
  const gameTick = useCallback(() => {
    setGameState(prevState => {
      const now = Date.now();
      const elapsedSeconds = (now - prevState.lastUpdate) / 1000;
      const newState = { ...prevState };

      // 1. Resource Production
      const production = { [ResourceType.Wood]: 0, [ResourceType.Clay]: 0, [ResourceType.Iron]: 0 };
      prevState.villages[0].buildings.forEach(building => {
        if (building.level > 0) {
            const buildingConfig = gameConfig.buildings[building.type];
            if('production' in buildingConfig) {
                 production[buildingConfig.resourceType] += buildingConfig.production[building.level - 1];
            }
        }
      });
      newState.resources[ResourceType.Wood] = Math.min(prevState.warehouseCapacity, prevState.resources[ResourceType.Wood] + (production[ResourceType.Wood] / 3600) * elapsedSeconds);
      newState.resources[ResourceType.Clay] = Math.min(prevState.warehouseCapacity, prevState.resources[ResourceType.Clay] + (production[ResourceType.Clay] / 3600) * elapsedSeconds);
      newState.resources[ResourceType.Iron] = Math.min(prevState.warehouseCapacity, prevState.resources[ResourceType.Iron] + (production[ResourceType.Iron] / 3600) * elapsedSeconds);

      // 2. Army Movement & Combat Resolution
      const arrivedMovements = newState.armyMovements.filter(m => now >= m.arrivalTime);
      if (arrivedMovements.length > 0) {
        newState.armyMovements = newState.armyMovements.filter(m => now < m.arrivalTime);

        arrivedMovements.forEach(movement => {
          if (movement.type === 'attack') {
            resolveCombat(movement); // This will update state again, causing a re-render. We need to handle this carefully.
          } else if (movement.type === 'return') {
            const village = newState.villages.find(v => v.id === movement.originVillage.id);
            if(village) {
              movement.units.forEach(retUnit => {
                const existingUnit = village.units.find(vUnit => vUnit.type === retUnit.type);
                if (existingUnit) existingUnit.count += retUnit.count;
                else village.units.push(retUnit);
              });
              if(movement.plunderedResources) {
                newState.resources.wood = Math.min(newState.warehouseCapacity, newState.resources.wood + movement.plunderedResources.wood);
                newState.resources.clay = Math.min(newState.warehouseCapacity, newState.resources.clay + movement.plunderedResources.clay);
                newState.resources.iron = Math.min(newState.warehouseCapacity, newState.resources.iron + movement.plunderedResources.iron);
              }
            }
          }
        });
      }

      newState.lastUpdate = now;
      return newState;
    });
  }, [resolveCombat]);

  useEffect(() => {
    const gameInterval = setInterval(gameTick, 1000);
    return () => clearInterval(gameInterval);
  }, [gameTick]);

  const renderView = () => {
    switch (activeView) {
      case 'village': return <VillageView gameState={gameState} setGameState={setGameState} />;
      case 'map': return <WorldMapView gameState={gameState} />;
      case 'army': return <ArmyView />;
      case 'tribe': return <TribeView />;
      case 'attack': return <AttackView gameState={gameState} setGameState={setGameState} />;
      default: return <VillageView gameState={gameState} setGameState={setGameState} />;
    }
  };

  return (
    <div className="min-h-screen bg-cover bg-center bg-fixed" style={{backgroundImage: "url('https://picsum.photos/seed/bg/1920/1080')"}}>
      <div className="min-h-screen bg-black bg-opacity-70 flex flex-col">
        <Header resources={gameState.resources} warehouseCapacity={gameState.warehouseCapacity} />
        <nav className="bg-black bg-opacity-50 p-2 shadow-lg">
          <div className="container mx-auto flex justify-center space-x-2 md:space-x-8">
            <button onClick={() => setActiveView('village')} className={`px-3 py-2 text-base md:text-lg uppercase tracking-wider transition-all duration-300 ${activeView === 'village' ? 'text-yellow-400 border-b-2 border-yellow-400' : 'text-gray-300 hover:text-yellow-200'}`}>Dorf</button>
            <button onClick={() => setActiveView('map')} className={`px-3 py-2 text-base md:text-lg uppercase tracking-wider transition-all duration-300 ${activeView === 'map' ? 'text-yellow-400 border-b-2 border-yellow-400' : 'text-gray-300 hover:text-yellow-200'}`}>Karte</button>
            <button onClick={() => setActiveView('army')} className={`px-3 py-2 text-base md:text-lg uppercase tracking-wider transition-all duration-300 ${activeView === 'army' ? 'text-yellow-400 border-b-2 border-yellow-400' : 'text-gray-300 hover:text-yellow-200'}`}>Armee</button>
            <button onClick={() => setActiveView('attack')} className={`px-3 py-2 text-base md:text-lg uppercase tracking-wider transition-all duration-300 ${activeView === 'attack' ? 'text-yellow-400 border-b-2 border-yellow-400' : 'text-gray-300 hover:text-yellow-200'}`}>Angriff</button>
            <button onClick={() => setActiveView('tribe')} className={`px-3 py-2 text-base md:text-lg uppercase tracking-wider transition-all duration-300 ${activeView === 'tribe' ? 'text-yellow-400 border-b-2 border-yellow-400' : 'text-gray-300 hover:text-yellow-200'}`}>Stamm</button>
          </div>
        </nav>
        <main className="flex-grow container mx-auto p-4">
          {renderView()}
        </main>
        <Footer />
      </div>
    </div>
  );
};

export default App;