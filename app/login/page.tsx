'use client';

import { Suspense, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import axios from 'axios';
import Image from 'next/image';
import { Eye, EyeOff, Loader2 } from 'lucide-react';
import type { FormEvent } from 'react';
import { useToast } from '../components/Toaster';

function LoginForm() {
  const searchParams = useSearchParams();
  const redirect = searchParams.get('redirect') || '/dashboard';

  const toast = useToast();
  const [form, setForm] = useState({ email: '', password: '' });
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      const { data } = await axios.post<{ success: boolean }>('/api/auth/login', form);
      if (data.success) {
        toast?.toast('Signed in successfully', 'success');
        window.location.href = redirect;
      }
    } catch (err) {
      const message = (err as { response?: { data?: { message?: string } } })?.response?.data?.message || 'Login failed. Please try again.';
      toast?.toast(message, 'error');
    } finally {
      setLoading(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-5">
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1.5">Email Address</label>
        <input
          type="email"
          required
          value={form.email}
          onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))}
          placeholder="admin@gramcarbon.in"
          className="w-full px-4 py-3 rounded-xl border border-gray-200 bg-gray-50 focus:bg-white focus:outline-none focus:ring-2 focus:ring-green-500 focus:border-transparent text-sm transition-all"
        />
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1.5">Password</label>
        <div className="relative">
          <input
            type={showPassword ? 'text' : 'password'}
            required
            value={form.password}
            onChange={(e) => setForm((f) => ({ ...f, password: e.target.value }))}
            placeholder="••••••••"
            className="w-full px-4 py-3 rounded-xl border border-gray-200 bg-gray-50 focus:bg-white focus:outline-none focus:ring-2 focus:ring-green-500 focus:border-transparent text-sm transition-all pr-12"
          />
          <button
            type="button"
            onClick={() => setShowPassword(!showPassword)}
            className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 p-1"
          >
            {showPassword ? <EyeOff size={17} /> : <Eye size={17} />}
          </button>
        </div>
      </div>

      <button
        type="submit"
        disabled={loading}
        className="w-full bg-green-600 hover:bg-green-700 active:bg-green-800 disabled:opacity-60 disabled:cursor-not-allowed text-white font-semibold py-3.5 rounded-xl transition-colors flex items-center justify-center gap-2 shadow-md shadow-green-200"
      >
        {loading ? <><Loader2 size={18} className="animate-spin" /> Signing in...</> : 'Sign In to Dashboard'}
      </button>
    </form>
  );
}

function RightPanel() {
  return (
    <div className="hidden lg:flex flex-col items-center justify-center h-full relative overflow-hidden bg-green-600">
      <div className="absolute inset-0 bg-gradient-to-br from-green-600 to-emerald-700" />
      <div className="absolute -top-16 -right-16 w-64 h-64 rounded-full bg-white/10" />
      <div className="absolute -bottom-20 -left-12 w-72 h-72 rounded-full bg-white/5" />
      <div className="relative z-10 text-center px-10">
        <div className="w-20 h-20 flex items-center justify-center mx-auto mb-6">
          <Image src="/gramicon.png" alt="gramCarbon Console" width={80} height={80} className="object-contain" />
        </div>
        <h2 className="text-white text-2xl font-bold mb-3">gramCarbon Console</h2>
        <p className="text-green-100 text-sm leading-relaxed max-w-xs">
          Empowering farmers through sustainable feed distribution and carbon credit tracking.
        </p>
      </div>
      <p className="absolute bottom-6 text-green-200/50 text-xs">© {new Date().getFullYear()} gramCarbon Console</p>
    </div>
  );
}

export default function LoginPage() {
  return (
    <div className="h-screen flex">
      <div className="flex-1 flex items-center justify-center p-6 bg-white lg:max-w-[480px]">
        <div className="w-full max-w-sm">
          <div className="flex flex-col items-center mb-8 lg:hidden">
            <Image src="/gramicon.png" alt="gramCarbon Console" width={48} height={48} className="object-contain mb-3" />
            <h1 className="text-xl font-bold text-gray-900">gramCarbon Console</h1>
          </div>
          <div className="hidden lg:flex items-center gap-3 mb-2">
            <Image src="/gramicon.png" alt="gramCarbon Console" width={40} height={40} className="object-contain" />
            <span className="font-bold text-gray-900 text-lg">gramCarbon Console</span>
          </div>
          <h2 className="text-2xl font-bold text-gray-900 mt-6 mb-1">Welcome back</h2>
          <p className="text-sm text-gray-500 mb-8">Sign in to your admin dashboard</p>
          <Suspense fallback={<div className="text-center text-sm text-gray-400 py-4">Loading...</div>}>
            <LoginForm />
          </Suspense>
          <p className="text-center text-xs text-gray-400 mt-8 lg:hidden">
            gramCarbon Console © {new Date().getFullYear()}
          </p>
        </div>
      </div>
      <div className="flex-1">
        <RightPanel />
      </div>
    </div>
  );
}
