import { CreditCard } from 'lucide-react';
import ComingSoon from '../../../components/ComingSoon';

export default function ZeAccPaymentConsolePage() {
  return (
    <ComingSoon
      title="Payment Console"
      description="Track the 15th-day payment gate and confirm payments."
      icon={CreditCard}
      bullets={[
        '15th-day / 10am gate tracker — auto-flags overdue',
        'Mark payment done, attach transaction detail mail from MM',
        'Payment received confirmation — confirm',
      ]}
    />
  );
}
