import { CheckCircle2 } from 'lucide-react';
import ComingSoon from '../../../components/ComingSoon';

export default function ZeClosurePage() {
  return (
    <ComingSoon
      title="Ticket Closure"
      description="Close out tickets once all upstream stages are confirmed."
      icon={CheckCircle2}
      bullets={[
        'Close ticket action once all upstream stages confirmed',
        'Archive / search of closed tickets',
      ]}
    />
  );
}
