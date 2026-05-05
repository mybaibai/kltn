import { Clock3, Gauge, Siren } from "lucide-react";

export default function ResponderBottomStats({ teamStats, nearestTeamsCount, requestStats }) {
  return (
    <div className="responder-bottom-strip">
      <div>
        <Siren size={15} /> Tổng đội cứu trợ: {teamStats.total}
      </div>
      <div>
        <Clock3 size={15} /> SOS chờ xử lý: {requestStats.pending}/{requestStats.total}
      </div>
      <div>
        <Gauge size={15} /> Đội gần nhất trong 10km: {nearestTeamsCount}
      </div>
    </div>
  );
}
