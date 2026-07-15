import { Factory } from 'lucide-react';
import ComingSoon from '../../../components/ComingSoon';

export default function ZeProductionPage() {
  return (
    <ComingSoon
      title="Production Oversight"
      description="Read-only view into production progress."
      icon={Factory}
      bullets={[
        'Daily 17:00 status feed: start / in-progress / completed',
        'Day-by-day progress log per batch',
      ]}
    />
  );
}
