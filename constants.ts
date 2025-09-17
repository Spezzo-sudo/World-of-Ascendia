import { GameState, BuildingType, ResourceType, UnitType, BuildingConfig, UnitConfig, Village } from './types';

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
  lastUpdate: Date.now(),
};

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

export const gameConfig: GameConfig = {
  buildings: {
    [BuildingType.Headquarters]: {
      name: 'Hauptquartier',
      description: 'Senkt die Bauzeit anderer Gebäude. Notwendig für den Ausbau des Dorfes.',
      maxLevel: 20,
      cost: {
        [ResourceType.Wood]: [90, 108, 130, 156, 187],
        [ResourceType.Clay]: [80, 96, 115, 138, 166],
        [ResourceType.Iron]: [70, 84, 101, 121, 145],
      },
      buildTime: [90, 108, 130, 156, 187], // in seconds
    },
     [BuildingType.Warehouse]: {
      name: 'Speicher',
      description: 'Erhöht die Lagerkapazität für Rohstoffe.',
      maxLevel: 20,
      cost: {
        [ResourceType.Wood]: [60, 72, 86, 103, 124],
        [ResourceType.Clay]: [50, 60, 72, 86, 103],
        [ResourceType.Iron]: [40, 48, 58, 70, 84],
      },
      buildTime: [60, 72, 86, 103, 124],
      capacity: [1000, 1200, 1440, 1728, 2074]
    },
    [BuildingType.Woodcutter]: {
      name: 'Holzfäller',
      description: 'Produziert Holz.',
      maxLevel: 30,
      cost: {
        [ResourceType.Wood]: [50, 60, 72, 86, 103],
        [ResourceType.Clay]: [60, 72, 86, 103, 124],
        [ResourceType.Iron]: [40, 48, 58, 70, 84],
      },
      buildTime: [60, 72, 86, 103, 124],
      production: [30, 35, 41, 47, 55],
      resourceType: ResourceType.Wood,
    },
    [BuildingType.ClayPit]: {
      name: 'Lehmgrube',
      description: 'Produziert Lehm.',
      maxLevel: 30,
      cost: {
        [ResourceType.Wood]: [60, 72, 86, 103, 124],
        [ResourceType.Clay]: [50, 60, 72, 86, 103],
        [ResourceType.Iron]: [40, 48, 58, 70, 84],
      },
      buildTime: [60, 72, 86, 103, 124],
      production: [30, 35, 41, 47, 55],
      resourceType: ResourceType.Clay,
    },
    [BuildingType.IronMine]: {
      name: 'Eisenmine',
      description: 'Produziert Eisen.',
      maxLevel: 30,
      cost: {
        [ResourceType.Wood]: [75, 90, 108, 130, 156],
        [ResourceType.Clay]: [65, 78, 94, 113, 136],
        [ResourceType.Iron]: [50, 60, 72, 86, 103],
      },
      buildTime: [75, 90, 108, 130, 156],
      production: [30, 35, 41, 47, 55],
      resourceType: ResourceType.Iron,
    },
    [BuildingType.Barracks]: {
      name: 'Kaserne',
      description: 'Rekrutiert Infanterie-Einheiten.',
      maxLevel: 25,
      cost: {
        [ResourceType.Wood]: [200, 240, 288, 346, 415],
        [ResourceType.Clay]: [170, 204, 245, 294, 353],
        [ResourceType.Iron]: [90, 108, 130, 156, 187],
      },
      buildTime: [180, 216, 259, 311, 373],
    },
    [BuildingType.Wall]: {
      name: 'Wall',
      description: 'Erhöht die Verteidigung des Dorfes.',
      maxLevel: 20,
      cost: {
        [ResourceType.Wood]: [50, 60, 72, 86, 103],
        [ResourceType.Clay]: [100, 120, 144, 173, 208],
        [ResourceType.Iron]: [20, 24, 29, 35, 42],
      },
      buildTime: [120, 144, 173, 208, 250],
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