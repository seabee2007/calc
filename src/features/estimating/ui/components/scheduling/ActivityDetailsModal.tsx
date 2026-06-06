import type { ActivityDetailsViewModel } from '../../../scheduling/activityDetailsModalData';

interface Props {
  details: ActivityDetailsViewModel;
  onClose: () => void;
  onEdit: () => void;
}

function DetailRow({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="grid grid-cols-[9rem_1fr] gap-2 border-b border-slate-100 py-2 text-sm dark:border-slate-800">
      <span className="text-slate-500 dark:text-slate-400">{label}</span>
      <span className="text-slate-800 dark:text-slate-100">{value}</span>
    </div>
  );
}

export default function ActivityDetailsModal({ details, onClose, onEdit }: Props) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="flex max-h-[90vh] w-full max-w-lg flex-col rounded-xl border border-slate-200 bg-white shadow-xl dark:border-slate-700 dark:bg-slate-900">
        <div className="border-b border-slate-200 px-5 py-4 dark:border-slate-700">
          <h2 className="text-base font-semibold text-slate-800 dark:text-slate-100">
            Activity Details
          </h2>
          <p className="mt-1 font-mono text-sm text-slate-500 dark:text-slate-400">
            {details.activityCode}
          </p>
        </div>

        <div className="overflow-y-auto px-5 py-2">
          <DetailRow label="Activity Code" value={details.activityCode} />
          <DetailRow label="Title" value={details.title} />
          <DetailRow label="Division" value={details.division} />
          <DetailRow label="Work Package" value={details.workPackage} />
          <DetailRow label="Duration" value={`${details.durationDays}d`} />
          <DetailRow label="Estimated Float" value={details.estimatedFloat} />
          <DetailRow label="Early Start" value={`Day ${details.earlyStart}`} />
          <DetailRow label="Early Finish" value={`Day ${details.earlyFinish}`} />
          <DetailRow label="Late Start" value={`Day ${details.lateStart}`} />
          <DetailRow label="Late Finish" value={`Day ${details.lateFinish}`} />
          <DetailRow label="Total Float" value={`${details.totalFloat}d`} />
          <DetailRow label="Free Float" value={`${details.freeFloat}d`} />
          <DetailRow label="Critical Path" value={details.isCritical ? 'Yes' : 'No'} />
          <DetailRow label="Crew Size" value={details.crewSize} />
          <DetailRow label="Labor Hours" value={details.laborHours} />
          <DetailRow label="Man-Days" value={details.manDays} />
          <DetailRow label="Crew-Days" value={details.crewDays} />
          <DetailRow
            label="Total Cost"
            value={details.totalCost.toLocaleString(undefined, {
              style: 'currency',
              currency: 'USD',
              maximumFractionDigits: 0,
            })}
          />
          <DetailRow label="Predecessors" value={details.predecessors} />
          <DetailRow label="Relationship" value={details.relationshipType} />
          <DetailRow label="Lag Days" value={details.lagDays} />
          {details.notes ? <DetailRow label="Notes" value={details.notes} /> : null}
        </div>

        <div className="flex items-center justify-end gap-3 border-t border-slate-200 px-5 py-4 dark:border-slate-700">
          <button
            type="button"
            className="rounded-lg px-4 py-2 text-sm text-slate-600 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-800"
            onClick={onClose}
          >
            Close
          </button>
          <button
            type="button"
            className="rounded-lg bg-cyan-600 px-4 py-2 text-sm font-medium text-white hover:bg-cyan-700"
            onClick={onEdit}
          >
            Edit activity
          </button>
        </div>
      </div>
    </div>
  );
}
