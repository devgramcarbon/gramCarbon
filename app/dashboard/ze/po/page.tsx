'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import type { FormEvent } from 'react';
import axios from 'axios';
import { Plus, RefreshCw, Upload, FileText, Send, ExternalLink, CheckCircle2 } from 'lucide-react';
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
  finalValues?: { qty?: number; rate?: number; amount?: number };
  createdAt: string;
}

const STATUS_LABELS: Record<Status, { label: string; className: string }> = {
  REQUESTED: { label: 'Requested', className: 'bg-amber-100 text-amber-700' },
  RECEIVED: { label: 'Received', className: 'bg-blue-100 text-blue-700' },
  ACKNOWLEDGED: { label: 'Acknowledged', className: 'bg-green-100 text-green-700' },
};

const EMPTY_FORM = { poNumber: '', client: '', batch: '', qty: '', rate: '', amount: '', notes: '' };

export default function ZePoPage() {
  const { toast } = useToast() ?? {};
  const [orders, setOrders] = useState<PurchaseOrder[]>([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [form, setForm] = useState(EMPTY_FORM);
  const [poFile, setPoFile] = useState<File | null>(null);
  const [extracting, setExtracting] = useState(false);
  const [extractedNote, setExtractedNote] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [ackTarget, setAckTarget] = useState<PurchaseOrder | null>(null);
  const [ackForm, setAckForm] = useState({ qty: '', rate: '', amount: '' });
  const [acking, setAcking] = useState(false);

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

  const resetCreateForm = () => {
    setForm(EMPTY_FORM);
    setPoFile(null);
    setExtractedNote(null);
  };

  const handleFileSelect = async (file: File | null) => {
    setPoFile(file);
    setExtractedNote(null);
    if (!file) return;

    setExtracting(true);
    try {
      const fd = new FormData();
      fd.append('file', file);
      const { data } = await axios.post<{ success: boolean; data: { fields: Record<string, string | number> } }>('/api/po/extract', fd, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });
      if (data.success) {
        const f = data.data.fields;
        const found = Object.keys(f).length > 0;
        setForm((prev) => ({
          ...prev,
          poNumber: (f.poNumber as string) || prev.poNumber,
          client: (f.client as string) || prev.client,
          qty: f.qty !== undefined ? String(f.qty) : prev.qty,
          rate: f.rate !== undefined ? String(f.rate) : prev.rate,
          amount: f.amount !== undefined ? String(f.amount) : prev.amount,
        }));
        setExtractedNote(found ? 'Fields extracted from PDF — please review before saving.' : 'Could not auto-extract fields from this file — please fill in manually.');
      }
    } catch {
      setExtractedNote('Field extraction failed — please fill in manually.');
    } finally {
      setExtracting(false);
    }
  };

  const handleCreate = async (e: FormEvent) => {
    e.preventDefault();
    setSaving(true);
    try {
      const fd = new FormData();
      fd.append('poNumber', form.poNumber);
      fd.append('client', form.client);
      if (form.batch) fd.append('batch', form.batch);
      if (form.qty) fd.append('qty', form.qty);
      if (form.rate) fd.append('rate', form.rate);
      if (form.amount) fd.append('amount', form.amount);
      if (form.notes) fd.append('notes', form.notes);
      if (poFile) fd.append('file', poFile);

      const { data } = await axios.post('/api/po', fd, { headers: { 'Content-Type': 'multipart/form-data' } });
      toast?.(data?.message || 'Purchase order created', 'success');
      setShowModal(false);
      resetCreateForm();
      fetchOrders();
    } catch (err) {
      toast?.((err as { response?: { data?: { message?: string } } })?.response?.data?.message || 'Failed to create purchase order', 'error');
    } finally {
      setSaving(false);
    }
  };

  const openAcknowledge = (row: PurchaseOrder) => {
    setAckTarget(row);
    setAckForm({
      qty: row.finalValues?.qty !== undefined ? String(row.finalValues.qty) : (row.qty !== undefined ? String(row.qty) : ''),
      rate: row.finalValues?.rate !== undefined ? String(row.finalValues.rate) : '',
      amount: row.finalValues?.amount !== undefined ? String(row.finalValues.amount) : '',
    });
  };

  const handleAcknowledge = async (e: FormEvent) => {
    e.preventDefault();
    if (!ackTarget) return;
    setAcking(true);
    try {
      const payload = {
        qty: ackForm.qty ? Number(ackForm.qty) : undefined,
        rate: ackForm.rate ? Number(ackForm.rate) : undefined,
        amount: ackForm.amount ? Number(ackForm.amount) : undefined,
      };
      await axios.post(`/api/po/${ackTarget._id}/acknowledge`, payload);
      toast?.('Purchase order acknowledged', 'success');
      setAckTarget(null);
      fetchOrders();
    } catch (err) {
      toast?.((err as { response?: { data?: { message?: string } } })?.response?.data?.message || 'Failed to acknowledge PO', 'error');
    } finally {
      setAcking(false);
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
        {row.status === 'RECEIVED' && (
          <button onClick={() => openAcknowledge(row)} className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-medium text-teal-700 bg-teal-50 hover:bg-teal-100 transition-colors">
            <CheckCircle2 size={13} /> Acknowledge
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
          <button onClick={() => setShowModal(true)} className="flex items-center gap-2 bg-teal-600 hover:bg-teal-700 text-white text-sm font-medium px-4 py-2 rounded-xl transition-colors"><Plus size={16} /> Create PO</button>
        </>}
      />

      <DataTable columns={columns} data={orders} loading={loading} emptyText="No purchase orders logged yet." />

      <Modal isOpen={showModal} onClose={() => { setShowModal(false); resetCreateForm(); }} title="Create Purchase Order"
        footer={<>
          <button onClick={() => { setShowModal(false); resetCreateForm(); }} className="px-4 py-2 text-sm text-gray-600 hover:bg-gray-100 rounded-xl">Cancel</button>
          <button form="po-form" type="submit" disabled={saving} className="flex items-center gap-2 px-4 py-2 text-sm bg-teal-600 hover:bg-teal-700 text-white font-medium rounded-xl disabled:opacity-60">
            <Send size={14} />{saving ? 'Creating...' : 'Create & Notify'}
          </button>
        </>}
      >
        <form id="po-form" onSubmit={handleCreate} className="space-y-4">
          <div
            onClick={() => fileInputRef.current?.click()}
            className="flex flex-col items-center justify-center gap-2 border-2 border-dashed border-gray-200 rounded-xl py-6 cursor-pointer hover:border-teal-400 hover:bg-teal-50/40 transition-colors"
          >
            <Upload size={20} className="text-gray-400" />
            <p className="text-sm text-gray-600">{poFile ? poFile.name : 'Click to upload PO file (PDF/image) — optional'}</p>
            {extracting && <p className="text-xs text-teal-600">Extracting fields...</p>}
            <input
              ref={fileInputRef}
              type="file"
              accept="application/pdf,image/jpeg,image/png,image/webp"
              className="hidden"
              onChange={(e) => handleFileSelect(e.target.files?.[0] || null)}
            />
          </div>
          {extractedNote && <p className="text-xs text-amber-600 bg-amber-50 px-3 py-2 rounded-lg">{extractedNote}</p>}
          <p className="text-xs text-gray-500">
            Creating this PO will automatically notify ZE Production, Milky Mist Production and Milky Mist Accounts via WhatsApp.
            {poFile ? ' Since a file is attached, it will also be marked as Received.' : ''}
          </p>

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
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">Rate</label>
              <input type="number" min="0" step="0.01" value={form.rate} onChange={(e) => setForm((f) => ({ ...f, rate: e.target.value }))} placeholder="15.50"
                className="w-full px-3 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-teal-500" />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">Amount</label>
              <input type="number" min="0" step="0.01" value={form.amount} onChange={(e) => setForm((f) => ({ ...f, amount: e.target.value }))} placeholder="170500.00"
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

      <Modal isOpen={!!ackTarget} onClose={() => setAckTarget(null)} title="Acknowledge Purchase Order"
        footer={<>
          <button onClick={() => setAckTarget(null)} className="px-4 py-2 text-sm text-gray-600 hover:bg-gray-100 rounded-xl">Cancel</button>
          <button form="po-ack-form" type="submit" disabled={acking} className="px-4 py-2 text-sm bg-teal-600 hover:bg-teal-700 text-white font-medium rounded-xl disabled:opacity-60">{acking ? 'Saving...' : 'Acknowledge'}</button>
        </>}
      >
        <form id="po-ack-form" onSubmit={handleAcknowledge} className="space-y-4">
          <p className="text-sm text-gray-600">
            Confirm final values for <span className="font-semibold text-gray-900">{ackTarget?.poNumber}</span> to mark it Acknowledged.
          </p>
          <div className="grid grid-cols-3 gap-3">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">Qty</label>
              <input type="number" min="0" value={ackForm.qty} onChange={(e) => setAckForm((f) => ({ ...f, qty: e.target.value }))}
                className="w-full px-3 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-teal-500" />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">Rate</label>
              <input type="number" min="0" step="0.01" value={ackForm.rate} onChange={(e) => setAckForm((f) => ({ ...f, rate: e.target.value }))}
                className="w-full px-3 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-teal-500" />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">Amount</label>
              <input type="number" min="0" step="0.01" value={ackForm.amount} onChange={(e) => setAckForm((f) => ({ ...f, amount: e.target.value }))}
                className="w-full px-3 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-teal-500" />
            </div>
          </div>
        </form>
      </Modal>
    </div>
  );
}
