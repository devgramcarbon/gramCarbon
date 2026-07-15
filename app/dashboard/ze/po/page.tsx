'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import type { FormEvent } from 'react';
import axios from 'axios';
import { Plus, RefreshCw, Upload, FileText, Send, ExternalLink } from 'lucide-react';
import PageHeader from '../../../components/PageHeader';
import Breadcrumbs from '../../../components/Breadcrumbs';
import DataTable from '../../../components/DataTable';
import Modal from '../../../components/Modal';
import { useToast } from '../../../components/Toaster';

type Status = 'REQUESTED' | 'RECEIVED' | 'ACKNOWLEDGED';

interface PurchaseOrder {
  _id: string;
  poNumber: string;
  client: string;
  batch?: string;
  qty?: number;
  notes?: string;
  status: Status;
  fileUrl?: string;
  fileName?: string;
  receivedAt?: string;
  createdAt: string;
}

const STATUS_LABELS: Record<Status, { label: string; className: string }> = {
  REQUESTED: { label: 'Requested', className: 'bg-amber-100 text-amber-700' },
  RECEIVED: { label: 'Received', className: 'bg-blue-100 text-blue-700' },
  ACKNOWLEDGED: { label: 'Acknowledged', className: 'bg-green-100 text-green-700' },
};

const EMPTY_FORM = { poNumber: '', client: '', batch: '', qty: '', notes: '' };

export default function ZePoPage() {
  const { toast } = useToast() ?? {};
  const [orders, setOrders] = useState<PurchaseOrder[]>([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [form, setForm] = useState(EMPTY_FORM);
  const [saving, setSaving] = useState(false);

  const [uploadTarget, setUploadTarget] = useState<PurchaseOrder | null>(null);
  const [uploadFile, setUploadFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const fetchOrders = useCallback(async () => {
    try {
      setLoading(true);
      const { data } = await axios.get<{ success: boolean; data: { orders: PurchaseOrder[] } }>('/api/po');
      if (data.success) setOrders(data.data.orders);
    } catch {
      toast?.('Failed to load purchase orders', 'error');
    } finally {
      setLoading(false);
    }
  }, [toast]);

  useEffect(() => { fetchOrders(); }, [fetchOrders]);

  const handleCreate = async (e: FormEvent) => {
    e.preventDefault();
    setSaving(true);
    try {
      const payload = { ...form, qty: form.qty ? Number(form.qty) : undefined };
      await axios.post('/api/po', payload);
      toast?.('Purchase order logged', 'success');
      setShowModal(false);
      setForm(EMPTY_FORM);
      fetchOrders();
    } catch (err) {
      toast?.((err as { response?: { data?: { message?: string } } })?.response?.data?.message || 'Failed to log purchase order', 'error');
    } finally {
      setSaving(false);
    }
  };

  const openUpload = (row: PurchaseOrder) => {
    setUploadTarget(row);
    setUploadFile(null);
  };

  const handleUpload = async (e: FormEvent) => {
    e.preventDefault();
    if (!uploadTarget || !uploadFile) return;
    setUploading(true);
    try {
      const fd = new FormData();
      fd.append('file', uploadFile);
      await axios.post(`/api/po/${uploadTarget._id}/upload`, fd, { headers: { 'Content-Type': 'multipart/form-data' } });
      toast?.('PO received — notified ZE Prod, MM Prod and MM Accounts', 'success');
      setUploadTarget(null);
      fetchOrders();
    } catch (err) {
      toast?.((err as { response?: { data?: { message?: string } } })?.response?.data?.message || 'Failed to upload PO', 'error');
    } finally {
      setUploading(false);
    }
  };

  const columns = [
    { key: 'poNumber', label: 'PO Number', render: (v: string) => <span className="font-medium text-gray-900">{v}</span> },
    { key: 'client', label: 'Client' },
    { key: 'batch', label: 'Batch', render: (v: string | undefined) => v || '—' },
    { key: 'qty', label: 'Qty', render: (v: number | undefined) => v ?? '—' },
    { key: 'status', label: 'Status', render: (v: Status) => (
      <span className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium ${STATUS_LABELS[v].className}`}>{STATUS_LABELS[v].label}</span>
    )},
    { key: 'fileUrl', label: 'PO File', render: (v: string | undefined, row: PurchaseOrder) => v ? (
      <a href={v} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1.5 text-xs text-blue-600 hover:underline">
        <FileText size={13} />{row.fileName || 'View file'} <ExternalLink size={11} />
      </a>
    ) : <span className="text-xs text-gray-400">Not uploaded</span> },
    { key: 'createdAt', label: 'Logged', render: (v: string) => new Date(v).toLocaleDateString('en-IN') },
    { key: 'actions', label: '', render: (_: unknown, row: PurchaseOrder) => (
      <div className="flex items-center justify-end">
        {row.status === 'REQUESTED' && (
          <button onClick={() => openUpload(row)} className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-medium text-teal-700 bg-teal-50 hover:bg-teal-100 transition-colors">
            <Upload size={13} /> Upload PO
          </button>
        )}
      </div>
    )},
  ];

  return (
    <div>
      <Breadcrumbs items={[{ label: 'PO Management', href: '/dashboard/ze/po' }]} />
      <PageHeader title="PO Management" description={`${orders.length} purchase order${orders.length === 1 ? '' : 's'} tracked`}
        actions={<>
          <button onClick={fetchOrders} className="p-2 rounded-xl border border-gray-200 hover:bg-gray-50 text-gray-500"><RefreshCw size={16} /></button>
          <button onClick={() => setShowModal(true)} className="flex items-center gap-2 bg-teal-600 hover:bg-teal-700 text-white text-sm font-medium px-4 py-2 rounded-xl transition-colors"><Plus size={16} /> Log PO</button>
        </>}
      />

      <DataTable columns={columns} data={orders} loading={loading} emptyText="No purchase orders logged yet." />

      <Modal isOpen={showModal} onClose={() => setShowModal(false)} title="Log Purchase Order"
        footer={<>
          <button onClick={() => setShowModal(false)} className="px-4 py-2 text-sm text-gray-600 hover:bg-gray-100 rounded-xl">Cancel</button>
          <button form="po-form" type="submit" disabled={saving} className="px-4 py-2 text-sm bg-teal-600 hover:bg-teal-700 text-white font-medium rounded-xl disabled:opacity-60">{saving ? 'Logging...' : 'Log PO'}</button>
        </>}
      >
        <form id="po-form" onSubmit={handleCreate} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1.5">PO Number<span className="text-red-500 ml-1">*</span></label>
            <input type="text" required value={form.poNumber} onChange={(e) => setForm((f) => ({ ...f, poNumber: e.target.value }))} placeholder="PO-2026-0142"
              className="w-full px-3 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-teal-500" />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1.5">Client<span className="text-red-500 ml-1">*</span></label>
            <input type="text" required value={form.client} onChange={(e) => setForm((f) => ({ ...f, client: e.target.value }))} placeholder="Milky Mist"
              className="w-full px-3 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-teal-500" />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">Batch</label>
              <input type="text" value={form.batch} onChange={(e) => setForm((f) => ({ ...f, batch: e.target.value }))} placeholder="B-042"
                className="w-full px-3 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-teal-500" />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">Qty</label>
              <input type="number" min="0" value={form.qty} onChange={(e) => setForm((f) => ({ ...f, qty: e.target.value }))} placeholder="500"
                className="w-full px-3 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-teal-500" />
            </div>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1.5">Notes</label>
            <textarea value={form.notes} onChange={(e) => setForm((f) => ({ ...f, notes: e.target.value }))} rows={3} placeholder="Any relevant context..."
              className="w-full px-3 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-teal-500" />
          </div>
        </form>
      </Modal>

      <Modal isOpen={!!uploadTarget} onClose={() => setUploadTarget(null)} title="Upload Received PO"
        footer={<>
          <button onClick={() => setUploadTarget(null)} className="px-4 py-2 text-sm text-gray-600 hover:bg-gray-100 rounded-xl">Cancel</button>
          <button form="po-upload-form" type="submit" disabled={uploading || !uploadFile} className="flex items-center gap-2 px-4 py-2 text-sm bg-teal-600 hover:bg-teal-700 text-white font-medium rounded-xl disabled:opacity-60">
            <Send size={14} />{uploading ? 'Uploading...' : 'Upload & Notify'}
          </button>
        </>}
      >
        <form id="po-upload-form" onSubmit={handleUpload} className="space-y-4">
          <p className="text-sm text-gray-600">
            Upload the PO file received via mail for <span className="font-semibold text-gray-900">{uploadTarget?.poNumber}</span>.
            This marks the PO as received and sends a WhatsApp notification to ZE Prod, MM Prod and MM Accounts.
          </p>
          <div
            onClick={() => fileInputRef.current?.click()}
            className="flex flex-col items-center justify-center gap-2 border-2 border-dashed border-gray-200 rounded-xl py-8 cursor-pointer hover:border-teal-400 hover:bg-teal-50/40 transition-colors"
          >
            <Upload size={22} className="text-gray-400" />
            <p className="text-sm text-gray-600">{uploadFile ? uploadFile.name : 'Click to select PO file (PDF/image)'}</p>
            <input
              ref={fileInputRef}
              type="file"
              accept="application/pdf,image/jpeg,image/png,image/webp"
              className="hidden"
              onChange={(e) => setUploadFile(e.target.files?.[0] || null)}
            />
          </div>
        </form>
      </Modal>
    </div>
  );
}
