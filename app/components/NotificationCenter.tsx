'use client';

import { useState, useEffect, useRef } from 'react';
import { Bell, Check, CheckCheck, Trash2, X, AlertCircle, Info, TrendingUp, MessageSquare } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import axios from 'axios';

interface NotificationTypeConfig {
  icon: LucideIcon;
  color: string;
  bg: string;
}

const typeConfig: Record<string, NotificationTypeConfig> = {
  STOCK_LOW: { icon: AlertCircle, color: 'text-orange-500', bg: 'bg-orange-50' },
  WHATSAPP_DELIVERY_FAILED: { icon: MessageSquare, color: 'text-red-500', bg: 'bg-red-50' },
  WEBHOOK_ERROR: { icon: AlertCircle, color: 'text-red-500', bg: 'bg-red-50' },
  SYSTEM_ERROR: { icon: AlertCircle, color: 'text-red-600', bg: 'bg-red-50' },
  NEW_DISTRIBUTOR: { icon: TrendingUp, color: 'text-blue-500', bg: 'bg-blue-50' },
  NEW_FARMER: { icon: TrendingUp, color: 'text-green-500', bg: 'bg-green-50' },
  SALE_RECORDED: { icon: TrendingUp, color: 'text-green-600', bg: 'bg-green-50' },
  INFO: { icon: Info, color: 'text-gray-500', bg: 'bg-gray-50' },
};

interface Notification {
  _id: string;
  type: string;
  title: string;
  message: string;
  isRead: boolean;
  createdAt: string;
}

function timeAgo(date: string): string {
  const diff = Date.now() - new Date(date).getTime();
  const m = Math.floor(diff / 60000);
  if (m < 1) return 'Just now';
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  return `${Math.floor(h / 24)}d ago`;
}

export default function NotificationCenter() {
  const [open, setOpen] = useState(false);
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [loading, setLoading] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  const fetchNotifications = async () => {
    try {
      setLoading(true);
      const { data } = await axios.get<{ success: boolean; data: { notifications: Notification[]; unreadCount: number } }>('/api/notifications?limit=20');
      if (data.success) {
        setNotifications(data.data.notifications);
        setUnreadCount(data.data.unreadCount);
      }
    } catch {
      // silent
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchNotifications();
    const interval = setInterval(fetchNotifications, 30_000);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  const markAll = async () => {
    await axios.patch('/api/notifications', { markAll: true });
    setUnreadCount(0);
    setNotifications((prev) => prev.map((n) => ({ ...n, isRead: true })));
  };

  const markOne = async (id: string) => {
    await axios.patch('/api/notifications', { ids: [id] });
    setNotifications((prev) => prev.map((n) => (n._id === id ? { ...n, isRead: true } : n)));
    setUnreadCount((c) => Math.max(0, c - 1));
  };

  const deleteOne = async (id: string) => {
    await axios.delete('/api/notifications', { data: { ids: [id] } });
    setNotifications((prev) => prev.filter((n) => n._id !== id));
  };

  return (
    <div className="relative" ref={ref}>
      <button
        onClick={() => { setOpen(!open); if (!open) fetchNotifications(); }}
        className="relative p-2 rounded-xl hover:bg-gray-100 text-gray-600 transition-colors"
      >
        <Bell size={20} />
        {unreadCount > 0 && (
          <span className="absolute -top-0.5 -right-0.5 w-5 h-5 bg-red-500 text-white text-xs font-bold rounded-full flex items-center justify-center">
            {unreadCount > 9 ? '9+' : unreadCount}
          </span>
        )}
      </button>

      {open && (
        <div className="absolute right-0 top-full mt-2 w-80 bg-white rounded-2xl shadow-xl border border-gray-100 z-50 overflow-hidden">
          <div className="flex items-center justify-between px-4 py-3 border-b border-gray-100">
            <h3 className="font-semibold text-gray-900 text-sm">Notifications</h3>
            <div className="flex items-center gap-2">
              {unreadCount > 0 && (
                <button onClick={markAll} className="text-xs text-green-600 hover:underline flex items-center gap-1">
                  <CheckCheck size={12} /> Mark all read
                </button>
              )}
              <button onClick={() => setOpen(false)} className="p-1 hover:bg-gray-100 rounded">
                <X size={14} />
              </button>
            </div>
          </div>

          <div className="max-h-80 overflow-y-auto">
            {loading && notifications.length === 0 ? (
              <div className="py-8 text-center text-gray-400 text-sm">Loading...</div>
            ) : notifications.length === 0 ? (
              <div className="py-8 text-center text-gray-400 text-sm">No notifications</div>
            ) : (
              notifications.map((n) => {
                const config = typeConfig[n.type] || typeConfig.INFO;
                const Icon = config.icon;
                return (
                  <div
                    key={n._id}
                    className={`flex gap-3 px-4 py-3 border-b border-gray-50 ${!n.isRead ? 'bg-green-50/30' : ''}`}
                  >
                    <div className={`w-8 h-8 rounded-full flex-shrink-0 flex items-center justify-center ${config.bg}`}>
                      <Icon size={15} className={config.color} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-xs font-medium text-gray-900 leading-snug">{n.title}</p>
                      <p className="text-xs text-gray-500 mt-0.5 line-clamp-2">{n.message}</p>
                      <p className="text-xs text-gray-400 mt-1">{timeAgo(n.createdAt)}</p>
                    </div>
                    <div className="flex flex-col gap-1 flex-shrink-0">
                      {!n.isRead && (
                        <button onClick={() => markOne(n._id)} className="p-1 hover:bg-gray-100 rounded text-gray-400">
                          <Check size={12} />
                        </button>
                      )}
                      <button onClick={() => deleteOne(n._id)} className="p-1 hover:bg-red-50 rounded text-gray-400 hover:text-red-500">
                        <Trash2 size={12} />
                      </button>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>
      )}
    </div>
  );
}
