'use client';

import { useEffect, useRef, useState } from 'react';
import type { FormEvent } from 'react';
import { Send, Copy, Check, Pencil } from 'lucide-react';
import PageHeader from '../../components/PageHeader';
import Breadcrumbs from '../../components/Breadcrumbs';
import Modal from '../../components/Modal';
import { useToast } from '../../components/Toaster';
import { useProjectFilter } from '../ProjectFilterContext';
import axios from 'axios';

interface Template { id: string; name: string; category: string; message: string; project?: 'np' | 'mm' }

interface PoTemplate { _id: string; key: string; label: string; category: string; message: string; variables: string[]; availableVariables: string[] }

const BUILT_IN_TEMPLATES: Template[] = [
  { id: 't1', name: 'Stock Received', category: 'Stock', message: '📦 Dear {{name}},\n\nYour stock of {{quantity}}kg (Batch: {{batch}}) has been received and updated.\n\nCurrent Balance: {{balance}}kg\n\n— gramCarbon Console Team' },
  { id: 't2', name: 'Low Stock Alert', category: 'Stock', message: '⚠️ Dear {{name}},\n\nYour feed stock is running low.\n\nCurrent Balance: {{balance}}kg\n\nPlease place a reorder to avoid disruption.\n\n— gramCarbon Console Team' },
  { id: 't3', name: 'Sale Confirmation', category: 'Sales', message: '✅ Sale Recorded\n\nFarmer: {{farmer}}\nAnimals: {{count}}\nQty: {{qty}}kg\nDate: {{date}}\n\nThank you!' },
  { id: 't4', name: 'Welcome Distributor', category: 'Onboarding', message: '👋 Welcome to gramCarbon Console!\n\nDear {{name}},\n\nYou have been registered as a distributor.\n\nReply Hi to our WhatsApp bot to get started.\n\n— gramCarbon Console Team' },
  { id: 't5', name: 'Monthly Summary', category: 'Reports', message: '📊 Monthly Summary — {{month}}\n\nDear {{name}},\n\nFeed Received: {{received}}kg\nFeed Sold: {{sold}}kg\nBalance: {{balance}}kg\nFarmers Served: {{farmers}}\n\n— gramCarbon Console Team' },
];

const categoryColors: Record<string, string> = { Stock: 'bg-blue-100 text-blue-700', Sales: 'bg-green-100 text-green-700', Onboarding: 'bg-purple-100 text-purple-700', Reports: 'bg-orange-100 text-orange-700' };

export default function TemplatesPage() {
  const { toast } = useToast() ?? {};
  const { project } = useProjectFilter();
  const [templates] = useState<Template[]>(BUILT_IN_TEMPLATES);
  const visibleTemplates = templates.filter((t) => !t.project || project === 'all' || t.project === project);
  const [showSendModal, setShowSendModal] = useState(false);
  const [activeTemplate, setActiveTemplate] = useState<Template | null>(null);
  const [phone, setPhone] = useState('');
  const [vars, setVars] = useState<Record<string, string>>({});
  const [sending, setSending] = useState(false);
  const [copied, setCopied] = useState('');

  const [poTemplates, setPoTemplates] = useState<PoTemplate[]>([]);
  const [loadingPo, setLoadingPo] = useState(true);
  const [editing, setEditing] = useState<PoTemplate | null>(null);
  const [editMessage, setEditMessage] = useState('');
  const [saving, setSaving] = useState(false);
  const editTextareaRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    axios.get('/api/templates')
      .then((res) => {
        const raw = (res.data?.data?.templates ?? []) as Array<Partial<PoTemplate>>;
        setPoTemplates(raw.map((t) => ({
          _id: t._id ?? '',
          key: t.key ?? '',
          label: t.label ?? '',
          category: t.category ?? '',
          message: t.message ?? '',
          variables: t.variables ?? [],
          availableVariables: t.availableVariables ?? [],
        })));
      })
      .catch(() => toast?.('Failed to load workflow templates', 'error'))
      .finally(() => setLoadingPo(false));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const openEdit = (t: PoTemplate) => {
    setEditing(t);
    setEditMessage(t.message);
  };

  const extractVars = (msg: string): string[] => {
    const matches = msg.match(/\{\{([^}]+)\}\}/g) || [];
    return [...new Set(matches.map((m) => m.replace(/[{}]/g, '')))];
  };

  const editUsedVars = extractVars(editMessage);
  const editUnknownVars = editing ? editUsedVars.filter((v) => !editing.availableVariables.includes(v)) : [];
  const editUnusedVars = editing ? editing.availableVariables.filter((v) => !editUsedVars.includes(v)) : [];

  const insertPlaceholder = (name: string) => {
    const el = editTextareaRef.current;
    const token = `{{${name}}}`;
    if (!el) { setEditMessage((m) => m + token); return; }
    const start = el.selectionStart ?? editMessage.length;
    const end = el.selectionEnd ?? editMessage.length;
    const next = editMessage.slice(0, start) + token + editMessage.slice(end);
    setEditMessage(next);
    requestAnimationFrame(() => {
      el.focus();
      const cursor = start + token.length;
      el.setSelectionRange(cursor, cursor);
    });
  };

  const saveEdit = async (e: FormEvent) => {
    e.preventDefault();
    if (!editing) return;
    if (editUnknownVars.length) {
      toast?.(`Unknown placeholder${editUnknownVars.length > 1 ? 's' : ''}: ${editUnknownVars.map((v) => `{{${v}}}`).join(', ')}`, 'error');
      return;
    }
    setSaving(true);
    try {
      const res = await axios.put('/api/templates', { key: editing.key, message: editMessage });
      const updated = res.data?.data as PoTemplate;
      setPoTemplates((prev) => prev.map((t) => (t.key === editing.key ? updated : t)));
      toast?.('Template updated', 'success');
      setEditing(null);
    } catch (err) {
      toast?.((err as { response?: { data?: { message?: string } } })?.response?.data?.message || 'Failed to save template', 'error');
    } finally { setSaving(false); }
  };

  const renderMessage = (msg: string, variables: Record<string, string>): string =>
    msg.replace(/\{\{([^}]+)\}\}/g, (_, key) => variables[key] || `{{${key}}}`);

  const copyTemplate = (msg: string) => {
    navigator.clipboard?.writeText(msg);
    setCopied(msg);
    setTimeout(() => setCopied(''), 2000);
    toast?.('Template copied!', 'success');
  };

  const openSend = (template: Template) => {
    setActiveTemplate(template);
    const initial: Record<string, string> = {};
    extractVars(template.message).forEach((v) => { initial[v] = ''; });
    setVars(initial);
    setPhone('');
    setShowSendModal(true);
  };

  const handleSend = async (e: FormEvent) => {
    e.preventDefault();
    if (!activeTemplate) return;
    setSending(true);
    try {
      const message = renderMessage(activeTemplate.message, vars);
      await axios.post('/api/send-message', { phone, mode: 'text', message });
      toast?.('Message sent successfully!', 'success');
      setShowSendModal(false);
    } catch (err) {
      toast?.((err as { response?: { data?: { error?: string } } })?.response?.data?.error || 'Failed to send', 'error');
    } finally { setSending(false); }
  };

  return (
    <div>
      <Breadcrumbs items={[{ label: 'Templates', href: '/dashboard/templates' }]} />
      <PageHeader title="Message Templates" description="Pre-built templates for common WhatsApp messages" />

      <h2 className="text-sm font-semibold text-gray-900 mb-3">Milky Mist PO Workflow</h2>
      <p className="text-xs text-gray-500 mb-4">These are the automated WhatsApp messages sent at each PO stage. Edit the wording below — placeholders like <code className="bg-gray-100 px-1 rounded">{'{{poNumber}}'}</code> are filled in automatically when the message is sent.</p>
      {loadingPo ? (
        <div className="text-sm text-gray-400 mb-8">Loading workflow templates...</div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4 mb-8">
          {poTemplates.map((t) => (
            <div key={t.key} className="bg-white rounded-2xl border border-gray-100 p-5 flex flex-col gap-3">
              <div className="flex items-start justify-between">
                <div>
                  <h3 className="font-semibold text-gray-900 text-sm">{t.label}</h3>
                  <span className="inline-block mt-1 px-2 py-0.5 rounded-full text-xs font-medium bg-teal-100 text-teal-700">{t.category}</span>
                </div>
                <button onClick={() => openEdit(t)} className="p-1.5 rounded-lg hover:bg-teal-50 text-gray-400 hover:text-teal-600">
                  <Pencil size={15} />
                </button>
              </div>
              <pre className="text-xs text-gray-600 bg-gray-50 rounded-xl p-3 whitespace-pre-wrap font-sans line-clamp-5">{t.message}</pre>
              {t.availableVariables.length > 0 && (
                <div className="flex flex-wrap gap-1">
                  {t.availableVariables.map((v) => (
                    <span key={v} className={`px-2 py-0.5 text-xs rounded-full font-mono ${t.variables.includes(v) ? 'bg-yellow-100 text-yellow-700' : 'bg-gray-100 text-gray-400'}`}>
                      {'{{' + v + '}}'}
                    </span>
                  ))}
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      <h2 className="text-sm font-semibold text-gray-900 mb-3">General Templates</h2>
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
        {visibleTemplates.map((t) => {
          const tVars = extractVars(t.message);
          return (
            <div key={t.id} className="bg-white rounded-2xl border border-gray-100 p-5 flex flex-col gap-3">
              <div className="flex items-start justify-between">
                <div>
                  <h3 className="font-semibold text-gray-900 text-sm">{t.name}</h3>
                  <span className={`inline-block mt-1 px-2 py-0.5 rounded-full text-xs font-medium ${categoryColors[t.category] || 'bg-gray-100 text-gray-600'}`}>{t.category}</span>
                </div>
                <div className="flex gap-1.5">
                  <button onClick={() => copyTemplate(t.message)} className="p-1.5 rounded-lg hover:bg-gray-100 text-gray-400">
                    {copied === t.message ? <Check size={15} className="text-green-500" /> : <Copy size={15} />}
                  </button>
                  <button onClick={() => openSend(t)} className="p-1.5 rounded-lg hover:bg-green-50 text-gray-400 hover:text-green-600"><Send size={15} /></button>
                </div>
              </div>
              <pre className="text-xs text-gray-600 bg-gray-50 rounded-xl p-3 whitespace-pre-wrap font-sans line-clamp-5">{t.message}</pre>
              {tVars.length > 0 && (
                <div className="flex flex-wrap gap-1">
                  {tVars.map((v) => <span key={v} className="px-2 py-0.5 text-xs bg-yellow-100 text-yellow-700 rounded-full">{'{{' + v + '}}'}</span>)}
                </div>
              )}
            </div>
          );
        })}
      </div>
      <Modal isOpen={showSendModal} onClose={() => setShowSendModal(false)} title={`Send: ${activeTemplate?.name ?? ''}`}
        footer={<>
          <button onClick={() => setShowSendModal(false)} className="px-4 py-2 text-sm text-gray-600 hover:bg-gray-100 rounded-xl">Cancel</button>
          <button form="send-tpl-form" type="submit" disabled={sending} className="px-4 py-2 text-sm bg-green-600 text-white font-medium rounded-xl disabled:opacity-60">{sending ? 'Sending...' : 'Send'}</button>
        </>}
      >
        {activeTemplate && (
          <form id="send-tpl-form" onSubmit={handleSend} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">Phone Number</label>
              <input type="text" required value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="91XXXXXXXXXX"
                className="w-full px-3 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-green-500" />
            </div>
            {extractVars(activeTemplate.message).map((v) => (
              <div key={v}>
                <label className="block text-sm font-medium text-gray-700 mb-1.5">{'{{' + v + '}}'}</label>
                <input type="text" required value={vars[v] || ''} onChange={(e) => setVars((prev) => ({ ...prev, [v]: e.target.value }))} placeholder={v}
                  className="w-full px-3 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-green-500" />
              </div>
            ))}
            <div className="bg-gray-50 rounded-xl p-3">
              <p className="text-xs font-medium text-gray-500 mb-1">Preview:</p>
              <pre className="text-xs text-gray-700 whitespace-pre-wrap font-sans">{renderMessage(activeTemplate.message, vars)}</pre>
            </div>
          </form>
        )}
      </Modal>

      <Modal isOpen={!!editing} onClose={() => setEditing(null)} title={`Edit: ${editing?.label ?? ''}`}
        footer={<>
          <button onClick={() => setEditing(null)} className="px-4 py-2 text-sm text-gray-600 hover:bg-gray-100 rounded-xl">Cancel</button>
          <button form="edit-tpl-form" type="submit" disabled={saving || editUnknownVars.length > 0} className="px-4 py-2 text-sm bg-teal-600 text-white font-medium rounded-xl disabled:opacity-60">{saving ? 'Saving...' : 'Save'}</button>
        </>}
      >
        {editing && (
          <form id="edit-tpl-form" onSubmit={saveEdit} className="space-y-4">
            {editing.availableVariables.length > 0 && (
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1.5">Available placeholders — click to insert</label>
                <div className="flex flex-wrap gap-1.5">
                  {editing.availableVariables.map((v) => (
                    <button
                      key={v}
                      type="button"
                      onClick={() => insertPlaceholder(v)}
                      className={`px-2 py-1 text-xs rounded-full font-mono ${editUsedVars.includes(v) ? 'bg-teal-100 text-teal-700' : 'bg-gray-100 text-gray-500 hover:bg-teal-50 hover:text-teal-600'}`}
                    >
                      {'{{' + v + '}}'}
                    </button>
                  ))}
                </div>
              </div>
            )}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">Message</label>
              <textarea ref={editTextareaRef} required rows={8} value={editMessage} onChange={(e) => setEditMessage(e.target.value)}
                className={`w-full px-3 py-2.5 border rounded-xl text-sm font-mono focus:outline-none focus:ring-2 ${editUnknownVars.length ? 'border-red-300 focus:ring-red-400' : 'border-gray-200 focus:ring-teal-500'}`} />
              {editUnknownVars.length > 0 ? (
                <p className="text-xs text-red-600 mt-1">
                  Unknown placeholder{editUnknownVars.length > 1 ? 's' : ''}: {editUnknownVars.map((v) => '{{' + v + '}}').join(', ')} — not filled in when sent, will show as N/A. Use only the placeholders listed above.
                </p>
              ) : (
                <p className="text-xs text-gray-400 mt-1">Only the placeholders listed above are supported for this message.</p>
              )}
              {editUnusedVars.length > 0 && (
                <p className="text-xs text-amber-600 mt-1">
                  Not used: {editUnusedVars.map((v) => '{{' + v + '}}').join(', ')} — this data is available but won&apos;t appear in the message.
                </p>
              )}
            </div>
            <div className="bg-gray-50 rounded-xl p-3">
              <p className="text-xs font-medium text-gray-500 mb-1">Preview (placeholders unfilled):</p>
              <pre className="text-xs text-gray-700 whitespace-pre-wrap font-sans">{editMessage}</pre>
            </div>
          </form>
        )}
      </Modal>
    </div>
  );
}
