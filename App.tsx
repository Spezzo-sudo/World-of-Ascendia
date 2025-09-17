import React, { useState, useEffect, useCallback } from 'react';
import { GameState, BuildingType, UnitType, ResourceType, ArmyMovement, Unit } from './types';
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

  const cloneVillages = useCallback((villages: GameState['villages']) =>
    villages.map(village => ({
      ...village,
      buildings: village.buildings.map(building => ({ ...building })),
      units: village.units.map(unit => ({ ...unit })),
    })), []);

  const mergeUnits = useCallback((existing: Unit[], incoming: Unit[]) => {
    const incomingMap = new Map<UnitType, number>();
    incoming.forEach(unit => {
      incomingMap.set(unit.type, (incomingMap.get(unit.type) ?? 0) + unit.count);
    });

    const merged: Unit[] = existing.map(unit => ({
      ...unit,
      count: unit.count + (incomingMap.get(unit.type) ?? 0),
    })).filter(unit => unit.count > 0);

    merged.forEach(unit => {
      if (incomingMap.has(unit.type)) {
        incomingMap.delete(unit.type);
      }
    });

    incomingMap.forEach((count, type) => {
      if (count > 0) {
        merged.push({ type, count });
      }
    });

    return merged;
  }, []);

  type CombatSlices = Pick<GameState, 'villages' | 'armyMovements' | 'combatReports'>;

  const resolveCombat = useCallback((slices: CombatSlices, movement: ArmyMovement): CombatSlices => {
    const attackerIndex = slices.villages.findIndex(village => village.id === movement.originVillage.id);
    const defender = dummyOpponents.find(village => village.id === movement.targetVillage.id);

    if (attackerIndex === -1 || !defender) {
      return slices;
    }

    const attackerPower = movement.units.reduce((sum, unit) => (
      sum + unit.count * gameConfig.units[unit.type].attack
    ), 0) * (Math.random() * 0.2 + 0.9);

    const wall = defender.buildings.find(building => building.type === BuildingType.Wall);
    const wallBonus = wall && wall.level > 0
      ? gameConfig.buildings.wall.defenseBonus[wall.level - 1]
      : 0;

    const defenderPower = defender.units.reduce((sum, unit) => (
      sum + unit.count * gameConfig.units[unit.type].defense
    ), 0) * (1 + wallBonus);

    const powerRatio = attackerPower / defenderPower;

    const attackerLosses: Unit[] = [];
    const defenderLosses: Unit[] = [];
    const survivingAttackers: Unit[] = [];
    const plunderedResources: Record<ResourceType, number> = {
      [ResourceType.Wood]: 0,
      [ResourceType.Clay]: 0,
      [ResourceType.Iron]: 0,
    };
    let attackerWon = false;

    if (powerRatio > 1) {
      attackerWon = true;
      defender.units.forEach(unit => defenderLosses.push({ ...unit }));

      movement.units.forEach(unit => {
        const lossRate = 1 / powerRatio;
        const losses = Math.round(unit.count * lossRate);
        if (losses > 0) {
          attackerLosses.push({ type: unit.type, count: losses });
        }
        const survivors = unit.count - losses;
        if (survivors > 0) {
          survivingAttackers.push({ type: unit.type, count: survivors });
        }
      });

      const totalCarryCapacity = survivingAttackers.reduce((sum, unit) => (
        sum + unit.count * gameConfig.units[unit.type].carryCapacity
      ), 0);

      const availableResources: Record<ResourceType, number> = {
        [ResourceType.Wood]: 500,
        [ResourceType.Clay]: 500,
        [ResourceType.Iron]: 500,
      };

      let capacityLeft = totalCarryCapacity;
      ([ResourceType.Wood, ResourceType.Clay, ResourceType.Iron] as const).forEach(resourceType => {
        if (capacityLeft <= 0) {
          return;
        }
        const amountToPlunder = Math.min(capacityLeft, availableResources[resourceType] * 0.5);
        plunderedResources[resourceType] = Math.floor(amountToPlunder);
        capacityLeft -= amountToPlunder;
      });
    } else {
      movement.units.forEach(unit => {
        attackerLosses.push({ ...unit });
      });

      defender.units.forEach(unit => {
        const lossRate = powerRatio;
        const losses = Math.round(unit.count * lossRate);
        if (losses > 0) {
          defenderLosses.push({ type: unit.type, count: losses });
        }
      });
    }

    const attackerVillage = slices.villages[attackerIndex];

    const combatReports = [
      {
        id: `report-${Date.now()}`,
        attacker: attackerVillage.name,
        defender: defender.name,
        attackerUnits: movement.units.map(unit => ({ ...unit })),
        defenderUnits: defender.units.map(unit => ({ ...unit })),
        attackerLosses,
        defenderLosses,
        plunderedResources,
        timestamp: Date.now(),
        attackerWon,
      },
      ...slices.combatReports,
    ];

    if (combatReports.length > 20) {
      combatReports.length = 20;
    }

    let armyMovements = slices.armyMovements;
    if (survivingAttackers.length > 0) {
      const travelTime = movement.arrivalTime - movement.departureTime;
      const returnMovement: ArmyMovement = {
        id: `return-${movement.id}`,
        type: 'return',
        units: survivingAttackers.map(unit => ({ ...unit })),
        originVillage: {
          id: movement.targetVillage.id,
          x: movement.targetVillage.x,
          y: movement.targetVillage.y,
        },
        targetVillage: {
          id: attackerVillage.id,
          name: attackerVillage.name,
          x: attackerVillage.x,
          y: attackerVillage.y,
        },
        departureTime: movement.arrivalTime,
        arrivalTime: movement.arrivalTime + travelTime,
        plunderedResources: { ...plunderedResources },
      };
      armyMovements = [...slices.armyMovements, returnMovement];
    }

    return {
      villages: slices.villages,
      armyMovements,
      combatReports,
    };
  }, []);
  
  const gameTick = useCallback(() => {
    setGameState(prevState => {
      const now = Date.now();
      const elapsedSeconds = Math.max(0, (now - prevState.lastUpdate) / 1000);

      const villages = cloneVillages(prevState.villages);
      const resources = { ...prevState.resources };

      const production = {
        [ResourceType.Wood]: 0,
        [ResourceType.Clay]: 0,
        [ResourceType.Iron]: 0,
      };

      const playerVillage = prevState.villages[0];
      if (playerVillage) {
        playerVillage.buildings.forEach(building => {
          if (building.level > 0) {
            const buildingConfig = gameConfig.buildings[building.type];
            if ('production' in buildingConfig && buildingConfig.production && buildingConfig.resourceType) {
              production[buildingConfig.resourceType] += buildingConfig.production[building.level - 1];
            }
          }
        });
      }

      const clampResource = (value: number) => Math.min(prevState.warehouseCapacity, value);
      resources[ResourceType.Wood] = clampResource(
        prevState.resources[ResourceType.Wood] + (production[ResourceType.Wood] / 3600) * elapsedSeconds
      );
      resources[ResourceType.Clay] = clampResource(
        prevState.resources[ResourceType.Clay] + (production[ResourceType.Clay] / 3600) * elapsedSeconds
      );
      resources[ResourceType.Iron] = clampResource(
        prevState.resources[ResourceType.Iron] + (production[ResourceType.Iron] / 3600) * elapsedSeconds
      );

      const arrivedMovements = prevState.armyMovements
        .filter(movement => now >= movement.arrivalTime)
        .map(movement => ({
          ...movement,
          units: movement.units.map(unit => ({ ...unit })),
          plunderedResources: movement.plunderedResources
            ? { ...movement.plunderedResources }
            : undefined,
        }));

      let armyMovements = prevState.armyMovements
        .filter(movement => now < movement.arrivalTime)
        .map(movement => ({
          ...movement,
          units: movement.units.map(unit => ({ ...unit })),
          plunderedResources: movement.plunderedResources
            ? { ...movement.plunderedResources }
            : undefined,
        }));

      let combatReports = prevState.combatReports.slice();

      arrivedMovements.forEach(movement => {
        if (movement.type === 'attack') {
          const result = resolveCombat({ villages, armyMovements, combatReports }, movement);
          armyMovements = result.armyMovements;
          combatReports = result.combatReports;
        } else if (movement.type === 'return') {
          const villageIndex = villages.findIndex(village => village.id === movement.targetVillage.id);
          if (villageIndex !== -1) {
            const updatedVillage = {
              ...villages[villageIndex],
              units: mergeUnits(villages[villageIndex].units, movement.units),
            };
            villages[villageIndex] = updatedVillage;

            if (movement.plunderedResources) {
              resources[ResourceType.Wood] = clampResource(
                resources[ResourceType.Wood] + movement.plunderedResources[ResourceType.Wood]
              );
              resources[ResourceType.Clay] = clampResource(
                resources[ResourceType.Clay] + movement.plunderedResources[ResourceType.Clay]
              );
              resources[ResourceType.Iron] = clampResource(
                resources[ResourceType.Iron] + movement.plunderedResources[ResourceType.Iron]
              );
            }
          }
        }
      });

      return {
        ...prevState,
        resources,
        villages,
        armyMovements,
        combatReports,
        lastUpdate: now,
      };
    });
  }, [cloneVillages, mergeUnits, resolveCombat]);

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