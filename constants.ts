import { GameState, BuildingType, ResourceType, UnitType, BuildingConfig, UnitConfig, Village, OpponentState, MapState } from './types';

const createSeries = (start: number, growth: number, levels: number) =>
  Array.from({ length: levels }, (_, index) => Math.round(start * Math.pow(growth, index)));

const createCostTable = (
  base: Record<ResourceType, number>,
  growth: number,
  levels: number
): Record<ResourceType, number[]> => ({
  [ResourceType.Wood]: createSeries(base[ResourceType.Wood], growth, levels),
  [ResourceType.Clay]: createSeries(base[ResourceType.Clay], growth, levels),
  [ResourceType.Iron]: createSeries(base[ResourceType.Iron], growth, levels),
});

const clampSeries = (values: number[], maxLevel: number) => values.slice(0, maxLevel);

type GameConfig = {
    buildings: {
        [key in BuildingType]: BuildingConfig;
    },
    units: {
        [key in UnitType]: UnitConfig;
    }
}

export const dummyOpponents: Village[] = [
    {
        id: 101, name: "Barbarendorf", x: 25, y: 14,
        buildings: [{ id: 1, type: BuildingType.Wall, level: 2 }],
        units: [{ type: UnitType.Spearman, count: 50 }]
    },
    {
        id: 102, name: "Verlassene Mine", x: 21, y: 17,
        buildings: [{ id: 1, type: BuildingType.Wall, level: 1 }],
        units: [{ type: UnitType.Swordsman, count: 25 }, { type: UnitType.Axeman, count: 10 }]
    }
];

const createOpponentState = (
  id: number,
  capacity: number,
  resources: [number, number, number],
  production: [number, number, number],
): OpponentState => ({
  id,
  capacity,
  resources: {
    [ResourceType.Wood]: resources[0],
    [ResourceType.Clay]: resources[1],
    [ResourceType.Iron]: resources[2],
  },
  productionPerHour: {
    [ResourceType.Wood]: production[0],
    [ResourceType.Clay]: production[1],
    [ResourceType.Iron]: production[2],
  },
});

const initialOpponentStates: OpponentState[] = [
  createOpponentState(101, 1600, [750, 620, 540], [220, 180, 140]),
  createOpponentState(102, 1400, [520, 710, 680], [160, 190, 210]),
];

const initialMapState: MapState = {
  start: { q: 23, r: 15 },
  waypoints: [],
  entrenchments: [],
  scans: [],
  routeMetrics: { totalCost: 0, etaSeconds: 0, distance: 0 },
};

export const initialGameState: GameState = {
  playerName: 'Herrscher',
  resources: {
    [ResourceType.Wood]: 500,
    [ResourceType.Clay]: 500,
    [ResourceType.Iron]: 500,
  },
  warehouseCapacity: 1000,
  villages: [
    {
      id: 1,
      name: 'Erstes Dorf',
      x: 23,
      y: 15,
      buildings: [
        { id: 1, type: BuildingType.Headquarters, level: 1 },
        { id: 2, type: BuildingType.Barracks, level: 1 },
        { id: 3, type: BuildingType.Warehouse, level: 1 },
        { id: 4, type: BuildingType.Woodcutter, level: 1 },
        { id: 5, type: BuildingType.ClayPit, level: 1 },
        { id: 6, type: BuildingType.IronMine, level: 1 },
        { id: 7, type: BuildingType.Wall, level: 0 },
      ],
      units: [
        { type: UnitType.Spearman, count: 20 },
        { type: UnitType.Swordsman, count: 15 },
        { type: UnitType.Scout, count: 5 },
      ],
    },
  ],
  armyMovements: [],
  combatReports: [],
  opponentStates: initialOpponentStates,
  mapState: initialMapState,
  lastUpdate: Date.now(),
};

export const gameConfig: GameConfig = {
  buildings: {
    [BuildingType.Headquarters]: {
      name: 'Hauptquartier',
      description: 'Senkt die Bauzeit anderer Gebäude. Notwendig für den Ausbau des Dorfes.',
      maxLevel: 20,
      cost: createCostTable({
        [ResourceType.Wood]: 90,
        [ResourceType.Clay]: 80,
        [ResourceType.Iron]: 70,
      }, 1.2, 20),
      buildTime: createSeries(90, 1.18, 20), // in seconds
    },
     [BuildingType.Warehouse]: {
      name: 'Speicher',
      description: 'Erhöht die Lagerkapazität für Rohstoffe.',
      maxLevel: 20,
      cost: createCostTable({
        [ResourceType.Wood]: 60,
        [ResourceType.Clay]: 50,
        [ResourceType.Iron]: 40,
      }, 1.22, 20),
      buildTime: createSeries(60, 1.2, 20),
      capacity: clampSeries(createSeries(1000, 1.22, 25), 20),
    },
    [BuildingType.Woodcutter]: {
      name: 'Holzfäller',
      description: 'Produziert Holz.',
      maxLevel: 30,
      cost: createCostTable({
        [ResourceType.Wood]: 50,
        [ResourceType.Clay]: 60,
        [ResourceType.Iron]: 40,
      }, 1.18, 30),
      buildTime: createSeries(60, 1.16, 30),
      production: createSeries(30, 1.17, 30),
      resourceType: ResourceType.Wood,
    },
    [BuildingType.ClayPit]: {
      name: 'Lehmgrube',
      description: 'Produziert Lehm.',
      maxLevel: 30,
      cost: createCostTable({
        [ResourceType.Wood]: 60,
        [ResourceType.Clay]: 50,
        [ResourceType.Iron]: 40,
      }, 1.18, 30),
      buildTime: createSeries(60, 1.16, 30),
      production: createSeries(30, 1.17, 30),
      resourceType: ResourceType.Clay,
    },
    [BuildingType.IronMine]: {
      name: 'Eisenmine',
      description: 'Produziert Eisen.',
      maxLevel: 30,
      cost: createCostTable({
        [ResourceType.Wood]: 75,
        [ResourceType.Clay]: 65,
        [ResourceType.Iron]: 50,
      }, 1.19, 30),
      buildTime: createSeries(75, 1.17, 30),
      production: createSeries(30, 1.17, 30),
      resourceType: ResourceType.Iron,
    },
    [BuildingType.Barracks]: {
      name: 'Kaserne',
      description: 'Rekrutiert Infanterie-Einheiten.',
      maxLevel: 25,
      cost: createCostTable({
        [ResourceType.Wood]: 200,
        [ResourceType.Clay]: 170,
        [ResourceType.Iron]: 90,
      }, 1.2, 25),
      buildTime: createSeries(180, 1.18, 25),
    },
    [BuildingType.Wall]: {
      name: 'Wall',
      description: 'Erhöht die Verteidigung des Dorfes.',
      maxLevel: 20,
      cost: createCostTable({
        [ResourceType.Wood]: 50,
        [ResourceType.Clay]: 100,
        [ResourceType.Iron]: 20,
      }, 1.22, 20),
      buildTime: createSeries(120, 1.2, 20),
      defenseBonus: [0.05, 0.1, 0.15, 0.2, 0.25, 0.3, 0.35, 0.4, 0.45, 0.5, 0.55, 0.6, 0.65, 0.7, 0.75, 0.8, 0.85, 0.9, 0.95, 1.0], // 5% per level
    },
  },
  units: {
      [UnitType.Spearman]: {
          name: 'Speerträger',
          description: 'Einfache defensive Einheit, gut gegen Kavallerie.',
          cost: { [ResourceType.Wood]: 50, [ResourceType.Clay]: 30, [ResourceType.Iron]: 10 },
          attack: 10, defense: 15, speed: 18, carryCapacity: 25, recruitTime: 120,
      },
      [UnitType.Swordsman]: {
          name: 'Schwertkämpfer',
          description: 'Ausgeglichene Infanterie-Einheit.',
          cost: { [ResourceType.Wood]: 30, [ResourceType.Clay]: 30, [ResourceType.Iron]: 70,},
          attack: 25, defense: 40, speed: 22, carryCapacity: 15, recruitTime: 240,
      },
      [UnitType.Axeman]: {
          name: 'Axtkämpfer',
          description: 'Starke offensive Einheit, schwach in der Verteidigung.',
          cost: { [ResourceType.Wood]: 60, [ResourceType.Clay]: 30, [ResourceType.Iron]: 40 },
          attack: 40, defense: 10, speed: 18, carryCapacity: 20, recruitTime: 210,
      },
      [UnitType.Scout]: {
          name: 'Späher',
          description: 'Schnelle Einheit zum Ausspionieren von Gegnern.',
          cost: { [ResourceType.Wood]: 50, [ResourceType.Clay]: 50, [ResourceType.Iron]: 20 },
          attack: 0, defense: 2, speed: 9, carryCapacity: 80, recruitTime: 90,
      },
      [UnitType.HeavyCavalry]: {
          name: 'Schwere Kavallerie',
          description: 'Starke und schnelle Angriffs-Einheit.',
          cost: { [ResourceType.Wood]: 125, [ResourceType.Clay]: 100, [ResourceType.Iron]: 250 },
          attack: 150, defense: 120, speed: 11, carryCapacity: 50, recruitTime: 600,
      }
  }
};