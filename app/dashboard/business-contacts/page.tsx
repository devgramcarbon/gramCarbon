'use client';

import { useState, useEffect, useCallback } from 'react';
import type { FormEvent } from 'react';
import axios from 'axios';
import { Plus, Search, RefreshCw, Phone, Pencil, Trash2, Power, KeyRound, ShieldOff, Send } from 'lucide-react';
import PageHeader from '../../components/PageHeader';
import Breadcrumbs from '../../components/Breadcrumbs';
import DataTable from '../../components/DataTable';
import Modal from '../../components/Modal';
import { useToast } from '../../components/Toaster';

type Org = 'MILKY_MIST' | 'ZEROEARTH';
type Department = 'PRODUCTION' | 'ACCOUNTS' | 'ADMINISTRATION';

interface BusinessContact {
  _id: string;
  name: string;
  org: Org;
  department: Department;
  phone: string;
  isActive: boolean;
  userId?: { _id: string; email: string; isActive: boolean } | null;
  createdAt?: string;
}

const ORG_LABELS: Record<Org, string> = { MILKY_MIST: 'Milky Mist', ZEROEARTH: 'ZeroEarth' };
const DEPT_LABELS: Record<Department, string> = { PRODUCTION: 'Production', ACCOUNTS: 'Accounts', ADMINISTRATION: 'Administration' };

const EMPTY_FORM = {
  name: '', org: 'MILKY_MIST' as Org, department: 'PRODUCTION' as Department, phone: '',
  grantAccess: false, email: '', password: '',
};

export default function BusinessContactsPage() {
  const { toast } = useToast() ?? {};
  const [contacts, setContacts] = useState<BusinessContact[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [showModal, setShowModal] = useState(false);
  const [form, setForm] = useState(EMPTY_FORM);
  const [saving, setSaving] = useState(false);

  const [editTarget, setEditTarget] = useState<BusinessContact | null>(null);
  const [editForm, setEditForm] = useState(EMPTY_FORM);
  const [editSaving, setEditSaving] = useState(false);

  const [deleteTarget, setDeleteTarget] = useState<BusinessContact | null>(null);
  const [deleting, setDeleting] = useState(false);

  const [accessTarget, setAccessTarget] = useState<BusinessContact | null>(null);
  const [accessForm, setAccessForm] = useState({ email: '', password: '' });
  const [accessSaving, setAccessSaving] = useState(false);

  const [revokeTarget, setRevokeTarget] = useState<BusinessContact | null>(null);
  const [revoking, setRevoking] = useState(false);

  const [testingId, setTestingId] = useState<string | null>(null);

  const fetchContacts = useCallback(async () => {
    try {
      setLoading(true);
      const { data } = await axios.get<{ success: boolean; data: { contacts: BusinessContact[] } }>('/api/business-contacts', { params: { search } });
      if (data.success) setContacts(data.data.contacts);
    } catch {
      toast?.('Failed to load business contacts', 'error');
    } finally {
      setLoading(false);
    }
  }, [search, toast]);

  useEffect(() => { fetchContacts(); }, [fetchContacts]);

  const sendTestMessage = useCallback(async (id: string) => {
    setTestingId(id);
    try {
      const { data } = await axios.post<{ success: boolean; message?: string }>(`/api/business-contacts/${id}/test-message`);
      toast?.(data.message || 'Test message sent', 'success');
    } catch (err) {
      toast?.((err as { response?: { data?: { message?: string } } })?.response?.data?.message || 'Test message failed to send', 'error');
    } finally {
      setTestingId(null);
    }
  }, [toast]);

  const handleAdd = async (e: FormEvent) => {
    e.preventDefault();
    setSaving(true);
    try {
      const { grantAccess, email, password, ...contactFields } = form;
      const payload = grantAccess ? { ...contactFields, dashboardAccess: { email, password } } : contactFields;
      const { data } = await axios.post<{ success: boolean; data: BusinessContact }>('/api/business-contacts', payload);
      toast?.('Business contact added successfully', 'success');
      setShowModal(false);
      setForm(EMPTY_FORM);
      fetchContacts();
      if (data.data?._id) sendTestMessage(data.data._id);
    } catch (err) {
      toast?.((err as { response?: { data?: { message?: string } } })?.response?.data?.message || 'Failed to add contact', 'error');
    } finally {
      setSaving(false);
    }
  };

  const openEdit = (row: BusinessContact) => {
    setEditTarget(row);
    setEditForm({ ...EMPTY_FORM, name: row.name, org: row.org, department: row.department, phone: row.phone });
  };

  const handleEdit = async (e: FormEvent) => {
    e.preventDefault();
    if (!editTarget) return;
    setEditSaving(true);
    try {
      const { name, org, department, phone } = editForm;
      await axios.patch(`/api/business-contacts/${editTarget._id}`, { name, org, department, phone });
      toast?.('Business contact updated successfully', 'success');
      setEditTarget(null);
      fetchContacts();
    } catch (err) {
      toast?.((err as { response?: { data?: { message?: string } } })?.response?.data?.message || 'Failed to update contact', 'error');
    } finally {
      setEditSaving(false);
    }
  };

  const openAccess = (row: BusinessContact) => {
    setAccessTarget(row);
    setAccessForm({ email: row.userId?.email || '', password: '' });
  };

  const handleGrantAccess = async (e: FormEvent) => {
    e.preventDefault();
    if (!accessTarget) return;
    setAccessSaving(true);
    try {
      await axios.patch(`/api/business-contacts/${accessTarget._id}`, { dashboardAccess: accessForm });
      toast?.('Dashboard access saved', 'success');
      setAccessTarget(null);
      fetchContacts();
    } catch (err) {
      toast?.((err as { response?: { data?: { message?: string } } })?.response?.data?.message || 'Failed to save dashboard access', 'error');
    } finally {
      setAccessSaving(false);
    }
  };

  const handleRevokeAccess = async () => {
    if (!revokeTarget) return;
    setRevoking(true);
    try {
      await axios.patch(`/api/business-contacts/${revokeTarget._id}`, { revokeDashboardAccess: true });
      toast?.('Dashboard access revoked', 'success');
      setRevokeTarget(null);
      fetchContacts();
    } catch (err) {
      toast?.((err as { response?: { data?: { message?: string } } })?.response?.data?.message || 'Failed to revoke access', 'error');
    } finally {
      setRevoking(false);
    }
  };

  const handleToggleActive = async (row: BusinessContact) => {
    try {
      await axios.patch(`/api/business-contacts/${row._id}`, { isActive: !row.isActive });
      fetchContacts();
    } catch {
      toast?.('Failed to update status', 'error');
    }
  };

  const handleDelete = async () => {
    if (!deleteTarget) return;
    setDeleting(true);
    try {
      await axios.delete(`/api/business-contacts/${deleteTarget._id}`);
      toast?.('Business contact deleted', 'success');
      setDeleteTarget(null);
      fetchContacts();
    } catch (err) {
      toast?.((err as { response?: { data?: { message?: string } } })?.response?.data?.message || 'Failed to delete contact', 'error');
    } finally {
      setDeleting(false);
    }
  };

  const columns = [
    { key: 'name', label: 'Name' },
    { key: 'org', label: 'Organization', render: (v: Org) => ORG_LABELS[v] },
    { key: 'department', label: 'Department', render: (v: Department) => DEPT_LABELS[v] },
    { key: 'phone', label: 'Phone', render: (v: string) => <span className="flex items-center gap-1.5"><Phone size={13} className="text-gray-400" />{v}</span> },
    { key: 'isActive', label: 'Status', render: (v: boolean, row: BusinessContact) => (
      <button onClick={() => handleToggleActive(row)} className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium ${v ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500'}`}>
        <Power size={12} />{v ? 'Active' : 'Inactive'}
      </button>
    )},
    { key: 'dashboardAccess', label: 'Dashboard Access', render: (_: unknown, row: BusinessContact) => row.userId ? (
      <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium bg-blue-100 text-blue-700">
        <KeyRound size={12} />{row.userId.email}
      </span>
    ) : (
      <span className="text-xs text-gray-400">None</span>
    )},
    { key: 'createdAt', label: 'Added', render: (v: string | undefined) => v ? new Date(v).toLocaleDateString('en-IN') : '—' },
    { key: 'actions', label: '', render: (_: unknown, row: BusinessContact) => (
      <div className="flex items-center gap-1 justify-end">
        <button onClick={() => sendTestMessage(row._id)} disabled={testingId === row._id} className="p-1.5 rounded-lg text-gray-400 hover:text-green-600 hover:bg-green-50 transition-colors disabled:opacity-60" title="Send test WhatsApp message"><Send size={14} /></button>
        <button onClick={() => openAccess(row)} className="p-1.5 rounded-lg text-gray-400 hover:text-blue-600 hover:bg-blue-50 transition-colors" title={row.userId ? 'Reset password' : 'Grant dashboard access'}><KeyRound size={14} /></button>
        {row.userId && (
          <button onClick={() => setRevokeTarget(row)} className="p-1.5 rounded-lg text-gray-400 hover:text-orange-600 hover:bg-orange-50 transition-colors" title="Revoke access"><ShieldOff size={14} /></button>
        )}
        <button onClick={() => openEdit(row)} className="p-1.5 rounded-lg text-gray-400 hover:text-blue-600 hover:bg-blue-50 transition-colors" title="Edit"><Pencil size={14} /></button>
        <button onClick={() => setDeleteTarget(row)} className="p-1.5 rounded-lg text-gray-400 hover:text-red-600 hover:bg-red-50 transition-colors" title="Delete"><Trash2 size={14} /></button>
      </div>
    )},
  ];

  const renderFormFields = (values: typeof EMPTY_FORM, setValues: (updater: (f: typeof EMPTY_FORM) => typeof EMPTY_FORM) => void) => (
    <>
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1.5">Name<span className="text-red-500 ml-1">*</span></label>
        <input type="text" required value={values.name} onChange={(e) => setValues((f) => ({ ...f, name: e.target.value }))} placeholder="MM Prod"
          className="w-full px-3 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-green-500" />
      </div>
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1.5">Organization<span className="text-red-500 ml-1">*</span></label>
        <select required value={values.org} onChange={(e) => setValues((f) => ({ ...f, org: e.target.value as Org }))}
          className="w-full px-3 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-green-500">
          <option value="MILKY_MIST">Milky Mist</option>
          <option value="ZEROEARTH">ZeroEarth</option>
        </select>
      </div>
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1.5">Department<span className="text-red-500 ml-1">*</span></label>
        <select required value={values.department} onChange={(e) => setValues((f) => ({ ...f, department: e.target.value as Department }))}
          className="w-full px-3 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-green-500">
          <option value="PRODUCTION">Production</option>
          <option value="ACCOUNTS">Accounts</option>
          <option value="ADMINISTRATION">Administration</option>
        </select>
      </div>
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1.5">Phone Number (WhatsApp)<span className="text-red-500 ml-1">*</span></label>
        <input type="text" required value={values.phone} onChange={(e) => setValues((f) => ({ ...f, phone: e.target.value }))} placeholder="7907247909"
          className="w-full px-3 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-green-500" />
        <p className="mt-1 text-xs text-gray-400">Enter 10-digit number — saved as 91XXXXXXXXXX for WhatsApp</p>
      </div>
    </>
  );

  const renderGrantAccessFields = () => (
    <>
      <label className="flex items-center gap-2 pt-1">
        <input type="checkbox" checked={form.grantAccess} onChange={(e) => setForm((f) => ({ ...f, grantAccess: e.target.checked }))}
          className="w-4 h-4 rounded border-gray-300 text-green-600 focus:ring-green-500" />
        <span className="text-sm font-medium text-gray-700">Grant dashboard login access</span>
      </label>
      {form.grantAccess && (
        <>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1.5">Login Email<span className="text-red-500 ml-1">*</span></label>
            <input type="email" required value={form.email} onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))} placeholder="mm.prod@example.com"
              className="w-full px-3 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-green-500" />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1.5">Password<span className="text-red-500 ml-1">*</span></label>
            <input type="password" required minLength={8} value={form.password} onChange={(e) => setForm((f) => ({ ...f, password: e.target.value }))} placeholder="At least 8 characters"
              className="w-full px-3 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-green-500" />
          </div>
        </>
      )}
    </>
  );

  return (
    <div>
      <Breadcrumbs items={[{ label: 'Business Contacts', href: '/dashboard/business-contacts' }]} />
      <PageHeader title="Business Contacts" description={`${contacts.length} contact${contacts.length === 1 ? '' : 's'} across Milky Mist and ZeroEarth`}
        actions={<>
          <button onClick={fetchContacts} className="p-2 rounded-xl border border-gray-200 hover:bg-gray-50 text-gray-500"><RefreshCw size={16} /></button>
          <button onClick={() => setShowModal(true)} className="flex items-center gap-2 bg-green-600 hover:bg-green-700 text-white text-sm font-medium px-4 py-2 rounded-xl transition-colors"><Plus size={16} /> Add Contact</button>
        </>}
      />
      <div className="relative mb-4">
        <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
        <input type="text" placeholder="Search by name or phone..." value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="w-full sm:w-80 pl-9 pr-4 py-2.5 text-sm border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-green-500" />
      </div>
      <DataTable columns={columns} data={contacts} loading={loading} emptyText="No business contacts found. Add your first contact." />

      <Modal isOpen={showModal} onClose={() => setShowModal(false)} title="Add Business Contact"
        footer={<>
          <button onClick={() => setShowModal(false)} className="px-4 py-2 text-sm text-gray-600 hover:bg-gray-100 rounded-xl">Cancel</button>
          <button form="add-contact-form" type="submit" disabled={saving} className="px-4 py-2 text-sm bg-green-600 hover:bg-green-700 text-white font-medium rounded-xl disabled:opacity-60">{saving ? 'Adding...' : 'Add Contact'}</button>
        </>}
      >
        <form id="add-contact-form" onSubmit={handleAdd} className="space-y-4">
          {renderFormFields(form, setForm)}
          {renderGrantAccessFields()}
        </form>
      </Modal>

      <Modal isOpen={!!editTarget} onClose={() => setEditTarget(null)} title="Edit Business Contact"
        footer={<>
          <button onClick={() => setEditTarget(null)} className="px-4 py-2 text-sm text-gray-600 hover:bg-gray-100 rounded-xl">Cancel</button>
          <button form="edit-contact-form" type="submit" disabled={editSaving} className="px-4 py-2 text-sm bg-blue-600 hover:bg-blue-700 text-white font-medium rounded-xl disabled:opacity-60">{editSaving ? 'Saving...' : 'Save Changes'}</button>
        </>}
      >
        <form id="edit-contact-form" onSubmit={handleEdit} className="space-y-4">
          {renderFormFields(editForm, setEditForm)}
        </form>
      </Modal>

      <Modal isOpen={!!deleteTarget} onClose={() => setDeleteTarget(null)} title="Delete Business Contact"
        footer={<>
          <button onClick={() => setDeleteTarget(null)} className="px-4 py-2 text-sm text-gray-600 hover:bg-gray-100 rounded-xl">Cancel</button>
          <button onClick={handleDelete} disabled={deleting} className="px-4 py-2 text-sm bg-red-600 hover:bg-red-700 text-white font-medium rounded-xl disabled:opacity-60">{deleting ? 'Deleting...' : 'Delete'}</button>
        </>}
      >
        <p className="text-sm text-gray-600">Are you sure you want to delete <span className="font-semibold text-gray-900">{deleteTarget?.name}</span>? This action cannot be undone.</p>
      </Modal>

      <Modal isOpen={!!accessTarget} onClose={() => setAccessTarget(null)} title={accessTarget?.userId ? 'Reset Dashboard Access' : 'Grant Dashboard Access'}
        footer={<>
          <button onClick={() => setAccessTarget(null)} className="px-4 py-2 text-sm text-gray-600 hover:bg-gray-100 rounded-xl">Cancel</button>
          <button form="access-form" type="submit" disabled={accessSaving} className="px-4 py-2 text-sm bg-green-600 hover:bg-green-700 text-white font-medium rounded-xl disabled:opacity-60">{accessSaving ? 'Saving...' : 'Save'}</button>
        </>}
      >
        <form id="access-form" onSubmit={handleGrantAccess} className="space-y-4">
          <p className="text-sm text-gray-600">
            {accessTarget?.userId
              ? <>Update login credentials for <span className="font-semibold text-gray-900">{accessTarget?.name}</span>.</>
              : <>Create a dashboard login for <span className="font-semibold text-gray-900">{accessTarget?.name}</span>.</>}
          </p>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1.5">Login Email<span className="text-red-500 ml-1">*</span></label>
            <input type="email" required value={accessForm.email} onChange={(e) => setAccessForm((f) => ({ ...f, email: e.target.value }))} placeholder="mm.prod@example.com"
              className="w-full px-3 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-green-500" />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1.5">Password<span className="text-red-500 ml-1">*</span></label>
            <input type="password" required minLength={8} value={accessForm.password} onChange={(e) => setAccessForm((f) => ({ ...f, password: e.target.value }))} placeholder="At least 8 characters"
              className="w-full px-3 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-green-500" />
          </div>
        </form>
      </Modal>

      <Modal isOpen={!!revokeTarget} onClose={() => setRevokeTarget(null)} title="Revoke Dashboard Access"
        footer={<>
          <button onClick={() => setRevokeTarget(null)} className="px-4 py-2 text-sm text-gray-600 hover:bg-gray-100 rounded-xl">Cancel</button>
          <button onClick={handleRevokeAccess} disabled={revoking} className="px-4 py-2 text-sm bg-orange-600 hover:bg-orange-700 text-white font-medium rounded-xl disabled:opacity-60">{revoking ? 'Revoking...' : 'Revoke Access'}</button>
        </>}
      >
        <p className="text-sm text-gray-600">This will delete the dashboard login for <span className="font-semibold text-gray-900">{revokeTarget?.name}</span> ({revokeTarget?.userId?.email}). They will no longer be able to sign in.</p>
      </Modal>
    </div>
  );
}
