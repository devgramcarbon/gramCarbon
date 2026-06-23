'use client';

import { useState, useEffect } from 'react';
import axios from 'axios';
import { Save, Loader2 } from 'lucide-react';
import PageHeader from '../../components/PageHeader';
import Breadcrumbs from '../../components/Breadcrumbs';
import { useToast } from '../../components/Toaster';

interface SettingField { key: string; label: string; description?: string; value: string; type?: string }

const DEFAULT_SETTINGS: Record<string, SettingField[]> = {
  whatsapp: [
    { key: 'whatsapp_phone_id', label: 'Phone Number ID', description: 'WhatsApp Business Phone Number ID from Meta Dashboard', value: '' },
    { key: 'whatsapp_api_version', label: 'API Version', description: 'Meta Graph API version (e.g. v18.0)', value: 'v18.0' },
  ],
  system: [
    { key: 'stock_low_threshold', label: 'Low Stock Alert (kg)', description: 'Send notification when balance drops below this', value: '50' },
    { key: 'session_timeout_hours', label: 'Bot Session Timeout (hours)', description: 'How long before a bot session expires', value: '24' },
    { key: 'max_message_rate', label: 'Max Messages per Minute', description: 'Rate limit for WhatsApp messaging', value: '30' },
  ],
  business: [
    { key: 'business_name', label: 'Business Name', value: 'gramCarbon Console' },
    { key: 'business_email', label: 'Contact Email', value: '' },
    { key: 'business_phone', label: 'Contact Phone', value: '' },
    { key: 'business_address', label: 'Address', value: '' },
  ],
  notifications: [
    { key: 'notify_stock_low', label: 'Stock Low Alerts', description: 'Receive notifications for low stock', value: 'true', type: 'boolean' },
    { key: 'notify_new_distributor', label: 'New Distributor Alerts', value: 'true', type: 'boolean' },
    { key: 'notify_system_errors', label: 'System Error Alerts', value: 'true', type: 'boolean' },
    { key: 'daily_summary', label: 'Daily Summary (8 AM)', value: 'true', type: 'boolean' },
  ],
};

const TABS = ['whatsapp', 'system', 'business', 'notifications'];

export default function SettingsPage() {
  const { toast } = useToast() ?? {};
  const [activeTab, setActiveTab] = useState('whatsapp');
  const [values, setValues] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    axios.get<{ success: boolean; data: Record<string, Array<{ key: string; value: string }>> }>('/api/settings').then(({ data }) => {
      if (data.success) {
        const flat: Record<string, string> = {};
        Object.values(data.data).flat().forEach((s) => { flat[s.key] = s.value; });
        setValues(flat);
      }
    }).catch(() => {}).finally(() => setLoaded(true));
  }, []);

  const handleSave = async () => {
    setSaving(true);
    try {
      const items = Object.entries(values).map(([key, value]) => {
        const category = Object.entries(DEFAULT_SETTINGS).find(([, fields]) => fields.some((f) => f.key === key))?.[0] || 'system';
        return { key, value, category };
      });
      await axios.post('/api/settings', items);
      toast?.('Settings saved successfully', 'success');
    } catch { toast?.('Failed to save settings', 'error'); }
    finally { setSaving(false); }
  };

  const fields = DEFAULT_SETTINGS[activeTab] || [];

  return (
    <div>
      <Breadcrumbs items={[{ label: 'Settings', href: '/dashboard/settings' }]} />
      <PageHeader title="Settings" description="Configure system and application settings"
        actions={
          <button onClick={handleSave} disabled={saving} className="flex items-center gap-2 bg-green-600 hover:bg-green-700 text-white text-sm font-medium px-4 py-2 rounded-xl disabled:opacity-60">
            {saving ? <Loader2 size={15} className="animate-spin" /> : <Save size={15} />}Save Changes
          </button>
        }
      />
      <div className="flex flex-col sm:flex-row gap-6">
        <div className="sm:w-48 flex-shrink-0">
          <nav className="flex sm:flex-col gap-1 overflow-x-auto pb-1 sm:pb-0">
            {TABS.map((tab) => (
              <button key={tab} onClick={() => setActiveTab(tab)}
                className={`flex-shrink-0 sm:w-full text-left px-3 py-2.5 rounded-xl text-sm font-medium capitalize transition-colors ${activeTab === tab ? 'bg-green-600 text-white' : 'text-gray-600 hover:bg-gray-100'}`}>
                {tab}
              </button>
            ))}
          </nav>
        </div>
        <div className="flex-1 bg-white rounded-2xl border border-gray-100 p-4 sm:p-6 space-y-5">
          {!loaded ? (
            <div className="text-sm text-gray-400">Loading settings...</div>
          ) : (
            fields.map((field) => (
              <div key={field.key}>
                <label className="block text-sm font-medium text-gray-800 mb-1">{field.label}</label>
                {field.description && <p className="text-xs text-gray-400 mb-2">{field.description}</p>}
                {field.type === 'boolean' ? (
                  <label className="flex items-center gap-3 cursor-pointer">
                    <div onClick={() => setValues((v) => ({ ...v, [field.key]: v[field.key] === 'true' ? 'false' : 'true' }))}
                      className={`w-11 h-6 rounded-full transition-colors relative ${values[field.key] === 'true' ? 'bg-green-500' : 'bg-gray-300'}`}>
                      <div className={`w-4 h-4 bg-white rounded-full absolute top-1 transition-transform ${values[field.key] === 'true' ? 'translate-x-6' : 'translate-x-1'}`} />
                    </div>
                    <span className="text-sm text-gray-600">{values[field.key] === 'true' ? 'Enabled' : 'Disabled'}</span>
                  </label>
                ) : (
                  <input type="text" value={values[field.key] ?? field.value} onChange={(e) => setValues((v) => ({ ...v, [field.key]: e.target.value }))}
                    className="w-full max-w-md px-3 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-green-500" />
                )}
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}
