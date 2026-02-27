export interface User {
  id: number;
  name: string;
  role: string;
  age: number; // 注意：server.ts 中 age 是 INTEGER
  mentalRank: string;
  physicalRank: string;
  gold: number;
  ability: string;
  spiritName: string;
  spiritType: string;
  avatarUrl: string;
  // 扩展状态以匹配审核流程
  status: 'pending' | 'approved' | 'dead' | 'ghost' | 'rejected' | 'pending_death' | 'pending_ghost';
  deathDescription: string;
  profileText: string;
  
  // --- 补充缺失的游戏逻辑字段 ---
  currentLocation?: string;
  job?: string;
  hp: number;
  maxHp: number;
  mp: number;
  maxMp: number;
  mentalProgress: number;
  workCount: number;
  trainCount: number;
  lastCheckInDate?: string;
  lastResetDate?: string;

  // --- 选填背景字段 ---
  gender?: string;
  height?: string;
  orientation?: string;
  faction?: string;
  factionRole?: string;
  personality?: string;
  appearance?: string;
  clothing?: string;
  background?: string;
  isHidden?: number;
}

// 精神体专用状态接口 (对应 TowerRoomView)
export interface SpiritStatus {
  userId: number;
  name: string;
  imageUrl: string;
  intimacy: number;
  level: number;
  hp: number;
  status: string;
}

// 统一物品接口
export interface InventoryItem {
  id: number;
  userId: number;
  name: string;
  qty: number; // 必须有数量字段
  description?: string;
  price?: number;
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
