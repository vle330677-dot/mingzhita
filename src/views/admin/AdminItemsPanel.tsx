import { useEffect, useMemo, useState } from 'react';
import { Package, X } from 'lucide-react';
import { apiFetch } from '../../utils/http';

interface Props {
  refreshKey: number;
  onNotice: (message: string) => void;
}

interface CatalogItemRow {
  id?: number;
  name: string;
  description?: string;
  locationTag?: string;
  npcId?: number | null;
  price?: number;
  faction?: string;
  tier?: string;
  itemType?: string;
  effectValue?: number;
}

const TIERS = ['低阶', '中阶', '高阶'];
const ITEM_TYPES = ['回复道具', '任务道具', '技能书道具', '贵重物品', '违禁品'];
const ITEM_LOCATIONS = [
  { value: 'all', label: '全图' },
  { value: 'tower_of_life', label: '命之塔' },
  { value: 'sanctuary', label: '圣所' },
  { value: 'london_tower', label: '伦敦塔' },
  { value: 'slums', label: '西市' },
  { value: 'rich_area', label: '东市' },
  { value: 'demon_society', label: '恶魔会' },
  { value: 'guild', label: '公会' },
  { value: 'army', label: '军队' },
  { value: 'tower_guard', label: '守塔会' },
  { value: 'observers', label: '观察者' },
  { value: 'paranormal_office', label: '灵异管理所' },
];
const EMPTY_ITEM: CatalogItemRow = { name: '', description: '', locationTag: 'all', faction: '全图', price: 0, tier: '低阶', itemType: '回复道具', effectValue: 0, npcId: null };

function formatItemLocation(locationTag: string | undefined) {
  const key = String(locationTag || 'all');
  return ITEM_LOCATIONS.find((option) => option.value === key)?.label || key;
}

export function AdminItemsPanel({ refreshKey, onNotice }: Props) {
  const [items, setItems] = useState<CatalogItemRow[]>([]);
  const [filter, setFilter] = useState('');
  const [editingItem, setEditingItem] = useState<CatalogItemRow | null>(null);

  const filteredItems = useMemo(() => {
    const keyword = filter.trim().toLowerCase();
    if (!keyword) return items;
    return items.filter((item) => [item.name, item.faction, item.itemType, item.locationTag, item.description].some((value) => String(value || '').toLowerCase().includes(keyword)));
  }, [filter, items]);

  const loadItems = async () => {
    const data = await apiFetch<any>('/api/items', { auth: 'admin' });
    setItems(Array.isArray(data.items) ? data.items : []);
  };

  useEffect(() => {
    loadItems().catch((error) => onNotice(error?.message || '加载物品失败'));
  }, [refreshKey]);

  const saveItem = async () => {
    if (!editingItem?.name?.trim()) {
      onNotice('请填写物品名称');
      return;
    }
    try {
      const payload = { ...editingItem, npcId: normalizeNullableNumber(editingItem.npcId) };
      const data = editingItem.id
        ? await apiFetch<any>(`/api/admin/items/${editingItem.id}`, { auth: 'admin', method: 'PUT', body: payload })
        : await apiFetch<any>('/api/admin/items', { auth: 'admin', method: 'POST', body: payload });
      onNotice(data.message || '物品已保存');
      setEditingItem(null);
      await loadItems();
    } catch (error: any) {
      onNotice(error?.message || '保存物品失败');
    }
  };

  const deleteItem = async (row: CatalogItemRow) => {
    if (!row.id || !window.confirm(`确认删除物品 ${row.name}？`)) return;
    try {
      const data = await apiFetch<any>(`/api/admin/items/${row.id}`, { auth: 'admin', method: 'DELETE' });
      onNotice(data.message || '物品已删除');
      await loadItems();
    } catch (error: any) {
      onNotice(error?.message || '删除物品失败');
    }
  };

  const seedCatalogDefaults = async () => {
    try {
      const data = await apiFetch<any>('/api/admin/catalog/bootstrap-defaults', { auth: 'admin', method: 'POST' });
      onNotice(data.message || '已补齐默认物品与技能');
      await loadItems();
    } catch (error: any) {
      onNotice(error?.message || '补齐默认配置失败');
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
        <label className="block min-w-0 flex-1 text-xs font-black text-slate-500">
          <span className="mb-1 block">筛选物品</span>
          <input value={filter} onChange={(event) => setFilter(event.target.value)} placeholder="名字 / 阵营 / 类型 / 地图" className="w-full rounded-2xl border border-slate-200 px-4 py-3 text-sm text-slate-900" />
        </label>
        <div className="flex gap-2">
          <button onClick={seedCatalogDefaults} className="rounded-2xl bg-amber-500 px-4 py-2 text-sm font-black text-slate-950 hover:bg-amber-400">补齐默认配置</button>
          <button onClick={() => setEditingItem({ ...EMPTY_ITEM })} className="rounded-2xl bg-slate-900 px-4 py-2 text-sm font-black text-white hover:bg-slate-800">新建物品</button>
        </div>
      </div>

      <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
        {filteredItems.map((item) => (
          <div key={item.id || item.name} className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
            <div className="flex items-start justify-between gap-3">
              <div>
                <div className="font-black">{item.name}</div>
                <div className="text-xs text-slate-500">{item.faction || '通用'} · {item.tier || '低阶'} · {item.itemType || '回复道具'}</div>
              </div>
              <div className="rounded-full bg-slate-200 px-3 py-1 text-xs font-black text-slate-700">{Number(item.price || 0)} 金币</div>
            </div>
            <div className="mt-3 text-sm leading-6 text-slate-700">{item.description || '暂无描述'}</div>
            <div className="mt-3 text-xs text-slate-500">掉落区域：{formatItemLocation(item.locationTag)} · 效果值：{Number(item.effectValue || 0)}</div>
            <div className="mt-3 flex gap-2">
              <button onClick={() => setEditingItem({ ...item })} className="rounded-xl bg-slate-900 px-3 py-1.5 text-xs font-black text-white hover:bg-slate-800">编辑</button>
              <button onClick={() => deleteItem(item)} className="rounded-xl bg-rose-100 px-3 py-1.5 text-xs font-black text-rose-700 hover:bg-rose-200">删除</button>
            </div>
          </div>
        ))}
      </div>

      {editingItem && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/60 p-4">
          <div className="w-full max-w-2xl rounded-[2rem] bg-white p-6 shadow-2xl">
            <div className="mb-4 flex items-center justify-between gap-3">
              <div className="flex items-center gap-2 text-xl font-black"><Package size={18} />{editingItem.id ? `编辑物品：${editingItem.name}` : '新建物品'}</div>
              <button onClick={() => setEditingItem(null)} className="rounded-full bg-slate-100 p-2 text-slate-500 hover:bg-slate-200"><X size={18} /></button>
            </div>
            <div className="grid gap-3 md:grid-cols-2">
              <Field label="名称" value={editingItem.name || ''} onChange={(value) => setEditingItem({ ...editingItem, name: value })} />
              <Field label="所属阵营" value={editingItem.faction || ''} onChange={(value) => setEditingItem({ ...editingItem, faction: value })} />
              <SelectField label="掉落区域" value={editingItem.locationTag || 'all'} onChange={(value) => setEditingItem({ ...editingItem, locationTag: value })} options={ITEM_LOCATIONS} />
              <SelectField label="阶级" value={editingItem.tier || '低阶'} onChange={(value) => setEditingItem({ ...editingItem, tier: value })} options={TIERS.map((value) => ({ value, label: value }))} />
              <SelectField label="物品类型" value={editingItem.itemType || '回复道具'} onChange={(value) => setEditingItem({ ...editingItem, itemType: value })} options={ITEM_TYPES.map((value) => ({ value, label: value }))} />
              <Field label="价格" value={String(editingItem.price ?? 0)} onChange={(value) => setEditingItem({ ...editingItem, price: Number(value || 0) })} />
              <Field label="效果值" value={String(editingItem.effectValue ?? 0)} onChange={(value) => setEditingItem({ ...editingItem, effectValue: Number(value || 0) })} />
              <Field label="NPC 编号（可空）" value={String(editingItem.npcId ?? '')} onChange={(value) => setEditingItem({ ...editingItem, npcId: value ? Number(value) : null })} />
            </div>
            <label className="mt-4 block text-xs font-black text-slate-500"><span className="mb-1 block">描述</span><textarea value={editingItem.description || ''} onChange={(event) => setEditingItem({ ...editingItem, description: event.target.value })} rows={5} className="w-full rounded-2xl border border-slate-200 px-4 py-3 text-sm text-slate-900" /></label>
            <div className="mt-4 flex justify-end gap-2">
              <button onClick={() => setEditingItem(null)} className="rounded-2xl bg-slate-100 px-4 py-2 font-black text-slate-700 hover:bg-slate-200">取消</button>
              <button onClick={saveItem} className="rounded-2xl bg-slate-900 px-4 py-2 font-black text-white hover:bg-slate-800">保存物品</button>
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
