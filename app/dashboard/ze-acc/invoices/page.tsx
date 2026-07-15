import { Receipt } from 'lucide-react';
import ComingSoon from '../../../components/ComingSoon';

export default function ZeAccInvoicesPage() {
  return (
    <ComingSoon
      title="Invoice Generation & Approval"
      description="Core purpose of the ZE Accounts dashboard."
      icon={Receipt}
      bullets={[
        'Invoice approval queue — approve',
        'Final invoice generator: build invoice from PO + final values + QAQC / weighbridge / DN / eway data, generate PDF, attach to ticket',
        'Invoice linked to dispatch card',
        'Invoice received / approved log — confirm',
      ]}
    />
  );
}
