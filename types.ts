export enum ResourceType {
  Wood = 'wood',
  Clay = 'clay',
  Iron = 'iron',
}

export enum BuildingType {
  Headquarters = 'headquarters',
  Barracks = 'barracks',
  Warehouse = 'warehouse',
  Woodcutter = 'woodcutter',
  ClayPit = 'clayPit',
  IronMine = 'ironMine',
  Wall = 'wall',
}

export enum UnitType {
  Spearman = 'spearman',
  Swordsman = 'swordsman',
  Axeman = 'axeman',
  Scout = 'scout',
  HeavyCavalry = 'heavyCavalry',
}

export interface Building {
  id: number;
  type: BuildingType;
  level: number;
}

export interface Unit {
  type: UnitType;
  count: number;
}

export interface Village {
  id: number;
  name: string;
  x: number;
  y: number;
  buildings: Building[];
  units: Unit[];
}

export interface ArmyMovement {
  id: string;
  type: 'attack' | 'return';
  units: Unit[];
  originVillage: { id: number, x: number, y: number };
  targetVillage: { id: number, name: string, x: number, y: number };
  departureTime: number;
  arrivalTime: number;
  plunderedResources?: { [key in ResourceType]: number };
}

export interface CombatReport {
  id: string;
  attacker: string;
  defender: string;
  attackerUnits: Unit[];
  defenderUnits: Unit[];
  attackerLosses: Unit[];
  defenderLosses: Unit[];
  plunderedResources: { [key in ResourceType]: number };
  timestamp: number;
  attackerWon: boolean;
}

export interface GameState {
  playerName: string;
  resources: {
    [ResourceType.Wood]: number;
    [ResourceType.Clay]: number;
    [ResourceType.Iron]: number;
  };
  warehouseCapacity: number;
  villages: Village[];
  armyMovements: ArmyMovement[];
  combatReports: CombatReport[];
  lastUpdate: number;
}

export interface BuildingConfig {
    name: string;
    description: string;
    maxLevel: number;
    cost: {
        [key in ResourceType]: number[];
    };
    buildTime: number[]; 
    [key: string]: any;
}

export interface UnitConfig {
    name: string;
    description: string;
    cost: {
        [key in ResourceType]: number;
    };
    attack: number;
    defense: number;
    speed: number; // fields per hour
    carryCapacity: number;
    recruitTime: number; // in seconds
}
