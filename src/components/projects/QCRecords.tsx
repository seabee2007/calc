import React, { useState, useEffect, useMemo } from 'react';
import { motion } from 'framer-motion';
import {
  Plus, Download, Mail, Save, Trash2, Edit, Search, Calendar
} from 'lucide-react';
import type { QCRecord, QCChecklist } from '../../types';
import Button from '../ui/Button';
import Input from '../ui/Input';
import Card from '../ui/Card';
import { format } from 'date-fns';
import { generateProjectPDF } from '../../utils/pdf';

interface QCRecordsProps {
  projectId: string;
  /** QCRecord[] in camelCase, from parent after normalization */
  records: QCRecord[];
  onSave: (record: Omit<QCRecord, 'id' | 'projectId' | 'createdAt' | 'updatedAt'>) => void;
  onDelete: (recordId: string) => void;
}

const QCRecords: React.FC<QCRecordsProps> = ({
  projectId,
  records,
  onSave,
  onDelete
}) => {
  // State
  const [showForm, setShowForm] = useState(false);
  const [editingRecord, setEditingRecord] = useState<QCRecord | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [dateFilter, setDateFilter] = useState('');
  const [formData, setFormData] = useState<Omit<QCRecord, 'id' | 'projectId' | 'createdAt' | 'updatedAt'>>({
    date: new Date().toISOString().split('T')[0],
    temperature: 0,
    humidity: 0,
    slump: 0,
    airContent: 0,
    cylindersMade: 0,
    notes: '',
    checklist: undefined!  // you can initialize checklist as needed
  });

  // Seed form when editingRecord changes
  useEffect(() => {
    if (!editingRecord) return;
    setFormData({
      date: editingRecord.date,
      temperature: editingRecord.temperature,
      humidity: editingRecord.humidity,
      slump: editingRecord.slump,
      airContent: editingRecord.airContent,
      cylindersMade: editingRecord.cylindersMade,
      notes: editingRecord.notes,
      checklist: editingRecord.checklist!
    });
    setShowForm(true);
  }, [editingRecord]);

  // Reset form to defaults
  const resetForm = () => {
    setFormData({
      date: new Date().toISOString().split('T')[0],
      temperature: 0,
      humidity: 0,
      slump: 0,
      airContent: 0,
      cylindersMade: 0,
      notes: '',
      checklist: {
        rebarSpacingActual: 0,
        rebarSpacingTolerance: 0,
        rebarSpacingPass: false,
        formPressureTestPass: false,
        formAlignmentPass: false,
        formCoverActual: 0,
        formCoverSpec: 0,
        formCoverPass: false,
        subgradePrepElectrical: false,
        elevationConduitInstalled: false,
        dimensionSleevesOK: false,
        compactionPullCordsOK: false,
        capillaryBarrierInstalled: false,
        vaporBarrierOK: false,
        miscInsectDrainRackOK: false,
        subslabPipingInstalled: false,
        floorDrainsOK: false,
        floorDrainsElevation: '',
        floorCleanoutsOK: false,
        floorCleanoutsElevation: '',
        stubupsAlignmentOK: false,
        stubupsType: '',
        bracingOK: false,
        screedBoardsSet: false,
        screedBoardsChecked: false,
        waterStopPlaced: false,
        placingToolsSet: false,
        placingToolsChecked: false,
        finishingToolsSet: false,
        finishingToolsChecked: false,
        curingMaterialsAvailable: false
      }
    });
  };

  // Handle form submit (create or update)
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    await onSave({ ...formData, projectId });
    setShowForm(false);
    setEditingRecord(null);
    resetForm();
  };

  // Filters + sort
  const filteredRecords = useMemo(() => {
    return records
      .filter(r => {
        const term = searchTerm.toLowerCase();
        const matchSearch =
          r.notes?.toLowerCase().includes(term) ||
          r.temperature.toString().includes(term) ||
          r.humidity.toString().includes(term) ||
          r.slump.toString().includes(term) ||
          r.airContent.toString().includes(term) ||
          r.cylindersMade.toString().includes(term);
        const matchDate = !dateFilter || r.date === dateFilter;
        return matchSearch && matchDate;
      })
      .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
  }, [records, searchTerm, dateFilter]);

  // Email report
  const handleEmailReport = () => {
    const body = filteredRecords.map(r =>
      `Date: ${format(new Date(r.date), 'MMM d, yyyy')}\n` +
      `Temperature: ${r.temperature}°F, Humidity: ${r.humidity}%\n` +
      `Slump: ${r.slump}", Air: ${r.airContent}%, Cyl: ${r.cylindersMade}\n` +
      `Notes: ${r.notes}\n\n`
    ).join('');
    window.location.href = `mailto:?subject=QC Records Report&body=${encodeURIComponent(body)}`;
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex justify-between items-center">
        <h3 className="text-xl font-semibold">Quality Control Records</h3>
        <div className="flex gap-2">
          <Button onClick={() => { resetForm(); setEditingRecord(null); setShowForm(true); }} icon={<Plus size={16} />}>
            Add Record
          </Button>
          <Button
            onClick={() => filteredRecords[0] && generateProjectPDF(filteredRecords[0])}
            icon={<Download size={16} />}
          >
            Export PDF
          </Button>
          <Button onClick={handleEmailReport} icon={<Mail size={16} />}>
            Email Report
          </Button>
        </div>
      </div>

      {/* Search & Date Filter */}
      <div className="flex gap-4 bg-white p-4 rounded-lg shadow">
        <div className="flex-1">
          <Input
            placeholder="Search records..."
            value={searchTerm}
            onChange={e => setSearchTerm(e.target.value)}
            icon={<Search className="h-4 w-4 text-gray-400" />}
            fullWidth
          />
        </div>
        <div className="w-48">
          <Input
            type="date"
            value={dateFilter}
            onChange={e => setDateFilter(e.target.value)}
            icon={<Calendar className="h-4 w-4 text-gray-400" />}
            fullWidth
          />
        </div>
      </div>

      {/* Add/Edit Form */}
      {showForm && (
        <Card className="p-6">
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <Input
                type="date"
                label="Date"
                value={formData.date}
                onChange={e => setFormData({ ...formData, date: e.target.value })}
                required
              />
              <Input
                type="number"
                label="Temperature (°F)"
                value={String(formData.temperature)}
                onChange={e => setFormData({ ...formData, temperature: +e.target.value })}
                required
              />
              <Input
                type="number"
                label="Humidity (%)"
                value={String(formData.humidity)}
                onChange={e => setFormData({ ...formData, humidity: +e.target.value })}
                required
              />
              <Input
                type="number"
                label="Slump (inches)"
                value={String(formData.slump)}
                onChange={e => setFormData({ ...formData, slump: +e.target.value })}
                required
              />
              <Input
                type="number"
                label="Air Content (%)"
                value={String(formData.airContent)}
                onChange={e => setFormData({ ...formData, airContent: +e.target.value })}
                required
              />
              <Input
                type="number"
                label="Cylinders Made"
                value={String(formData.cylindersMade)}
                onChange={e => setFormData({ ...formData, cylindersMade: +e.target.value })}
                required
              />
            </div>
            <Input
              label="Notes"
              value={formData.notes}
              onChange={e => setFormData({ ...formData, notes: e.target.value })}
              fullWidth
            />

            {/* You can extend this form with your checklist fields (formData.checklist) */}

            <div className="flex justify-end gap-2">
              <Button type="button" variant="outline" onClick={() => { setShowForm(false); setEditingRecord(null); resetForm(); }}>
                Cancel
              </Button>
              <Button type="submit" icon={<Save size={16} />}>
                {editingRecord ? 'Update Record' : 'Save Record'}
              </Button>
            </div>
          </form>
        </Card>
      )}

      {/* Records List */}
      <div className="space-y-4">
        {filteredRecords.length === 0 ? (
          <div className="text-center py-8 bg-gray-50 rounded-lg">
            <p className="text-gray-500">No QC records found</p>
          </div>
        ) : (
          filteredRecords.map(record => (
            <motion.div
              key={record.id}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              transition={{ duration: 0.2 }}
            >
              <Card className="p-4 hover:shadow-lg transition-shadow">
                <div className="flex justify-between items-start">
                  <div className="space-y-2 flex-1">
                    <div className="flex items-center gap-4">
                      <h4 className="font-medium text-gray-900">
                        {format(new Date(record.date), 'MMM d, yyyy')}
                      </h4>
                      <span className="text-gray-500">|</span>
                      <span className="text-gray-600">{record.temperature}°F</span>
                      <span className="text-gray-500">|</span>
                      <span className="text-gray-600">{record.humidity}% RH</span>
                    </div>
                    <div className="grid grid-cols-3 gap-4 text-sm">
                      <div>
                        <span className="text-gray-500">Slump:</span>
                        <span className="ml-2 text-gray-900">{record.slump}"</span>
                      </div>
                      <div>
                        <span className="text-gray-500">Air Content:</span>
                        <span className="ml-2 text-gray-900">{record.airContent}%</span>
                      </div>
                      <div>
                        <span className="text-gray-500">Cylinders:</span>
                        <span className="ml-2 text-gray-900">{record.cylindersMade}</span>
                      </div>
                    </div>
                    {record.notes && (
                      <p className="text-sm text-gray-600 bg-gray-50 p-2 rounded">
                        {record.notes}
                      </p>
                    )}
                  </div>
                  <div className="flex gap-2">
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => setEditingRecord(record)}
                      icon={<Edit size={16} />}
                    />
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => onDelete(record.id)}
                      icon={<Trash2 size={16} />}
                    />
                  </div>
                </div>
              </Card>
            </motion.div>
          ))
        )}
      </div>
    </div>
  );
};

export default QCRecords;
