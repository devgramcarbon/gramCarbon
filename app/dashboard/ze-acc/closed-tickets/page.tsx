import { Archive } from 'lucide-react';
import ComingSoon from '../../../components/ComingSoon';

export default function ZeAccClosedTicketsPage() {
  return (
    <ComingSoon
      title="Closed Tickets Archive"
      description="Read access to closed tickets for reconciliation."
      icon={Archive}
      bullets={[
        'Read access to closed tickets',
        'Used for reconciliation',
      ]}
    />
  );
}
