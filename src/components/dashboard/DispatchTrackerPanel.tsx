import React from 'react';
import { Truck } from 'lucide-react';
import OpsCard from './OpsCard';
import type { DispatchTruckRow } from '../../utils/operationsDashboard';
import { Link } from 'react-router-dom';

const statusLabel: Record<DispatchTruckRow['status'], string> = {
  scheduled: 'Scheduled',
  loading: 'Loading',
  en_route: 'En route',
  on_site: 'On site',
  washing_out: 'Washing out',
};

const statusClass: Record<DispatchTruckRow['status'], string> = {
  scheduled: 'bg-slate-600',
  loading: 'bg-amber-500',
  en_route: 'bg-cyan-500',
  on_site: 'bg-emerald-500',
  washing_out: 'bg-blue-400',
};

interface DispatchTrackerPanelProps {
  trucks: DispatchTruckRow[];
  batchPlantName?: string;
  deliveryLabel: string;
  hasPlacementsToday: boolean;
}

const NO_PLACEMENTS_MSG =
  'No placements scheduled for today. Truck dispatch appears here when a project has today\'s pour date and a saved placement order.';

const DispatchTrackerPanel: React.FC<DispatchTrackerPanelProps> = ({
  trucks,
  batchPlantName,
  deliveryLabel,
  hasPlacementsToday,
}) => {
  const showDispatch = hasPlacementsToday && trucks.length > 0;

  return (
    <OpsCard>
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <Truck className="h-5 w-5 text-blue-400" />
          <h3 className="font-semibold text-white">Ready-mix dispatch</h3>
        </div>
        <Link to="/pour-planner" className="text-xs text-cyan-400 hover:underline">
          Order / plan →
        </Link>
      </div>
      {!hasPlacementsToday ? (
        <p className="text-sm text-slate-400">{NO_PLACEMENTS_MSG}</p>
      ) : (
        <>
          {batchPlantName && (
            <p className="text-sm text-slate-400 mb-3">
              Plant: <span className="text-slate-200">{batchPlantName}</span>
            </p>
          )}
          <p className="text-xs text-slate-500 mb-3">{deliveryLabel}</p>
          {showDispatch ? (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-left text-slate-500 border-b border-slate-700">
                    <th className="pb-2 pr-4 font-medium">Truck</th>
                    <th className="pb-2 pr-4 font-medium">Status</th>
                    <th className="pb-2 font-medium">ETA / time</th>
                  </tr>
                </thead>
                <tbody>
                  {trucks.map((row) => (
                    <tr key={row.id} className="border-b border-slate-800/80">
                      <td className="py-2.5 pr-4 font-mono text-slate-200">
                        {row.truckNumber}
                      </td>
                      <td className="py-2.5 pr-4">
                        <span
                          className={`inline-block px-2 py-0.5 rounded text-xs font-medium text-white ${statusClass[row.status]}`}
                        >
                          {statusLabel[row.status]}
                        </span>
                      </td>
                      <td className="py-2.5 text-slate-300">{row.etaLabel}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <p className="text-sm text-slate-400">
              Placement is today — save the order call sheet in Placement Planner to show truck
              intervals.
            </p>
          )}
          {showDispatch && (
            <p className="text-xs text-slate-500 mt-3">
              Schedule from saved call sheet. Live truck GPS requires plant integration.
            </p>
          )}
        </>
      )}
    </OpsCard>
  );
};

export default DispatchTrackerPanel;
