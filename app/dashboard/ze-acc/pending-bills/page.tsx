import { CalendarClock } from 'lucide-react';
import ComingSoon from '../../../components/ComingSoon';

export default function ZeAccPendingBillsPage() {
  return (
    <ComingSoon
      title="Pending Bills Tracker"
      description="Sortable calendar view of bills expected by date."
      icon={CalendarClock}
      bullets={[
        'Bills expected by date',
        'Sortable calendar view',
      ]}
    />
  );
}
