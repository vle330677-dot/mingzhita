import { useEffect, useMemo, useState } from 'react';
import { BookOpen, X } from 'lucide-react';
import { apiFetch } from '../../utils/http';

interface Props {
  refreshKey: number;
  onNotice: (message: string) => void;
}

interface CatalogSkillRow {
  id?: number;
  name: string;
  faction?: string;
  tier?: string;
  description?: string;
  npcId?: number | null;
}

const SKILL_FACTIONS = ['物理系', '元素系', '精神系', '感知系', '信息系', '治疗系', '强化系', '炼金系', '圣所', '普通人', '恶魔会', '通用'];
const TIERS = ['低阶', '中阶', '高阶'];
const EMPTY_SKILL: CatalogSkillRow = { name: '', faction: '通用', tier: '低阶', description: '', npcId: null };

export function AdminSkillsPanel({ refreshKey, onNotice }: Props) {
  const [skills, setSkills] = useState<CatalogSkillRow[]>([]);
  const [filter, setFilter] = useState('');
  const [editingSkill, setEditingSkill] = useState<CatalogSkillRow | null>(null);

  const filteredSkills = useMemo(() => {
    const keyword = filter.trim().toLowerCase();
    if (!keyword) return skills;
    return skills.filter((skill) => [skill.name, skill.faction, skill.tier, skill.description].some((value) => String(value || '').toLowerCase().includes(keyword)));
  }, [filter, skills]);

  const groupedSkills = useMemo(() => {
    const groups = SKILL_FACTIONS.map((faction) => ({ faction, rows: filteredSkills.filter((skill) => String(skill.faction || '通用') === faction) }));
    const rest = filteredSkills.filter((skill) => !SKILL_FACTIONS.includes(String(skill.faction || '通用')));
    return rest.length ? [...groups, { faction: '其他', rows: rest }] : groups;
  }, [filteredSkills]);

  const loadSkills = async () => {
    const data = await apiFetch<any>('/api/skills', { auth: 'admin' });
    setSkills(Array.isArray(data.skills) ? data.skills : []);
  };

  useEffect(() => {
    loadSkills().catch((error) => onNotice(error?.message || '加载技能失败'));
  }, [refreshKey]);

  const saveSkill = async () => {
    if (!editingSkill?.name?.trim()) {
      onNotice('请填写技能名称');
      return;
    }
    try {
      const payload = { ...editingSkill, npcId: normalizeNullableNumber(editingSkill.npcId) };
      const data = editingSkill.id
        ? await apiFetch<any>(`/api/admin/skills/${editingSkill.id}`, { auth: 'admin', method: 'PUT', body: payload })
        : await apiFetch<any>('/api/admin/skills', { auth: 'admin', method: 'POST', body: payload });
      onNotice(data.message || '技能已保存');
      setEditingSkill(null);
      await loadSkills();
    } catch (error: any) {
      onNotice(error?.message || '保存技能失败');
    }
  };

  const deleteSkill = async (row: CatalogSkillRow) => {
    if (!row.id || !window.confirm(`确认删除技能 ${row.name}？`)) return;
    try {
      const data = await apiFetch<any>(`/api/admin/skills/${row.id}`, { auth: 'admin', method: 'DELETE' });
      onNotice(data.message || '技能已删除');
      await loadSkills();
    } catch (error: any) {
      onNotice(error?.message || '删除技能失败');
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
        <label className="block min-w-0 flex-1 text-xs font-black text-slate-500">
          <span className="mb-1 block">筛选技能</span>
          <input value={filter} onChange={(event) => setFilter(event.target.value)} placeholder="名字 / 派系 / 阶级" className="w-full rounded-2xl border border-slate-200 px-4 py-3 text-sm text-slate-900" />
        </label>
        <button onClick={() => setEditingSkill({ ...EMPTY_SKILL })} className="rounded-2xl bg-slate-900 px-4 py-2 text-sm font-black text-white hover:bg-slate-800">新建技能</button>
      </div>

      <div className="space-y-4">
        {groupedSkills.map((group) => (
          <div key={group.faction} className="space-y-3">
            <div className="text-sm font-black text-slate-500">{group.faction}</div>
            {group.rows.length === 0 ? (
              <div className="rounded-2xl border border-dashed border-slate-200 bg-slate-50 px-4 py-5 text-center text-sm text-slate-500">该分类下暂无技能</div>
            ) : (
              <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
                {group.rows.map((skill) => (
                  <div key={skill.id || skill.name} className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <div className="font-black">{skill.name}</div>
                        <div className="text-xs text-slate-500">{skill.faction || '通用'} · {skill.tier || '低阶'}</div>
                      </div>
                      <div className="rounded-full bg-sky-100 px-3 py-1 text-xs font-black text-sky-700">{skill.tier || '低阶'}</div>
                    </div>
                    <div className="mt-3 text-sm leading-6 text-slate-700">{skill.description || '暂无描述'}</div>
                    <div className="mt-3 flex gap-2">
                      <button onClick={() => setEditingSkill({ ...skill })} className="rounded-xl bg-slate-900 px-3 py-1.5 text-xs font-black text-white hover:bg-slate-800">编辑</button>
                      <button onClick={() => deleteSkill(skill)} className="rounded-xl bg-rose-100 px-3 py-1.5 text-xs font-black text-rose-700 hover:bg-rose-200">删除</button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        ))}
      </div>

      {editingSkill && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/60 p-4">
          <div className="w-full max-w-2xl rounded-[2rem] bg-white p-6 shadow-2xl">
            <div className="mb-4 flex items-center justify-between gap-3">
              <div className="flex items-center gap-2 text-xl font-black"><BookOpen size={18} />{editingSkill.id ? `编辑技能：${editingSkill.name}` : '新建技能'}</div>
              <button onClick={() => setEditingSkill(null)} className="rounded-full bg-slate-100 p-2 text-slate-500 hover:bg-slate-200"><X size={18} /></button>
            </div>
            <div className="grid gap-3 md:grid-cols-2">
              <Field label="名称" value={editingSkill.name || ''} onChange={(value) => setEditingSkill({ ...editingSkill, name: value })} />
              <SelectField label="派系" value={editingSkill.faction || '通用'} onChange={(value) => setEditingSkill({ ...editingSkill, faction: value })} options={SKILL_FACTIONS.map((value) => ({ value, label: value }))} />
              <SelectField label="阶级" value={editingSkill.tier || '低阶'} onChange={(value) => setEditingSkill({ ...editingSkill, tier: value })} options={TIERS.map((value) => ({ value, label: value }))} />
              <Field label="NPC 编号（可空）" value={String(editingSkill.npcId ?? '')} onChange={(value) => setEditingSkill({ ...editingSkill, npcId: value ? Number(value) : null })} />
            </div>
            <label className="mt-4 block text-xs font-black text-slate-500"><span className="mb-1 block">描述</span><textarea value={editingSkill.description || ''} onChange={(event) => setEditingSkill({ ...editingSkill, description: event.target.value })} rows={5} className="w-full rounded-2xl border border-slate-200 px-4 py-3 text-sm text-slate-900" /></label>
            <div className="mt-4 flex justify-end gap-2">
              <button onClick={() => setEditingSkill(null)} className="rounded-2xl bg-slate-100 px-4 py-2 font-black text-slate-700 hover:bg-slate-200">取消</button>
              <button onClick={saveSkill} className="rounded-2xl bg-slate-900 px-4 py-2 font-black text-white hover:bg-slate-800">保存技能</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function normalizeNullableNumber(value: number | null | undefined) {
  return value === null || value === undefined || Number.isNaN(Number(value)) ? null : Number(value);
}

function Field({ label, value, onChange }: { label: string; value: string; onChange: (value: string) => void }) {
  return <label className="block text-xs font-black text-slate-500"><span className="mb-1 block">{label}</span><input value={value} onChange={(event) => onChange(event.target.value)} className="w-full rounded-2xl border border-slate-200 px-4 py-3 text-sm text-slate-900" /></label>;
}

function SelectField({ label, value, onChange, options }: { label: string; value: string; onChange: (value: string) => void; options: Array<{ value: string; label: string }> }) {
  return <label className="block text-xs font-black text-slate-500"><span className="mb-1 block">{label}</span><select value={value} onChange={(event) => onChange(event.target.value)} className="w-full rounded-2xl border border-slate-200 px-4 py-3 text-sm text-slate-900">{options.map((option) => <option key={`${option.value}-${option.label}`} value={option.value}>{option.label}</option>)}</select></label>;
}
