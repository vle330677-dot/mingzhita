import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { X, AlertTriangle, CheckCircle, Clock, XCircle } from 'lucide-react';

interface ConfirmationDialogProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => void;
  title: string;
  message: string;
  operationType: string;
  confirmText?: string;
  cancelText?: string;
  requireTyping?: boolean;
  typingText?: string;
}

export function ConfirmationDialog({
  isOpen,
  onClose,
  onConfirm,
  title,
  message,
  operationType,
  confirmText = '确认',
  cancelText = '取消',
  requireTyping = false,
  typingText = '确认'
}: ConfirmationDialogProps) {
  const [inputValue, setInputValue] = useState('');
  const [countdown, setCountdown] = useState(5);

  useEffect(() => {
    if (!isOpen) {
      setInputValue('');
      setCountdown(5);
      return;
    }

    const timer = setInterval(() => {
      setCountdown((prev) => Math.max(0, prev - 1));
    }, 1000);

    return () => clearInterval(timer);
  }, [isOpen]);

  const canConfirm = countdown === 0 && (!requireTyping || inputValue === typingText);

  const getIcon = () => {
    switch (operationType) {
      case 'death':
      case 'delete_character':
        return <XCircle size={48} className="text-red-500" />;
      case 'become_ghost':
        return <AlertTriangle size={48} className="text-purple-500" />;
      case 'resign_position':
        return <AlertTriangle size={48} className="text-orange-500" />;
      default:
        return <AlertTriangle size={48} className="text-yellow-500" />;
    }
  };

  if (!isOpen) return null;

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[200] flex items-center justify-center p-4"
        onClick={onClose}
      >
        <motion.div
          initial={{ scale: 0.9, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          exit={{ scale: 0.9, opacity: 0 }}
          onClick={(e) => e.stopPropagation()}
          className="bg-white rounded-2xl shadow-2xl max-w-md w-full p-6 space-y-4"
        >
          <div className="flex flex-col items-center text-center space-y-3">
            {getIcon()}
            <h2 className="text-2xl font-black text-slate-800">{title}</h2>
            <p className="text-sm text-slate-600 leading-relaxed">{message}</p>
          </div>

          {countdown > 0 && (
            <div className="flex items-center justify-center gap-2 bg-slate-100 rounded-lg p-3">
              <Clock size={16} className="text-slate-500" />
              <span className="text-sm text-slate-600">
                请仔细阅读，{countdown} 秒后可确认
              </span>
            </div>
          )}

          {requireTyping && countdown === 0 && (
            <div className="space-y-2">
              <label className="text-xs text-slate-500 block">
                请输入 "<span className="font-bold text-red-600">{typingText}</span>" 以确认操作
              </label>
              <input
                type="text"
                value={inputValue}
                onChange={(e) => setInputValue(e.target.value)}
                className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-red-500"
                placeholder={typingText}
                autoFocus
              />
            </div>
          )}

          <div className="flex gap-3 pt-2">
            <button
              onClick={onClose}
              className="flex-1 px-4 py-3 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold rounded-lg transition-colors"
            >
              {cancelText}
            </button>
            <button
              onClick={onConfirm}
              disabled={!canConfirm}
              className={`flex-1 px-4 py-3 font-bold rounded-lg transition-colors ${
                canConfirm
                  ? 'bg-red-600 hover:bg-red-700 text-white'
                  : 'bg-slate-200 text-slate-400 cursor-not-allowed'
              }`}
            >
              {confirmText}
            </button>
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
}

interface PendingConfirmation {
  id: number;
  operationType: string;
  operationLabel: string;
  operationData: any;
  expiresAt: string;
  createdAt: string;
  isExpired: boolean;
}

interface ConfirmationListProps {
  userId: number;
  onConfirmed?: (confirmation: PendingConfirmation) => void;
}

export function ConfirmationList({ userId, onConfirmed }: ConfirmationListProps) {
  const [confirmations, setConfirmations] = useState<PendingConfirmation[]>([]);
  const [loading, setLoading] = useState(false);

  const fetchConfirmations = async () => {
    try {
      const res = await fetch(`/api/confirmations?userId=${userId}`);
      const data = await res.json();
      if (data.success) {
        setConfirmations(data.confirmations || []);
      }
    } catch (e) {
      console.error('Failed to fetch confirmations:', e);
    }
  };

  useEffect(() => {
    fetchConfirmations();
    const interval = setInterval(fetchConfirmations, 5000);
    return () => clearInterval(interval);
  }, [userId]);

  const handleConfirm = async (id: number) => {
    setLoading(true);
    try {
      const res = await fetch(`/api/confirmations/${id}/confirm`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId })
      });
      const data = await res.json();
      if (data.success) {
        const confirmed = confirmations.find((c) => c.id === id);
        if (confirmed && onConfirmed) {
          onConfirmed(confirmed);
        }
        fetchConfirmations();
      }
    } catch (e) {
      console.error('Failed to confirm:', e);
    } finally {
      setLoading(false);
    }
  };

  const handleCancel = async (id: number) => {
    try {
      const res = await fetch(`/api/confirmations/${id}/cancel`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId })
      });
      if (res.ok) {
        fetchConfirmations();
      }
    } catch (e) {
      console.error('Failed to cancel:', e);
    }
  };

  if (confirmations.length === 0) return null;

  return (
    <div className="fixed bottom-4 right-4 z-[100] max-w-sm w-full space-y-2">
      {confirmations.map((conf) => (
        <motion.div
          key={conf.id}
          initial={{ x: 400, opacity: 0 }}
          animate={{ x: 0, opacity: 1 }}
          exit={{ x: 400, opacity: 0 }}
          className="bg-white rounded-xl shadow-lg border border-slate-200 p-4 space-y-3"
        >
          <div className="flex items-start justify-between gap-2">
            <div className="flex-1">
              <div className="flex items-center gap-2">
                <AlertTriangle size={16} className="text-orange-500" />
                <h3 className="font-bold text-sm text-slate-800">{conf.operationLabel}</h3>
              </div>
              <p className="text-xs text-slate-500 mt-1">
                {conf.isExpired ? '已过期' : `过期时间: ${new Date(conf.expiresAt).toLocaleString()}`}
              </p>
            </div>
            <button
              onClick={() => handleCancel(conf.id)}
              className="p-1 hover:bg-slate-100 rounded"
            >
              <X size={16} className="text-slate-400" />
            </button>
          </div>

          {!conf.isExpired && (
            <div className="flex gap-2">
              <button
                onClick={() => handleCancel(conf.id)}
                className="flex-1 px-3 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold rounded-lg transition-colors"
              >
                取消
              </button>
              <button
                onClick={() => handleConfirm(conf.id)}
                disabled={loading}
                className="flex-1 px-3 py-2 bg-red-600 hover:bg-red-700 text-white text-xs font-bold rounded-lg transition-colors disabled:opacity-50"
              >
                确认执行
              </button>
            </div>
          )}
        </motion.div>
      ))}
    </div>
  );
}

// Hook for creating confirmation requests
export function useConfirmation() {
  const createConfirmation = async (
    userId: number,
    operationType: string,
    operationData: any = {},
    expiresInMinutes: number = 10
  ): Promise<{ success: boolean; confirmationId?: number; message?: string }> => {
    try {
      const res = await fetch('/api/confirmations', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userId,
          operationType,
          operationData,
          expiresInMinutes
        })
      });
      const data = await res.json();
      return data;
    } catch (e) {
      console.error('Failed to create confirmation:', e);
      return { success: false, message: '创建确认请求失败' };
    }
  };

  return { createConfirmation };
}
