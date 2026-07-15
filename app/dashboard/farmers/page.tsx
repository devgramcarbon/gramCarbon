'use client';

import { useState, useCallback } from 'react';
import type { FormEvent } from 'react';
import { Plus, Search, RefreshCw, Beef } from 'lucide-react';
import PageHeader from '../../components/PageHeader';
import Breadcrumbs from '../../components/Breadcrumbs';
import DataTable from '../../components/DataTable';
import Modal from '../../components/Modal';
import { useToast } from '../../components/Toaster';

interface Farmer { _id: string; farmerId: string; name: string; mobile: string; village?: string; district?: string; state?: string; animalCount?: number; animalType?: string; gender?: string; createdAt?: string; animalIds?: string[] }
interface Pagination { page: number; pages: number; total: number; limit: number }

const HARDCODED_FARMERS: Farmer[] = [
  { _id: '1', farmerId: 'F_TN_PET_301_0001', name: 'Anitha Gnanavel', mobile: '9344481240', animalCount: 2, animalIds: ['F_TN_PET_301_0001/01', 'F_TN_PET_301_0001/02'] },
  { _id: '2', farmerId: 'F_TN_NAI_301_0002', name: 'Sudha Athimoolam', mobile: '8220743081', animalCount: 2, animalIds: ['F_TN_NAI_301_0002/01', 'F_TN_NAI_301_0002/02'] },
  { _id: '3', farmerId: 'F_TN_PET_301_0003', name: 'Lakshmi V', mobile: '6380649274', animalCount: 2, animalIds: ['F_TN_PET_301_0003/01', 'F_TN_PET_301_0003/02'] },
  { _id: '4', farmerId: 'F_TN_NAI_301_0004', name: 'Priya Elairaj', mobile: '9791664908', animalCount: 2, animalIds: ['F_TN_NAI_301_0004/01', 'F_TN_NAI_301_0004/02'] },
  { _id: '5', farmerId: 'F_TN_PET_301_0005', name: 'Senthanal K', mobile: '8098854093', animalCount: 2, animalIds: ['F_TN_PET_301_0005/01', 'F_TN_PET_301_0005/02'] },
  { _id: '6', farmerId: 'F_TN_NAD_304_0006', name: 'P Kamalam', mobile: '9626019484', animalCount: 2, animalIds: ['F_TN_NAD_304_0006/01', 'F_TN_NAD_304_0006/02'] },
  { _id: '7', farmerId: 'F_TN_NAI_301_0007', name: 'Tamilarasi', mobile: '6384120554', animalCount: 2, animalIds: ['F_TN_NAI_301_0007/01', 'F_TN_NAI_301_0007/02'] },
  { _id: '8', farmerId: 'F_TN_KAL_202_0008', name: 'Selvi Vengadesan', mobile: '7667122503', animalCount: 2, animalIds: ['F_TN_KAL_202_0008/01', 'F_TN_KAL_202_0008/02'] },
  { _id: '9', farmerId: 'F_TN_KAL_202_0009', name: 'Manjula K', mobile: '7639508647', animalCount: 2, animalIds: ['F_TN_KAL_202_0009/01', 'F_TN_KAL_202_0009/02'] },
  { _id: '10', farmerId: 'F_TN_NAI_301_0010', name: 'Suslia', mobile: '9524247374', animalCount: 2, animalIds: ['F_TN_NAI_301_0010/01', 'F_TN_NAI_301_0010/02'] },
  { _id: '11', farmerId: 'F_TN_KAL_202_0011', name: 'Jayamani', mobile: '9444714409', animalCount: 1, animalIds: ['F_TN_KAL_202_0011/01'] },
  { _id: '12', farmerId: 'F_TN_KAL_202_0012', name: 'Selvi Naliyapan', mobile: '9003468910', animalCount: 2, animalIds: ['F_TN_KAL_202_0012/01', 'F_TN_KAL_202_0012/02'] },
  { _id: '13', farmerId: 'F_TN_KAL_202_0013', name: 'Sumathi Jayabalan', mobile: '9500600549', animalCount: 2, animalIds: ['F_TN_KAL_202_0013/01', 'F_TN_KAL_202_0013/02'] },
  { _id: '14', farmerId: 'F_TN_PET_301_0014', name: 'Ambiga sasikumar', mobile: '9843446747', animalCount: 1, animalIds: ['F_TN_PET_301_0014/01'] },
  { _id: '15', farmerId: 'F_TN_NAI_301_0015', name: 'P. Manimegalai', mobile: '9080672809', animalCount: 2, animalIds: ['F_TN_NAI_301_0015/01', 'F_TN_NAI_301_0015/02'] },
  { _id: '16', farmerId: 'F_TN_NAI_301_0016', name: 'Neelavathi', mobile: '9943381045', animalCount: 2, animalIds: ['F_TN_NAI_301_0016/01', 'F_TN_NAI_301_0016/02'] },
  { _id: '17', farmerId: 'F_TN_NAI_301_0017', name: 'Sivagami', mobile: '9047817788', animalCount: 2, animalIds: ['F_TN_NAI_301_0017/01', 'F_TN_NAI_301_0017/02'] },
  { _id: '18', farmerId: 'F_TN_NAI_301_0018', name: 'Tamilselvi', mobile: '9500691349', animalCount: 2, animalIds: ['F_TN_NAI_301_0018/01', 'F_TN_NAI_301_0018/02'] },
  { _id: '19', farmerId: 'F_TN_PET_301_0019', name: 'Rani G', mobile: '9787142193', animalCount: 2, animalIds: ['F_TN_PET_301_0019/01', 'F_TN_PET_301_0019/02'] },
  { _id: '20', farmerId: 'F_TN_PET_301_0020', name: 'Banumathi', mobile: '9042257813', animalCount: 2, animalIds: ['F_TN_PET_301_0020/01', 'F_TN_PET_301_0020/02'] },
  { _id: '21', farmerId: 'F_TN_NAI_301_0021', name: 'Selvi J', mobile: '8489338331', animalCount: 2, animalIds: ['F_TN_NAI_301_0021/01', 'F_TN_NAI_301_0021/02'] },
  { _id: '22', farmerId: 'F_TN_NAI_301_0022', name: 'Kasthuri', mobile: '9159919508', animalCount: 2, animalIds: ['F_TN_NAI_301_0022/01', 'F_TN_NAI_301_0022/02'] },
  { _id: '23', farmerId: 'F_TN_NAI_301_0023', name: 'Priya', mobile: '9361658319', animalCount: 2, animalIds: ['F_TN_NAI_301_0023/01', 'F_TN_NAI_301_0023/02'] },
  { _id: '24', farmerId: 'F_TN_PET_301_0024', name: 'Vembarasi', mobile: '9786079394', animalCount: 2, animalIds: ['F_TN_PET_301_0024/01', 'F_TN_PET_301_0024/02'] },
  { _id: '25', farmerId: 'F_TN_PET_301_0025', name: 'Vanitha E', mobile: '9787605392', animalCount: 2, animalIds: ['F_TN_PET_301_0025/01', 'F_TN_PET_301_0025/02'] },
  { _id: '26', farmerId: 'F_TN_NAI_301_0026', name: 'Sarasu C', mobile: '9442819804', animalCount: 2, animalIds: ['F_TN_NAI_301_0026/01', 'F_TN_NAI_301_0026/02'] },
  { _id: '27', farmerId: 'F_TN_NAI_301_0027', name: 'Ramani M', mobile: '6369053882', animalCount: 2, animalIds: ['F_TN_NAI_301_0027/01', 'F_TN_NAI_301_0027/02'] },
  { _id: '28', farmerId: 'F_TN_NAI_301_0028', name: 'Selvi R', mobile: '9488779719', animalCount: 2, animalIds: ['F_TN_NAI_301_0028/01', 'F_TN_NAI_301_0028/02'] },
  { _id: '29', farmerId: 'F_TN_VK_301_0029', name: 'Santhi S', mobile: '7550045169', animalCount: 2, animalIds: ['F_TN_VK_301_0029/01', 'F_TN_VK_301_0029/02'] },
  { _id: '30', farmerId: 'F_TN_NAI_301_0030', name: 'Kalpana A', mobile: '9976453340', animalCount: 2, animalIds: ['F_TN_NAI_301_0030/01', 'F_TN_NAI_301_0030/02'] },
  { _id: '31', farmerId: 'F_TN_NAI_301_0031', name: 'Manjula C', mobile: '9345675712', animalCount: 2, animalIds: ['F_TN_NAI_301_0031/01', 'F_TN_NAI_301_0031/02'] },
  { _id: '32', farmerId: 'F_TN_PET_301_0032', name: 'Indirani Selvaraj', mobile: '9566594685', animalCount: 2, animalIds: ['F_TN_PET_301_0032/01', 'F_TN_PET_301_0032/02'] },
  { _id: '33', farmerId: 'F_TN_NAI_301_0033', name: 'Radha', mobile: '8838684943', animalCount: 2, animalIds: ['F_TN_NAI_301_0033/01', 'F_TN_NAI_301_0033/02'] },
  { _id: '34', farmerId: 'F_TN_PET_301_0034', name: 'Thangaye', mobile: '8098834355', animalCount: 1, animalIds: ['F_TN_PET_301_0034/01'] },
  { _id: '35', farmerId: 'F_TN_KAL_202_0035', name: 'Pooja', mobile: '8940482753', animalCount: 2, animalIds: ['F_TN_KAL_202_0035/01', 'F_TN_KAL_202_0035/02'] },
  { _id: '36', farmerId: 'F_TN_KAL_202_0036', name: 'Selvi S', mobile: '8838030200', animalCount: 2, animalIds: ['F_TN_KAL_202_0036/01', 'F_TN_KAL_202_0036/02'] },
  { _id: '37', farmerId: 'F_TN_KAL_202_0037', name: 'Parimala', mobile: '9514562567', animalCount: 2, animalIds: ['F_TN_KAL_202_0037/01', 'F_TN_KAL_202_0037/02'] },
  { _id: '38', farmerId: 'F_TN_KAL_202_0038', name: 'Nandhini kalimuthu', mobile: '9159957565', animalCount: 2, animalIds: ['F_TN_KAL_202_0038/01', 'F_TN_KAL_202_0038/02'] },
  { _id: '39', farmerId: 'F_TN_KAL_202_0039', name: 'Victor arokyadas', mobile: '9585821479', animalCount: 2, animalIds: ['F_TN_KAL_202_0039/01', 'F_TN_KAL_202_0039/02'] },
  { _id: '40', farmerId: 'F_TN_KAL_202_0040', name: 'Dhanalakshmi D', mobile: '9843157565', animalCount: 1, animalIds: ['F_TN_KAL_202_0040/01'] },
  { _id: '41', farmerId: 'F_TN_KAL_202_0041', name: 'P Padmavathi', mobile: '8870872391', animalCount: 2, animalIds: ['F_TN_KAL_202_0041/01', 'F_TN_KAL_202_0041/02'] },
  { _id: '42', farmerId: 'F_TN_NAI_301_0042', name: 'Suriya', mobile: '8098849228', animalCount: 1, animalIds: ['F_TN_NAI_301_0042/01'] },
  { _id: '43', farmerId: 'F_TN_NAI_301_0043', name: 'Manimeghalai K', mobile: '9486918923', animalCount: 1, animalIds: ['F_TN_NAI_301_0043/01'] },
  { _id: '44', farmerId: 'F_TN_NAI_301_0044', name: 'Rani Ganeshan', mobile: '8688369495', animalCount: 2, animalIds: ['F_TN_NAI_301_0044/01', 'F_TN_NAI_301_0044/02'] },
  { _id: '45', farmerId: 'F_TN_PET_301_0045', name: 'Sumithra', mobile: '9442703155', animalCount: 2, animalIds: ['F_TN_PET_301_0045/01', 'F_TN_PET_301_0045/02'] },
  { _id: '46', farmerId: 'F_TN_NAI_301_0046', name: 'Amudhavelli', mobile: '9787511062', animalCount: 2, animalIds: ['F_TN_NAI_301_0046/01', 'F_TN_NAI_301_0046/02'] },
  { _id: '47', farmerId: 'F_TN_NAI_301_0047', name: 'Sathya S', mobile: '8531915707', animalCount: 2, animalIds: ['F_TN_NAI_301_0047/01', 'F_TN_NAI_301_0047/02'] },
  { _id: '48', farmerId: 'F_TN_NAI_301_0048', name: 'Indirani Ganesan', mobile: '9787057746', animalCount: 2, animalIds: ['F_TN_NAI_301_0048/01', 'F_TN_NAI_301_0048/02'] },
  { _id: '49', farmerId: 'F_TN_PET_301_0049', name: 'Jaya', mobile: '9543778926', animalCount: 2, animalIds: ['F_TN_PET_301_0049/01', 'F_TN_PET_301_0049/02'] },
  { _id: '50', farmerId: 'F_TN_VK_301_0050', name: 'Chithra', mobile: '7904462765', animalCount: 2, animalIds: ['F_TN_VK_301_0050/01', 'F_TN_VK_301_0050/02'] },
  { _id: '51', farmerId: 'F_TN_VK_301_0051', name: 'Vanila Nalapilai', mobile: '9150177367', animalCount: 2, animalIds: ['F_TN_VK_301_0051/01', 'F_TN_VK_301_0051/02'] },
  { _id: '52', farmerId: 'F_TN_NAI_301_0052', name: 'AnbuMani', mobile: '9626437643', animalCount: 2, animalIds: ['F_TN_NAI_301_0052/01', 'F_TN_NAI_301_0052/02'] },
  { _id: '53', farmerId: 'F_TN_NAI_301_0053', name: 'Saraswathi', mobile: '7094714747', animalCount: 2, animalIds: ['F_TN_NAI_301_0053/01', 'F_TN_NAI_301_0053/02'] },
  { _id: '54', farmerId: 'F_TN_NAI_301_0054', name: 'Kalairasi', mobile: '9524247077', animalCount: 2, animalIds: ['F_TN_NAI_301_0054/01', 'F_TN_NAI_301_0054/02'] },
];

export default function FarmersPage() {
  const { toast } = useToast() ?? {};
  const [farmers, setFarmers] = useState<Farmer[]>(HARDCODED_FARMERS);
  const [loading] = useState(false);
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');
  const [showModal, setShowModal] = useState(false);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({ name: '', mobile: '', village: '', district: '', state: '', animalCount: '', animalType: 'Cow', gender: '' });

  const filtered = farmers.filter((f) =>
    !search || f.name.toLowerCase().includes(search.toLowerCase()) || f.mobile.includes(search) || f.farmerId.toLowerCase().includes(search.toLowerCase())
  );
  const limit = 20;
  const pagination: Pagination = { page, pages: Math.max(1, Math.ceil(filtered.length / limit)), total: filtered.length, limit };
  const pageFarmers = filtered.slice((page - 1) * limit, page * limit);

  const fetchFarmers = useCallback(() => { setFarmers(HARDCODED_FARMERS); }, []);

  const handleAdd = async (e: FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setFarmers((prev) => [
      { _id: String(prev.length + 1), farmerId: `F_TN_NEW_000_${String(prev.length + 1).padStart(4, '0')}`, ...form, animalCount: Number(form.animalCount) || 0 },
      ...prev,
    ]);
    toast?.('Farmer registered successfully', 'success');
    setShowModal(false);
    setForm({ name: '', mobile: '', village: '', district: '', state: '', animalCount: '', animalType: 'Cow', gender: '' });
    setSaving(false);
  };

  const columns = [
    { key: 'farmerId', label: 'ID', render: (v: string | undefined) => <span className="font-mono text-xs bg-gray-100 px-2 py-0.5 rounded">{v}</span> },
    { key: 'name', label: 'Name' },
    { key: 'mobile', label: 'Phone Number' },
    { key: 'animalCount', label: 'No. of Animals', render: (v: number) => (
      <span className="flex items-center gap-1.5"><Beef size={13} className="text-gray-400" />{v}</span>
    )},
    { key: 'animalIds', label: 'Animal ID', render: (v: string[] | undefined) => (
      <div className="flex flex-col gap-0.5">
        {(v || []).map((id) => <span key={id} className="font-mono text-xs bg-gray-100 px-2 py-0.5 rounded">{id}</span>)}
      </div>
    )},
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
      <DataTable columns={columns} data={pageFarmers} loading={loading} pagination={pagination} onPageChange={setPage} emptyText="No farmers registered yet." />
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
