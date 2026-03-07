export type HomeLoc = 'sanctuary' | 'slums' | 'rich_area';

export type BuiltinFactionLocationId =
  | 'tower_of_life'
  | 'london_tower'
  | 'paranormal_office'
  | 'guild'
  | 'tower_guard'
  | 'observers'
  | 'demon_society'
  | 'army'
  | 'sanctuary'
  | 'slums'
  | 'rich_area';

export interface BuiltinFactionMeta {
  name: string;
  locationId: BuiltinFactionLocationId;
  leaderJob: string;
  roleManagerJobs: string[];
  kickEnabled: boolean;
  baseSalary: number;
  lowestJob: string;
  jobs: string[];
  uniqueJobs?: string[];
}

export const CUSTOM_FACTION_PREFIX = 'custom_faction_';
export const SCHOOL_LOCATION_IDS = new Set<BuiltinFactionLocationId>([
  'tower_of_life',
  'london_tower',
  'sanctuary',
]);
export const TOWER_GOVERNOR_JOBS = new Set(['圣子', '圣女']);
export const GUARD_CHIEF_JOB = '守塔会会长';
export const CUSTOM_ROLE_ENABLED_LOCATIONS = new Set<string>([
  'tower_of_life',
  'guild',
  'observers',
  'paranormal_office',
  'rich_area',
  'slums',
  'demon_society',
  'tower_guard',
  'army',
]);

export const BUILTIN_FACTIONS: BuiltinFactionMeta[] = [
  {
    name: '命之塔',
    locationId: 'tower_of_life',
    leaderJob: '圣子 / 圣女',
    roleManagerJobs: ['圣子', '圣女'],
    kickEnabled: true,
    baseSalary: 12000,
    lowestJob: '仆从',
    uniqueJobs: ['圣子', '圣女'],
    jobs: ['圣子', '圣女', '候选者', '侍奉者', '仆从', '神使', '神使后裔'],
  },
  {
    name: '伦敦塔',
    locationId: 'london_tower',
    leaderJob: '伦敦塔教师',
    roleManagerJobs: ['伦敦塔教师'],
    kickEnabled: true,
    baseSalary: 8000,
    lowestJob: '伦敦塔学员',
    uniqueJobs: ['伦敦塔教师'],
    jobs: ['伦敦塔教师', '伦敦塔职工', '伦敦塔学员'],
  },
  {
    name: '灵异管理所',
    locationId: 'paranormal_office',
    leaderJob: '灵异所所长',
    roleManagerJobs: ['灵异所所长'],
    kickEnabled: true,
    baseSalary: 9000,
    lowestJob: '灵异所文员',
    uniqueJobs: ['灵异所所长', '搜捕队队长'],
    jobs: ['灵异所所长', '搜捕队队长', '搜捕队队员', '灵异所文员'],
  },
  {
    name: '公会',
    locationId: 'guild',
    leaderJob: '公会会长',
    roleManagerJobs: ['公会会长'],
    kickEnabled: true,
    baseSalary: 7000,
    lowestJob: '冒险者',
    uniqueJobs: ['公会会长'],
    jobs: ['公会会长', '公会成员', '冒险者'],
  },
  {
    name: '守塔会',
    locationId: 'tower_guard',
    leaderJob: '守塔会会长',
    roleManagerJobs: ['守塔会会长'],
    kickEnabled: true,
    baseSalary: 8500,
    lowestJob: '守塔会成员',
    uniqueJobs: ['守塔会会长'],
    jobs: ['守塔会会长', '守塔会成员'],
  },
  {
    name: '观察者',
    locationId: 'observers',
    leaderJob: '观察者首领',
    roleManagerJobs: ['观察者首领'],
    kickEnabled: true,
    baseSalary: 8500,
    lowestJob: '情报搜集员',
    uniqueJobs: ['观察者首领'],
    jobs: ['观察者首领', '情报搜集员', '情报处理员'],
  },
  {
    name: '恶魔会',
    locationId: 'demon_society',
    leaderJob: '恶魔会会长',
    roleManagerJobs: ['恶魔会会长'],
    kickEnabled: true,
    baseSalary: 7500,
    lowestJob: '恶魔会成员',
    uniqueJobs: ['恶魔会会长'],
    jobs: ['恶魔会会长', '恶魔会成员'],
  },
  {
    name: '军队',
    locationId: 'army',
    leaderJob: '军队将官',
    roleManagerJobs: ['军队将官'],
    kickEnabled: true,
    baseSalary: 9500,
    lowestJob: '军队士兵',
    uniqueJobs: ['军队将官', '军队校官', '军队尉官'],
    jobs: ['军队将官', '军队校官', '军队尉官', '军队士兵'],
  },
  {
    name: '圣所',
    locationId: 'sanctuary',
    leaderJob: '圣所保育员',
    roleManagerJobs: ['圣所保育员'],
    kickEnabled: true,
    baseSalary: 6500,
    lowestJob: '圣所幼崽',
    jobs: ['圣所保育员', '圣所职工', '圣所幼崽'],
  },
  {
    name: '西市',
    locationId: 'slums',
    leaderJob: '西区市长',
    roleManagerJobs: ['西区市长'],
    kickEnabled: false,
    baseSalary: 6000,
    lowestJob: '西区技工',
    uniqueJobs: ['西区市长', '西区副市长'],
    jobs: ['西区市长', '西区副市长', '西区技工'],
  },
  {
    name: '东市',
    locationId: 'rich_area',
    leaderJob: '东区市长',
    roleManagerJobs: ['东区市长'],
    kickEnabled: false,
    baseSalary: 10000,
    lowestJob: '东区贵族',
    uniqueJobs: ['东区市长', '东区副市长'],
    jobs: ['东区市长', '东区副市长', '东区贵族', '东区技工'],
  },
];

export const BUILTIN_JOB_MAP = new Map<string, BuiltinFactionMeta>();
for (const meta of BUILTIN_FACTIONS) {
  for (const job of meta.jobs) BUILTIN_JOB_MAP.set(job, meta);
}

export const BUILTIN_LOCATION_MAP = new Map<string, BuiltinFactionMeta>();
for (const meta of BUILTIN_FACTIONS) {
  BUILTIN_LOCATION_MAP.set(meta.locationId, meta);
}

const HOME_BY_JOB = new Map<string, HomeLoc>([
  ['圣所幼崽', 'sanctuary'],
  ['圣所保育员', 'sanctuary'],
  ['圣所职工', 'sanctuary'],
  ['西区技工', 'slums'],
  ['西区副市长', 'slums'],
  ['西区市长', 'slums'],
  ['东区贵族', 'rich_area'],
  ['东区技工', 'rich_area'],
  ['东区副市长', 'rich_area'],
  ['东区市长', 'rich_area'],
]);

const RANK_SCORE_MAP: Record<string, number> = {
  D: 1,
  'D+': 2,
  C: 3,
  'C+': 4,
  B: 5,
  'B+': 6,
  A: 7,
  'A+': 8,
  S: 9,
  'S+': 10,
  SS: 11,
  'SS+': 12,
  SSS: 13,
  'SSS+': 14,
};

export function isCustomFactionLocationId(value?: string | null) {
  return String(value || '').trim().startsWith(CUSTOM_FACTION_PREFIX);
}

export function isSchoolLocation(locationId: string) {
  return SCHOOL_LOCATION_IDS.has(locationId as BuiltinFactionLocationId);
}

export function isMinor(age: number) {
  return Number(age || 0) < 16;
}

export function isStudentAge(age: number) {
  const n = Number(age || 0);
  return n >= 16 && n <= 19;
}

export function isNoJob(value?: string | null) {
  const normalized = String(value || '').trim();
  return !normalized || normalized === '无' || normalized === '无职位' || normalized.toLowerCase() === 'none';
}

export function resolveHomeByJob(jobName: string): HomeLoc | null {
  return HOME_BY_JOB.get(String(jobName || '').trim()) || null;
}

export function resolveBuiltinFactionByJob(jobName: string) {
  const job = String(jobName || '').trim();
  if (!job || isNoJob(job)) return null;
  const exact = BUILTIN_JOB_MAP.get(job);
  if (exact) return exact;
  if (job.includes('伦敦塔')) return BUILTIN_LOCATION_MAP.get('london_tower') || null;
  if (job.includes('灵异') || job.includes('搜捕')) return BUILTIN_LOCATION_MAP.get('paranormal_office') || null;
  if (job.includes('公会') || job.includes('冒险者')) return BUILTIN_LOCATION_MAP.get('guild') || null;
  if (job.includes('守塔')) return BUILTIN_LOCATION_MAP.get('tower_guard') || null;
  if (job.includes('观察') || job.includes('情报')) return BUILTIN_LOCATION_MAP.get('observers') || null;
  if (job.includes('恶魔')) return BUILTIN_LOCATION_MAP.get('demon_society') || null;
  if (job.includes('军队') || job.includes('将官') || job.includes('校官') || job.includes('尉官') || job.includes('士兵')) {
    return BUILTIN_LOCATION_MAP.get('army') || null;
  }
  if (job.includes('圣所') || job.includes('幼崽') || job.includes('保育')) return BUILTIN_LOCATION_MAP.get('sanctuary') || null;
  if (job.includes('西区')) return BUILTIN_LOCATION_MAP.get('slums') || null;
  if (job.includes('东区')) return BUILTIN_LOCATION_MAP.get('rich_area') || null;
  if (job.includes('圣子') || job.includes('圣女') || job.includes('候选') || job.includes('侍奉') || job.includes('仆从') || job.includes('神使')) {
    return BUILTIN_LOCATION_MAP.get('tower_of_life') || null;
  }
  return null;
}

export function lowestJobForFaction(jobName: string) {
  const meta = resolveBuiltinFactionByJob(jobName);
  return meta ? meta.lowestJob : String(jobName || '').trim();
}

export function isLondonTowerStudentJob(jobName: string) {
  const job = String(jobName || '').trim();
  return job.includes('伦敦塔') && (job.includes('学员') || job.includes('学生'));
}

export function calcQuitPenalty(jobName: string) {
  const meta = resolveBuiltinFactionByJob(jobName);
  if (!meta) return 0;

  const job = String(jobName || '').trim();
  let factor = 1;
  if (/会长|首领|所长|市长|将官|圣子|圣女|掌权者/.test(job)) factor = 1.8;
  else if (/副市长|队长|校官|教师|候选者|保育员/.test(job)) factor = 1.4;
  else if (/尉官|成员|职工|文员|队员|学员|技工|贵族|仆从|冒险者/.test(job)) factor = 1;

  const salary = Math.max(1000, Math.round(meta.baseSalary * factor));
  return Math.max(100, Math.round(salary * 0.1));
}

export function inferFactionName(user: any) {
  const byJob = resolveBuiltinFactionByJob(String(user?.job || ''));
  if (byJob) return byJob.name;
  const raw = String(user?.faction || '').trim();
  return isNoJob(raw) ? '' : raw;
}

export function canManageFactionRoster(
  operatorJob: string,
  locationId: string,
  kickEnabled: boolean,
  delegationActive: boolean
) {
  if (!kickEnabled) return false;
  const job = String(operatorJob || '').trim();
  if (isNoJob(job)) return false;

  const meta = BUILTIN_LOCATION_MAP.get(String(locationId || '').trim());
  if (!meta) return false;

  if (!isSchoolLocation(meta.locationId)) return meta.roleManagerJobs.includes(job);
  if (TOWER_GOVERNOR_JOBS.has(job)) return true;
  return delegationActive && job === GUARD_CHIEF_JOB;
}

export function canManageCustomRoles(operatorJob: string, locationId: string) {
  const meta = BUILTIN_LOCATION_MAP.get(String(locationId || '').trim());
  if (!meta) return false;
  if (!CUSTOM_ROLE_ENABLED_LOCATIONS.has(meta.locationId)) return false;
  return meta.roleManagerJobs.includes(String(operatorJob || '').trim());
}

export function compareRank(value?: string | null, required?: string | null) {
  const target = String(required || '').trim().toUpperCase();
  if (!target) return true;
  const current = String(value || '').trim().toUpperCase();
  return (RANK_SCORE_MAP[current] || 0) >= (RANK_SCORE_MAP[target] || 0);
}
