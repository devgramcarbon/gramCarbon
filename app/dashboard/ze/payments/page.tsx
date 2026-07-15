import { Wallet } from 'lucide-react';
import ComingSoon from '../../../components/ComingSoon';

export default function ZePaymentsPage() {
  return (
    <ComingSoon
      title="Payment Oversight"
      description="Read-only, cross-checked against ZE Accounts."
      icon={Wallet}
      bullets={[
        'Payment gate status',
        'Payment done status',
        'Payment received status',
      ]}
    />
  );
}
