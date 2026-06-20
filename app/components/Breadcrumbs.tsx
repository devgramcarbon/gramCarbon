'use client';

import Link from 'next/link';
import { ChevronRight, Home } from 'lucide-react';

interface BreadcrumbItem {
  label: string;
  href: string;
}

export default function Breadcrumbs({ items = [] }: { items?: BreadcrumbItem[] }) {
  return (
    <nav className="flex items-center gap-1 text-sm text-gray-500 mb-4">
      <Link href="/dashboard" className="flex items-center gap-1 hover:text-green-600 transition-colors">
        <Home size={14} />
      </Link>
      {items.map((item, i) => (
        <span key={i} className="flex items-center gap-1">
          <ChevronRight size={14} className="text-gray-400" />
          {i === items.length - 1 ? (
            <span className="text-gray-800 font-medium">{item.label}</span>
          ) : (
            <Link href={item.href} className="hover:text-green-600 transition-colors">
              {item.label}
            </Link>
          )}
        </span>
      ))}
    </nav>
  );
}
