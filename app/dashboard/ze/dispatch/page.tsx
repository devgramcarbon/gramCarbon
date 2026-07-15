import { Truck } from 'lucide-react';
import ComingSoon from '../../../components/ComingSoon';

export default function ZeDispatchPage() {
  return (
    <ComingSoon
      title="Dispatch Tracker"
      description="Track material loading, dispatch and receipt."
      icon={Truck}
      bullets={[
        'Loaded & dispatched status with weight / DN / eway',
        'Material received confirmation from MM',
      ]}
    />
  );
}
