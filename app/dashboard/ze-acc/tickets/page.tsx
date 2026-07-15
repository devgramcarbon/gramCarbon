import { LayoutList } from 'lucide-react';
import ComingSoon from '../../../components/ComingSoon';

export default function ZeAccTicketsPage() {
  return (
    <ComingSoon
      title="Ticket Queue"
      description="Ticket list filtered to financially-relevant stages."
      icon={LayoutList}
      bullets={[
        'Same ticket list as ZE Admin, filtered to financially-relevant stages',
        'Flags for tickets nearing the 15th-day payment gate',
      ]}
    />
  );
}
