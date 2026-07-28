'use client';

import { useState, useEffect, useCallback } from 'react';
import type { FormEvent } from 'react';
import axios from 'axios';
import { Plus, Search, RefreshCw, MapPin, Beef, Upload, Download } from 'lucide-react';
import PageHeader from '../../components/PageHeader';
import Breadcrumbs from '../../components/Breadcrumbs';
import DataTable from '../../components/DataTable';
import Modal from '../../components/Modal';
import { useToast } from '../../components/Toaster';
import { useSocket } from '../../components/SocketProvider';
import { useProjectFilter } from '../ProjectFilterContext';

interface Farmer { _id: string; farmerId: string; name: string; mobile: string; village?: string; district?: string; state?: string; animalCount?: number; animalType?: string; gender?: string; createdAt?: string }
interface Pagination { page: number; pages: number; total: number; limit: number }

export default function FarmersPage() {
  const { toast } = useToast() ?? {};
  const { subscribe } = useSocket() ?? {};
  const { project } = useProjectFilter();
  const [farmers, setFarmers] = useState<Farmer[]>([]);
  const [pagination, setPagination] = useState<Pagination | null>(null);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');
  const [showModal, setShowModal] = useState(false);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({ name: '', mobile: '', village: '', district: '', state: '', animalCount: '', animalType: 'Cow', gender: '', aadhar: '' });
  const [formProject, setFormProject] = useState<'np' | 'mm'>(project === 'np' || project === 'mm' ? project : 'np');
  const [showBulkModal, setShowBulkModal] = useState(false);
  const [bulkProject, setBulkProject] = useState<'np' | 'mm'>(project === 'np' || project === 'mm' ? project : 'np');
  const [bulkRows, setBulkRows] = useState<Record<string, string>[]>([]);
  const [bulkFileName, setBulkFileName] = useState('');
  const [bulkParseError, setBulkParseError] = useState('');
  const [bulkSubmitting, setBulkSubmitting] = useState(false);
  const [bulkResult, setBulkResult] = useState<{ created: number; skipped: number; errors: Array<{ row: number; mobile?: string; reason: string }> } | null>(null);

  const fetchFarmers = useCallback(async () => {
    setLoading(true);
    try {
      const { data } = await axios.get<{ success: boolean; data: { farmers: Farmer[]; pagination: Pagination } }>('/api/farmers', { params: { page, search, limit: 20, project: project !== 'all' ? project : undefined } });
      if (data.success) { setFarmers(data.data.farmers); setPagination(data.data.pagination); }
    } catch { toast?.('Failed to load farmers', 'error'); }
    finally { setLoading(false); }
  }, [page, search, toast, project]);

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
      await axios.post('/api/farmers', { ...form, animalCount: Number(form.animalCount), project: formProject });
      toast?.('Farmer registered successfully', 'success');
      setShowModal(false);
      setForm({ name: '', mobile: '', village: '', district: '', state: '', animalCount: '', animalType: 'Cow', gender: '', aadhar: '' });
      setFormProject(project === 'np' || project === 'mm' ? project : 'np');
      fetchFarmers();
    } catch (err) {
      toast?.((err as { response?: { data?: { message?: string } } })?.response?.data?.message || 'Failed to register farmer', 'error');
    } finally { setSaving(false); }
  };

  const parseCsv = (text: string): Record<string, string>[] => {
    const rows: string[][] = [];
    let field = '', row: string[] = [], inQuotes = false;
    for (let i = 0; i < text.length; i++) {
      const c = text[i];
      if (inQuotes) {
        if (c === '"') { if (text[i + 1] === '"') { field += '"'; i++; } else { inQuotes = false; } }
        else field += c;
      } else if (c === '"') inQuotes = true;
      else if (c === ',') { row.push(field); field = ''; }
      else if (c === '\n' || c === '\r') {
        if (c === '\r' && text[i + 1] === '\n') i++;
        row.push(field); field = '';
        if (row.some((v) => v.trim() !== '')) rows.push(row);
        row = [];
      } else field += c;
    }
    if (field !== '' || row.length) { row.push(field); if (row.some((v) => v.trim() !== '')) rows.push(row); }
    if (rows.length === 0) return [];
    const headers = rows[0].map((h) => h.trim().toLowerCase());
    return rows.slice(1).map((r) => {
      const obj: Record<string, string> = {};
      headers.forEach((h, idx) => { obj[h] = (r[idx] ?? '').trim(); });
      return obj;
    });
  };

  const handleBulkFile = async (file: File) => {
    setBulkParseError('');
    setBulkResult(null);
    setBulkFileName(file.name);
    try {
      const text = await file.text();
      const parsed = parseCsv(text);
      if (parsed.length === 0) { setBulkParseError('No data rows found in CSV.'); setBulkRows([]); return; }
      const required = bulkProject === 'np' ? ['name', 'mobile', 'animalcount', 'aadhar'] : ['name', 'mobile', 'animalcount'];
      const missing = required.filter((r) => !(r in parsed[0]));
      if (missing.length) { setBulkParseError(`Missing required column(s): ${missing.join(', ')}`); setBulkRows([]); return; }
      setBulkRows(parsed);
    } catch {
      setBulkParseError('Failed to read file.');
      setBulkRows([]);
    }
  };

  const handleBulkSubmit = async () => {
    if (bulkRows.length === 0) return;
    setBulkSubmitting(true);
    setBulkResult(null);
    try {
      const farmers = bulkRows.map((r) => ({
        name: r.name,
        mobile: r.mobile,
        village: r.village || undefined,
        district: r.district || undefined,
        state: r.state || undefined,
        animalCount: Number(r.animalcount),
        animalType: ['Cow', 'Buffalo', 'Mixed', 'Other'].includes(r.animaltype) ? r.animaltype : (r.animaltype ? 'Other' : undefined),
        gender: ['Male', 'Female', 'Other'].includes(r.gender) ? r.gender : undefined,
        aadhar: r.aadhar || undefined,
        project: bulkProject,
      }));
      const { data } = await axios.post('/api/farmers/bulk', { farmers });
      if (data.success) {
        setBulkResult(data.data);
        toast?.(data.message || 'Bulk import complete', 'success');
        fetchFarmers();
      }
    } catch (err) {
      toast?.((err as { response?: { data?: { message?: string } } })?.response?.data?.message || 'Bulk import failed', 'error');
    } finally {
      setBulkSubmitting(false);
    }
  };

  const downloadTemplate = () => {
    const csv = bulkProject === 'np'
      ? 'name,mobile,village,district,state,animalCount,animalType,gender,aadhar\nRamesh Kumar,9876543210,Nainarpalayam,Erode,Tamil Nadu,4,Cow,Male,123456789012\n'
      : 'name,mobile,village,district,state,animalCount,animalType,gender\nRamesh Kumar,9876543210,Nainarpalayam,Erode,Tamil Nadu,4,Cow,Male\n';
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = 'farmers_template.csv'; a.click();
    URL.revokeObjectURL(url);
  };

  const closeBulkModal = () => {
    setShowBulkModal(false);
    setBulkRows([]);
    setBulkFileName('');
    setBulkParseError('');
    setBulkResult(null);
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
    { key: 'animalCount', label: 'Animal Count', type: 'number', required: true },
  ];

  return (
    <div>
      <Breadcrumbs items={[{ label: 'Farmers', href: '/dashboard/farmers' }]} />
      <PageHeader title="Farmers" description={`${pagination?.total || 0} registered farmers`}
        actions={<>
          <button onClick={fetchFarmers} className="p-2 rounded-xl border bg-white border-gray-200 hover:bg-gray-50 text-gray-500"><RefreshCw size={16} /></button>
          <button onClick={() => { setBulkProject(project === 'np' || project === 'mm' ? project : 'np'); setShowBulkModal(true); }} className="flex items-center gap-2 border border-gray-200 hover:bg-gray-50 text-gray-700 text-sm font-medium bg-white px-4 py-2 rounded-xl"><Upload size={16} /> Bulk Upload</button>
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
          <div className="sm:col-span-2">
            <label className="block text-sm font-medium text-gray-700 mb-1.5">Project</label>
            <div className="flex gap-4">
              <label className="flex items-center gap-1.5 text-sm text-gray-700">
                <input type="radio" name="add-farmer-project" checked={formProject === 'np'} onChange={() => setFormProject('np')} /> NainarPalayam
              </label>
              <label className="flex items-center gap-1.5 text-sm text-gray-700">
                <input type="radio" name="add-farmer-project" checked={formProject === 'mm'} onChange={() => setFormProject('mm')} /> Milky Mist
              </label>
            </div>
          </div>
          {textFields.map((field) => (
            <div key={field.key}>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">{field.label}{field.required && <span className="text-red-500 ml-1">*</span>}</label>
              <input type={field.type || 'text'} required={field.required} min={field.key === 'animalCount' ? 1 : undefined} value={form[field.key]}
                onChange={(e) => setForm((f) => ({ ...f, [field.key]: e.target.value }))}
                className="w-full px-3 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-green-500" />
            </div>
          ))}
          {formProject === 'np' && (
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">Aadhar Number<span className="text-red-500 ml-1">*</span></label>
              <input type="text" inputMode="numeric" required maxLength={12} value={form.aadhar}
                onChange={(e) => setForm((f) => ({ ...f, aadhar: e.target.value.replace(/\D/g, '') }))}
                placeholder="12-digit Aadhar number"
                className="w-full px-3 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-green-500" />
              <p className="text-xs text-gray-500 mt-1">Required for NainarPalayam carbon-program farmers (stored encrypted).</p>
            </div>
          )}
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
      <Modal isOpen={showBulkModal} onClose={closeBulkModal} title="Bulk Upload Farmers (CSV)" size="lg"
        footer={<>
          <button onClick={closeBulkModal} className="px-4 py-2 text-sm text-gray-600 hover:bg-gray-100 rounded-xl">{bulkResult ? 'Close' : 'Cancel'}</button>
          {!bulkResult && (
            <button onClick={handleBulkSubmit} disabled={bulkSubmitting || bulkRows.length === 0} className="px-4 py-2 text-sm bg-green-600 text-white font-medium rounded-xl disabled:opacity-60">
              {bulkSubmitting ? 'Uploading...' : `Import ${bulkRows.length || ''} Farmer${bulkRows.length === 1 ? '' : 's'}`}
            </button>
          )}
        </>}
      >
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <label className="block text-sm font-medium text-gray-700">Project</label>
            <button onClick={downloadTemplate} type="button" className="flex items-center gap-1.5 text-xs text-green-700 hover:underline">
              <Download size={13} /> Download CSV template
            </button>
          </div>
          <div className="flex gap-4">
            <label className="flex items-center gap-1.5 text-sm text-gray-700">
              <input type="radio" name="bulk-farmer-project" checked={bulkProject === 'np'} onChange={() => setBulkProject('np')} /> NainarPalayam
            </label>
            <label className="flex items-center gap-1.5 text-sm text-gray-700">
              <input type="radio" name="bulk-farmer-project" checked={bulkProject === 'mm'} onChange={() => setBulkProject('mm')} /> Milky Mist
            </label>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1.5">CSV File</label>
            <input type="file" accept=".csv,text/csv" onChange={(e) => { const f = e.target.files?.[0]; if (f) handleBulkFile(f); }}
              className="w-full text-sm border border-gray-200 rounded-xl px-3 py-2.5 file:mr-3 file:py-1.5 file:px-3 file:rounded-lg file:border-0 file:bg-green-50 file:text-green-700 file:text-sm" />
            <p className="text-xs text-gray-500 mt-1.5">
              Required columns: name, mobile, animalCount{bulkProject === 'np' ? ', aadhar (12 digits)' : ''}. Optional: village, district, state, animalType (Cow/Buffalo/Mixed/Other), gender (Male/Female/Other).
            </p>
          </div>

          {bulkParseError && <div className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-xl px-3 py-2">{bulkParseError}</div>}

          {bulkRows.length > 0 && !bulkResult && (
            <div>
              <p className="text-sm text-gray-600 mb-2">{bulkFileName}: {bulkRows.length} row(s) ready to import.</p>
              <div className="max-h-56 overflow-auto border border-gray-200 rounded-xl">
                <table className="w-full text-xs">
                  <thead className="bg-gray-50 sticky top-0">
                    <tr>{Object.keys(bulkRows[0]).map((h) => <th key={h} className="text-left px-2 py-1.5 font-medium text-gray-600">{h}</th>)}</tr>
                  </thead>
                  <tbody>
                    {bulkRows.slice(0, 10).map((r, i) => (
                      <tr key={i} className="border-t border-gray-100">
                        {Object.keys(bulkRows[0]).map((h) => <td key={h} className="px-2 py-1.5 text-gray-700">{r[h] || '—'}</td>)}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              {bulkRows.length > 10 && <p className="text-xs text-gray-400 mt-1">+ {bulkRows.length - 10} more row(s)</p>}
            </div>
          )}

          {bulkResult && (
            <div className="space-y-2">
              <div className="flex gap-4 text-sm">
                <span className="text-green-700 font-medium">{bulkResult.created} created</span>
                <span className="text-amber-600 font-medium">{bulkResult.skipped} skipped</span>
              </div>
              {bulkResult.errors.length > 0 && (
                <div className="max-h-40 overflow-auto border border-gray-200 rounded-xl">
                  <table className="w-full text-xs">
                    <thead className="bg-gray-50 sticky top-0"><tr><th className="text-left px-2 py-1.5">Row</th><th className="text-left px-2 py-1.5">Mobile</th><th className="text-left px-2 py-1.5">Reason</th></tr></thead>
                    <tbody>
                      {bulkResult.errors.map((e, i) => (
                        <tr key={i} className="border-t border-gray-100">
                          <td className="px-2 py-1.5">{e.row}</td>
                          <td className="px-2 py-1.5">{e.mobile || '—'}</td>
                          <td className="px-2 py-1.5 text-red-600">{e.reason}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          )}
        </div>
      </Modal>
    </div>
  );
}
