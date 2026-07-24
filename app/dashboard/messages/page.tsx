'use client';

import { useState, useEffect } from 'react';
import type { FormEvent } from 'react';
import axios from 'axios';
import { Send, Phone, Loader2, Users, UserCheck, Hash } from 'lucide-react';
import PageHeader from '../../components/PageHeader';
import Breadcrumbs from '../../components/Breadcrumbs';
import { useToast } from '../../components/Toaster';
import { useProjectFilter } from '../ProjectFilterContext';

const MODES = [
  { value: 'text', label: 'Text / PDF' },
  { value: 'yesno', label: 'Yes / No' },
  { value: 'buttons', label: 'Custom Buttons' },
  { value: 'list', label: 'List Menu' },
  { value: 'link', label: 'CTA Link' },
  { value: 'poll', label: 'Poll' },
];

const RECIPIENT_MODES = [
  { value: 'number', label: 'Specific Number', icon: Hash },
  { value: 'all', label: 'All Distributors', icon: Users },
  { value: 'select', label: 'Select Distributor', icon: UserCheck },
];

interface Distributor { _id: string; name: string; phone: string }
interface FormState { phone: string; mode: string; message: string; buttons: string[]; listItems: string[]; linkUrl: string; linkTitle: string; pollOptions: string[]; pollMultiple: boolean }

export default function MessagesPage() {
  const { toast } = useToast() ?? {};
  const { project } = useProjectFilter();
  const [form, setForm] = useState<FormState>({ phone: '', mode: 'text', message: '', buttons: ['', '', ''], listItems: [''], linkUrl: '', linkTitle: '', pollOptions: ['', ''], pollMultiple: false });
  const [sending, setSending] = useState(false);
  const [recipientMode, setRecipientMode] = useState<'number' | 'all' | 'select'>('number');
  const [distributors, setDistributors] = useState<Distributor[]>([]);
  const [loadingDist, setLoadingDist] = useState(false);
  const [selectedDist, setSelectedDist] = useState<Distributor | null>(null);
  const [distSearch, setDistSearch] = useState('');

  useEffect(() => {
    if (recipientMode === 'all' || recipientMode === 'select') {
      setLoadingDist(true);
      axios.get('/api/distributors', { params: { limit: 100, project: project !== 'all' ? project : undefined } })
        .then((res) => setDistributors(res.data.data?.distributors || []))
        .catch(() => toast?.('Failed to load distributors', 'error'))
        .finally(() => setLoadingDist(false));
    }
  }, [recipientMode, project]);

  const filteredDist = distributors.filter((d) =>
    d.name.toLowerCase().includes(distSearch.toLowerCase()) || d.phone.includes(distSearch)
  );

  const sendToPhone = async (phone: string) => {
    const payload: Record<string, unknown> = { phone, mode: form.mode, message: form.message };
    if (form.mode === 'buttons') payload.buttons = form.buttons.filter(Boolean);
    if (form.mode === 'list') payload.listItems = form.listItems.filter(Boolean).map((t, i) => ({ id: `item_${i}`, title: t }));
    if (form.mode === 'link') { payload.linkUrl = form.linkUrl; payload.linkTitle = form.linkTitle; }
    if (form.mode === 'poll') { payload.pollOptions = form.pollOptions.filter(Boolean); payload.pollMultiple = form.pollMultiple; }
    await axios.post('/api/send-message', payload);
  };

  const handleSend = async (e: FormEvent) => {
    e.preventDefault();
    if (!form.message.trim()) { toast?.('Message body is required', 'error'); return; }

    if (recipientMode === 'number' && !form.phone.trim()) { toast?.('Phone number is required', 'error'); return; }
    if (recipientMode === 'select' && !selectedDist) { toast?.('Please select a distributor', 'error'); return; }
    if (recipientMode === 'all' && distributors.length === 0) { toast?.('No distributors found', 'error'); return; }

    setSending(true);
    try {
      if (recipientMode === 'number') {
        await sendToPhone(form.phone.trim());
        toast?.('Message sent!', 'success');
      } else if (recipientMode === 'select' && selectedDist) {
        await sendToPhone(selectedDist.phone);
        toast?.(`Message sent to ${selectedDist.name}`, 'success');
      } else if (recipientMode === 'all') {
        let sent = 0; let failed = 0;
        for (const d of distributors) {
          try { await sendToPhone(d.phone); sent++; } catch { failed++; }
        }
        toast?.(failed > 0 ? `Sent ${sent}, failed ${failed}` : `Sent to all ${sent} distributors`, failed > 0 ? 'error' : 'success');
      }
      setForm((f) => ({ ...f, message: '', buttons: ['', '', ''], listItems: [''], linkUrl: '', linkTitle: '', pollOptions: ['', ''], pollMultiple: false }));
    } catch (err) {
      toast?.((err as { response?: { data?: { error?: string } } })?.response?.data?.error || 'Failed to send message', 'error');
    } finally { setSending(false); }
  };

  const updateBtn = (i: number, val: string) => setForm((f) => { const buttons = [...f.buttons]; buttons[i] = val; return { ...f, buttons }; });
  const updateListItem = (i: number, val: string) => setForm((f) => { const listItems = [...f.listItems]; listItems[i] = val; return { ...f, listItems }; });
  const updatePollOption = (i: number, val: string) => setForm((f) => { const pollOptions = [...f.pollOptions]; pollOptions[i] = val; return { ...f, pollOptions }; });

  return (
    <div>
      <Breadcrumbs items={[{ label: 'Messages', href: '/dashboard/messages' }]} />
      <PageHeader title="WhatsApp Messages" description="Send messages to distributors and farmers" />
      <div className="max-w-2xl">
        <div className="bg-white rounded-2xl border border-gray-100 p-6">
          <form onSubmit={handleSend} className="space-y-5">

            {/* Recipient selector */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Send To <span className="text-red-500">*</span></label>
              <div className="flex gap-2 mb-3">
                {RECIPIENT_MODES.map((rm) => {
                  const Icon = rm.icon;
                  return (
                    <button key={rm.value} type="button"
                      onClick={() => { setRecipientMode(rm.value as typeof recipientMode); setSelectedDist(null); setDistSearch(''); }}
                      className={`flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-medium border transition-colors ${recipientMode === rm.value ? 'bg-green-600 text-white border-green-600' : 'border-gray-200 text-gray-600 hover:bg-gray-50'}`}>
                      <Icon size={13} />
                      {rm.label}
                    </button>
                  );
                })}
              </div>

              {/* Specific number input */}
              {recipientMode === 'number' && (
                <div className="relative">
                  <Phone size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                  <input type="text" value={form.phone} onChange={(e) => setForm((f) => ({ ...f, phone: e.target.value }))}
                    placeholder="91XXXXXXXXXX (with country code)"
                    className="w-full pl-9 pr-4 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-green-500" />
                </div>
              )}

              {/* All distributors info */}
              {recipientMode === 'all' && (
                <div className="flex items-center gap-2 px-4 py-3 bg-green-50 border border-green-100 rounded-xl text-sm text-green-700">
                  {loadingDist
                    ? <><Loader2 size={14} className="animate-spin" /> Loading distributors...</>
                    : <><Users size={14} /> Message will be sent to all <strong>{distributors.length}</strong> distributor{distributors.length !== 1 ? 's' : ''}</>}
                </div>
              )}

              {/* Select a distributor */}
              {recipientMode === 'select' && (
                <div className="space-y-2">
                  <input type="text" value={distSearch} onChange={(e) => setDistSearch(e.target.value)}
                    placeholder="Search by name or phone..."
                    className="w-full px-3 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-green-500" />
                  {loadingDist ? (
                    <div className="flex items-center gap-2 text-sm text-gray-500 py-2"><Loader2 size={14} className="animate-spin" /> Loading...</div>
                  ) : (
                    <div className="max-h-48 overflow-y-auto border border-gray-100 rounded-xl divide-y divide-gray-50">
                      {filteredDist.length === 0
                        ? <p className="text-sm text-gray-400 text-center py-4">No distributors found</p>
                        : filteredDist.map((d) => (
                          <button key={d._id} type="button" onClick={() => setSelectedDist(d)}
                            className={`w-full flex items-center justify-between px-4 py-2.5 text-left text-sm transition-colors hover:bg-gray-50 ${selectedDist?._id === d._id ? 'bg-green-50 text-green-700' : 'text-gray-700'}`}>
                            <span className="font-medium">{d.name}</span>
                            <span className="text-xs text-gray-400 font-mono">{d.phone}</span>
                          </button>
                        ))}
                    </div>
                  )}
                  {selectedDist && (
                    <div className="flex items-center justify-between px-3 py-2 bg-green-50 border border-green-100 rounded-xl text-sm text-green-700">
                      <span><UserCheck size={14} className="inline mr-1" /><strong>{selectedDist.name}</strong> · {selectedDist.phone}</span>
                      <button type="button" onClick={() => setSelectedDist(null)} className="text-green-500 hover:text-green-700 text-xs">✕</button>
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* Message type */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">Message Type</label>
              <div className="flex flex-wrap gap-2">
                {MODES.map((m) => (
                  <button key={m.value} type="button" onClick={() => setForm((f) => ({ ...f, mode: m.value }))}
                    className={`px-3 py-1.5 rounded-full text-xs font-medium transition-colors ${form.mode === m.value ? 'bg-green-600 text-white' : 'border border-gray-200 text-gray-600 hover:bg-gray-50'}`}>
                    {m.label}
                  </button>
                ))}
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">Message Body <span className="text-red-500">*</span></label>
              <textarea required value={form.message} onChange={(e) => setForm((f) => ({ ...f, message: e.target.value }))} rows={4} placeholder="Type your message here..."
                className="w-full px-3 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-green-500 resize-none" />
            </div>

            {form.mode === 'buttons' && (
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Button Labels (max 3)</label>
                <div className="space-y-2">
                  {form.buttons.map((b, i) => (
                    <input key={i} type="text" value={b} onChange={(e) => updateBtn(i, e.target.value)} placeholder={`Button ${i + 1}`}
                      className="w-full px-3 py-2 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-green-500" />
                  ))}
                </div>
              </div>
            )}

            {form.mode === 'list' && (
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">List Items</label>
                <div className="space-y-2">
                  {form.listItems.map((item, i) => (
                    <div key={i} className="flex gap-2">
                      <input type="text" value={item} onChange={(e) => updateListItem(i, e.target.value)} placeholder={`Item ${i + 1}`}
                        className="flex-1 px-3 py-2 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-green-500" />
                      {form.listItems.length > 1 && (
                        <button type="button" onClick={() => setForm((f) => ({ ...f, listItems: f.listItems.filter((_, idx) => idx !== i) }))}
                          className="px-2 py-2 text-red-500 hover:bg-red-50 rounded-lg text-xs">✕</button>
                      )}
                    </div>
                  ))}
                  {form.listItems.length < 10 && (
                    <button type="button" onClick={() => setForm((f) => ({ ...f, listItems: [...f.listItems, ''] }))}
                      className="text-xs text-green-600 hover:underline">+ Add item</button>
                  )}
                </div>
              </div>
            )}

            {form.mode === 'link' && (
              <div className="space-y-3">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1.5">Button Label</label>
                  <input type="text" value={form.linkTitle} onChange={(e) => setForm((f) => ({ ...f, linkTitle: e.target.value }))} placeholder="Click here"
                    className="w-full px-3 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-green-500" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1.5">URL <span className="text-red-500">*</span></label>
                  <input type="url" required={form.mode === 'link'} value={form.linkUrl} onChange={(e) => setForm((f) => ({ ...f, linkUrl: e.target.value }))} placeholder="https://example.com"
                    className="w-full px-3 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-green-500" />
                </div>
              </div>
            )}

            {form.mode === 'poll' && (
              <div className="space-y-3">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Poll Options <span className="text-red-500">*</span> <span className="text-xs text-gray-400 font-normal">(2–12 options, max 24 chars each)</span></label>
                  <div className="space-y-2">
                    {form.pollOptions.map((opt, i) => (
                      <div key={i} className="flex gap-2">
                        <input type="text" value={opt} maxLength={24} onChange={(e) => updatePollOption(i, e.target.value)} placeholder={`Option ${i + 1}`}
                          className="flex-1 px-3 py-2 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-green-500" />
                        {form.pollOptions.length > 2 && (
                          <button type="button" onClick={() => setForm((f) => ({ ...f, pollOptions: f.pollOptions.filter((_, idx) => idx !== i) }))}
                            className="px-2 py-2 text-red-500 hover:bg-red-50 rounded-lg text-xs">✕</button>
                        )}
                      </div>
                    ))}
                    {form.pollOptions.length < 12 && (
                      <button type="button" onClick={() => setForm((f) => ({ ...f, pollOptions: [...f.pollOptions, ''] }))}
                        className="text-xs text-green-600 hover:underline">+ Add option</button>
                    )}
                  </div>
                </div>
                <label className="flex items-center gap-2.5 cursor-pointer select-none">
                  <div className={`w-9 h-5 rounded-full transition-colors relative ${form.pollMultiple ? 'bg-green-600' : 'bg-gray-200'}`}
                    onClick={() => setForm((f) => ({ ...f, pollMultiple: !f.pollMultiple }))}>
                    <span className={`absolute top-0.5 left-0.5 w-4 h-4 bg-white rounded-full shadow transition-transform ${form.pollMultiple ? 'translate-x-4' : ''}`} />
                  </div>
                  <span className="text-sm text-gray-700">Allow multiple answers</span>
                </label>
              </div>
            )}

            <button type="submit" disabled={sending}
              className="w-full flex items-center justify-center gap-2 bg-green-600 hover:bg-green-700 text-white font-medium py-3 rounded-xl disabled:opacity-60 transition-colors">
              {sending ? <Loader2 size={17} className="animate-spin" /> : <Send size={17} />}
              {sending
                ? recipientMode === 'all' ? 'Sending to all...' : 'Sending...'
                : recipientMode === 'all' ? `Send to All (${distributors.length})` : 'Send Message'}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}
