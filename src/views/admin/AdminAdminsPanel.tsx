import { useEffect, useState } from 'react';
import { apiFetch } from '../../utils/http';

interface Props {
  refreshKey: number;
  onNotice: (message: string) => void;
}

interface AdminMeta {
  currentAdmin: { id: number; name: string; adminAvatarUrl?: string } | null;
  onlineAdmins: Array<{ id: number; name: string; adminAvatarUrl?: string; lastSeenAt?: string }>;
  whitelist: Array<{ name: string; codeName?: string; enabled: number }>;
}

export function AdminAdminsPanel({ refreshKey, onNotice }: Props) {
  const [meta, setMeta] = useState<AdminMeta>({ currentAdmin: null, onlineAdmins: [], whitelist: [] });
  const [adminAvatarDraft, setAdminAvatarDraft] = useState('');
  const [newAdminName, setNewAdminName] = useState('');
  const [newAdminCodeName, setNewAdminCodeName] = useState('');
  const [creatingAdmin, setCreatingAdmin] = useState(false);

  const loadMeta = async () => {
    const data = await apiFetch<any>('/api/admin/meta', { auth: 'admin' });
    const next = {
      currentAdmin: data.currentAdmin || null,
      onlineAdmins: Array.isArray(data.onlineAdmins) ? data.onlineAdmins : [],
      whitelist: Array.isArray(data.whitelist) ? data.whitelist : [],
    };
    setMeta(next);
    setAdminAvatarDraft(String(next.currentAdmin?.adminAvatarUrl || ''));
  };

  useEffect(() => {
    loadMeta().catch((error) => onNotice(error?.message || '加载管理员信息失败'));
  }, [refreshKey]);

  const saveAdminProfile = async () => {
    try {
      const data = await apiFetch<any>('/api/admin/profile', { auth: 'admin', method: 'PUT', body: { adminAvatarUrl: adminAvatarDraft.trim() } });
      onNotice(data.message || '管理员资料已更新');
      await loadMeta();
    } catch (error: any) {
      onNotice(error?.message || '保存管理员头像失败');
    }
  };

  const createAdmin = async () => {
    if (!newAdminName.trim()) {
      onNotice('请填写管理员名字');
      return;
    }

    setCreatingAdmin(true);
    try {
      const data = await apiFetch<any>('/api/admin/whitelist', {
        auth: 'admin',
        method: 'POST',
        body: {
          name: newAdminName.trim(),
          codeName: newAdminCodeName.trim(),
          enabled: 1,
        },
      });
      onNotice(data.message || '管理员已加入白名单');
      setNewAdminName('');
      setNewAdminCodeName('');
      await loadMeta();
    } catch (error: any) {
      onNotice(error?.message || '新增管理员失败');
    } finally {
      setCreatingAdmin(false);
    }
  };

  return (
    <div className="space-y-4">
      <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_320px]">
        <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
          <div className="text-lg font-black">管理员资料</div>
          <div className="mt-1 text-sm text-slate-500">后台头像会显示在管理员在线列表中。</div>
          <div className="mt-4 flex items-center gap-4">
            <AvatarPreview src={adminAvatarDraft} label={meta.currentAdmin?.name || '管理员'} large />
            <div className="min-w-0 flex-1 space-y-3">
              <label className="block text-xs font-black text-slate-500">
                <span className="mb-1 block">后台头像链接</span>
                <input value={adminAvatarDraft} onChange={(event) => setAdminAvatarDraft(event.target.value)} placeholder="请输入图片链接或 data:image 数据" className="w-full rounded-2xl border border-slate-200 px-4 py-3 text-sm text-slate-900" />
              </label>
              <button onClick={saveAdminProfile} className="rounded-2xl bg-slate-900 px-4 py-2 text-sm font-black text-white hover:bg-slate-800">保存管理员头像</button>
            </div>
          </div>
        </div>

        <div className="space-y-4">
          <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
            <div className="text-lg font-black">新增管理员</div>
            <div className="mt-1 text-sm text-slate-500">新增后，对方可使用统一入口码配合管理员名字或代号登录后台。</div>
            <div className="mt-4 space-y-3">
              <label className="block text-xs font-black text-slate-500">
                <span className="mb-1 block">管理员名字</span>
                <input value={newAdminName} onChange={(event) => setNewAdminName(event.target.value)} placeholder="例如：白塔" className="w-full rounded-2xl border border-slate-200 px-4 py-3 text-sm text-slate-900" />
              </label>
              <label className="block text-xs font-black text-slate-500">
                <span className="mb-1 block">管理员代号（可选）</span>
                <input value={newAdminCodeName} onChange={(event) => setNewAdminCodeName(event.target.value)} placeholder="例如：白塔_管理" className="w-full rounded-2xl border border-slate-200 px-4 py-3 text-sm text-slate-900" />
              </label>
              <button onClick={createAdmin} disabled={creatingAdmin} className="w-full rounded-2xl bg-slate-900 px-4 py-3 text-sm font-black text-white hover:bg-slate-800 disabled:opacity-60">
                {creatingAdmin ? '新增中...' : '加入管理员白名单'}
              </button>
            </div>
          </div>

          <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
            <div className="text-lg font-black">白名单管理员</div>
            <div className="mt-3 space-y-2">
              {meta.whitelist.map((admin) => (
                <div key={`${admin.name}-${admin.codeName}`} className="flex items-center justify-between rounded-2xl border border-slate-200 bg-white px-3 py-2 text-sm">
                  <div>
                    <div className="font-black">{admin.name}</div>
                    <div className="text-xs text-slate-500">代号：{admin.codeName || '未配置'}</div>
                  </div>
                  <div className={`rounded-full px-3 py-1 text-xs font-black ${admin.enabled ? 'bg-emerald-100 text-emerald-700' : 'bg-slate-200 text-slate-700'}`}>{admin.enabled ? '启用' : '停用'}</div>
                </div>
              ))}
              {!meta.whitelist.length && <div className="rounded-2xl border border-dashed border-slate-200 bg-white px-3 py-4 text-sm text-slate-500">暂无白名单管理员</div>}
            </div>
          </div>
        </div>
      </div>

      <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
        <div className="text-lg font-black">在线管理员</div>
        <div className="mt-3 grid gap-3 md:grid-cols-2 xl:grid-cols-3">
          {meta.onlineAdmins.map((admin) => (
            <div key={admin.id} className="flex items-center gap-3 rounded-2xl border border-slate-200 bg-white p-3">
              <AvatarPreview src={admin.adminAvatarUrl} label={admin.name} />
              <div className="min-w-0">
                <div className="truncate font-black">{admin.name}</div>
                <div className="text-xs text-slate-500">最近在线：{admin.lastSeenAt || '刚刚'}</div>
              </div>
            </div>
          ))}
          {!meta.onlineAdmins.length && <div className="rounded-2xl border border-dashed border-slate-200 bg-white px-3 py-4 text-sm text-slate-500">当前没有在线管理员</div>}
        </div>
      </div>
    </div>
  );
}

function AvatarPreview({ src, label, large = false }: { src?: string; label: string; large?: boolean }) {
  const className = large ? 'h-20 w-20 text-2xl' : 'h-10 w-10 text-sm';
  return <div className={`flex items-center justify-center overflow-hidden rounded-full border border-slate-200 bg-slate-200 font-black text-slate-600 ${className}`}>{src ? <img src={src} alt={label} className="h-full w-full object-cover" /> : String(label || '?')[0] || '?'}</div>;
}
