import { LayoutList } from 'lucide-react';
import ComingSoon from '../../../components/ComingSoon';

export default function ZeTicketsPage() {
  return (
    <ComingSoon
      title="Master Ticket Console"
      description="Every open ticket with current stage, client, batch, date, location and quantity."
      icon={LayoutList}
      bullets={[
        'Stage progress bar per ticket (visually shows where it’s stuck)',
        'Aging / bottleneck flags for tickets sitting too long at any stage',
      ]}
    />
  );
}
