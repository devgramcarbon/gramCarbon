import { FileCheck2 } from 'lucide-react';
import ComingSoon from '../../../components/ComingSoon';

export default function ZeAccQaqcWeighbridgePage() {
  return (
    <ComingSoon
      title="QAQC & Weighbridge Payments"
      description="Mark report payments as paid."
      icon={FileCheck2}
      bullets={[
        'QAQC report payment — mark paid',
        'Weighbridge report payment — mark paid',
      ]}
    />
  );
}
