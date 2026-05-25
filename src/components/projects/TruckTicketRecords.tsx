import React, { useMemo, useState } from 'react';
import { motion } from 'framer-motion';
import { Plus, Save, Trash2, Edit, Truck } from 'lucide-react';
import type { Project } from '../../types';
import {
  DEFAULT_TRUCK_TICKET_FORM,
  type TruckTicketFormState,
} from '../../types/concreteTruckTicket';
import { suggestedMixCode, suggestedOrderedYards } from '../../utils/concreteTruckTicket';
import Button from '../ui/Button';
import Card from '../ui/Card';
import TruckTicketForm from './TruckTicketForm';
import QCRecords from './QCRecords';
import { format } from 'date-fns';

interface TruckTicketRecordsProps {
  project: Project;
  onSaveTicket: (form: TruckTicketFormState, recordId?: string) => Promise<void>;
  onDeleteTicket: (recordId: string) => Promise<void>;
  onSaveLegacyRecord: Parameters<typeof QCRecords>[0]['onSave'];
}

const TruckTicketRecords: React.FC<TruckTicketRecordsProps> = ({
  project,
  onSaveTicket,
  onDeleteTicket,
  onSaveLegacyRecord,
}) => {
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState<TruckTicketFormState>({
    ...DEFAULT_TRUCK_TICKET_FORM,
  });
  const [saving, setSaving] = useState(false);

  const truckTickets = project.truckTickets ?? [];
  const legacyRecords = project.qcRecords ?? [];

  const totalVolumeYd = useMemo(() => {
    const vols = project.calculations?.map((c) => c.result.volume) ?? [];
    if (vols.length === 0) return undefined;
    return Math.max(...vols);
  }, [project.calculations]);

  const setField = <K extends keyof TruckTicketFormState>(
    key: K,
    value: TruckTicketFormState[K],
  ) => {
    setForm((prev) => ({ ...prev, [key]: value }));
  };

  const openNewForm = () => {
    setEditingId(null);
    const psi = project.calculations?.[0]?.psi;
    setForm({
      ...DEFAULT_TRUCK_TICKET_FORM,
      recordDate: new Date().toISOString().split('T')[0],
      mixCode: suggestedMixCode(psi ? String(psi) : undefined),
      orderedYards: suggestedOrderedYards(totalVolumeYd),
    });
    setShowForm(true);
  };

  const openEditForm = (recordId: string) => {
    const stored = truckTickets.find((t) => t.id === recordId);
    if (!stored) return;
    setEditingId(recordId);
    setForm({ ...stored.form });
    setShowForm(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    try {
      await onSaveTicket(form, editingId ?? undefined);
      setShowForm(false);
      setEditingId(null);
      setForm({ ...DEFAULT_TRUCK_TICKET_FORM });
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h3 className="text-xl font-semibold text-gray-900 dark:text-white flex items-center gap-2">
            <Truck className="h-5 w-5 text-blue-600" />
            Truck ticket QC
          </h3>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
            Saved to your account — syncs across phone, tablet, and laptop.
          </p>
        </div>
        <Button onClick={openNewForm} icon={<Plus size={16} />}>
          Add ticket record
        </Button>
      </div>

      {showForm && (
        <Card className="p-6">
          <form onSubmit={handleSubmit} className="space-y-4">
            <TruckTicketForm
              form={form}
              onChange={setField}
              orderedYardsHint={
                totalVolumeYd != null && totalVolumeYd > 0
                  ? `Project calculations: up to ${totalVolumeYd.toFixed(2)} yd³`
                  : undefined
              }
            />
            <div className="flex justify-end gap-2 pt-2">
              <Button
                type="button"
                variant="outline"
                onClick={() => {
                  setShowForm(false);
                  setEditingId(null);
                }}
              >
                Cancel
              </Button>
              <Button type="submit" icon={<Save size={16} />} disabled={saving}>
                {saving ? 'Saving…' : editingId ? 'Update ticket' : 'Save ticket'}
              </Button>
            </div>
          </form>
        </Card>
      )}

      <div className="space-y-4">
        {truckTickets.length === 0 ? (
          <div className="text-center py-8 bg-gray-50 dark:bg-gray-800 rounded-lg">
            <p className="text-gray-500 dark:text-gray-400">
              No truck ticket records yet. Add one when concrete arrives onsite.
            </p>
          </div>
        ) : (
          truckTickets.map((record) => (
            <motion.div
              key={record.id}
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
            >
              <Card className="p-4 hover:shadow-md transition-shadow">
                <div className="flex flex-col gap-3">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <h4 className="font-medium text-gray-900 dark:text-white">
                        Ticket {record.ticket.ticketNumber || '—'}
                        {record.ticket.truckNumber
                          ? ` · Truck ${record.ticket.truckNumber}`
                          : ''}
                      </h4>
                      <p className="text-sm text-gray-500 dark:text-gray-400">
                        {format(new Date(record.form.recordDate), 'MMM d, yyyy')}
                        {record.ticket.mixCode ? ` · ${record.ticket.mixCode}` : ''}
                      </p>
                    </div>
                    <div className="flex gap-2 shrink-0">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => openEditForm(record.id)}
                        icon={<Edit size={16} />}
                      />
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => onDeleteTicket(record.id)}
                        icon={<Trash2 size={16} />}
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-sm">
                    <div className="bg-gray-50 dark:bg-gray-700/50 p-2 rounded-lg">
                      <span className="text-gray-500 dark:text-gray-400 text-xs block">
                        Delivered
                      </span>
                      <span className="font-medium text-gray-900 dark:text-white">
                        {record.ticket.deliveredYards || '—'} yd³
                      </span>
                    </div>
                    <div className="bg-gray-50 dark:bg-gray-700/50 p-2 rounded-lg">
                      <span className="text-gray-500 dark:text-gray-400 text-xs block">
                        Slump
                      </span>
                      <span className="font-medium text-gray-900 dark:text-white">
                        {record.ticket.slump || '—'}"
                      </span>
                    </div>
                    <div className="bg-gray-50 dark:bg-gray-700/50 p-2 rounded-lg">
                      <span className="text-gray-500 dark:text-gray-400 text-xs block">
                        Air
                      </span>
                      <span className="font-medium text-gray-900 dark:text-white">
                        {record.ticket.airContent || '—'}%
                      </span>
                    </div>
                    <div className="bg-gray-50 dark:bg-gray-700/50 p-2 rounded-lg">
                      <span className="text-gray-500 dark:text-gray-400 text-xs block">
                        Status
                      </span>
                      <span className="font-medium text-gray-900 dark:text-white">
                        {record.ticket.accepted ? 'Accepted' : 'Pending'}
                      </span>
                    </div>
                  </div>

                  {(record.form.inspectorInitials || record.form.admixtureAddedOnSite) && (
                    <p className="text-xs text-gray-600 dark:text-gray-400">
                      {record.form.inspectorInitials &&
                        `QC: ${record.form.inspectorInitials}`}
                      {record.form.admixtureAddedOnSite &&
                        ` · Admix: ${record.form.admixtureAddedOnSite}`}
                    </p>
                  )}
                </div>
              </Card>
            </motion.div>
          ))
        )}
      </div>

      {legacyRecords.length > 0 && (
        <div className="pt-6 border-t border-gray-200 dark:border-gray-700">
          <QCRecords
            projectId={project.id}
            records={legacyRecords}
            onSave={onSaveLegacyRecord}
            onDelete={onDeleteTicket}
          />
        </div>
      )}
    </div>
  );
};

export default TruckTicketRecords;
