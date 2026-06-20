'use client';

import { useState, useEffect, useCallback } from 'react';
import type { FormEvent } from 'react';
import axios from 'axios';
import { Plus, Package, TrendingUp, AlertTriangle, RefreshCw, type LucideIcon } from 'lucide-react';
import PageHeader from '../../components/PageHeader';
import Breadcrumbs from '../../components/Breadcrumbs';
import DataTable from '../../components/DataTable';
import Modal from '../../components/Modal';
import { useToast } from '../../components/Toaster';
import { useSocket } from '../../components/SocketProvider';

interface StockInfo { receivedKg: number; soldKg: number }
interface Distributor { _id: string; name: string; phone: string; stock?: StockInfo }

export default function StockPage() {
  const { toast } = useToast() ?? {};
  const socket = useSocket();
  const [distributors, setDistributors] = useState<Distributor[]>([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({ phone: '', name: '', receivedKg: '', batchNo: '' });
  const [summary, setSummary] = useState({ total: 0, sold: 0, balance: 0 });

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const { data } = await axios.get<{ success: boolean; data: { distributors: Distributor[] } }>('/api/distributors', { params: { limit: 100 } });
      if (data.success) {
        const dists = data.data.distributors;
        setDistributors(dists);
        const total = dists.reduce((s, d) => s + (d.stock?.receivedKg || 0), 0);
        const sold = dists.reduce((s, d) => s + (d.stock?.soldKg || 0), 0);
        setSummary({ total, sold, balance: total - sold });
      }
    } catch { toast?.('Failed to load stock data', 'error'); }
    finally { setLoading(false); }
  }, [toast]);

  useEffect(() => { fetchData(); }, [fetchData]);
  useEffect(() => { if (!socket) return; return socket.subscribe('stock_updated', fetchData); }, [socket, fetchData]);

  const handleAdd = async (e: FormEvent) => {
    e.preventDefault();
    setSaving(true);
    try {
      await axios.post('/api/stock', { distributorPhone: form.phone, distributorName: form.name, receivedKg: Number(form.receivedKg), batchNo: form.batchNo });
      toast?.(`+${form.receivedKg}kg added successfully`, 'success');
      setShowModal(false);
      setForm({ phone: '', name: '', receivedKg: '', batchNo: '' });
      fetchData();
    } catch (err) {
      toast?.((err as { response?: { data?: { message?: string } } })?.response?.data?.message || 'Failed to add stock', 'error');
    } finally { setSaving(false); }
  };

  const statCards: Array<{ label: string; value: string; icon: LucideIcon; color: string; bg: string }> = [
    { label: 'Total Received', value: `${summary.total}kg`, icon: Package, color: 'text-blue-600', bg: 'bg-blue-50' },
    { label: 'Total Sold', value: `${summary.sold}kg`, icon: TrendingUp, color: 'text-green-600', bg: 'bg-green-50' },
    { label: 'Total Balance', value: `${summary.balance}kg`, icon: AlertTriangle, color: 'text-orange-600', bg: 'bg-orange-50' },
  ];

  const columns = [
    { key: 'name', label: 'Distributor' },
    { key: 'phone', label: 'Phone' },
    { key: 'stock_received', label: 'Received', render: (_: unknown, row: Distributor) => `${row.stock?.receivedKg || 0}kg` },
    { key: 'stock_sold', label: 'Sold', render: (_: unknown, row: Distributor) => `${row.stock?.soldKg || 0}kg` },
    { key: 'balance', label: 'Balance', render: (_: unknown, row: Distributor) => {
      const bal = (row.stock?.receivedKg || 0) - (row.stock?.soldKg || 0);
      return <span className={`px-2.5 py-1 rounded-full text-xs font-semibold ${bal < 50 ? 'bg-red-100 text-red-700' : 'bg-green-100 text-green-700'}`}>{bal}kg</span>;
    }},
    { key: 'utilization', label: 'Utilization', render: (_: unknown, row: Distributor) => {
      const rcv = row.stock?.receivedKg || 0; const sold = row.stock?.soldKg || 0;
      const pct = rcv > 0 ? Math.round((sold / rcv) * 100) : 0;
      return <div className="flex items-center gap-2"><div className="flex-1 h-1.5 bg-gray-200 rounded-full max-w-[80px]"><div className="h-full bg-green-500 rounded-full" style={{ width: `${pct}%` }} /></div><span className="text-xs">{pct}%</span></div>;
    }},
  ];

  type FormKey = keyof typeof form;
  const formFields: Array<{ key: FormKey; label: string; required?: boolean; type?: string; placeholder: string }> = [
    { key: 'phone', label: 'Distributor Phone', required: true, placeholder: '9876543210' },
    { key: 'name', label: 'Distributor Name', placeholder: 'Auto-filled if registered' },
    { key: 'receivedKg', label: 'Quantity (kg)', required: true, type: 'number', placeholder: '100' },
    { key: 'batchNo', label: 'Batch Number', placeholder: 'BATCH-001' },
  ];

  return (
    <div>
      <Breadcrumbs items={[{ label: 'Stock', href: '/dashboard/stock' }]} />
      <PageHeader title="Stock Management" description="Monitor and manage feed stock across distributors"
        actions={<>
          <button onClick={fetchData} className="p-2 rounded-xl border border-gray-200 hover:bg-gray-50 text-gray-500"><RefreshCw size={16} /></button>
          <button onClick={() => setShowModal(true)} className="flex items-center gap-2 bg-green-600 hover:bg-green-700 text-white text-sm font-medium px-4 py-2 rounded-xl"><Plus size={16} /> Add Stock</button>
        </>}
      />
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-6">
        {statCards.map((card) => {
          const Icon = card.icon;
          return (
            <div key={card.label} className="bg-white rounded-2xl border border-gray-100 p-4 flex items-center gap-4">
              <div className={`w-11 h-11 rounded-xl flex items-center justify-center ${card.bg}`}><Icon size={22} className={card.color} /></div>
              <div><p className="text-2xl font-bold text-gray-900">{card.value}</p><p className="text-xs text-gray-500">{card.label}</p></div>
            </div>
          );
        })}
      </div>
      <DataTable columns={columns} data={distributors} loading={loading} emptyText="No stock records. Add stock for a distributor." />
      <Modal isOpen={showModal} onClose={() => setShowModal(false)} title="Add Stock"
        footer={<>
          <button onClick={() => setShowModal(false)} className="px-4 py-2 text-sm text-gray-600 hover:bg-gray-100 rounded-xl">Cancel</button>
          <button form="stock-form" type="submit" disabled={saving} className="px-4 py-2 text-sm bg-green-600 text-white font-medium rounded-xl disabled:opacity-60">{saving ? 'Adding...' : 'Add Stock'}</button>
        </>}
      >
        <form id="stock-form" onSubmit={handleAdd} className="space-y-4">
          {formFields.map((field) => (
            <div key={field.key}>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">{field.label}{field.required && <span className="text-red-500 ml-1">*</span>}</label>
              <input type={field.type || 'text'} required={field.required} value={form[field.key]} onChange={(e) => setForm((f) => ({ ...f, [field.key]: e.target.value }))} placeholder={field.placeholder}
                min={field.type === 'number' ? '0.1' : undefined} step={field.type === 'number' ? '0.1' : undefined}
                className="w-full px-3 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-green-500" />
            </div>
          ))}
        </form>
      </Modal>
    </div>
  );
}
