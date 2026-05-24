import React from 'react';
import { Clock, AlertTriangle } from 'lucide-react';
import Card from '../ui/Card';
import {
  ASTM_C94_MAX_DRUM_REVOLUTIONS,
  ASTM_C94_MAX_MINUTES,
  timeRiskColor,
  type DeliveryWindowAnalysis,
} from '../../utils/placementWindow';

interface DeliveryClockProps {
  analysis: DeliveryWindowAnalysis;
  drumRpm?: string;
}

const DeliveryClock: React.FC<DeliveryClockProps> = ({ analysis, drumRpm }) => {
  const rpm = parseFloat(drumRpm || '6') || 6;
  const revolutionsAtElapsed = rpm * analysis.totalElapsedMin;

  return (
    <Card className={`p-5 border-2 ${timeRiskColor(analysis.riskLevel)}`}>
      <div className="flex items-center gap-2 mb-4">
        <Clock className="h-5 w-5" />
        <h3 className="text-lg font-bold">Delivery clock</h3>
      </div>

      <p className="text-sm mb-4 opacity-90">
        ASTM C94: discharge within {ASTM_C94_MAX_MINUTES} min or before{' '}
        {ASTM_C94_MAX_DRUM_REVOLUTIONS} drum revolutions after water contacts cement
        (unless waived by purchaser).
      </p>

      <div className="space-y-2 text-sm">
        <Row label="Allowed discharge window" value={`${analysis.allowedMinutes} min`} />
        <Row label="Travel time" value={`${Math.round(analysis.travelTimeMin)} min`} />
        <Row label="Traffic buffer" value={`${Math.round(analysis.trafficBufferMin)} min`} />
        <Row label="Onsite wait" value={`${Math.round(analysis.siteWaitMin)} min`} />
        <Row label="Placement / discharge" value={`${Math.round(analysis.dischargeMin)} min`} />
        <Row
          label="Total elapsed"
          value={`${Math.round(analysis.totalElapsedMin)} min`}
          bold
        />
      </div>

      <div
        className={`mt-4 rounded-lg p-4 border ${timeRiskColor(analysis.riskLevel)}`}
      >
        <p className="text-xs uppercase tracking-wide opacity-80 mb-1">
          Remaining allowable time
        </p>
        <p className="text-3xl font-bold">
          {analysis.remainingMinutes > 0
            ? `${Math.round(analysis.remainingMinutes)} min`
            : `${Math.abs(Math.round(analysis.remainingMinutes))} min over`}
        </p>
        <p className="text-sm font-medium mt-2 flex items-center gap-1.5">
          {analysis.riskLevel !== 'ok' && (
            <AlertTriangle className="h-4 w-4 shrink-0" />
          )}
          {analysis.riskLabel}
        </p>
      </div>

      <p className="text-xs mt-3 opacity-75">
        Est. drum revolutions at elapsed time: ~{Math.round(revolutionsAtElapsed)} (
        {rpm} RPM × {Math.round(analysis.totalElapsedMin)} min)
      </p>
    </Card>
  );
};

function Row({
  label,
  value,
  bold,
}: {
  label: string;
  value: string;
  bold?: boolean;
}) {
  return (
    <div className="flex justify-between gap-4">
      <span className={bold ? 'font-semibold' : ''}>{label}</span>
      <span className={bold ? 'font-bold' : 'font-medium'}>{value}</span>
    </div>
  );
}

export default DeliveryClock;
