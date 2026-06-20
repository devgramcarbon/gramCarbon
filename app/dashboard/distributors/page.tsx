'use client';

import { useState, useEffect, useCallback } from 'react';
import type { FormEvent } from 'react';
import axios from 'axios';
import { Plus, Search, RefreshCw, Phone, Package, Pencil, Trash2 } from 'lucide-react';
import PageHeader from '../../components/PageHeader';
import Breadcrumbs from '../../components/Breadcrumbs';
import DataTable from '../../components/DataTable';
import Modal from '../../components/Modal';
import { useToast } from '../../components/Toaster';
import { useSocket } from '../../components/SocketProvider';

interface StockInfo { receivedKg: number; soldKg: number }
interface Distributor { _id: string; name: string; phone: string; email?: string; district?: string; state?: string; createdAt?: string; stock?: StockInfo }
interface Pagination { page: number; pages: number; total: number; limit: number }

const EMPTY_FORM = { phone: '', name: '', email: '', district: '', state: '' };

export default function DistributorsPage() {
  const { toast } = useToast() ?? {};
  const socket = useSocket();
  const [distributors, setDistributors] = useState<Distributor[]>([]);
  const [pagination, setPagination] = useState<Pagination | null>(null);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');
  const [showModal, setShowModal] = useState(false);
  const [form, setForm] = useState(EMPTY_FORM);
  const [saving, setSaving] = useState(false);

  const [editTarget, setEditTarget] = useState<Distributor | null>(null);
  const [editForm, setEditForm] = useState(EMPTY_FORM);
  const [editSaving, setEditSaving] = useState(false);

  const [deleteTarget, setDeleteTarget] = useState<Distributor | null>(null);
  const [deleting, setDeleting] = useState(false);

  const fetchDistributors = useCallback(async () => {
    try {
      setLoading(true);
      const { data } = await axios.get<{ success: boolean; data: { distributors: Distributor[]; pagination: Pagination } }>('/api/distributors', { params: { page, search, limit: 20 } });
      if (data.success) { setDistributors(data.data.distributors); setPagination(data.data.pagination); }
    } catch { toast?.('Failed to load distributors', 'error'); }
    finally { setLoading(false); }
  }, [page, search, toast]);

  useEffect(() => { fetchDistributors(); }, [fetchDistributors]);
  useEffect(() => { if (!socket) return; return socket.subscribe('dashboard_updated', fetchDistributors); }, [socket, fetchDistributors]);

  const handleAdd = async (e: FormEvent) => {
    e.preventDefault();
    setSaving(true);
    try {
      await axios.post('/api/distributors', form);
      toast?.('Distributor added successfully', 'success');
      setShowModal(false);
      setForm(EMPTY_FORM);
      fetchDistributors();
    } catch (err) {
      toast?.((err as { response?: { data?: { message?: string } } })?.response?.data?.message || 'Failed to add distributor', 'error');
    } finally { setSaving(false); }
  };

  const openEdit = (row: Distributor) => {
    setEditTarget(row);
    setEditForm({ phone: row.phone, name: row.name, email: row.email || '', district: row.district || '', state: row.state || '' });
  };

  const handleEdit = async (e: FormEvent) => {
    e.preventDefault();
    if (!editTarget) return;
    setEditSaving(true);
    try {
      await axios.patch(`/api/distributors/${editTarget._id}`, editForm);
      toast?.('Distributor updated successfully', 'success');
      setEditTarget(null);
      fetchDistributors();
    } catch (err) {
      toast?.((err as { response?: { data?: { message?: string } } })?.response?.data?.message || 'Failed to update distributor', 'error');
    } finally { setEditSaving(false); }
  };

  const handleDelete = async () => {
    if (!deleteTarget) return;
    setDeleting(true);
    try {
      await axios.delete(`/api/distributors/${deleteTarget._id}`);
      toast?.('Distributor deleted', 'success');
      setDeleteTarget(null);
      fetchDistributors();
    } catch (err) {
      toast?.((err as { response?: { data?: { message?: string } } })?.response?.data?.message || 'Failed to delete distributor', 'error');
    } finally { setDeleting(false); }
  };

  const FORM_FIELDS = [
    { key: 'name' as const, label: 'Full Name', required: true, placeholder: 'Rajesh Kumar' },
    { key: 'phone' as const, label: 'Phone Number (WhatsApp)', required: true, placeholder: '9876543210 or 919876543210' },
    { key: 'email' as const, label: 'Email (optional)', placeholder: 'rajesh@example.com' },
    { key: 'district' as const, label: 'District', placeholder: 'Nashik' },
    { key: 'state' as const, label: 'State', placeholder: 'Maharashtra' },
  ];

  const columns = [
    { key: 'name', label: 'Name' },
    { key: 'phone', label: 'Phone', render: (v: string) => <span className="flex items-center gap-1.5"><Phone size={13} className="text-gray-400" />{v}</span> },
    { key: 'stock_balance', label: 'Stock Balance', render: (_: unknown, row: Distributor) => {
      const balance = (row.stock?.receivedKg || 0) - (row.stock?.soldKg || 0);
      return <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium ${balance < 50 ? 'bg-red-100 text-red-700' : 'bg-green-100 text-green-700'}`}><Package size={12} />{balance}kg</span>;
    }},
    { key: 'stock_received', label: 'Received', render: (_: unknown, row: Distributor) => `${row.stock?.receivedKg || 0}kg` },
    { key: 'stock_sold', label: 'Sold', render: (_: unknown, row: Distributor) => `${row.stock?.soldKg || 0}kg` },
    { key: 'stock_utilization', label: 'Utilization', render: (_: unknown, row: Distributor) => {
      const rcv = row.stock?.receivedKg || 0; const sold = row.stock?.soldKg || 0;
      const pct = rcv > 0 ? Math.round((sold / rcv) * 100) : 0;
      return <div className="flex items-center gap-2"><div className="w-16 h-1.5 bg-gray-200 rounded-full"><div className="h-full bg-green-500 rounded-full" style={{ width: `${pct}%` }} /></div><span className="text-xs text-gray-600">{pct}%</span></div>;
    }},
    { key: 'createdAt', label: 'Joined', render: (v: string) => v ? new Date(v).toLocaleDateString('en-IN') : '—' },
    { key: 'actions', label: '', render: (_: unknown, row: Distributor) => (
      <div className="flex items-center gap-1 justify-end">
        <button onClick={() => openEdit(row)} className="p-1.5 rounded-lg text-gray-400 hover:text-blue-600 hover:bg-blue-50 transition-colors" title="Edit"><Pencil size={14} /></button>
        <button onClick={() => setDeleteTarget(row)} className="p-1.5 rounded-lg text-gray-400 hover:text-red-600 hover:bg-red-50 transition-colors" title="Delete"><Trash2 size={14} /></button>
      </div>
    )},
  ];

  return (
    <div>
      <Breadcrumbs items={[{ label: 'Distributors', href: '/dashboard/distributors' }]} />
      <PageHeader title="Distributors" description={`${pagination?.total || 0} total distributors`}
        actions={<>
          <button onClick={fetchDistributors} className="p-2 rounded-xl border border-gray-200 hover:bg-gray-50 text-gray-500"><RefreshCw size={16} /></button>
          <button onClick={() => setShowModal(true)} className="flex items-center gap-2 bg-green-600 hover:bg-green-700 text-white text-sm font-medium px-4 py-2 rounded-xl transition-colors"><Plus size={16} /> Add Distributor</button>
        </>}
      />
      <div className="relative mb-4">
        <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
        <input type="text" placeholder="Search by name or phone..." value={search}
          onChange={(e) => { setSearch(e.target.value); setPage(1); }}
          className="w-full sm:w-80 pl-9 pr-4 py-2.5 text-sm border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-green-500" />
      </div>
      <DataTable columns={columns} data={distributors} loading={loading} pagination={pagination ?? undefined} onPageChange={setPage} emptyText="No distributors found. Add your first distributor." />

      {/* Add Modal */}
      <Modal isOpen={showModal} onClose={() => setShowModal(false)} title="Add Distributor"
        footer={<>
          <button onClick={() => setShowModal(false)} className="px-4 py-2 text-sm text-gray-600 hover:bg-gray-100 rounded-xl">Cancel</button>
          <button form="add-dist-form" type="submit" disabled={saving} className="px-4 py-2 text-sm bg-green-600 hover:bg-green-700 text-white font-medium rounded-xl disabled:opacity-60">{saving ? 'Adding...' : 'Add Distributor'}</button>
        </>}
      >
        <form id="add-dist-form" onSubmit={handleAdd} className="space-y-4">
          {FORM_FIELDS.map((field) => (
            <div key={field.key}>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">{field.label}{field.required && <span className="text-red-500 ml-1">*</span>}</label>
              <input type="text" required={field.required} value={form[field.key]} onChange={(e) => setForm((f) => ({ ...f, [field.key]: e.target.value }))} placeholder={field.placeholder}
                className="w-full px-3 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-green-500" />
              {field.key === 'phone' && <p className="mt-1 text-xs text-gray-400">Enter 10-digit number — saved as 91XXXXXXXXXX for WhatsApp</p>}
            </div>
          ))}
        </form>
      </Modal>

      {/* Edit Modal */}
      <Modal isOpen={!!editTarget} onClose={() => setEditTarget(null)} title="Edit Distributor"
        footer={<>
          <button onClick={() => setEditTarget(null)} className="px-4 py-2 text-sm text-gray-600 hover:bg-gray-100 rounded-xl">Cancel</button>
          <button form="edit-dist-form" type="submit" disabled={editSaving} className="px-4 py-2 text-sm bg-blue-600 hover:bg-blue-700 text-white font-medium rounded-xl disabled:opacity-60">{editSaving ? 'Saving...' : 'Save Changes'}</button>
        </>}
      >
        <form id="edit-dist-form" onSubmit={handleEdit} className="space-y-4">
          {FORM_FIELDS.map((field) => (
            <div key={field.key}>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">{field.label}{field.required && <span className="text-red-500 ml-1">*</span>}</label>
              <input type="text" required={field.required} value={editForm[field.key]} onChange={(e) => setEditForm((f) => ({ ...f, [field.key]: e.target.value }))} placeholder={field.placeholder}
                className="w-full px-3 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
              {field.key === 'phone' && <p className="mt-1 text-xs text-gray-400">Enter 10-digit number — saved as 91XXXXXXXXXX for WhatsApp</p>}
            </div>
          ))}
        </form>
      </Modal>

      {/* Delete Confirmation Modal */}
      <Modal isOpen={!!deleteTarget} onClose={() => setDeleteTarget(null)} title="Delete Distributor"
        footer={<>
          <button onClick={() => setDeleteTarget(null)} className="px-4 py-2 text-sm text-gray-600 hover:bg-gray-100 rounded-xl">Cancel</button>
          <button onClick={handleDelete} disabled={deleting} className="px-4 py-2 text-sm bg-red-600 hover:bg-red-700 text-white font-medium rounded-xl disabled:opacity-60">{deleting ? 'Deleting...' : 'Delete'}</button>
        </>}
      >
        <p className="text-sm text-gray-600">Are you sure you want to delete <span className="font-semibold text-gray-900">{deleteTarget?.name}</span>? This action cannot be undone.</p>
      </Modal>
    </div>
  );
}
