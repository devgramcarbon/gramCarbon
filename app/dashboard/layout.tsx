'use client';

import { useState, useEffect } from 'react';
import type { ReactNode } from 'react';
import axios from 'axios';
import { Menu } from 'lucide-react';
import Sidebar from './Sidebar';
import { SocketProvider, useSocket } from '../components/SocketProvider';
import NotificationCenter from '../components/NotificationCenter';
import { ToastProvider } from '../components/Toaster';
import ThemeToggle from '../components/ThemeToggle';
import { ProjectFilterProvider, useProjectFilter } from './ProjectFilterContext';
import { ChevronDown } from 'lucide-react';

interface UserData {
  name?: string;
  role?: string;
}

const PROJECT_OPTIONS = [
  { key: 'all', label: 'All Projects' },
  { key: 'np', label: 'NainarPalayam' },
  { key: 'mm', label: 'Milky Mist' },
] as const;

const PROJECT_SWITCH_SEEN_KEY = 'gc_project_switch_coachmark_seen';

function ProjectSwitcher() {
  const { project, setProject } = useProjectFilter();
  const [open, setOpen] = useState(false);
  const [showCoachmark, setShowCoachmark] = useState(false);
  const current = PROJECT_OPTIONS.find((o) => o.key === project)!;

  useEffect(() => {
    if (!localStorage.getItem(PROJECT_SWITCH_SEEN_KEY)) setShowCoachmark(true);
  }, []);

  const dismissCoachmark = () => {
    localStorage.setItem(PROJECT_SWITCH_SEEN_KEY, '1');
    setShowCoachmark(false);
  };

  return (
    <div className="relative">
      <button
        onClick={() => {
          setOpen((o) => !o);
          if (showCoachmark) dismissCoachmark();
        }}
        onBlur={() => setTimeout(() => setOpen(false), 150)}
        className="flex items-center gap-1.5 px-2.5 h-8 rounded-lg border border-gray-200 dark:border-[#30363d] text-xs font-medium text-gray-700 dark:text-[#cdd9e5] hover:bg-gray-50 dark:hover:bg-[#21262d] transition-colors"
      >
        <span className="hidden sm:inline">{current.label}</span>
        <span className="sm:hidden">{project === 'all' ? 'All' : project === 'np' ? 'NP' : 'MM'}</span>
        <ChevronDown size={13} className="text-gray-400" />
      </button>
      {open && (
        <div className="absolute right-0 top-full mt-1 w-44 rounded-lg border border-gray-100 dark:border-[#30363d] bg-white dark:bg-[#161b22] shadow-lg py-1 z-40">
          {PROJECT_OPTIONS.map((opt) => (
            <button
              key={opt.key}
              onMouseDown={() => setProject(opt.key)}
              className={`w-full text-left px-3 py-1.5 text-xs transition-colors ${
                project === opt.key
                  ? 'text-teal-700 dark:text-teal-400 font-semibold bg-teal-50 dark:bg-teal-500/10'
                  : 'text-gray-600 dark:text-[#cdd9e5] hover:bg-gray-50 dark:hover:bg-[#21262d]'
              }`}
            >
              {opt.label}
            </button>
          ))}
        </div>
      )}
      {showCoachmark && !open && (
        <div className="absolute right-0 top-full mt-2 w-64 rounded-xl border border-teal-100 dark:border-teal-500/20 bg-white dark:bg-[#161b22] shadow-xl p-3 z-40 animate-in fade-in slide-in-from-top-1">
          <div className="absolute -top-1.5 right-6 w-3 h-3 rotate-45 bg-white dark:bg-[#161b22] border-l border-t border-teal-100 dark:border-teal-500/20" />
          <p className="text-xs font-semibold text-gray-800 dark:text-[#cdd9e5] mb-1">Switch between projects</p>
          <p className="text-[11px] text-gray-500 dark:text-[#768390] leading-relaxed mb-2">
            Use this dropdown to view data for NainarPalayam, Milky Mist, or all projects combined — it filters every dashboard page.
          </p>
          <button
            onClick={dismissCoachmark}
            className="text-[11px] font-semibold text-teal-600 hover:text-teal-700"
          >
            Got it
          </button>
        </div>
      )}
    </div>
  );
}

function DashboardContent({ children }: { children: ReactNode }) {
  const socket = useSocket();
  const [user, setUser] = useState<UserData | null>(null);
  const [mobileOpen, setMobileOpen] = useState(false);

  useEffect(() => {
    axios.get<{ success: boolean; data: UserData }>('/api/auth/me').then(({ data }) => {
      if (data.success) setUser(data.data);
    }).catch(() => {});
  }, []);

  return (
    <div className="flex min-h-screen bg-transparent">
      <Sidebar user={user} connected={socket?.connected} mobileOpen={mobileOpen} setMobileOpen={setMobileOpen} />
      <div className="flex-1 min-w-0 flex flex-col">
        <header className="sticky top-0 z-30 bg-white/80 dark:bg-[#161b22]/90 backdrop-blur border-b border-gray-100 dark:border-[#21262d] px-3 sm:px-4 lg:px-6 flex items-center justify-between gap-3 h-14">
          <div className="flex items-center gap-3 min-w-0">
            <button
              onClick={() => setMobileOpen(true)}
              className="lg:hidden flex-shrink-0 w-9 h-9 flex items-center justify-center rounded-xl hover:bg-gray-50 dark:hover:bg-[#21262d] transition-colors"
            >
              <Menu size={17} className="text-gray-600 dark:text-[#cdd9e5]" />
            </button>
            <div className="flex-shrink-0 lg:hidden flex">
          <img src="/gramcarbonlogo.png" alt="gramCarbon Console" className="h-6 w-auto object-contain dark:hidden" />
          <img src="/white.png" alt="gramCarbon Console" className="h-6 w-auto object-contain hidden dark:block" />
        </div>
            <div className="hidden lg:flex flex-col">
              <span className="text-xs text-gray-400 dark:text-[#768390] leading-tight">Welcome back,</span>
              <span className="text-sm font-semibold text-gray-800 dark:text-[#cdd9e5] leading-tight">{user?.name || 'Admin'}</span>
            </div>
          </div>
          <div className="flex items-center gap-2 sm:gap-3 flex-shrink-0">
            <ProjectSwitcher />
            <ThemeToggle />
            <NotificationCenter />
            <div className="w-8 h-8 bg-teal-600 rounded-full flex items-center justify-center">
              <span className="text-white text-xs font-bold">
                {user?.name?.[0]?.toUpperCase() || 'A'}
              </span>
            </div>
          </div>
        </header>
        <main className="flex-1 p-3 sm:p-6 lg:p-8">{children}</main>
      </div>
    </div>
  );
}

export default function DashboardLayout({ children }: { children: ReactNode }) {
  return (
    <SocketProvider>
      <ToastProvider>
        <ProjectFilterProvider>
          <DashboardContent>{children}</DashboardContent>
        </ProjectFilterProvider>
      </ToastProvider>
    </SocketProvider>
  );
}
