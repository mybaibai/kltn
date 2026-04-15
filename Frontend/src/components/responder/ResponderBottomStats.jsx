import { Clock3, Gauge, Siren } from "lucide-react";

export default function ResponderBottomStats({ teamStats, nearestTeamsCount, requestStats }) {
  return (
    <div className="responder-bottom-strip">
      <div>
        <Siren size={15} /> Tong doi cuu tro: {teamStats.total}
      </div>
      <div>
        <Clock3 size={15} /> SOS cho xu ly: {requestStats.pending}/{requestStats.total}
      </div>
      <div>
        <Gauge size={15} /> Doi gan nhat trong 10km: {nearestTeamsCount}
      </div>
    </div>
  );
}
