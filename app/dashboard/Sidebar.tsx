'use client';

import { useEffect } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import axios from 'axios';
import {
  LayoutDashboard, Users, UserCheck, Package, ShoppingCart,
  MessageSquare, FileText, BarChart3, Settings, Shield, Terminal,
  LogOut, X, Building2, LayoutList, ClipboardList, Factory, FolderOpen,
  Truck, Wallet, CheckCircle2, FileCheck2, Receipt, CalendarClock,
  CreditCard, Archive, Leaf, TreePine, type LucideIcon,
} from 'lucide-react';

interface NavItem {
  href: string;
  label: string;
  icon: LucideIcon;
  exact?: boolean;
  adminOnly?: boolean;
  superAdminOnly?: boolean;
  zeAdminOnly?: boolean;
  zeAccOnly?: boolean;
}

const NAV_ITEMS: NavItem[] = [
  { href: '/dashboard', label: 'Dashboard', icon: LayoutDashboard, exact: true },
  { href: '/dashboard/distributors', label: 'Distributors', icon: Users },
  { href: '/dashboard/farmers', label: 'Farmers', icon: UserCheck },
  { href: '/dashboard/stock', label: 'Stock', icon: Package },
  { href: '/dashboard/offset-stats', label: 'Offset Stats', icon: Leaf },
  { href: '/dashboard/impact', label: 'Environmental Impact', icon: TreePine },
  { href: '/dashboard/sales', label: 'Sales', icon: ShoppingCart },
  { href: '/dashboard/messages', label: 'Messages', icon: MessageSquare },
  { href: '/dashboard/templates', label: 'Templates', icon: FileText, adminOnly: true },
  { href: '/dashboard/reports', label: 'Reports', icon: BarChart3, adminOnly: true },
  { href: '/dashboard/business-contacts', label: 'Business Contacts', icon: Building2, superAdminOnly: true },
  { href: '/dashboard/settings', label: 'Settings', icon: Settings, adminOnly: true },
  { href: '/dashboard/audit-logs', label: 'Audit Logs', icon: Shield, adminOnly: true },
  { href: '/dashboard/server-logs', label: 'Server Logs', icon: Terminal, adminOnly: true },

  // ZE Admin dashboard
  { href: '/dashboard/ze/tickets', label: 'Master Ticket Console', icon: LayoutList, zeAdminOnly: true },
  { href: '/dashboard/ze/po', label: 'PO Management', icon: ClipboardList, zeAdminOnly: true },
  { href: '/dashboard/ze/production', label: 'Production Oversight', icon: Factory, zeAdminOnly: true },
  { href: '/dashboard/ze/documents', label: 'Document Control', icon: FolderOpen, zeAdminOnly: true },
  { href: '/dashboard/ze/dispatch', label: 'Dispatch Tracker', icon: Truck, zeAdminOnly: true },
  { href: '/dashboard/ze/payments', label: 'Payment Oversight', icon: Wallet, zeAdminOnly: true },
  { href: '/dashboard/ze/closure', label: 'Ticket Closure', icon: CheckCircle2, zeAdminOnly: true },

  // ZE Accounts dashboard
  { href: '/dashboard/ze-acc/tickets', label: 'Ticket Queue', icon: LayoutList, zeAccOnly: true },
  { href: '/dashboard/ze-acc/qaqc-weighbridge', label: 'QAQC & Weighbridge', icon: FileCheck2, zeAccOnly: true },
  { href: '/dashboard/ze-acc/invoices', label: 'Invoices', icon: Receipt, zeAccOnly: true },
  { href: '/dashboard/ze-acc/pending-bills', label: 'Pending Bills', icon: CalendarClock, zeAccOnly: true },
  { href: '/dashboard/ze-acc/payment-console', label: 'Payment Console', icon: CreditCard, zeAccOnly: true },
  { href: '/dashboard/ze-acc/closed-tickets', label: 'Closed Tickets', icon: Archive, zeAccOnly: true },
];

interface SidebarProps {
  user: { name?: string; role?: string } | null;
  connected?: boolean;
  mobileOpen?: boolean;
  setMobileOpen?: (open: boolean) => void;
}

export default function Sidebar({ user, mobileOpen = false, setMobileOpen }: SidebarProps) {
  const pathname = usePathname();
  const router = useRouter();

  useEffect(() => { setMobileOpen?.(false); }, [pathname]);

  const isAdmin = user?.role === 'SUPER_ADMIN' || user?.role === 'ADMIN';
  const isSuperAdmin = user?.role === 'SUPER_ADMIN';
  const isZeAdmin = user?.role === 'ZE_ADMIN';
  const isZeAcc = user?.role === 'ZE_ACC';
  const items = NAV_ITEMS.filter((i) => {
    if (i.zeAdminOnly) return isZeAdmin || (i.href === '/dashboard/ze/po' && isSuperAdmin);
    if (i.zeAccOnly) return isZeAcc;
    if (isZeAdmin || isZeAcc) return i.exact === true;
    return (!i.adminOnly || isAdmin) && (!i.superAdminOnly || isSuperAdmin);
  });

  const isActive = (item: NavItem) => item.exact ? pathname === item.href : pathname.startsWith(item.href);

  const handleLogout = async () => {
    try { await axios.post('/api/auth/logout'); } catch {}
    router.push('/login');
  };

  const Content = () => (
    <div className="flex flex-col h-full">
      <div className="flex items-center gap-3 px-5 py-5 ">
        <div className="flex-shrink-0">
          <img src="/gramcarbonlogo.png" alt="gramCarbon Console" className="h-6 w-auto object-contain dark:hidden" />
          <img src="/white.png" alt="gramCarbon Console" className="h-6 w-auto object-contain hidden dark:block" />
        </div>

      </div>

      <nav className="flex-1 px-3 py-3 space-y-0.5 overflow-y-auto no-scrollbar">
        {items.map((item) => {
          const active = isActive(item);
          const Icon = item.icon;
          return (
            <Link
              key={item.href}
              href={item.href}
              onClick={() => setMobileOpen?.(false)}
              className={`relative flex w-full items-center gap-2.5 px-2.5 py-2 rounded-lg text-[13px] transition-all duration-150 ${
                active
                  ? 'bg-teal-50 text-teal-700 font-semibold'
                  : 'text-gray-500 font-normal hover:bg-gray-50 hover:text-gray-800'
              }`}
            >
              {active && <span className="absolute left-0 top-1/2 -translate-y-1/2 w-[3px] h-[55%] bg-teal-500 rounded-r-full shadow-[0_0_8px_rgba(13,148,136,0.45)]" />}
              <Icon size={14} className="flex-shrink-0" />
              <span>{item.label}</span>
            </Link>
          );
        })}
      </nav>

      <div className="px-3 pb-4 space-y-2 border-t border-gray-100 dark:border-[#21262d] pt-3">
        <div className="flex items-center gap-3 px-3 py-2.5 rounded-xl bg-gray-50 dark:bg-[#1c2128]">
          <div className="w-8 h-8 bg-teal-600 rounded-full flex items-center justify-center flex-shrink-0">
            <span className="text-white text-xs font-bold">{user?.name?.[0]?.toUpperCase() || 'A'}</span>
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-xs font-semibold text-gray-900 truncate">{user?.name || 'Admin'}</p>
            <p className="text-[10px] text-gray-400 truncate">{user?.role || 'OPERATOR'}</p>
          </div>
          <button onClick={handleLogout} className="p-1.5 rounded-lg hover:bg-red-50 hover:text-red-600 text-gray-400" title="Logout">
            <LogOut size={15} />
          </button>
        </div>
      </div>
    </div>
  );

  return (
    <>
      <aside className="hidden lg:flex flex-col w-64 bg-white dark:bg-[#161b22] border-r border-gray-100 dark:border-[#21262d] h-screen sticky top-0">
        <Content />
      </aside>

      {mobileOpen && (
        <div className="fixed inset-0 z-50 lg:hidden">
          <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={() => setMobileOpen?.(false)} />
          <div className="absolute left-0 top-0 bottom-0 w-72 bg-white dark:bg-[#161b22] shadow-2xl">
            <button onClick={() => setMobileOpen?.(false)} className="absolute top-4 right-4 p-1.5 hover:bg-gray-100 dark:hover:bg-[#21262d] rounded-lg">
              <X size={17} className="text-gray-500 dark:text-[#768390]" />
            </button>
            <Content />
          </div>
        </div>
      )}
    </>
  );
}
