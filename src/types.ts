export interface User {
  id: number;
  name: string;
  role: string;
  mentalRank: string;
  physicalRank: string;
  gold: number;
  ability: string;
  spiritName: string;
  spiritType: string;
  avatarUrl: string;
  status: 'pending' | 'approved' | 'dead' | 'ghost' | 'rejected';
  deathDescription: string;
  profileText: string;
  gender?: string;
  height?: string;
  age?: string;
  orientation?: string;
  faction?: string;
  factionRole?: string;
  personality?: string;
  appearance?: string;
  clothing?: string;
  background?: string;
  isHidden?: number;
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
