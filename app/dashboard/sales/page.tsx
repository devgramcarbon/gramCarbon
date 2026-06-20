'use client';

import { useState, useEffect, useCallback } from 'react';
import type { FormEvent } from 'react';
import axios from 'axios';
import { Plus, Search, Filter, RefreshCw, CheckCircle, AlertCircle, Loader2 } from 'lucide-react';
import PageHeader from '../../components/PageHeader';
import Breadcrumbs from '../../components/Breadcrumbs';
import DataTable from '../../components/DataTable';
import Modal from '../../components/Modal';
import { useToast } from '../../components/Toaster';
import { useSocket } from '../../components/SocketProvider';

interface Sale { _id: string; distributorPhone: string; farmerName: string; cowCount: number; qtyKg: number; batchNo?: string; saleDate?: string }
interface Pagination { page: number; pages: number; total: number; limit: number }
interface FarmerLookup { status: 'idle' | 'loading' | 'found' | 'not_found'; name: string; farmerId: string }

export default function SalesPage() {
  const { toast } = useToast() ?? {};
  const socket = useSocket();
  const [sales, setSales] = useState<Sale[]>([]);
  const [pagination, setPagination] = useState<Pagination | null>(null);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');
  const [fromDate, setFromDate] = useState('');
  const [toDate, setToDate] = useState('');
  const [showModal, setShowModal] = useState(false);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({ distributorPhone: '', farmerMobile: '', cowCount: '', qtyKg: '', batchNo: '' });
  const [farmerLookup, setFarmerLookup] = useState<FarmerLookup>({ status: 'idle', name: '', farmerId: '' });

  const fetchSales = useCallback(async () => {
    setLoading(true);
    try {
      const { data } = await axios.get<{ success: boolean; data: { sales: Sale[]; pagination: Pagination } }>('/api/sales', { params: { page, search, from: fromDate, to: toDate, limit: 20 } });
      if (data.success) { setSales(data.data.sales); setPagination(data.data.pagination); }
    } catch { toast?.('Failed to load sales', 'error'); }
    finally { setLoading(false); }
  }, [page, search, fromDate, toDate, toast]);

  useEffect(() => { fetchSales(); }, [fetchSales]);
  useEffect(() => { if (!socket) return; return socket.subscribe('sale_recorded', fetchSales); }, [socket, fetchSales]);

  const lookupFarmer = useCallback(async (mobile: string) => {
    const digits = mobile.replace(/\D/g, '');
    if (digits.length < 10) { setFarmerLookup({ status: 'idle', name: '', farmerId: '' }); return; }

    setFarmerLookup({ status: 'loading', name: '', farmerId: '' });
    try {
      const { data } = await axios.get<{ success: boolean; data: { farmers: Array<{ name: string; farmerId: string; mobile: string }> } }>(
        '/api/farmers', { params: { search: digits, limit: 1 } }
      );
      const match = data.data.farmers.find((f) => f.mobile === digits || f.mobile === `91${digits}`);
      if (match) {
        setFarmerLookup({ status: 'found', name: match.name, farmerId: match.farmerId });
      } else {
        setFarmerLookup({ status: 'not_found', name: '', farmerId: '' });
      }
    } catch {
      setFarmerLookup({ status: 'not_found', name: '', farmerId: '' });
    }
  }, []);

  const handleFarmerMobileChange = (value: string) => {
    setForm((f) => ({ ...f, farmerMobile: value }));
    setFarmerLookup({ status: 'idle', name: '', farmerId: '' });
  };

  const handleFarmerMobileBlur = () => {
    if (form.farmerMobile.trim()) lookupFarmer(form.farmerMobile.trim());
  };

  const handleAdd = async (e: FormEvent) => {
    e.preventDefault();
    if (farmerLookup.status !== 'found') {
      toast?.('Please enter a registered farmer mobile number', 'error');
      return;
    }
    setSaving(true);
    try {
      await axios.post('/api/sales', {
        ...form,
        farmerName: farmerLookup.name,
        cowCount: Number(form.cowCount),
        qtyKg: Number(form.qtyKg),
      });
      toast?.('Sale recorded successfully', 'success');
      setShowModal(false);
      setForm({ distributorPhone: '', farmerMobile: '', cowCount: '', qtyKg: '', batchNo: '' });
      setFarmerLookup({ status: 'idle', name: '', farmerId: '' });
      fetchSales();
    } catch (err) {
      toast?.((err as { response?: { data?: { message?: string } } })?.response?.data?.message || 'Failed to record sale', 'error');
    } finally { setSaving(false); }
  };

  const resetModal = () => {
    setShowModal(false);
    setForm({ distributorPhone: '', farmerMobile: '', cowCount: '', qtyKg: '', batchNo: '' });
    setFarmerLookup({ status: 'idle', name: '', farmerId: '' });
  };

  const columns = [
    { key: 'distributorPhone', label: 'Distributor' },
    { key: 'farmerName', label: 'Farmer' },
    { key: 'cowCount', label: 'Animals', render: (v: number) => `${v} animals` },
    { key: 'qtyKg', label: 'Qty (kg)', render: (v: number) => <span className="font-semibold text-green-700">{v}kg</span> },
    { key: 'batchNo', label: 'Batch', render: (v: string | undefined) => v || '—' },
    { key: 'saleDate', label: 'Date', render: (v: string | undefined) => v ? new Date(v).toLocaleDateString('en-IN') : '—' },
  ];

  return (
    <div>
      <Breadcrumbs items={[{ label: 'Sales', href: '/dashboard/sales' }]} />
      <PageHeader title="Sales" description={`${pagination?.total || 0} total transactions`}
        actions={<>
          <button onClick={fetchSales} className="p-2 rounded-xl border border-gray-200 hover:bg-gray-50 text-gray-500"><RefreshCw size={16} /></button>
          <button onClick={() => setShowModal(true)} className="flex items-center gap-2 bg-green-600 hover:bg-green-700 text-white text-sm font-medium px-4 py-2 rounded-xl"><Plus size={16} /> Record Sale</button>
        </>}
      />
      <div className="flex flex-wrap items-center gap-3 mb-4">
        <div className="relative">
          <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
          <input type="text" placeholder="Search farmer or batch..." value={search} onChange={(e) => { setSearch(e.target.value); setPage(1); }}
            className="pl-9 pr-4 py-2.5 text-sm border border-gray-200 rounded-xl w-56 focus:outline-none focus:ring-2 focus:ring-green-500" />
        </div>
        <div className="flex items-center gap-2 text-sm text-gray-500">
          <Filter size={14} />
          <input type="date" value={fromDate} onChange={(e) => { setFromDate(e.target.value); setPage(1); }} className="border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-500" />
          <span>—</span>
          <input type="date" value={toDate} onChange={(e) => { setToDate(e.target.value); setPage(1); }} className="border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-500" />
          {(fromDate || toDate) && <button onClick={() => { setFromDate(''); setToDate(''); }} className="text-xs text-red-500 hover:underline">Clear</button>}
        </div>
      </div>
      <DataTable columns={columns} data={sales} loading={loading} pagination={pagination ?? undefined} onPageChange={setPage} emptyText="No sales found for the selected filters." />
      <Modal isOpen={showModal} onClose={resetModal} title="Record Sale"
        footer={<>
          <button onClick={resetModal} className="px-4 py-2 text-sm text-gray-600 hover:bg-gray-100 rounded-xl">Cancel</button>
          <button form="sale-form" type="submit" disabled={saving || farmerLookup.status !== 'found'} className="px-4 py-2 text-sm bg-green-600 text-white font-medium rounded-xl disabled:opacity-60">
            {saving ? 'Recording...' : 'Record Sale'}
          </button>
        </>}
      >
        <form id="sale-form" onSubmit={handleAdd} className="space-y-4">
          {/* Distributor Phone */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1.5">Distributor Phone <span className="text-red-500">*</span></label>
            <input type="text" required value={form.distributorPhone} onChange={(e) => setForm((f) => ({ ...f, distributorPhone: e.target.value }))}
              placeholder="9876543210"
              className="w-full px-3 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-green-500" />
          </div>

          {/* Farmer Mobile lookup */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1.5">Farmer Mobile <span className="text-red-500">*</span></label>
            <div className="relative">
              <input type="text" required value={form.farmerMobile}
                onChange={(e) => handleFarmerMobileChange(e.target.value)}
                onBlur={handleFarmerMobileBlur}
                placeholder="Enter registered farmer mobile"
                className={`w-full px-3 py-2.5 pr-9 border rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-green-500 ${
                  farmerLookup.status === 'found' ? 'border-green-400 bg-green-50' :
                  farmerLookup.status === 'not_found' ? 'border-red-400 bg-red-50' :
                  'border-gray-200'
                }`} />
              <div className="absolute right-3 top-1/2 -translate-y-1/2">
                {farmerLookup.status === 'loading' && <Loader2 size={16} className="text-gray-400 animate-spin" />}
                {farmerLookup.status === 'found' && <CheckCircle size={16} className="text-green-500" />}
                {farmerLookup.status === 'not_found' && <AlertCircle size={16} className="text-red-500" />}
              </div>
            </div>
            {farmerLookup.status === 'found' && (
              <p className="mt-1 text-xs text-green-600 font-medium">{farmerLookup.name} ({farmerLookup.farmerId})</p>
            )}
            {farmerLookup.status === 'not_found' && (
              <p className="mt-1 text-xs text-red-600">Farmer not registered. <a href="/dashboard/farmers" className="underline hover:text-red-700">Register farmer first</a>.</p>
            )}
          </div>

          {/* Animal Count */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1.5">Animal Count <span className="text-red-500">*</span></label>
            <input type="number" required min="1" value={form.cowCount} onChange={(e) => setForm((f) => ({ ...f, cowCount: e.target.value }))}
              placeholder="5"
              className="w-full px-3 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-green-500" />
          </div>

          {/* Quantity */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1.5">Quantity (kg) <span className="text-red-500">*</span></label>
            <input type="number" required min="1" value={form.qtyKg} onChange={(e) => setForm((f) => ({ ...f, qtyKg: e.target.value }))}
              placeholder="50"
              className="w-full px-3 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-green-500" />
          </div>

          {/* Batch Number */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1.5">Batch Number</label>
            <input type="text" value={form.batchNo} onChange={(e) => setForm((f) => ({ ...f, batchNo: e.target.value }))}
              placeholder="BATCH-001"
              className="w-full px-3 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-green-500" />
          </div>
        </form>
      </Modal>
    </div>
  );
}
