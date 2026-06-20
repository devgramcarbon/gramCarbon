'use client';

import { useState, useEffect, useCallback } from 'react';
import type { FormEvent } from 'react';
import axios from 'axios';
import { Plus, Search, RefreshCw, MapPin, Beef } from 'lucide-react';
import PageHeader from '../../components/PageHeader';
import Breadcrumbs from '../../components/Breadcrumbs';
import DataTable from '../../components/DataTable';
import Modal from '../../components/Modal';
import { useToast } from '../../components/Toaster';
import { useSocket } from '../../components/SocketProvider';

interface Farmer { _id: string; farmerId: string; name: string; mobile: string; village?: string; district?: string; state?: string; animalCount?: number; animalType?: string; gender?: string; createdAt?: string }
interface Pagination { page: number; pages: number; total: number; limit: number }

export default function FarmersPage() {
  const { toast } = useToast() ?? {};
  const { subscribe } = useSocket() ?? {};
  const [farmers, setFarmers] = useState<Farmer[]>([]);
  const [pagination, setPagination] = useState<Pagination | null>(null);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');
  const [showModal, setShowModal] = useState(false);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({ name: '', mobile: '', village: '', district: '', state: '', animalCount: '', animalType: 'Cow', gender: '' });

  const fetchFarmers = useCallback(async () => {
    setLoading(true);
    try {
      const { data } = await axios.get<{ success: boolean; data: { farmers: Farmer[]; pagination: Pagination } }>('/api/farmers', { params: { page, search, limit: 20 } });
      if (data.success) { setFarmers(data.data.farmers); setPagination(data.data.pagination); }
    } catch { toast?.('Failed to load farmers', 'error'); }
    finally { setLoading(false); }
  }, [page, search, toast]);

  useEffect(() => { fetchFarmers(); }, [fetchFarmers]);

  useEffect(() => {
    return subscribe?.('dashboard_updated', (data: unknown) => {
      if ((data as { type?: string })?.type === 'farmer_added') {
        fetchFarmers();
        toast?.('New farmer registered', 'info');
      }
    });
  }, [subscribe, fetchFarmers, toast]);

  const handleAdd = async (e: FormEvent) => {
    e.preventDefault();
    setSaving(true);
    try {
      await axios.post('/api/farmers', { ...form, animalCount: Number(form.animalCount) || 0 });
      toast?.('Farmer registered successfully', 'success');
      setShowModal(false);
      setForm({ name: '', mobile: '', village: '', district: '', state: '', animalCount: '', animalType: 'Cow', gender: '' });
      fetchFarmers();
    } catch (err) {
      toast?.((err as { response?: { data?: { message?: string } } })?.response?.data?.message || 'Failed to register farmer', 'error');
    } finally { setSaving(false); }
  };

  const columns = [
    { key: 'farmerId', label: 'ID', render: (v: string | undefined) => <span className="font-mono text-xs bg-gray-100 px-2 py-0.5 rounded">{v}</span> },
    { key: 'name', label: 'Name' },
    { key: 'mobile', label: 'Mobile' },
    { key: 'village', label: 'Location', render: (_: unknown, row: Farmer) => (
      <span className="flex items-center gap-1 text-xs text-gray-600"><MapPin size={12} className="text-gray-400" />{[row.village, row.district].filter(Boolean).join(', ') || '—'}</span>
    )},
    { key: 'animalCount', label: 'Animals', render: (v: number, row: Farmer) => (
      <span className="flex items-center gap-1.5"><Beef size={13} className="text-gray-400" />{v} {row.animalType}</span>
    )},
    { key: 'gender', label: 'Gender' },
    { key: 'createdAt', label: 'Registered', render: (v: string | undefined) => v ? new Date(v).toLocaleDateString('en-IN') : '—' },
  ];

  type FormKey = keyof typeof form;
  const textFields: Array<{ key: FormKey; label: string; required?: boolean; type?: string }> = [
    { key: 'name', label: 'Full Name', required: true },
    { key: 'mobile', label: 'Mobile Number', required: true },
    { key: 'village', label: 'Village' },
    { key: 'district', label: 'District' },
    { key: 'state', label: 'State' },
    { key: 'animalCount', label: 'Animal Count', type: 'number' },
  ];

  return (
    <div>
      <Breadcrumbs items={[{ label: 'Farmers', href: '/dashboard/farmers' }]} />
      <PageHeader title="Farmers" description={`${pagination?.total || 0} registered farmers`}
        actions={<>
          <button onClick={fetchFarmers} className="p-2 rounded-xl border border-gray-200 hover:bg-gray-50 text-gray-500"><RefreshCw size={16} /></button>
          <button onClick={() => setShowModal(true)} className="flex items-center gap-2 bg-green-600 hover:bg-green-700 text-white text-sm font-medium px-4 py-2 rounded-xl"><Plus size={16} /> Add Farmer</button>
        </>}
      />
      <div className="relative mb-4">
        <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
        <input type="text" placeholder="Search by name, mobile or ID..." value={search}
          onChange={(e) => { setSearch(e.target.value); setPage(1); }}
          className="w-full sm:w-80 pl-9 pr-4 py-2.5 text-sm border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-green-500" />
      </div>
      <DataTable columns={columns} data={farmers} loading={loading} pagination={pagination ?? undefined} onPageChange={setPage} emptyText="No farmers registered yet." />
      <Modal isOpen={showModal} onClose={() => setShowModal(false)} title="Register Farmer" size="lg"
        footer={<>
          <button onClick={() => setShowModal(false)} className="px-4 py-2 text-sm text-gray-600 hover:bg-gray-100 rounded-xl">Cancel</button>
          <button form="farmer-form" type="submit" disabled={saving} className="px-4 py-2 text-sm bg-green-600 text-white font-medium rounded-xl disabled:opacity-60">{saving ? 'Saving...' : 'Register Farmer'}</button>
        </>}
      >
        <form id="farmer-form" onSubmit={handleAdd} className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {textFields.map((field) => (
            <div key={field.key}>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">{field.label}{field.required && <span className="text-red-500 ml-1">*</span>}</label>
              <input type={field.type || 'text'} required={field.required} value={form[field.key]}
                onChange={(e) => setForm((f) => ({ ...f, [field.key]: e.target.value }))}
                className="w-full px-3 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-green-500" />
            </div>
          ))}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1.5">Animal Type</label>
            <select value={form.animalType} onChange={(e) => setForm((f) => ({ ...f, animalType: e.target.value }))}
              className="w-full px-3 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-green-500">
              {['Cow', 'Buffalo', 'Mixed', 'Other'].map((t) => <option key={t}>{t}</option>)}
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1.5">Gender</label>
            <select value={form.gender} onChange={(e) => setForm((f) => ({ ...f, gender: e.target.value }))}
              className="w-full px-3 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-green-500">
              <option value="">Select</option>
              {['Male', 'Female', 'Other'].map((g) => <option key={g}>{g}</option>)}
            </select>
          </div>
        </form>
      </Modal>
    </div>
  );
}
