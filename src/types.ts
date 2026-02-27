export interface User {
  id: number;
  name: string;

  role: string;
  faction?: string;

  mentalRank: string;
  physicalRank: string;
  gold: number;

  ability: string;
  spiritName: string;
  spiritType: string;
  avatarUrl: string;

  status:
    | 'pending'
    | 'approved'
    | 'dead'
    | 'ghost'
    | 'rejected'
    | 'pending_death'
    | 'pending_ghost';

  deathDescription: string;
  profileText: string;

  // 运行时常用字段
  age?: number;
  isHidden?: number;
  currentLocation?: string;

  job?: string;
  hp?: number;
  maxHp?: number;
  mp?: number;
  maxMp?: number;
  mentalProgress?: number;
  workCount?: number;
  trainCount?: number;

  // 兼容旧字段
  gender?: string;
  height?: string;
  orientation?: string;
  factionRole?: string;
  personality?: string;
  appearance?: string;
  clothing?: string;
  background?: string;
}

export interface Tombstone {
  id: number;
  name: string;
  deathDescription: string;
  role: string;
  mentalRank: string;
  physicalRank: string;
  ability: string;
  spiritName: string;
  isHidden?: number;
}

export interface Item {
  id: number;
  userId: number;
  name: string;
  description: string;
}
