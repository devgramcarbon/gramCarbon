import { FolderOpen } from 'lucide-react';
import ComingSoon from '../../../components/ComingSoon';

export default function ZeDocumentsPage() {
  return (
    <ComingSoon
      title="Document Control Center"
      description="Track and store every document tied to a ticket."
      icon={FolderOpen}
      bullets={[
        'QAQC report status: requested → ready → paid',
        'Eway bill & DN approval status',
        'Weighbridge report status: requested → ready → paid',
        'Final approved doc bundle per ticket (DN + eway + QAQC + weighbridge) — downloadable master repository',
      ]}
    />
  );
}
