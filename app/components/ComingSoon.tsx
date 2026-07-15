import type { LucideIcon } from 'lucide-react';
import PageHeader from './PageHeader';
import Breadcrumbs from './Breadcrumbs';

interface ComingSoonProps {
  title: string;
  description: string;
  icon: LucideIcon;
  bullets: string[];
}

export default function ComingSoon({ title, description, icon: Icon, bullets }: ComingSoonProps) {
  return (
    <div>
      <Breadcrumbs items={[{ label: title, href: '#' }]} />
      <PageHeader title={title} description={description} />
      <div className="rounded-2xl border border-dashed border-gray-200 bg-white p-10 text-center">
        <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-teal-50">
          <Icon size={22} className="text-teal-600" />
        </div>
        <p className="text-sm font-semibold text-gray-800">Coming soon</p>
        <p className="mt-1 text-sm text-gray-500">This section is planned but not yet built.</p>
        <ul className="mx-auto mt-5 max-w-md space-y-2 text-left">
          {bullets.map((b) => (
            <li key={b} className="flex items-start gap-2 text-sm text-gray-600">
              <span className="mt-1.5 h-1.5 w-1.5 flex-shrink-0 rounded-full bg-teal-400" />
              {b}
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}
