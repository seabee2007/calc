import React, { useState, useEffect, useMemo } from 'react';
import { motion } from 'framer-motion';
import { Plus, Save, Trash2, Edit, Search, Calendar } from 'lucide-react';
import type { QCRecord, QCRecordType } from '../../types';
import Button from '../ui/Button';
import Input from '../ui/Input';
import Card from '../ui/Card';
import { format } from 'date-fns';
import { soundService } from '../../services/soundService';
import { computeBreakResult } from '../../utils/qcRecordDb';
import {
  OPS_EMPTY_STATE,
  OPS_MUTED,
  OPS_SECTION_EYEBROW,
  OPS_TITLE,
} from '../dashboard/opsTheme';

interface QCRecordsProps {
  projectId: string;
  records: QCRecord[];
  onSave: (
    record: Omit<QCRecord, 'id' | 'projectId' | 'createdAt' | 'updatedAt'>,
    recordId?: string,
  ) => void | Promise<void>;
  onDelete: (recordId: string) => void;
}

type FreshFormData = {
  date: string;
  truckNumber: string;
  ticketNumber: string;
  batchTime: string;
  sampleTime: string;
  temperature: string;
  humidity: string;
  windSpeed: string;
  concreteTemperature: string;
  slump: string;
  airContent: string;
  unitWeight: string;
  cylindersMade: string;
  notes: string;
};

type BreakFormData = {
  testAgeDays: string;
  breakDate: string;
  breakStrengthPsi: string;
  cylinderId: string;
  designStrengthPsi: string;
  loadLbs: string;
  averageStrengthPsi: string;
  breakResult: '' | 'pass' | 'fail' | 'informational';
  notes: string;
};

const emptyFreshForm = (): FreshFormData => ({
  date: new Date().toISOString().split('T')[0],
  truckNumber: '',
  ticketNumber: '',
  batchTime: '',
  sampleTime: '',
  temperature: '',
  humidity: '',
  windSpeed: '',
  concreteTemperature: '',
  slump: '',
  airContent: '',
  unitWeight: '',
  cylindersMade: '',
  notes: '',
});

const emptyBreakForm = (): BreakFormData => ({
  testAgeDays: '7',
  breakDate: new Date().toISOString().split('T')[0],
  breakStrengthPsi: '',
  cylinderId: '',
  designStrengthPsi: '',
  loadLbs: '',
  averageStrengthPsi: '',
  breakResult: '',
  notes: '',
});

function parseOptionalFloat(value: string): number | undefined {
  if (!value.trim()) return undefined;
  const n = parseFloat(value);
  return Number.isFinite(n) ? n : undefined;
}

function parseOptionalInt(value: string): number | undefined {
  if (!value.trim()) return undefined;
  const n = parseInt(value, 10);
  return Number.isFinite(n) ? n : undefined;
}

function formatOptional(value?: number, suffix = ''): string {
  if (value == null || Number.isNaN(value)) return '—';
  return `${value}${suffix}`;
}

function recordMatchesSearch(record: QCRecord, term: string): boolean {
  if (!term) return true;
  const hay = [
    record.notes,
    record.recordType,
    record.testAgeDays?.toString(),
    record.breakStrengthPsi?.toString(),
    record.designStrengthPsi?.toString(),
    record.truckNumber,
    record.ticketNumber,
    record.cylinderId,
    record.temperature?.toString(),
    record.humidity?.toString(),
    record.slump?.toString(),
    record.airContent?.toString(),
    record.cylindersMade?.toString(),
  ]
    .filter(Boolean)
    .join(' ')
    .toLowerCase();
  return hay.includes(term);
}

function breakResultBadgeClass(result?: QCRecord['breakResult']): string {
  switch (result) {
    case 'pass':
      return 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-300';
    case 'fail':
      return 'bg-red-100 text-red-800 dark:bg-red-900/40 dark:text-red-300';
    case 'informational':
      return 'bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-300';
    default:
      return 'bg-gray-100 text-gray-700 dark:bg-gray-700 dark:text-gray-300';
  }
}

const QCRecords: React.FC<QCRecordsProps> = ({
  records,
  onSave,
  onDelete,
}) => {
  const [showForm, setShowForm] = useState(false);
  const [editingRecord, setEditingRecord] = useState<QCRecord | null>(null);
  const [recordType, setRecordType] = useState<QCRecordType>('fresh_test');
  const [searchTerm, setSearchTerm] = useState('');
  const [dateFilter, setDateFilter] = useState('');
  const [freshForm, setFreshForm] = useState<FreshFormData>(emptyFreshForm);
  const [breakForm, setBreakForm] = useState<BreakFormData>(emptyBreakForm);

  useEffect(() => {
    if (!editingRecord) return;

    setRecordType(editingRecord.recordType ?? 'fresh_test');
    if (editingRecord.recordType === 'break_test') {
      setBreakForm({
        testAgeDays: String(editingRecord.testAgeDays ?? 7),
        breakDate: (editingRecord.breakDate ?? editingRecord.date).split('T')[0],
        breakStrengthPsi: editingRecord.breakStrengthPsi?.toString() ?? '',
        cylinderId: editingRecord.cylinderId ?? '',
        designStrengthPsi: editingRecord.designStrengthPsi?.toString() ?? '',
        loadLbs: editingRecord.loadLbs?.toString() ?? '',
        averageStrengthPsi: editingRecord.averageStrengthPsi?.toString() ?? '',
        breakResult: editingRecord.breakResult ?? '',
        notes: editingRecord.notes ?? '',
      });
    } else {
      setFreshForm({
        date: editingRecord.date.split('T')[0],
        truckNumber: editingRecord.truckNumber ?? '',
        ticketNumber: editingRecord.ticketNumber ?? '',
        batchTime: editingRecord.batchTime ?? '',
        sampleTime: editingRecord.sampleTime ?? '',
        temperature: editingRecord.temperature?.toString() ?? '',
        humidity: editingRecord.humidity?.toString() ?? '',
        windSpeed: editingRecord.windSpeed?.toString() ?? '',
        concreteTemperature: editingRecord.concreteTemperature?.toString() ?? '',
        slump: editingRecord.slump?.toString() ?? '',
        airContent: editingRecord.airContent?.toString() ?? '',
        unitWeight: editingRecord.unitWeight?.toString() ?? '',
        cylindersMade: editingRecord.cylindersMade?.toString() ?? '',
        notes: editingRecord.notes ?? '',
      });
    }
    setShowForm(true);
  }, [editingRecord]);

  const resetForm = () => {
    setFreshForm(emptyFreshForm());
    setBreakForm(emptyBreakForm());
    setRecordType('fresh_test');
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    let payload: Omit<QCRecord, 'id' | 'projectId' | 'createdAt' | 'updatedAt'>;

    if (recordType === 'break_test') {
      const testAgeDays = parseInt(breakForm.testAgeDays, 10) as 7 | 14 | 28 | 56;
      const designStrengthPsi = parseOptionalFloat(breakForm.designStrengthPsi);
      const breakStrengthPsi = parseOptionalFloat(breakForm.breakStrengthPsi);
      const userBreakResult = breakForm.breakResult || undefined;
      const breakResult = computeBreakResult(
        testAgeDays,
        designStrengthPsi,
        breakStrengthPsi,
        userBreakResult,
      );

      payload = {
        recordType: 'break_test',
        date: breakForm.breakDate,
        testAgeDays,
        breakDate: breakForm.breakDate,
        breakStrengthPsi,
        cylinderId: breakForm.cylinderId.trim() || undefined,
        designStrengthPsi,
        loadLbs: parseOptionalFloat(breakForm.loadLbs),
        averageStrengthPsi: parseOptionalFloat(breakForm.averageStrengthPsi),
        breakResult,
        notes: breakForm.notes.trim() || undefined,
      };
    } else {
      payload = {
        recordType: 'fresh_test',
        date: freshForm.date,
        truckNumber: freshForm.truckNumber.trim() || undefined,
        ticketNumber: freshForm.ticketNumber.trim() || undefined,
        batchTime: freshForm.batchTime.trim() || undefined,
        sampleTime: freshForm.sampleTime.trim() || undefined,
        temperature: parseOptionalFloat(freshForm.temperature),
        humidity: parseOptionalFloat(freshForm.humidity),
        windSpeed: parseOptionalFloat(freshForm.windSpeed),
        concreteTemperature: parseOptionalFloat(freshForm.concreteTemperature),
        slump: parseOptionalFloat(freshForm.slump),
        airContent: parseOptionalFloat(freshForm.airContent),
        unitWeight: parseOptionalFloat(freshForm.unitWeight),
        cylindersMade: parseOptionalInt(freshForm.cylindersMade),
        notes: freshForm.notes.trim() || undefined,
      };
    }

    await onSave(payload, editingRecord?.id);
    setShowForm(false);
    setEditingRecord(null);
    resetForm();
  };

  const filteredRecords = useMemo(() => {
    const term = searchTerm.toLowerCase().trim();
    return records
      .filter((r) => {
        const matchSearch = recordMatchesSearch(r, term);
        const matchDate =
          !dateFilter ||
          r.date.split('T')[0] === dateFilter ||
          r.breakDate?.split('T')[0] === dateFilter;
        return matchSearch && matchDate;
      })
      .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
  }, [records, searchTerm, dateFilter]);

  const freshRecords = filteredRecords.filter((r) => r.recordType !== 'break_test');
  const breakRecords = filteredRecords.filter((r) => r.recordType === 'break_test');

  const showBreakResultOverride =
    recordType === 'break_test' &&
    parseOptionalFloat(breakForm.designStrengthPsi) != null &&
    parseOptionalFloat(breakForm.breakStrengthPsi) != null &&
    (parseOptionalFloat(breakForm.breakStrengthPsi) ?? 0) <
      (parseOptionalFloat(breakForm.designStrengthPsi) ?? 0) &&
    (parseInt(breakForm.testAgeDays, 10) === 7 ||
      parseInt(breakForm.testAgeDays, 10) === 14);

  const openNewForm = (type: QCRecordType) => {
    resetForm();
    setEditingRecord(null);
    setRecordType(type);
    setShowForm(true);
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4">
        <div>
          <h3 className={`text-xl font-semibold ${OPS_TITLE}`}>
            Concrete QC Records
          </h3>
          <p className={`text-sm ${OPS_MUTED} mt-1`}>
            Use Concrete Slump Test for placement-day field tests. Use Break Test Result for 7, 14,
            and 28-day cylinder results.
          </p>
        </div>
        <div className="flex flex-wrap gap-2 shrink-0">
          <Button variant="accent" onClick={() => openNewForm('fresh_test')} icon={<Plus size={16} />}>
            Slump Test
          </Button>
          <Button variant="accent" onClick={() => openNewForm('break_test')}  icon={<Plus size={16} />}
          >
            Break Result
          </Button>
        </div>
      </div>

      <div className="flex flex-col sm:flex-row gap-4">
        <div className="flex-1">
          <Input
            placeholder="Search records..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            icon={<Search className="h-4 w-4 text-gray-400" />}
            fullWidth
          />
        </div>
        <div className="w-full sm:w-48">
          <Input
            type="date"
            value={dateFilter}
            onChange={(e) => setDateFilter(e.target.value)}
            icon={<Calendar className="h-4 w-4 text-gray-400" />}
            fullWidth
          />
        </div>
      </div>

      {showForm && (
        <Card className="p-6">
          <form onSubmit={handleSubmit} className="space-y-4">
            {recordType === 'fresh_test' ? (
              <div className="rounded-lg bg-slate-800/50 border border-slate-700 p-4 mb-4">
                <div className="text-xs uppercase tracking-widest text-cyan-400 font-semibold">
                  Concrete QC Record
                </div>
                <h3 className="mt-1 text-lg font-bold text-white">Concrete Slump Test</h3>
                <p className="text-sm text-slate-400">
                  ASTM C143 Slump • ASTM C231 Air Content • ASTM C1064 Temperature
                </p>
              </div>
            ) : (
              <div className="rounded-lg bg-slate-800/50 border border-slate-700 p-4 mb-4">
                <div className="text-xs uppercase tracking-widest text-cyan-400 font-semibold">
                  Concrete QC Record
                </div>
                <h3 className="mt-1 text-lg font-bold text-white">Break Test Result</h3>
                <p className="text-sm text-slate-400">
                  ASTM C39 Compressive Strength • Cylinder break at 7, 14, 28, or 56 days
                </p>
              </div>
            )}

            {recordType === 'fresh_test' ? (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <Input
                  type="date"
                  label="Date"
                  value={freshForm.date}
                  onChange={(e) => setFreshForm({ ...freshForm, date: e.target.value })}
                  required
                  fullWidth
                />
                <Input
                  label="Truck number"
                  value={freshForm.truckNumber}
                  onChange={(e) => setFreshForm({ ...freshForm, truckNumber: e.target.value })}
                  fullWidth
                />
                <Input
                  label="Ticket number"
                  value={freshForm.ticketNumber}
                  onChange={(e) => setFreshForm({ ...freshForm, ticketNumber: e.target.value })}
                  fullWidth
                />
                <Input
                  label="Batch time"
                  value={freshForm.batchTime}
                  onChange={(e) => setFreshForm({ ...freshForm, batchTime: e.target.value })}
                  placeholder="e.g. 7:30 AM"
                  fullWidth
                />
                <Input
                  label="Sample time"
                  value={freshForm.sampleTime}
                  onChange={(e) => setFreshForm({ ...freshForm, sampleTime: e.target.value })}
                  placeholder="e.g. 8:15 AM"
                  fullWidth
                />
                <Input
                  type="number"
                  label="Air temperature (°F)"
                  value={freshForm.temperature}
                  onChange={(e) => setFreshForm({ ...freshForm, temperature: e.target.value })}
                  fullWidth
                />
                <Input
                  type="number"
                  label="Humidity (%)"
                  value={freshForm.humidity}
                  onChange={(e) => setFreshForm({ ...freshForm, humidity: e.target.value })}
                  fullWidth
                />
                <Input
                  type="number"
                  label="Wind speed (mph)"
                  value={freshForm.windSpeed}
                  onChange={(e) => setFreshForm({ ...freshForm, windSpeed: e.target.value })}
                  fullWidth
                />
                <Input
                  type="number"
                  label="Concrete temperature (°F)"
                  value={freshForm.concreteTemperature}
                  onChange={(e) =>
                    setFreshForm({ ...freshForm, concreteTemperature: e.target.value })
                  }
                  fullWidth
                />
                <Input
                  type="number"
                  label="Slump (inches)"
                  value={freshForm.slump}
                  onChange={(e) => setFreshForm({ ...freshForm, slump: e.target.value })}
                  fullWidth
                />
                <Input
                  type="number"
                  label="Air content (%)"
                  value={freshForm.airContent}
                  onChange={(e) => setFreshForm({ ...freshForm, airContent: e.target.value })}
                  fullWidth
                />
                <Input
                  type="number"
                  label="Unit weight (pcf)"
                  value={freshForm.unitWeight}
                  onChange={(e) => setFreshForm({ ...freshForm, unitWeight: e.target.value })}
                  fullWidth
                />
                <Input
                  type="number"
                  label="Cylinders made"
                  value={freshForm.cylindersMade}
                  onChange={(e) => setFreshForm({ ...freshForm, cylindersMade: e.target.value })}
                  fullWidth
                />
                <div className="sm:col-span-2">
                  <Input
                    label="Notes"
                    value={freshForm.notes}
                    onChange={(e) => setFreshForm({ ...freshForm, notes: e.target.value })}
                    fullWidth
                  />
                </div>
              </div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                    Test age (days) *
                  </label>
                  <select
                    value={breakForm.testAgeDays}
                    onChange={(e) => setBreakForm({ ...breakForm, testAgeDays: e.target.value })}
                    required
                    className="w-full rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 px-3 py-2 text-gray-900 dark:text-white"
                  >
                    <option value="7">7-day</option>
                    <option value="14">14-day</option>
                    <option value="28">28-day</option>
                    <option value="56">56-day</option>
                  </select>
                </div>
                <Input
                  type="date"
                  label="Break date"
                  value={breakForm.breakDate}
                  onChange={(e) => setBreakForm({ ...breakForm, breakDate: e.target.value })}
                  required
                  fullWidth
                />
                <Input
                  type="number"
                  label="Break strength (PSI)"
                  value={breakForm.breakStrengthPsi}
                  onChange={(e) =>
                    setBreakForm({ ...breakForm, breakStrengthPsi: e.target.value })
                  }
                  required
                  fullWidth
                />
                <Input
                  label="Cylinder ID"
                  value={breakForm.cylinderId}
                  onChange={(e) => setBreakForm({ ...breakForm, cylinderId: e.target.value })}
                  fullWidth
                />
                <Input
                  type="number"
                  label="Design strength (PSI)"
                  value={breakForm.designStrengthPsi}
                  onChange={(e) =>
                    setBreakForm({ ...breakForm, designStrengthPsi: e.target.value })
                  }
                  fullWidth
                />
                <Input
                  type="number"
                  label="Load (lbs)"
                  value={breakForm.loadLbs}
                  onChange={(e) => setBreakForm({ ...breakForm, loadLbs: e.target.value })}
                  fullWidth
                />
                <Input
                  type="number"
                  label="Average strength (PSI)"
                  value={breakForm.averageStrengthPsi}
                  onChange={(e) =>
                    setBreakForm({ ...breakForm, averageStrengthPsi: e.target.value })
                  }
                  fullWidth
                />
                {showBreakResultOverride && (
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                      Result override
                    </label>
                    <select
                      value={breakForm.breakResult}
                      onChange={(e) =>
                        setBreakForm({
                          ...breakForm,
                          breakResult: e.target.value as BreakFormData['breakResult'],
                        })
                      }
                      className="w-full rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 px-3 py-2 text-gray-900 dark:text-white"
                    >
                      <option value="">Informational (default)</option>
                      <option value="informational">Informational</option>
                      <option value="fail">Fail</option>
                    </select>
                    <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                      Early-age tests below design strength default to informational.
                    </p>
                  </div>
                )}
                <div className="sm:col-span-2">
                  <Input
                    label="Notes"
                    value={breakForm.notes}
                    onChange={(e) => setBreakForm({ ...breakForm, notes: e.target.value })}
                    fullWidth
                  />
                </div>
              </div>
            )}

            <div className="flex justify-end gap-2">
              <Button
                type="button"
                variant="outline"
                onClick={() => {
                  setShowForm(false);
                  setEditingRecord(null);
                  resetForm();
                }}
              >
                Cancel
              </Button>
              <Button type="submit" icon={<Save size={16} />}>
                {editingRecord ? 'Update Record' : 'Save Record'}
              </Button>
            </div>
          </form>
        </Card>
      )}

      {filteredRecords.length === 0 ? (
        <div className={OPS_EMPTY_STATE}>
          <p className={OPS_MUTED}>No QC records found</p>
        </div>
      ) : (
        <div className="space-y-8">
          {freshRecords.length > 0 && (
            <section className="space-y-4">
              <h4 className={`text-sm font-semibold uppercase tracking-wide ${OPS_SECTION_EYEBROW}`}>
                Fresh Concrete Tests
              </h4>
              {freshRecords.map((record) => (
                <FreshRecordCard
                  key={record.id}
                  record={record}
                  onEdit={() => setEditingRecord(record)}
                  onDelete={() => {
                    soundService.play('trash');
                    onDelete(record.id);
                  }}
                />
              ))}
            </section>
          )}

          {breakRecords.length > 0 && (
            <section className="space-y-4">
              <h4 className={`text-sm font-semibold uppercase tracking-wide ${OPS_SECTION_EYEBROW}`}>
                Break Test Results
              </h4>
              {breakRecords.map((record) => (
                <BreakRecordCard
                  key={record.id}
                  record={record}
                  onEdit={() => setEditingRecord(record)}
                  onDelete={() => {
                    soundService.play('trash');
                    onDelete(record.id);
                  }}
                />
              ))}
            </section>
          )}
        </div>
      )}
    </div>
  );
};

function FreshRecordCard({
  record,
  onEdit,
  onDelete,
}: {
  record: QCRecord;
  onEdit: () => void;
  onDelete: () => void;
}) {
  const truckTicket =
    record.truckNumber || record.ticketNumber
      ? [record.truckNumber, record.ticketNumber].filter(Boolean).join(' · ')
      : null;

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -20 }}
      transition={{ duration: 0.2 }}
    >
      <Card className="p-4 hover:shadow-lg transition-shadow">
        <div className="flex flex-col space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-4">
              <h4 className="font-medium text-gray-900 dark:text-white">
                {format(new Date(record.date), 'MMM d, yyyy')}
              </h4>
              {truckTicket && (
                <span className="text-sm text-gray-600 dark:text-gray-400">{truckTicket}</span>
              )}
            </div>
            <div className="flex gap-2">
              <Button variant="ghost" size="sm" onClick={onEdit} icon={<Edit size={16} />} />
              <Button variant="ghost" size="sm" onClick={onDelete} icon={<Trash2 size={16} />} />
            </div>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <Metric label="Slump" value={formatOptional(record.slump, '"')} />
            <Metric label="Air" value={formatOptional(record.airContent, '%')} />
            <Metric
              label="Concrete temp"
              value={formatOptional(record.concreteTemperature ?? record.temperature, '°F')}
            />
            <Metric label="Cylinders" value={formatOptional(record.cylindersMade)} />
          </div>

          {record.notes && (
            <div className="bg-blue-50 dark:bg-blue-900/50 p-3 rounded-lg">
              <p className="text-sm text-blue-900 dark:text-blue-100">{record.notes}</p>
            </div>
          )}
        </div>
      </Card>
    </motion.div>
  );
}

function BreakRecordCard({
  record,
  onEdit,
  onDelete,
}: {
  record: QCRecord;
  onEdit: () => void;
  onDelete: () => void;
}) {
  const displayDate = record.breakDate ?? record.date;

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -20 }}
      transition={{ duration: 0.2 }}
    >
      <Card className="p-4 hover:shadow-lg transition-shadow">
        <div className="flex flex-col space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex flex-wrap items-center gap-2 sm:gap-3">
              <h4 className="font-medium text-gray-900 dark:text-white">
                {record.testAgeDays ?? '—'}-day break
              </h4>
              {record.breakResult && (
                <span
                  className={`text-xs font-semibold uppercase px-2 py-0.5 rounded ${breakResultBadgeClass(record.breakResult)}`}
                >
                  {record.breakResult}
                </span>
              )}
            </div>
            <div className="flex gap-2">
              <Button variant="ghost" size="sm" onClick={onEdit} icon={<Edit size={16} />} />
              <Button variant="ghost" size="sm" onClick={onDelete} icon={<Trash2 size={16} />} />
            </div>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <Metric
              label="Strength"
              value={formatOptional(record.breakStrengthPsi, ' PSI')}
            />
            <Metric
              label="Break date"
              value={
                displayDate
                  ? format(new Date(displayDate), 'MMM d, yyyy')
                  : '—'
              }
            />
            <Metric label="Cylinder ID" value={record.cylinderId ?? '—'} />
            <Metric
              label="Design PSI"
              value={formatOptional(record.designStrengthPsi, ' PSI')}
            />
          </div>

          {record.notes && (
            <div className="bg-violet-50 dark:bg-violet-900/30 p-3 rounded-lg">
              <p className="text-sm text-violet-900 dark:text-violet-100">{record.notes}</p>
            </div>
          )}
        </div>
      </Card>
    </motion.div>
  );
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <div className="bg-gray-50 dark:bg-gray-700 p-3 rounded-lg">
      <span className="text-gray-500 dark:text-gray-400 text-sm">{label}:</span>
      <span className="ml-2 font-medium text-gray-900 dark:text-white">{value}</span>
    </div>
  );
}

export default QCRecords;
