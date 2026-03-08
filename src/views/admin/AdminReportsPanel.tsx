import { useEffect, useMemo, useState } from 'react';
import { apiFetch } from '../../utils/http';

interface Props {
  refreshKey: number;
  onNotice: (message: string) => void;
}

interface AdminReport {
  id: number;
  reporterId: number;
  reporterName: string;
  targetId: number;
  targetName: string;
  reason: string;
  status: string;
  banVotes: number;
  rejectVotes: number;
  createdAt: string;
  updatedAt: string;
}

const REPORT_STATUS_OPTIONS = ['all', 'pending', 'voting', 'banned', 'rejected'];
const REPORT_STATUS_LABELS: Record<string, string> = {
  all: '全部',
  pending: '待处理',
  voting: '投票中',
  banned: '已封号',
  rejected: '已驳回',
};

function formatReportStatus(status: string) {
  return REPORT_STATUS_LABELS[String(status || '')] || String(status || '未设置');
}

export function AdminReportsPanel({ refreshKey, onNotice }: Props) {
  const [reports, setReports] = useState<AdminReport[]>([]);
  const [reportFilter, setReportFilter] = useState('all');
  const [threshold, setThreshold] = useState(2);

  const filteredReports = useMemo(() => {
    if (reportFilter === 'all') return reports;
    return reports.filter((report) => String(report.status || '') === reportFilter);
  }, [reportFilter, reports]);

  const loadReports = async () => {
    const data = await apiFetch<any>('/api/admin/reports', { auth: 'admin' });
    setReports(Array.isArray(data.reports) ? data.reports : []);
    setThreshold(Math.max(1, Number(data.threshold || 2)));
  };

  useEffect(() => {
    loadReports().catch((error) => onNotice(error?.message || '加载举报列表失败'));
  }, [refreshKey]);

  const voteReport = async (reportId: number, decision: 'ban' | 'reject') => {
    try {
      const data = await apiFetch<any>(`/api/admin/reports/${reportId}/vote`, { auth: 'admin', method: 'POST', body: { decision } });
      onNotice(data.message || '举报投票已记录');
      await loadReports();
    } catch (error: any) {
      onNotice(error?.message || '举报投票失败');
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
        <label className="block text-xs font-black text-slate-500">
          <span className="mb-1 block">举报状态</span>
          <select value={reportFilter} onChange={(event) => setReportFilter(event.target.value)} className="rounded-2xl border border-slate-200 px-4 py-3 text-sm text-slate-900">
            {REPORT_STATUS_OPTIONS.map((value) => <option key={value} value={value}>{formatReportStatus(value)}</option>)}
          </select>
        </label>
        <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-600">封号与驳回阈值：{threshold} 票</div>
      </div>

      <div className="space-y-3">
        {filteredReports.length === 0 && <div className="rounded-2xl border border-dashed border-slate-200 bg-slate-50 px-4 py-5 text-center text-sm text-slate-500">当前筛选条件下没有举报记录</div>}
        {filteredReports.map((report) => (
          <div key={report.id} className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <div className="font-black">举报 #{report.id}</div>
                <div className="text-xs text-slate-500">举报人：{report.reporterName || `玩家#${report.reporterId}`} · 目标：{report.targetName || `玩家#${report.targetId}`}</div>
                <div className="mt-1 text-xs text-slate-500">创建：{report.createdAt}</div>
              </div>
              <div className={`rounded-full px-3 py-1 text-xs font-black ${report.status === 'banned' ? 'bg-rose-100 text-rose-700' : report.status === 'rejected' ? 'bg-slate-200 text-slate-700' : 'bg-amber-100 text-amber-700'}`}>{formatReportStatus(report.status)}</div>
            </div>
            <div className="mt-3 whitespace-pre-wrap rounded-2xl border border-slate-200 bg-white p-3 text-sm leading-6 text-slate-700">{report.reason}</div>
            <div className="mt-3 flex flex-wrap gap-2 text-xs text-slate-500">
              <span className="rounded-full bg-rose-100 px-3 py-1 font-black text-rose-700">封号票 {report.banVotes}/{threshold}</span>
              <span className="rounded-full bg-slate-200 px-3 py-1 font-black text-slate-700">驳回票 {report.rejectVotes}/{threshold}</span>
            </div>
            {!['banned', 'rejected'].includes(report.status) && (
              <div className="mt-3 flex flex-wrap gap-2">
                <button onClick={() => voteReport(report.id, 'ban')} className="rounded-xl bg-rose-600 px-3 py-1.5 text-xs font-black text-white hover:bg-rose-500">支持封号</button>
                <button onClick={() => voteReport(report.id, 'reject')} className="rounded-xl bg-slate-800 px-3 py-1.5 text-xs font-black text-white hover:bg-slate-700">驳回举报</button>
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
