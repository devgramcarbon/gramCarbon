export function Spinner({ size = 'md', className = '' }: { size?: 'sm' | 'md' | 'lg'; className?: string }) {
  const sizes = { sm: 'w-4 h-4', md: 'w-8 h-8', lg: 'w-12 h-12' };
  return (
    <div
      className={`${sizes[size]} border-2 border-gray-200 border-t-green-600 rounded-full animate-spin ${className}`}
    />
  );
}

export default function LoadingState({ message = 'Loading...', fullPage = false }: { message?: string; fullPage?: boolean }) {
  const inner = (
    <div className="flex flex-col items-center gap-3 text-gray-500">
      <Spinner size="lg" />
      <p className="text-sm">{message}</p>
    </div>
  );

  if (fullPage) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        {inner}
      </div>
    );
  }

  return (
    <div className="flex items-center justify-center py-20">
      {inner}
    </div>
  );
}

export function SkeletonBlock({ className = '' }: { className?: string }) {
  return <div className={`animate-pulse bg-gray-200 dark:bg-[#30363d] rounded ${className}`} />;
}

export function SkeletonRow({ cols = 4 }: { cols?: number }) {
  return (
    <tr className="animate-pulse">
      {Array.from({ length: cols }).map((_, i) => (
        <td key={i} className="px-4 py-3">
          <div className="h-4 bg-gray-200 dark:bg-[#30363d] rounded w-3/4" />
        </td>
      ))}
    </tr>
  );
}
