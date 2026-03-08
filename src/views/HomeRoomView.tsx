import { useEffect, useMemo, useRef, useState } from 'react';
import {
  ArrowLeft, BedDouble, ChevronDown, ChevronUp, Download, MessageSquarePlus,
  Save, Settings, Sparkles, Trash2
} from 'lucide-react';
import { CustomGamePlayerView } from './CustomGamePlayerView';

type HomeLocation = 'sanctuary' | 'slums' | 'rich_area';
const NONE = '无';
const MOBILE_PORTRAIT_QUERY = '(max-width: 767px) and (orientation: portrait)';

interface ReplayItem {
  id: string;
  title: string;
  locationName: string;
  participantNames: string;
  createdAt: string;
  messageCount: number;
}

interface CustomGameMineRow {
  id: number;
  title: string;
  status: string;
  voteStatus: string;
  createdAt: string;
}

interface SpiritStatus {
  name: string;
  intimacy: number;
  level: number;
  imageUrl: string;
  appearance: string;
  daily: {
    feed: number;
    pet: number;
    train: number;
  };
}

const EMPTY_SPIRIT_STATUS: SpiritStatus = {
  name: '',
  intimacy: 0,
  level: 1,
  imageUrl: '',
  appearance: '',
  daily: { feed: 0, pet: 0, train: 0 }
};

interface UserLite {
  id: number;
  name?: string;
  role?: string;
  age?: number;
  gold?: number;
}

export interface HomeRoomDetail {
  ownerId: number;
  ownerName: string;
  avatarUrl?: string;
  job?: string;
  role?: string;
  homeLocation?: HomeLocation | string;
  bgImage?: string;
  description?: string;
  visible?: boolean;
  allowVisit?: boolean;
  spiritName?: string;
  spiritType?: string;
}

interface Props {
  currentUser: UserLite;
  room: HomeRoomDetail;
  sourceMap: HomeLocation;
  onBack: () => void;
  showToast: (msg: string) => void;
  onSaved?: (next: HomeRoomDetail) => void;
  refreshGlobalData?: () => void;
  onRequestSwitchLocation?: (locationId: string) => void;
  onExitToWorld?: () => void;
  onEnterCustomGameRun?: (gameId: number) => void;
}

export function deriveInitialHomeLocation(user: UserLite): HomeLocation {
  const role = String(user.role || '');
  const age = Number(user.age || 0);
  const gold = Number(user.gold || 0);
  if (role === '未分化' || age < 16) return 'sanctuary';
  return gold > 9999 ? 'rich_area' : 'slums';
}

const THEME: Record<HomeLocation, { name: string; backText: string; defaultBg: string; overlay: string; panel: string; accent: string }> = {
  sanctuary: {
    name: '圣所',
    backText: '返回圣所',
    defaultBg: '/room/圣所.png',
    overlay: 'from-amber-900/40 via-orange-900/20 to-yellow-900/30',
    panel: 'bg-amber-950/60 border-amber-700/50',
    accent: 'text-amber-300'
  },
  slums: {
    name: '西区',
    backText: '返回西区',
    defaultBg: '/room/西市.png',
    overlay: 'from-stone-950/60 via-orange-950/25 to-black/65',
    panel: 'bg-stone-900/60 border-orange-700/50',
    accent: 'text-orange-300'
  },
  rich_area: {
    name: '东区',
    backText: '返回东区',
    defaultBg: '/room/东市.png',
    overlay: 'from-sky-950/45 via-emerald-950/15 to-slate-950/55',
    panel: 'bg-slate-900/55 border-sky-700/50',
    accent: 'text-sky-300'
  }
};

function normalizeHomeLocation(v: any): HomeLocation | null {
  if (v === 'sanctuary' || v === 'slums' || v === 'rich_area') return v;
  return null;
}

// ─── Per-species spirit entity SVG shapes ───────────────────────────────────

type SpiritSpecies = '狼'|'猎鹰'|'黑豹'|'白狐'|'虎'|'渡鸦'
  |'玫瑰'|'百合'|'鸢尾'|'莲花'|'山茶'|'紫藤'|'default';

const SPIRIT_COLORS: Record<string, { body: string; accent: string; glow: string }> = {
  狼:       { body: '#7090b0', accent: '#a0c4e8', glow: '#60a8e0' },
  猎鹰:     { body: '#c09040', accent: '#f0c870', glow: '#e8b050' },
  黑豹:     { body: '#503870', accent: '#9060d0', glow: '#8050c8' },
  白狐:     { body: '#e0e8f8', accent: '#ffffff', glow: '#b8d4f8' },
  虎:       { body: '#e06020', accent: '#f0a030', glow: '#f08030' },
  渡鸦:     { body: '#404858', accent: '#808ea8', glow: '#6070a0' },
  玫瑰:     { body: '#d84070', accent: '#f880a8', glow: '#e86088' },
  百合:     { body: '#f8f0e0', accent: '#ffe8c0', glow: '#f8d8a0' },
  鸢尾:     { body: '#6050a8', accent: '#9080e0', glow: '#8070d0' },
  莲花:     { body: '#e870a0', accent: '#f8a8c8', glow: '#f090b8' },
  山茶:     { body: '#c83040', accent: '#f06070', glow: '#e05060' },
  紫藤:     { body: '#9070c0', accent: '#c0a0e8', glow: '#b090d8' },
  default:  { body: '#6080b0', accent: '#80a8d8', glow: '#5090c8' },
};

function SpiritBodySVG({ species, c, clicked }: { species: SpiritSpecies; c: typeof SPIRIT_COLORS[string]; clicked: boolean }) {
  const bounce = clicked ? 'translate(0,-6)' : 'translate(0,0)';
  switch (species) {
    case '狼': return (
      <g transform={bounce} style={{ transition: 'transform 0.25s cubic-bezier(.34,1.56,.64,1)' }}>
        {/* wolf head */}
        <ellipse cx="36" cy="38" rx="20" ry="22" fill={c.body} />
        {/* ears */}
        <polygon points="20,22 14,6 28,18" fill={c.body} />
        <polygon points="52,22 58,6 44,18" fill={c.body} />
        <polygon points="21,20 16,10 27,18" fill={c.accent} opacity="0.7" />
        <polygon points="51,20 56,10 45,18" fill={c.accent} opacity="0.7" />
        {/* snout */}
        <ellipse cx="36" cy="46" rx="9" ry="6" fill={c.accent} opacity="0.8" />
        <circle cx="36" cy="43" r="3" fill="#1a1a2a" />
        {/* eyes */}
        <ellipse cx="27" cy="34" rx="4" ry="4.5" fill="#fffde0" />
        <ellipse cx="45" cy="34" rx="4" ry="4.5" fill="#fffde0" />
        <circle cx="28" cy="35" r="2.5" fill="#1a1a2a" />
        <circle cx="46" cy="35" r="2.5" fill="#1a1a2a" />
        <circle cx="29" cy="33.5" r="1" fill="white" opacity="0.9" />
        <circle cx="47" cy="33.5" r="1" fill="white" opacity="0.9" />
        {/* ear wiggle on click */}
        {clicked && <>
          <polygon points="20,22 14,6 28,18" fill={c.accent} opacity="0.9" transform="rotate(-15,20,22)" />
          <polygon points="52,22 58,6 44,18" fill={c.accent} opacity="0.9" transform="rotate(15,52,22)" />
        </>}
      </g>
    );
    case '猎鹰': return (
      <g transform={bounce} style={{ transition: 'transform 0.25s cubic-bezier(.34,1.56,.64,1)' }}>
        {/* body */}
        <ellipse cx="36" cy="40" rx="16" ry="20" fill={c.body} />
        {/* wings */}
        <path d={clicked ? 'M20,35 Q4,18 10,42 L20,40Z' : 'M20,38 Q8,32 12,44 L20,40Z'} fill={c.body} style={{ transition: 'd 0.2s' }} />
        <path d={clicked ? 'M52,35 Q68,18 62,42 L52,40Z' : 'M52,38 Q64,32 60,44 L52,40Z'} fill={c.body} style={{ transition: 'd 0.2s' }} />
        {/* wing pattern */}
        <line x1="20" y1="40" x2="12" y2="44" stroke={c.accent} strokeWidth="1.5" opacity="0.6" />
        <line x1="52" y1="40" x2="60" y2="44" stroke={c.accent} strokeWidth="1.5" opacity="0.6" />
        {/* head */}
        <ellipse cx="36" cy="24" rx="12" ry="13" fill={c.body} />
        {/* beak */}
        <path d="M32,28 L36,34 L40,28Z" fill={c.accent} />
        {/* eyes */}
        <circle cx="29" cy="22" r="4" fill="#fffde0" />
        <circle cx="43" cy="22" r="4" fill="#fffde0" />
        <circle cx="30" cy="23" r="2.5" fill="#1a1a2a" />
        <circle cx="44" cy="23" r="2.5" fill="#1a1a2a" />
        <circle cx="31" cy="22" r="1" fill="white" opacity="0.9" />
        <circle cx="45" cy="22" r="1" fill="white" opacity="0.9" />
      </g>
    );
    case '黑豹': return (
      <g transform={bounce} style={{ transition: 'transform 0.25s cubic-bezier(.34,1.56,.64,1)' }}>
        <ellipse cx="36" cy="38" rx="20" ry="22" fill={c.body} />
        <polygon points="22,22 17,8 30,20" fill={c.body} />
        <polygon points="50,22 55,8 42,20" fill={c.body} />
        <polygon points="22,21 18,12 28,20" fill={c.accent} opacity="0.5" />
        <polygon points="50,21 54,12 44,20" fill={c.accent} opacity="0.5" />
        <ellipse cx="36" cy="46" rx="8" ry="5" fill={c.accent} opacity="0.6" />
        <circle cx="36" cy="43" r="2.5" fill="#0a0a1a" />
        {/* whiskers */}
        <line x1="26" y1="45" x2="12" y2="42" stroke={c.accent} strokeWidth="0.8" opacity="0.7" />
        <line x1="26" y1="47" x2="12" y2="48" stroke={c.accent} strokeWidth="0.8" opacity="0.7" />
        <line x1="46" y1="45" x2="60" y2="42" stroke={c.accent} strokeWidth="0.8" opacity="0.7" />
        <line x1="46" y1="47" x2="60" y2="48" stroke={c.accent} strokeWidth="0.8" opacity="0.7" />
        {/* eyes - slitted */}
        <ellipse cx="27" cy="33" rx="4" ry="5" fill="#d0ff80" />
        <ellipse cx="45" cy="33" rx="4" ry="5" fill="#d0ff80" />
        <ellipse cx="27" cy="33" rx="1.5" ry="4" fill="#0a0a1a" />
        <ellipse cx="45" cy="33" rx="1.5" ry="4" fill="#0a0a1a" />
        {clicked && <g opacity="0.6">
          <line x1="26" y1="45" x2="8" y2="40" stroke={c.accent} strokeWidth="1" />
          <line x1="26" y1="47" x2="8" y2="50" stroke={c.accent} strokeWidth="1" />
          <line x1="46" y1="45" x2="64" y2="40" stroke={c.accent} strokeWidth="1" />
          <line x1="46" y1="47" x2="64" y2="50" stroke={c.accent} strokeWidth="1" />
        </g>}
      </g>
    );
    case '白狐': return (
      <g transform={bounce} style={{ transition: 'transform 0.25s cubic-bezier(.34,1.56,.64,1)' }}>
        <ellipse cx="36" cy="38" rx="19" ry="22" fill={c.body} />
        {/* pointy fox ears */}
        <polygon points="22,24 15,4 32,20" fill={c.body} />
        <polygon points="50,24 57,4 40,20" fill={c.body} />
        <polygon points="22,23 17,9 30,20" fill={c.accent} />
        <polygon points="50,23 55,9 42,20" fill={c.accent} />
        {/* pointy snout */}
        <ellipse cx="36" cy="47" rx="7" ry="5" fill={c.accent} />
        <path d="M29,44 Q36,56 43,44" fill={c.body} />
        <circle cx="36" cy="43.5" r="2.5" fill="#1a0a1a" />
        {/* eyes */}
        <ellipse cx="27" cy="34" rx="4" ry="4" fill="#a0f0e0" />
        <ellipse cx="45" cy="34" rx="4" ry="4" fill="#a0f0e0" />
        <circle cx="28" cy="35" r="2.5" fill="#0a0a1a" />
        <circle cx="46" cy="35" r="2.5" fill="#0a0a1a" />
        <circle cx="29" cy="34" r="1" fill="white" opacity="0.9" />
        <circle cx="47" cy="34" r="1" fill="white" opacity="0.9" />
        {/* tails behind (ghost nine-tails effect) */}
        {[0,1,2].map(i => (
          <path key={i} d={`M${36 + (i-1)*8},60 Q${36+(i-1)*12},78 ${36+(i-1)*10},72`}
            stroke={c.body} strokeWidth="3" fill="none" strokeLinecap="round" opacity="0.7"
            style={{ transform: clicked ? `rotate(${(i-1)*12}deg)` : 'none', transformOrigin: '36px 60px' }}
          />
        ))}
      </g>
    );
    case '虎': return (
      <g transform={bounce} style={{ transition: 'transform 0.25s cubic-bezier(.34,1.56,.64,1)' }}>
        <ellipse cx="36" cy="38" rx="22" ry="23" fill={c.body} />
        <polygon points="23,24 18,8 32,20" fill={c.body} />
        <polygon points="49,24 54,8 40,20" fill={c.body} />
        <polygon points="23,22 20,12 30,20" fill={c.accent} opacity="0.7" />
        <polygon points="49,22 52,12 42,20" fill={c.accent} opacity="0.7" />
        {/* stripes */}
        {[0,1,2].map(i => (
          <line key={i} x1={24+i*4} y1={30+i*5} x2={28+i*4} y2={22+i*4}
            stroke="#3a1800" strokeWidth="2" opacity="0.5" strokeLinecap="round" />
        ))}
        {[0,1,2].map(i => (
          <line key={i} x1={48-i*4} y1={30+i*5} x2={44-i*4} y2={22+i*4}
            stroke="#3a1800" strokeWidth="2" opacity="0.5" strokeLinecap="round" />
        ))}
        <ellipse cx="36" cy="46" rx="10" ry="7" fill={c.accent} opacity="0.8" />
        <circle cx="36" cy="43" r="3.5" fill="#1a0a00" />
        <ellipse cx="27" cy="33" rx="4.5" ry="5" fill="#fffde0" />
        <ellipse cx="45" cy="33" rx="4.5" ry="5" fill="#fffde0" />
        <circle cx="28" cy="34" r="2.5" fill="#1a0a00" />
        <circle cx="46" cy="34" r="2.5" fill="#1a0a00" />
        <circle cx="29" cy="33" r="1" fill="white" opacity="0.9" />
        <circle cx="47" cy="33" r="1" fill="white" opacity="0.9" />
      </g>
    );
    case '渡鸦': return (
      <g transform={bounce} style={{ transition: 'transform 0.25s cubic-bezier(.34,1.56,.64,1)' }}>
        {/* body */}
        <ellipse cx="36" cy="42" rx="16" ry="18" fill={c.body} />
        {/* wings - flap on click */}
        <path d={clicked ? 'M20,38 Q2,20 8,44 L20,42Z' : 'M20,40 Q8,36 10,48 L20,44Z'} fill={c.body} />
        <path d={clicked ? 'M52,38 Q70,20 64,44 L52,42Z' : 'M52,40 Q64,36 62,48 L52,44Z'} fill={c.body} />
        {/* wing shine */}
        <path d={clicked ? 'M20,39 Q6,24 12,42' : 'M20,41 Q10,38 12,46'} stroke={c.accent} strokeWidth="1" fill="none" opacity="0.5" />
        <path d={clicked ? 'M52,39 Q66,24 60,42' : 'M52,41 Q62,38 60,46'} stroke={c.accent} strokeWidth="1" fill="none" opacity="0.5" />
        {/* head */}
        <ellipse cx="36" cy="26" rx="13" ry="14" fill={c.body} />
        {/* beak */}
        <path d="M30,30 Q36,38 42,30 L36,26Z" fill="#3a3a4a" />
        {/* eyes */}
        <circle cx="28" cy="24" r="4.5" fill="#3a4060" />
        <circle cx="44" cy="24" r="4.5" fill="#3a4060" />
        <circle cx="29" cy="24" r="2.5" fill="#0808a8" />
        <circle cx="45" cy="24" r="2.5" fill="#0808a8" />
        <circle cx="30" cy="23" r="1" fill="white" opacity="0.9" />
        <circle cx="46" cy="23" r="1" fill="white" opacity="0.9" />
      </g>
    );
    // Plants
    case '玫瑰': return (
      <g transform={bounce} style={{ transition: 'transform 0.25s cubic-bezier(.34,1.56,.64,1)' }}>
        <line x1="36" y1="72" x2="36" y2="36" stroke="#2d7a3a" strokeWidth="3" strokeLinecap="round" />
        <path d="M36,50 Q28,44 32,38 Q36,52 36,50Z" fill="#2d7a3a" opacity="0.8" />
        <path d="M36,50 Q44,44 40,38 Q36,52 36,50Z" fill="#2d7a3a" opacity="0.8" />
        {/* petals */}
        {[0,1,2,3,4,5].map(i => {
          const a = (i / 6) * Math.PI * 2 + (clicked ? 0.3 : 0);
          const r = clicked ? 18 : 15;
          return <ellipse key={i} cx={36 + Math.cos(a)*r} cy={30 + Math.sin(a)*r*0.7}
            rx="9" ry="11" fill={c.body} opacity="0.9"
            transform={`rotate(${i*60},${36 + Math.cos(a)*r},${30 + Math.sin(a)*r*0.7})`} />;
        })}
        <circle cx="36" cy="30" r="10" fill={c.accent} />
        <circle cx="36" cy="30" r="5" fill={c.body} opacity="0.6" />
      </g>
    );
    case '百合': return (
      <g transform={bounce} style={{ transition: 'transform 0.25s cubic-bezier(.34,1.56,.64,1)' }}>
        <line x1="36" y1="74" x2="36" y2="42" stroke="#4a9050" strokeWidth="3" strokeLinecap="round" />
        {[0,1,2].map(i => (
          <path key={i} d={`M${36+(i-1)*10},55 Q${36+(i-1)*16},45 ${36+(i-1)*8},42`}
            stroke="#4a9050" strokeWidth="2" fill="none" strokeLinecap="round" opacity="0.8" />
        ))}
        {[0,1,2,3,4,5].map(i => {
          const a = (i / 6) * Math.PI * 2;
          const spread = clicked ? 24 : 18;
          return <path key={i}
            d={`M36,36 Q${36+Math.cos(a)*spread},${28+Math.sin(a)*spread*0.6} ${36+Math.cos(a)*spread*1.3},${24+Math.sin(a)*spread*0.5}`}
            stroke={c.body} strokeWidth="4" fill="none" strokeLinecap="round" opacity="0.9" />;
        })}
        {/* stamens */}
        {[0,1,2].map(i => (
          <circle key={i} cx={36+(i-1)*6} cy={32} r="2" fill={c.accent} opacity="0.9" />
        ))}
        <circle cx="36" cy="30" r="4" fill={c.accent} opacity="0.6" />
      </g>
    );
    case '鸢尾': return (
      <g transform={bounce} style={{ transition: 'transform 0.25s cubic-bezier(.34,1.56,.64,1)' }}>
        <line x1="36" y1="74" x2="36" y2="36" stroke="#5a7030" strokeWidth="3" strokeLinecap="round" />
        <path d="M36,52 Q26,48 28,40 Q36,56 36,52Z" fill="#5a7030" opacity="0.9" />
        <path d="M36,52 Q46,48 44,40 Q36,56 36,52Z" fill="#5a7030" opacity="0.9" />
        {/* falls (lower petals) */}
        {[-1,0,1].map(i => (
          <path key={i} d={`M36,32 Q${36+i*20},${44+Math.abs(i)*4} ${36+i*16},${54+Math.abs(i)*6}`}
            stroke={c.body} strokeWidth="6" fill="none" strokeLinecap="round" opacity="0.85"
            style={{ transform: clicked ? `rotate(${i*8}deg)` : 'none', transformOrigin: '36px 32px' }} />
        ))}
        {/* standards (upper petals) */}
        {[-1,0,1].map(i => (
          <path key={i} d={`M36,32 Q${36+i*14},${18} ${36+i*8},${12}`}
            stroke={c.accent} strokeWidth="5" fill="none" strokeLinecap="round" opacity="0.8"
            style={{ transform: clicked ? `rotate(${i*6}deg)` : 'none', transformOrigin: '36px 32px' }} />
        ))}
        <circle cx="36" cy="32" r="5" fill={c.accent} />
      </g>
    );
    case '莲花': return (
      <g transform={bounce} style={{ transition: 'transform 0.25s cubic-bezier(.34,1.56,.64,1)' }}>
        {/* water surface */}
        <ellipse cx="36" cy="66" rx="22" ry="6" fill="#4080a0" opacity="0.4" />
        <line x1="36" y1="66" x2="36" y2="46" stroke="#5a8860" strokeWidth="2.5" strokeLinecap="round" />
        {/* petals - two layers */}
        {[0,1,2,3,4,5,6,7].map(i => {
          const a = (i / 8) * Math.PI * 2;
          const r = clicked ? 17 : 14;
          return <ellipse key={i} cx={36+Math.cos(a)*r} cy={38+Math.sin(a)*r*0.5}
            rx="7" ry="12" fill={c.body}
            transform={`rotate(${i*45+90},${36+Math.cos(a)*r},${38+Math.sin(a)*r*0.5})`}
            opacity="0.85" />;
        })}
        {[0,1,2,3,4].map(i => {
          const a = (i / 5) * Math.PI * 2 + 0.3;
          return <ellipse key={i} cx={36+Math.cos(a)*9} cy={34+Math.sin(a)*4}
            rx="5" ry="9" fill={c.accent}
            transform={`rotate(${i*72+90},${36+Math.cos(a)*9},${34+Math.sin(a)*4})`}
            opacity="0.9" />;
        })}
        <circle cx="36" cy="32" r="7" fill={c.accent} />
      </g>
    );
    case '山茶': return (
      <g transform={bounce} style={{ transition: 'transform 0.25s cubic-bezier(.34,1.56,.64,1)' }}>
        <line x1="36" y1="74" x2="36" y2="40" stroke="#3a7040" strokeWidth="3" strokeLinecap="round" />
        <path d="M36,54 Q26,50 28,42 Q36,58 36,54Z" fill="#3a7040" opacity="0.9" />
        <path d="M36,54 Q46,50 44,42 Q36,58 36,54Z" fill="#3a7040" opacity="0.9" />
        {[0,1,2,3,4].map(i => {
          const a = (i / 5) * Math.PI * 2 + (clicked ? 0.25 : 0);
          const r = clicked ? 17 : 14;
          return <ellipse key={i} cx={36+Math.cos(a)*r} cy={32+Math.sin(a)*r*0.7}
            rx="10" ry="13" fill={c.body}
            transform={`rotate(${i*72},${36+Math.cos(a)*r},${32+Math.sin(a)*r*0.7})`}
            opacity="0.88" />;
        })}
        {/* stamens cluster */}
        {[0,1,2,3,4,5,6].map(i => {
          const a2 = (i/7)*Math.PI*2;
          return <line key={i} x1="36" y1="32" x2={36+Math.cos(a2)*7} y2={32+Math.sin(a2)*7}
            stroke={c.accent} strokeWidth="1.5" strokeLinecap="round" opacity="0.9" />;
        })}
        <circle cx="36" cy="32" r="4" fill={c.accent} />
      </g>
    );
    case '紫藤': return (
      <g transform={bounce} style={{ transition: 'transform 0.25s cubic-bezier(.34,1.56,.64,1)' }}>
        {/* vine */}
        <path d="M36,10 Q28,20 32,30 Q36,36 36,36" stroke="#5a4080" strokeWidth="2.5" fill="none" strokeLinecap="round" />
        {/* drooping clusters */}
        {[0,1,2,3].map(col => {
          const cx2 = 20 + col * 11;
          const startY = 28 + col * 4;
          return Array.from({length: 5+col}, (_, row) => (
            <ellipse key={`${col}-${row}`} cx={cx2 + (row%2)*3 - 1} cy={startY + row*9}
              rx="4" ry="5" fill={c.body}
              style={{ transform: clicked ? `translateY(-3px)` : 'none' }}
              opacity={0.7 + row * 0.04} />
          ));
        })}
        {/* leaves at top */}
        {[-1,0,1].map(i => (
          <ellipse key={i} cx={30+i*8} cy={18+Math.abs(i)*4} rx="6" ry="4"
            fill="#5a7030" opacity="0.8" transform={`rotate(${i*20},${30+i*8},${18+Math.abs(i)*4})`} />
        ))}
      </g>
    );
    default: return (
      <g transform={bounce} style={{ transition: 'transform 0.25s cubic-bezier(.34,1.56,.64,1)' }}>
        <ellipse cx="36" cy="38" rx="20" ry="22" fill={c.body} opacity="0.9" />
        <ellipse cx="27" cy="34" rx="4" ry="5" fill="#fffde0" />
        <ellipse cx="45" cy="34" rx="4" ry="5" fill="#fffde0" />
        <circle cx="28" cy="35" r="2.5" fill="#0a0a2a" />
        <circle cx="46" cy="35" r="2.5" fill="#0a0a2a" />
        <circle cx="29" cy="33.5" r="1" fill="white" opacity="0.9" />
        <circle cx="47" cy="33.5" r="1" fill="white" opacity="0.9" />
      </g>
    );
  }
}

function SpiritEntity({ role, spiritName, spiritType }: { role: string; spiritName: string; spiritType: string }) {
  const isSentinel = role === '哨兵';
  const isGuide = role === '向导';
  if (!isSentinel && !isGuide) return null;

  const [clicked, setClicked] = useState(false);
  const clickTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const handleClick = () => {
    setClicked(true);
    if (clickTimer.current) clearTimeout(clickTimer.current);
    clickTimer.current = setTimeout(() => setClicked(false), 600);
  };

  // Determine species
  const species: SpiritSpecies = (() => {
    const allSpecies: SpiritSpecies[] = ['狼','猎鹰','黑豹','白狐','虎','渡鸦','玫瑰','百合','鸢尾','莲花','山茶','紫藤'];
    const found = allSpecies.find(s => s === spiritName);
    return found || 'default';
  })();

  const isPlant = spiritType === '植物' || ['玫瑰','百合','鸢尾','莲花','山茶','紫藤'].includes(species);
  const c = SPIRIT_COLORS[species] || SPIRIT_COLORS.default;
  const glowColor = c.glow;
  const displayName = spiritName || (isSentinel ? '精神体' : '精神体');

  return (
    <div
      className="absolute select-none cursor-pointer"
      style={{
        bottom: '26%',
        right: isPlant ? '14%' : '16%',
        animation: 'spirit-float 4s ease-in-out infinite',
        filter: `drop-shadow(0 0 14px ${glowColor}99)`,
        zIndex: 5
      }}
      onClick={handleClick}
      title={`点击和${displayName}互动`}
    >
      <style>{`
        @keyframes spirit-float {
          0%, 100% { transform: translateY(0px); }
          50% { transform: translateY(-10px); }
        }
        @keyframes spirit-sparkle {
          0% { opacity: 0; transform: scale(0.5) translateY(0); }
          50% { opacity: 1; }
          100% { opacity: 0; transform: scale(1.2) translateY(-16px); }
        }
      `}</style>
      <svg width="76" height="88" viewBox="0 0 72 80" fill="none" xmlns="http://www.w3.org/2000/svg">
        <defs>
          <filter id={`sf-${species}`}><feGaussianBlur stdDeviation="1.5" /></filter>
        </defs>
        {/* ambient glow */}
        <ellipse cx="36" cy="50" rx="26" ry="14" fill={glowColor} opacity="0.12" filter={`url(#sf-${species})`} />
        <SpiritBodySVG species={species} c={c} clicked={clicked} />
        {/* click sparkles */}
        {clicked && [0,1,2,3,4].map(i => {
          const a = (i/5)*Math.PI*2;
          return <circle key={i}
            cx={36+Math.cos(a)*20} cy={30+Math.sin(a)*12}
            r="3" fill={c.accent} opacity="0.9"
            style={{ animation: 'spirit-sparkle 0.5s ease-out forwards' }} />;
        })}
      </svg>
      <div className="text-center -mt-1" style={{ color: glowColor, fontSize: 10, fontWeight: 700, letterSpacing: 1, textShadow: `0 0 8px ${glowColor}` }}>
        {displayName}
      </div>
    </div>
  );
}

type PanelId = 'rest' | 'customize' | 'spirit' | 'replays' | 'password' | 'growth';

export default function HomeRoomView({
  currentUser,
  room,
  sourceMap,
  onBack,
  showToast,
  onSaved,
  refreshGlobalData,
  onRequestSwitchLocation,
  onExitToWorld,
  onEnterCustomGameRun
}: Props) {
  const isOwner = Number(currentUser.id) === Number(room.ownerId);
  const actualLoc = normalizeHomeLocation(room.homeLocation) || sourceMap;
  const theme = THEME[actualLoc];

  // Sanctuary auto-migration: if owner is ≥16 and still in sanctuary, force migrate
  const [migrating, setMigrating] = useState(false);
  const [showMigrationPrompt, setShowMigrationPrompt] = useState(false);
  const [migrationTarget, setMigrationTarget] = useState<'slums' | 'rich_area'>('slums');

  useEffect(() => {
    if (!isOwner) return;
    const ownerAge = Number(currentUser.age || 0);
    const ownerRole = String(currentUser.role || '');
    const homeLoc = normalizeHomeLocation(room.homeLocation) || sourceMap;
    const isUndifferentiated = ownerAge < 16 || ownerRole === '未分化';
    if (homeLoc === 'sanctuary' && !isUndifferentiated) {
      const target = Number(currentUser.gold || 0) >= 9999 ? 'rich_area' : 'slums';
      setMigrationTarget(target);
      setShowMigrationPrompt(true);
    }
  }, [isOwner, currentUser.age, currentUser.role, currentUser.gold, room.homeLocation, sourceMap]);

  const handleMigrate = async () => {
    if (migrating) return;
    setMigrating(true);
    try {
      const res = await fetch(`/api/users/${currentUser.id}/home`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${localStorage.getItem('USER_TOKEN') || ''}`
        },
        body: JSON.stringify({ locationId: migrationTarget })
      });
      const data = await res.json().catch(() => ({} as any));
      if (!res.ok || data.success === false) {
        showToast(data.message || '迁居失败，请联系管理员');
        return;
      }
      setShowMigrationPrompt(false);
      showToast(`已自动迁居至${migrationTarget === 'rich_area' ? '东区' : '西区'}，圣所仅供16岁以下未分化者居住。`);
      refreshGlobalData?.();
      onBack();
    } catch {
      showToast('网络错误，迁居失败');
    } finally {
      setMigrating(false);
    }
  };

  // Room settings state
  const [editDesc, setEditDesc] = useState(room.description || '');
  const [editBg, setEditBg] = useState(room.bgImage || '');
  const [editVisible, setEditVisible] = useState(room.visible !== false);
  const [editAllowVisit, setEditAllowVisit] = useState(room.allowVisit !== false);
  const [roomPassword, setRoomPassword] = useState('');
  const [roomPasswordAgain, setRoomPasswordAgain] = useState('');
  const [clearRoomPassword, setClearRoomPassword] = useState(false);
  const [saving, setSaving] = useState(false);

  // Replays state
  const [showReplays, setShowReplays] = useState(false);
  const [replayLoading, setReplayLoading] = useState(false);
  const [replays, setReplays] = useState<ReplayItem[]>([]);
  const [deletingReplayId, setDeletingReplayId] = useState<string | null>(null);

  // Growth state
  const [growing, setGrowing] = useState(false);

  // Custom game state
  const [showCustomGameApply, setShowCustomGameApply] = useState(false);
  const [customGameLoading, setCustomGameLoading] = useState(false);
  const [customGameBusy, setCustomGameBusy] = useState(false);
  const [customGameTitle, setCustomGameTitle] = useState('');
  const [customGameIdea, setCustomGameIdea] = useState('');
  const [customGameRows, setCustomGameRows] = useState<CustomGameMineRow[]>([]);

  // Spirit state
  const [spiritLoading, setSpiritLoading] = useState(false);
  const [spiritBusy, setSpiritBusy] = useState(false);
  const [spiritAvailable, setSpiritAvailable] = useState(false);
  const [spiritStatus, setSpiritStatus] = useState<SpiritStatus>(EMPTY_SPIRIT_STATUS);
  const [spiritNameDraft, setSpiritNameDraft] = useState('');
  const [spiritImageDraft, setSpiritImageDraft] = useState('');
  const [spiritAppearanceDraft, setSpiritAppearanceDraft] = useState('');

  // Active collapsible panel
  const [activePanel, setActivePanel] = useState<PanelId | null>(null);

  const [isPortraitMobile, setIsPortraitMobile] = useState(() => {
    if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') return false;
    return window.matchMedia(MOBILE_PORTRAIT_QUERY).matches;
  });

  const age = Number(currentUser.age || 0);
  const role = String(currentUser.role || '');
  const isUndifferentiatedStage = age < 16 || role === '未分化';
  const isStudentStage = age >= 16 && age <= 19;

  const canVisitorView = useMemo(() => {
    if (isOwner) return true;
    if (room.visible === false) return false;
    return true;
  }, [isOwner, room.visible]);

  const bg = editBg.trim() || room.bgImage || theme.defaultBg;

  useEffect(() => {
    if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') return;
    const media = window.matchMedia(MOBILE_PORTRAIT_QUERY);
    const onChange = (e: MediaQueryListEvent) => setIsPortraitMobile(e.matches);
    setIsPortraitMobile(media.matches);
    if (typeof media.addEventListener === 'function') {
      media.addEventListener('change', onChange);
      return () => media.removeEventListener('change', onChange);
    }
    media.addListener(onChange);
    return () => media.removeListener(onChange);
  }, []);

  const fetchReplays = async () => {
    if (!isOwner) return;
    try {
      setReplayLoading(true);
      const res = await fetch(`/api/rooms/${room.ownerId}/replays`, {
        headers: { Authorization: `Bearer ${localStorage.getItem('USER_TOKEN') || ''}` }
      });
      const data = await res.json().catch(() => ({} as any));
      if (!res.ok || data.success === false) {
        showToast(data.message || '读取回顾失败');
        return;
      }
      setReplays(Array.isArray(data.archives) ? data.archives : []);
    } catch {
      showToast('网络错误，读取回顾失败');
    } finally {
      setReplayLoading(false);
    }
  };

  useEffect(() => {
    if (showReplays && isOwner) fetchReplays();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [showReplays, isOwner, room.ownerId]);

  const saveRoomSettings = async () => {
    if (!isOwner || saving) return;
    if (!clearRoomPassword && roomPassword.trim()) {
      if (roomPassword.trim().length < 4) {
        showToast('房间密码至少 4 位');
        return;
      }
      if (roomPassword !== roomPasswordAgain) {
        showToast('两次输入的房间密码不一致');
        return;
      }
    }
    try {
      setSaving(true);
      const res = await fetch(`/api/rooms/${room.ownerId}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${localStorage.getItem('USER_TOKEN') || ''}`
        },
        body: JSON.stringify({
          visible: editVisible,
          allowVisit: editAllowVisit,
          roomDescription: editDesc,
          roomBgImage: editBg,
          roomPassword: !clearRoomPassword ? roomPassword.trim() : '',
          clearRoomPassword
        })
      });
      const data = await res.json().catch(() => ({} as any));
      if (!res.ok || data.success === false) {
        showToast(data.message || '保存失败');
        return;
      }
      const next: HomeRoomDetail = { ...room, description: editDesc, bgImage: editBg, visible: editVisible, allowVisit: editAllowVisit };
      onSaved?.(next);
      setRoomPassword('');
      setRoomPasswordAgain('');
      setClearRoomPassword(false);
      showToast('家园设置已保存');
    } catch {
      showToast('网络错误，保存失败');
    } finally {
      setSaving(false);
    }
  };

  const deleteReplay = async (archiveId: string) => {
    if (!archiveId || deletingReplayId) return;
    if (!window.confirm('确定删除这条回顾吗？删除后不可恢复。')) return;
    try {
      setDeletingReplayId(archiveId);
      const res = await fetch(`/api/rooms/${room.ownerId}/replays/${encodeURIComponent(archiveId)}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${localStorage.getItem('USER_TOKEN') || ''}` }
      });
      const data = await res.json().catch(() => ({} as any));
      if (!res.ok || data.success === false) {
        showToast(data.message || '删除回顾失败');
        return;
      }
      setReplays((prev) => prev.filter((x) => x.id !== archiveId));
      showToast('回顾已删除');
    } catch {
      showToast('网络错误，删除失败');
    } finally {
      setDeletingReplayId(null);
    }
  };

  const handleRest = async () => {
    if (!isOwner) { showToast('只有房主可以在自己的房间休息'); return; }
    try {
      const res = await fetch('/api/tower/rest', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId: currentUser.id })
      });
      if (!res.ok) { showToast('休息失败，请稍后重试'); return; }
      showToast('休息完成，状态已恢复');
      refreshGlobalData?.();
    } catch {
      showToast('网络错误，休息失败');
    }
  };

  const handleGrowthAdvance = async () => {
    if (!isOwner) { showToast('只有房主可以进行成长推进'); return; }
    if (growing) return;
    try {
      setGrowing(true);
      if (isUndifferentiatedStage) {
        const goDifferentiate = window.confirm('未分化阶段成长需要先前往命之塔进行属性分化。\n确定：前往分化抽取属性\n取消：稍后再说');
        if (!goDifferentiate) { showToast('已取消成长推进。'); return; }
        const uid = Number(currentUser.id || 0);
        const res = await fetch(`/api/characters/${uid}/location`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ locationId: 'tower_of_life' })
        });
        const data = await res.json().catch(() => ({} as any));
        if (!res.ok || data.success === false) { showToast(data.message || '前往命之塔失败'); return; }
        sessionStorage.setItem(`tower_open_differentiation_${uid}`, '1');
        refreshGlobalData?.();
        if (onRequestSwitchLocation) { onRequestSwitchLocation('tower_of_life'); } else { onBack(); }
        showToast('已前往命之塔，可直接进行属性分化。');
        return;
      }
      if (isStudentStage) {
        const ok = window.confirm('确认毕业并进入19+成年阶段吗？该成长不可逆。');
        if (!ok) return;
        const res = await fetch('/api/growth/advance', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ userId: currentUser.id, action: 'graduate' })
        });
        const data = await res.json().catch(() => ({} as any));
        if (!res.ok || data.success === false) { showToast(data.message || '毕业失败'); return; }
        showToast('毕业完成，已进入19+成年阶段');
        refreshGlobalData?.();
        return;
      }
      showToast('你已处于成年阶段，成长不可回退');
    } catch {
      showToast('网络错误，成长推进失败');
    } finally {
      setGrowing(false);
    }
  };

  const loadMyCustomGames = async (silent = false) => {
    try {
      setCustomGameLoading(true);
      const res = await fetch('/api/custom-games/mine', {
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${localStorage.getItem('USER_TOKEN') || ''}` }
      });
      const data = await res.json().catch(() => ([] as any[]));
      if (!res.ok) { if (!silent) showToast('读取灾厄申请列表失败'); return; }
      setCustomGameRows((Array.isArray(data) ? data : []).map((x: any) => ({
        id: Number(x.id || 0),
        title: String(x.title || `灾厄游戏#${x.id || 0}`),
        status: String(x.status || '未知'),
        voteStatus: String(x.vote_status || 'none'),
        createdAt: String(x.created_at || '')
      })));
    } catch {
      if (!silent) showToast('网络错误，读取灾厄申请列表失败');
    } finally {
      setCustomGameLoading(false);
    }
  };

  const submitCustomGameApply = async () => {
    const title = customGameTitle.trim();
    const ideaText = customGameIdea.trim();
    if (!title) { showToast('请填写灾厄游戏标题'); return; }
    if (!ideaText) { showToast('请填写游戏大纲'); return; }
    if (customGameBusy) return;
    try {
      setCustomGameBusy(true);
      const res = await fetch('/api/custom-games', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${localStorage.getItem('USER_TOKEN') || ''}` },
        body: JSON.stringify({ title, ideaText })
      });
      const data = await res.json().catch(() => ({} as any));
      if (!res.ok) { showToast(data.message || '提交灾厄申请失败'); return; }
      setCustomGameTitle('');
      setCustomGameIdea('');
      showToast('灾厄申请已提交，等待管理员审核');
      await loadMyCustomGames(true);
    } catch {
      showToast('网络错误，提交灾厄申请失败');
    } finally {
      setCustomGameBusy(false);
    }
  };

  const loadSpiritStatus = async (silent = false) => {
    if (!isOwner) return;
    try {
      setSpiritLoading(true);
      const res = await fetch(`/api/users/${currentUser.id}/spirit-status`, {
        headers: { Authorization: `Bearer ${localStorage.getItem('USER_TOKEN') || ''}` }
      });
      const data = await res.json().catch(() => ({} as any));
      if (!res.ok || data.success === false) { if (!silent) showToast(data.message || '读取精神体状态失败'); return; }
      const raw = data.spiritStatus || {};
      setSpiritStatus({
        name: String(raw.name || ''),
        intimacy: Number(raw.intimacy || 0),
        level: Math.max(1, Number(raw.level || 1)),
        imageUrl: String(raw.imageUrl || ''),
        appearance: String(raw.appearance || ''),
        daily: { feed: Number(raw.daily?.feed || 0), pet: Number(raw.daily?.pet || 0), train: Number(raw.daily?.train || 0) }
      });
      setSpiritAvailable(Boolean(data.available));
      if (!Boolean(data.available) && !silent) showToast('当前身份暂未开放精神体培养功能');
    } catch {
      if (!silent) showToast('网络错误，读取精神体状态失败');
    } finally {
      setSpiritLoading(false);
    }
  };

  const saveSpiritProfile = async () => {
    if (!isOwner || spiritBusy) return;
    const name = spiritNameDraft.trim();
    const imageUrl = spiritImageDraft.trim();
    const appearance = spiritAppearanceDraft.trim();
    if (!name && !imageUrl && !appearance) { showToast('请至少填写一个精神体资料项'); return; }
    try {
      setSpiritBusy(true);
      const res = await fetch('/api/tower/interact-spirit', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId: currentUser.id, name, imageUrl, appearance })
      });
      const data = await res.json().catch(() => ({} as any));
      if (!res.ok || data.success === false) { showToast(data.message || '保存精神体资料失败'); return; }
      showToast(data.message || '精神体资料已更新');
      setSpiritNameDraft(''); setSpiritImageDraft(''); setSpiritAppearanceDraft('');
      await loadSpiritStatus(true);
      refreshGlobalData?.();
    } catch {
      showToast('网络错误，保存精神体资料失败');
    } finally {
      setSpiritBusy(false);
    }
  };

  const interactSpirit = async (action: 'feed' | 'pet' | 'train') => {
    if (!isOwner || spiritBusy || !spiritAvailable) return;
    try {
      setSpiritBusy(true);
      const res = await fetch('/api/tower/interact-spirit', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId: currentUser.id, action })
      });
      const data = await res.json().catch(() => ({} as any));
      if (!res.ok || data.success === false) { showToast(data.message || '精神体互动失败'); return; }
      showToast(data.message || '精神体互动完成');
      await loadSpiritStatus(true);
      refreshGlobalData?.();
    } catch {
      showToast('网络错误，精神体互动失败');
    } finally {
      setSpiritBusy(false);
    }
  };

  const exportReplayTxt = async () => {
    try {
      const res = await fetch(`/api/rooms/${room.ownerId}/replays/export?format=txt`, {
        headers: { Authorization: `Bearer ${localStorage.getItem('USER_TOKEN') || ''}` }
      });
      if (!res.ok) { showToast('导出失败：暂无记录或接口不可用'); return; }
      const blob = await res.blob();
      const a = document.createElement('a');
      a.href = URL.createObjectURL(blob);
      a.download = `${room.ownerName}-家园回放.txt`;
      a.click();
      URL.revokeObjectURL(a.href);
      showToast('回放导出完成');
    } catch {
      showToast('导出失败');
    }
  };

  const togglePanel = (id: PanelId) => {
    if (id === 'spirit' && activePanel !== 'spirit') loadSpiritStatus(true);
    if (id === 'replays' && activePanel !== 'replays') fetchReplays();
    setActivePanel((prev) => prev === id ? null : id);
  };

  // Panel button config
  const panels: { id: PanelId; label: string; ownerOnly: boolean; color: string }[] = [
    { id: 'rest', label: '休息', ownerOnly: true, color: 'bg-indigo-700 hover:bg-indigo-600' },
    { id: 'customize', label: '自定义', ownerOnly: true, color: 'bg-emerald-700 hover:bg-emerald-600' },
    { id: 'spirit', label: '精神体', ownerOnly: true, color: 'bg-violet-700 hover:bg-violet-600' },
    { id: 'replays', label: '回顾', ownerOnly: true, color: 'bg-slate-700 hover:bg-slate-600' },
    { id: 'password', label: '密码', ownerOnly: true, color: 'bg-amber-700 hover:bg-amber-600' },
    { id: 'growth', label: '成长', ownerOnly: true, color: 'bg-fuchsia-700 hover:bg-fuchsia-600' },
  ];
  const visiblePanels = panels.filter((p) => !p.ownerOnly || isOwner);

  if (showMigrationPrompt) {
    const destName = migrationTarget === 'rich_area' ? '东区（富人区）' : '西区（平民区）';
    return (
      <div className="fixed inset-0 z-[220] bg-black/80 text-white flex items-center justify-center p-6 mobile-portrait-safe-overlay">
        <div className="max-w-md w-full rounded-2xl border border-amber-600/50 bg-slate-900 p-6 text-center mobile-portrait-safe-card mobile-contrast-surface-dark">
          <div className="text-3xl mb-3">🏠</div>
          <p className="text-lg font-black mb-2 text-amber-200">圣所居住资格变更</p>
          <p className="text-sm text-slate-300 mb-4 leading-relaxed">
            圣所仅供<span className="text-amber-300 font-bold">16岁以下未分化者</span>居住。<br />
            你已成长，将被自动迁居至 <span className="text-sky-300 font-bold">{destName}</span>。
          </p>
          <button
            onClick={handleMigrate}
            disabled={migrating}
            className="w-full py-2.5 rounded-xl bg-amber-600 hover:bg-amber-500 font-black disabled:opacity-60"
          >
            {migrating ? '迁居中...' : `确认迁居至${destName}`}
          </button>
        </div>
      </div>
    );
  }

  if (!canVisitorView) {
    return (
      <div className="fixed inset-0 z-[220] bg-black text-white flex items-center justify-center p-6 mobile-portrait-safe-overlay">
        <div className="max-w-md w-full rounded-2xl border border-slate-700 bg-slate-900 p-6 text-center mobile-portrait-safe-card mobile-contrast-surface-dark">
          <p className="text-lg font-black mb-2">该家园暂不开放访问</p>
          <p className="text-sm text-slate-400 mb-4">房主未公开该房间。</p>
          <button onClick={onBack} className="px-4 py-2 rounded-xl bg-slate-700 hover:bg-slate-600">返回</button>
        </div>
      </div>
    );
  }

  return (
    <div className={`fixed inset-0 z-[220] text-white overflow-hidden${isPortraitMobile ? ' mobile-room-safe' : ''}`}>
      {/* Background room image - full screen */}
      <div className="absolute inset-0">
        <img src={bg} className="w-full h-full object-cover" alt="home-bg" />
        <div className={`absolute inset-0 bg-gradient-to-br ${theme.overlay} opacity-70`} />
        <div className="absolute inset-0 bg-black/25" />
      </div>

      {/* Floating spirit entity for sentinel/guide */}
      {isOwner && (
        <SpiritEntity
          role={role}
          spiritName={(room as any).spiritName || spiritStatus.name || ''}
          spiritType={(room as any).spiritType || ''}
        />
      )}
      {!isOwner && (
        <SpiritEntity
          role={room.role || ''}
          spiritName={(room as any).spiritName || ''}
          spiritType={(room as any).spiritType || ''}
        />
      )}

      {/* Top bar */}
      <div
        className="relative z-10 flex items-center justify-between px-4 py-3 bg-black/30 backdrop-blur-md border-b border-white/10"
        style={isPortraitMobile ? { paddingTop: 'calc(env(safe-area-inset-top, 0px) + clamp(40px,10dvh,80px))' } : undefined}
      >
        <div className="flex items-center gap-2">
          <button
            onClick={onBack}
            className="inline-flex items-center gap-2 px-3 py-1.5 rounded-xl bg-black/40 border border-white/20 text-sm font-bold hover:bg-black/60 transition-colors"
          >
            <ArrowLeft size={15} /> {theme.backText}
          </button>
          {onExitToWorld && (
            <button
              onClick={onExitToWorld}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-sky-900/50 border border-sky-500/30 text-xs font-bold text-sky-300 hover:bg-sky-800/60 transition-colors"
            >
              🌍 回到世界
            </button>
          )}
        </div>
        <div className="text-sm font-bold text-white/90 flex items-center gap-2">
          <span className={`text-xs px-2 py-0.5 rounded-full bg-black/30 border border-white/15 ${theme.accent}`}>{theme.name}</span>
          {room.ownerName} 的家园
        </div>
      </div>

      {/* Room description overlay (top-center) */}
      {room.description && (
        <div className="absolute top-16 left-1/2 -translate-x-1/2 z-10 max-w-xs w-full px-4">
          <div className="bg-black/50 backdrop-blur-md rounded-2xl border border-white/10 px-4 py-2 text-xs text-white/80 text-center leading-relaxed">
            {room.description}
          </div>
        </div>
      )}

      {/* Owner info plaque (left side) */}
      <div className="absolute left-4 top-20 z-10">
        <div className="bg-black/50 backdrop-blur-md rounded-2xl border border-white/10 px-3 py-3 flex flex-col items-center gap-2 min-w-[80px]">
          <div className="w-12 h-12 rounded-full border-2 border-white/20 overflow-hidden bg-slate-800">
            {room.avatarUrl ? (
              <img src={room.avatarUrl} className="w-full h-full object-cover" alt="" />
            ) : (
              <div className="w-full h-full flex items-center justify-center text-white/40 font-black text-lg">
                {room.ownerName?.[0] || '?'}
              </div>
            )}
          </div>
          <div className="text-center">
            <div className="text-xs font-black text-white truncate max-w-[80px]">{room.ownerName}</div>
            <div className="text-[10px] text-white/50 mt-0.5">{room.job || NONE}</div>
            <div className="text-[10px] text-white/50">{room.role || '未知'}</div>
          </div>
        </div>
      </div>

      {/* Visitor notice */}
      {!isOwner && (
        <div className="absolute right-4 top-20 z-10">
          <div className="bg-black/50 backdrop-blur-md rounded-xl border border-white/10 px-3 py-2 text-[11px] text-white/60">
            访客模式
          </div>
        </div>
      )}

      {/* Bottom collapsible function panels */}
      <div
        className="absolute left-0 right-0 z-10"
        style={{ bottom: isPortraitMobile ? 'calc(env(safe-area-inset-bottom, 0px) + clamp(40px,10dvh,80px))' : 0 }}
      >
        {/* Panel content area */}
        {activePanel && (
          <div className="bg-black/75 backdrop-blur-xl border-t border-white/10 max-h-64 overflow-y-auto custom-scrollbar p-4">
            {/* Rest panel */}
            {activePanel === 'rest' && isOwner && (
              <div className="space-y-3">
                <p className="text-xs text-white/60">在自己的房间休息可恢复HP/MP至满值。</p>
                <button
                  onClick={handleRest}
                  className="w-full py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 font-black flex items-center justify-center gap-2"
                >
                  <BedDouble size={15} /> 休息（恢复状态）
                </button>
              </div>
            )}

            {/* Customize panel */}
            {activePanel === 'customize' && isOwner && (
              <div className="space-y-2.5">
                <textarea
                  value={editDesc}
                  onChange={(e) => setEditDesc(e.target.value)}
                  className="w-full h-20 p-2 rounded-lg bg-slate-950 border border-slate-700 text-xs resize-none"
                  placeholder="输入房间介绍..."
                />
                <input
                  value={editBg}
                  onChange={(e) => setEditBg(e.target.value)}
                  className="w-full p-2 rounded-lg bg-slate-950 border border-slate-700 text-xs"
                  placeholder={`背景图链接（留空使用默认：${theme.defaultBg}）`}
                />
                <div className="flex gap-4 text-xs">
                  <label className="flex items-center gap-1.5">
                    <input type="checkbox" checked={editVisible} onChange={(e) => setEditVisible(e.target.checked)} />
                    房间公开
                  </label>
                  <label className="flex items-center gap-1.5">
                    <input type="checkbox" checked={editAllowVisit} onChange={(e) => setEditAllowVisit(e.target.checked)} />
                    允许访客
                  </label>
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    onClick={saveRoomSettings}
                    disabled={saving}
                    className="py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 font-black text-xs flex items-center justify-center gap-1.5 disabled:opacity-60"
                  >
                    <Save size={13} /> {saving ? '保存中...' : '保存设置'}
                  </button>
                  <button
                    onClick={() => setShowCustomGameApply(true)}
                    className="py-2 rounded-xl bg-rose-700 hover:bg-rose-600 font-black text-xs flex items-center justify-center gap-1.5"
                  >
                    <MessageSquarePlus size={13} /> 灾厄申请
                  </button>
                </div>
              </div>
            )}

            {/* Spirit panel */}
            {activePanel === 'spirit' && isOwner && (
              <div className="space-y-3">
                {spiritLoading ? (
                  <div className="text-xs text-slate-400">读取精神体状态中...</div>
                ) : (
                  <>
                    <div className="flex items-center gap-3">
                      <div className="w-12 h-12 rounded-xl border border-slate-700 bg-slate-900 overflow-hidden shrink-0">
                        {spiritStatus.imageUrl ? (
                          <img src={spiritStatus.imageUrl} alt="spirit-avatar" className="w-full h-full object-cover" />
                        ) : (
                          <div className="w-full h-full flex items-center justify-center text-violet-300 text-lg font-black">灵</div>
                        )}
                      </div>
                      <div>
                        <p className="text-sm font-black">{spiritStatus.name || '未命名精神体'}</p>
                        <p className="text-[11px] text-slate-400">等级 {spiritStatus.level} · 亲密度 {spiritStatus.intimacy}</p>
                        <p className="text-[10px] text-slate-500">
                          今日：喂 {spiritStatus.daily.feed}/3 · 摸 {spiritStatus.daily.pet}/3 · 练 {spiritStatus.daily.train}/3
                        </p>
                      </div>
                    </div>
                    {!spiritAvailable && (
                      <div className="text-[11px] text-amber-300 bg-amber-900/20 border border-amber-700/30 rounded-lg px-3 py-1.5">
                        当前身份暂未开放精神体培养（仅哨兵/向导可用）
                      </div>
                    )}
                    <div className="grid grid-cols-3 gap-2">
                      <button onClick={() => interactSpirit('feed')} disabled={!spiritAvailable || spiritBusy} className="py-2 rounded-xl bg-emerald-700 hover:bg-emerald-600 text-xs font-black disabled:opacity-50">喂食 +5</button>
                      <button onClick={() => interactSpirit('pet')} disabled={!spiritAvailable || spiritBusy} className="py-2 rounded-xl bg-sky-700 hover:bg-sky-600 text-xs font-black disabled:opacity-50">摸摸 +8</button>
                      <button onClick={() => interactSpirit('train')} disabled={!spiritAvailable || spiritBusy} className="py-2 rounded-xl bg-fuchsia-700 hover:bg-fuchsia-600 text-xs font-black disabled:opacity-50">训练 +3</button>
                    </div>
                    <div className="space-y-1.5">
                      <input value={spiritNameDraft} onChange={(e) => setSpiritNameDraft(e.target.value)} placeholder="精神体名称（仅首次可锁定）" className="w-full p-2 rounded-lg bg-slate-950 border border-slate-700 text-xs" />
                      <input value={spiritImageDraft} onChange={(e) => setSpiritImageDraft(e.target.value)} placeholder="精神体头像链接（仅首次可锁定）" className="w-full p-2 rounded-lg bg-slate-950 border border-slate-700 text-xs" />
                      <button onClick={saveSpiritProfile} disabled={spiritBusy} className="w-full py-2 rounded-xl bg-violet-600 hover:bg-violet-500 text-xs font-black disabled:opacity-60">
                        {spiritBusy ? '处理中...' : '保存精神体资料'}
                      </button>
                    </div>
                  </>
                )}
              </div>
            )}

            {/* Replays panel */}
            {activePanel === 'replays' && isOwner && (
              <div className="space-y-3">
                <div className="flex gap-2">
                  <button onClick={exportReplayTxt} className="flex-1 py-2 rounded-xl bg-slate-700 hover:bg-slate-600 text-xs font-black flex items-center justify-center gap-1.5">
                    <Download size={13} /> 导出 TXT
                  </button>
                  <button onClick={fetchReplays} disabled={replayLoading} className="flex-1 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-xs font-black disabled:opacity-60">
                    {replayLoading ? '刷新中...' : '刷新列表'}
                  </button>
                </div>
                {replayLoading ? (
                  <div className="text-xs text-slate-400">加载中...</div>
                ) : replays.length === 0 ? (
                  <div className="text-xs text-slate-500">暂无回顾记录</div>
                ) : (
                  replays.map((arc) => (
                    <div key={arc.id} className="rounded-xl border border-slate-700 bg-slate-900/60 p-2.5 flex items-center gap-2">
                      <div className="flex-1 min-w-0">
                        <p className="text-xs font-bold text-slate-100 truncate">{arc.title || arc.id}</p>
                        <p className="text-[10px] text-slate-400">{arc.locationName} · {arc.messageCount} 条</p>
                      </div>
                      <button
                        onClick={() => deleteReplay(arc.id)}
                        disabled={deletingReplayId === arc.id}
                        className="shrink-0 px-2 py-1 rounded bg-rose-700 hover:bg-rose-600 text-[11px] font-bold flex items-center gap-1 disabled:opacity-60"
                      >
                        <Trash2 size={11} /> 删除
                      </button>
                    </div>
                  ))
                )}
              </div>
            )}

            {/* Password panel */}
            {activePanel === 'password' && isOwner && (
              <div className="space-y-2">
                <input
                  type="password"
                  value={roomPassword}
                  onChange={(e) => setRoomPassword(e.target.value)}
                  className="w-full p-2 rounded-lg bg-slate-950 border border-slate-700 text-xs"
                  placeholder="新房间密码（留空表示不修改）"
                />
                <input
                  type="password"
                  value={roomPasswordAgain}
                  onChange={(e) => setRoomPasswordAgain(e.target.value)}
                  className="w-full p-2 rounded-lg bg-slate-950 border border-slate-700 text-xs"
                  placeholder="重复输入新密码"
                />
                <label className="text-xs flex items-center gap-2">
                  <input type="checkbox" checked={clearRoomPassword} onChange={(e) => setClearRoomPassword(e.target.checked)} />
                  清空房间密码
                </label>
                <button
                  onClick={saveRoomSettings}
                  disabled={saving}
                  className="w-full py-2 rounded-xl bg-amber-600 hover:bg-amber-500 font-black text-xs flex items-center justify-center gap-1.5 disabled:opacity-60"
                >
                  <Settings size={13} /> {saving ? '保存中...' : '保存密码设置'}
                </button>
              </div>
            )}

            {/* Growth panel */}
            {activePanel === 'growth' && isOwner && (
              <div className="space-y-3">
                <div className="text-xs text-white/60 leading-relaxed">
                  {isUndifferentiatedStage ? '未分化阶段：点击前往命之塔进行属性分化。' :
                   isStudentStage ? '学生阶段（16-19岁）：点击确认毕业进入19+成年阶段。' :
                   '你已处于成年阶段（19+），成长路径已完成。'}
                </div>
                {(isUndifferentiatedStage || isStudentStage) && (
                  <button
                    onClick={handleGrowthAdvance}
                    disabled={growing}
                    className="w-full py-2.5 rounded-xl bg-fuchsia-600 hover:bg-fuchsia-500 font-black text-sm disabled:opacity-60 flex items-center justify-center gap-2"
                  >
                    <Sparkles size={15} />
                    {isUndifferentiatedStage
                      ? (growing ? '前往中...' : '前往命之塔分化')
                      : (growing ? '处理中...' : '确认毕业 → 19+')}
                  </button>
                )}
              </div>
            )}
          </div>
        )}

        {/* Panel tab buttons */}
        <div className="flex items-center gap-1 px-3 py-2 bg-black/60 backdrop-blur-md border-t border-white/10 overflow-x-auto">
          {visiblePanels.map((p) => (
            <button
              key={p.id}
              onClick={() => togglePanel(p.id)}
              className={`shrink-0 flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-black transition-all ${
                activePanel === p.id
                  ? `${p.color} text-white ring-1 ring-white/20`
                  : 'bg-white/10 hover:bg-white/20 text-white/70'
              }`}
            >
              {p.label}
              {activePanel === p.id ? <ChevronDown size={11} /> : <ChevronUp size={11} />}
            </button>
          ))}
        </div>
      </div>

      {/* Custom game modal */}
      {showCustomGameApply && (
        <div className="fixed inset-0 z-[255] bg-black/70 flex items-center justify-center p-4 mobile-portrait-safe-overlay">
          <div className="w-full max-w-6xl rounded-3xl border border-rose-700/40 bg-slate-900/95 p-5 shadow-2xl mobile-portrait-safe-card mobile-contrast-surface-dark">
            <div className="flex items-center justify-between gap-3 mb-3">
              <h4 className="text-base font-black text-rose-200 flex items-center gap-2">
                <MessageSquarePlus size={15} /> 灾厄游戏中心
              </h4>
              <button onClick={() => setShowCustomGameApply(false)} className="px-3 py-1.5 rounded-lg bg-slate-800 border border-slate-700 text-xs font-bold">关闭</button>
            </div>
            <CustomGamePlayerView
              user={currentUser as any}
              showToast={showToast}
              onEnterRun={(gameId) => {
                setShowCustomGameApply(false);
                onEnterCustomGameRun?.(gameId);
              }}
            />
          </div>
        </div>
      )}
    </div>
  );
}
