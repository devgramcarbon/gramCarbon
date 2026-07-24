'use client';

import { useState } from 'react';
import type { FormEvent } from 'react';
import { FileText, Send, Copy, Check } from 'lucide-react';
import PageHeader from '../../components/PageHeader';
import Breadcrumbs from '../../components/Breadcrumbs';
import Modal from '../../components/Modal';
import { useToast } from '../../components/Toaster';
import { useProjectFilter } from '../ProjectFilterContext';
import axios from 'axios';

interface Template { id: string; name: string; category: string; message: string; project?: 'np' | 'mm' }

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

  const extractVars = (msg: string): string[] => {
    const matches = msg.match(/\{\{([^}]+)\}\}/g) || [];
    return [...new Set(matches.map((m) => m.replace(/[{}]/g, '')))];
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
    </div>
  );
}
