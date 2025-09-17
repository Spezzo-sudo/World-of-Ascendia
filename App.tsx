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

  const cloneOpponentStates = useCallback((opponents: GameState['opponentStates']) =>
    opponents.map(opponent => ({
      ...opponent,
      resources: { ...opponent.resources },
      productionPerHour: { ...opponent.productionPerHour },
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

  type CombatSlices = Pick<GameState, 'villages' | 'armyMovements' | 'combatReports' | 'opponentStates'>;

  const resolveCombat = useCallback((slices: CombatSlices, movement: ArmyMovement): CombatSlices => {
    const attackerIndex = slices.villages.findIndex(village => village.id === movement.originVillage.id);
    const defender = dummyOpponents.find(village => village.id === movement.targetVillage.id);

    if (attackerIndex === -1 || !defender) {
      return slices;
    }

    const opponentStates = slices.opponentStates.map(opponent => ({
      ...opponent,
      resources: { ...opponent.resources },
      productionPerHour: { ...opponent.productionPerHour },
    }));
    const opponentIndex = opponentStates.findIndex(state => state.id === movement.targetVillage.id);
    const opponent = opponentIndex !== -1 ? opponentStates[opponentIndex] : null;

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

      const availableResources: Record<ResourceType, number> = opponent
        ? { ...opponent.resources }
        : {
            [ResourceType.Wood]: 320,
            [ResourceType.Clay]: 320,
            [ResourceType.Iron]: 320,
          };

      let capacityLeft = totalCarryCapacity;
      ([ResourceType.Wood, ResourceType.Clay, ResourceType.Iron] as const).forEach(resourceType => {
        if (capacityLeft <= 0) {
          return;
        }
        const stock = availableResources[resourceType];
        if (stock <= 0) {
          return;
        }
        const amountToPlunder = Math.min(capacityLeft, stock);
        const taken = Math.floor(amountToPlunder);
        plunderedResources[resourceType] = taken;
        capacityLeft -= taken;
        availableResources[resourceType] = Math.max(0, stock - taken);
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

    if (opponent && attackerWon) {
      const updatedResources = { ...opponent.resources };
      ([ResourceType.Wood, ResourceType.Clay, ResourceType.Iron] as const).forEach(resourceType => {
        updatedResources[resourceType] = Math.max(0, updatedResources[resourceType] - plunderedResources[resourceType]);
      });
      opponentStates[opponentIndex] = { ...opponent, resources: updatedResources };
    }

    return {
      villages: slices.villages,
      armyMovements,
      combatReports,
      opponentStates,
    };
  }, []);
  
  const gameTick = useCallback(() => {
    setGameState(prevState => {
      const now = Date.now();
      const elapsedSeconds = Math.max(0, (now - prevState.lastUpdate) / 1000);

      const villages = cloneVillages(prevState.villages);
      const resources = { ...prevState.resources };
      let warehouseCapacity = gameConfig.buildings[BuildingType.Warehouse].capacity?.[0] ?? prevState.warehouseCapacity;
      let opponentStates = cloneOpponentStates(prevState.opponentStates);

      const production = {
        [ResourceType.Wood]: 0,
        [ResourceType.Clay]: 0,
        [ResourceType.Iron]: 0,
      };

      villages.forEach(village => {
        village.buildings.forEach(building => {
          if (building.level <= 0) {
            return;
          }
          const buildingConfig = gameConfig.buildings[building.type];
          if ('production' in buildingConfig && buildingConfig.production && buildingConfig.resourceType) {
            production[buildingConfig.resourceType] += buildingConfig.production[Math.min(building.level - 1, buildingConfig.production.length - 1)];
          }
          if (building.type === BuildingType.Warehouse && buildingConfig.capacity) {
            const idx = Math.max(0, Math.min(building.level - 1, buildingConfig.capacity.length - 1));
            warehouseCapacity = Math.max(warehouseCapacity, buildingConfig.capacity[idx]);
          }
        });
      });

      warehouseCapacity = Math.max(warehouseCapacity, prevState.warehouseCapacity);

      const clampResource = (value: number) => Math.min(warehouseCapacity, value);
      resources[ResourceType.Wood] = clampResource(
        Math.round(prevState.resources[ResourceType.Wood] + (production[ResourceType.Wood] / 3600) * elapsedSeconds)
      );
      resources[ResourceType.Clay] = clampResource(
        Math.round(prevState.resources[ResourceType.Clay] + (production[ResourceType.Clay] / 3600) * elapsedSeconds)
      );
      resources[ResourceType.Iron] = clampResource(
        Math.round(prevState.resources[ResourceType.Iron] + (production[ResourceType.Iron] / 3600) * elapsedSeconds)
      );

      opponentStates = opponentStates.map(opponent => {
        const updatedResources = { ...opponent.resources };
        ([ResourceType.Wood, ResourceType.Clay, ResourceType.Iron] as const).forEach(resourceType => {
          const regenPerSecond = opponent.productionPerHour[resourceType] / 3600;
          const regenerated = updatedResources[resourceType] + regenPerSecond * elapsedSeconds;
          updatedResources[resourceType] = Math.min(opponent.capacity, Math.round(regenerated));
        });
        return { ...opponent, resources: updatedResources };
      });

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
          const result = resolveCombat({ villages, armyMovements, combatReports, opponentStates }, movement);
          armyMovements = result.armyMovements;
          combatReports = result.combatReports;
          opponentStates = result.opponentStates;
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
        warehouseCapacity,
        opponentStates,
        lastUpdate: now,
      };
    });
  }, [cloneVillages, cloneOpponentStates, mergeUnits, resolveCombat]);

  useEffect(() => {
    const gameInterval = setInterval(gameTick, 1000);
    return () => clearInterval(gameInterval);
  }, [gameTick]);

  const renderView = () => {
    switch (activeView) {
      case 'village': return <VillageView gameState={gameState} setGameState={setGameState} />;
      case 'map': return <WorldMapView gameState={gameState} setGameState={setGameState} />;
      case 'army': return <ArmyView />;
      case 'tribe': return <TribeView />;
      case 'attack': return <AttackView gameState={gameState} setGameState={setGameState} />;
      default: return <VillageView gameState={gameState} setGameState={setGameState} />;
    }
  };

  const navItems: { key: View; label: string; icon: string; description: string }[] = [
    { key: 'village', label: 'Dorf', icon: '🏡', description: 'Ausbau & Ressourcen' },
    { key: 'map', label: 'Karte', icon: '🗺️', description: 'Navigation & Sicht' },
    { key: 'army', label: 'Armee', icon: '⚔️', description: 'Einheitenübersicht' },
    { key: 'attack', label: 'Angriff', icon: '🎯', description: 'Missionen planen' },
    { key: 'tribe', label: 'Stamm', icon: '🏰', description: 'Diplomatie & Bonus' },
  ];

  return (
    <div className="min-h-screen bg-cover bg-center bg-fixed" style={{backgroundImage: "url('https://picsum.photos/seed/bg/1920/1080')"}}>
      <div className="min-h-screen bg-black bg-opacity-70 flex flex-col">
        <Header resources={gameState.resources} warehouseCapacity={gameState.warehouseCapacity} />
        <nav className="bg-black/60 backdrop-blur-md border-b border-black/40">
          <div className="max-w-5xl mx-auto px-4 py-3">
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-2">
              {navItems.map(item => {
                const isActive = activeView === item.key;
                return (
                  <button
                    key={item.key}
                    onClick={() => setActiveView(item.key)}
                    className={`group flex items-center gap-3 rounded-xl border px-3 py-2 transition-all duration-300 shadow-lg ${
                      isActive
                        ? 'bg-emerald-500/85 border-emerald-300 text-slate-900 shadow-emerald-500/30'
                        : 'bg-slate-900/70 border-slate-700/60 text-slate-200 hover:bg-slate-800/80 hover:border-emerald-400/60'
                    }`}
                  >
                    <span className="text-xl drop-shadow">{item.icon}</span>
                    <div className="flex flex-col text-left leading-tight">
                      <span className="text-sm font-semibold tracking-wide">{item.label}</span>
                      <span className="text-[10px] uppercase tracking-[0.3em] text-slate-400 group-hover:text-emerald-200">{item.description}</span>
                    </div>
                  </button>
                );
              })}
            </div>
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