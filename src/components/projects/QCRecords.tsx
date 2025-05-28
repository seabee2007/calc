import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { Plus, Download, Mail, Save, Trash2, Edit, Search, Calendar } from 'lucide-react';
import { QCRecord, QCChecklist } from '../../types';
import Button from '../ui/Button';
import Input from '../ui/Input';
import Card from '../ui/Card';
import Checkbox from '../ui/Checkbox';
import { format } from 'date-fns';
import { generateProjectPDF } from '../../utils/pdf';

const defaultChecklist: QCChecklist = {
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
};

interface QCRecordsProps {
  projectId: string;
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
  const [showForm, setShowForm] = useState(false);
  const [editingRecord, setEditingRecord] = useState<QCRecord | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [dateFilter, setDateFilter] = useState('');
  const [formData, setFormData] = useState({
    date: new Date().toISOString().split('T')[0],
    temperature: '',
    humidity: '',
    slump: '',
    air_content: '',
    cylinders_made: '',
    notes: '',
    checklist: defaultChecklist
  });

  useEffect(() => {
    if (editingRecord) {
      setFormData({
        date: editingRecord.date,
        temperature: (editingRecord.temperature || 0).toString(),
        humidity: (editingRecord.humidity || 0).toString(),
        slump: (editingRecord.slump || 0).toString(),
        air_content: (editingRecord.air_content || 0).toString(),
        cylinders_made: (editingRecord.cylindersMade || 0).toString(),
        notes: editingRecord.notes || '',
        checklist: editingRecord.checklist || defaultChecklist
      });
      setShowForm(true);
    }
  }, [editingRecord]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    const record = {
      date: formData.date,
      temperature: parseFloat(formData.temperature) || 0,
      humidity: parseFloat(formData.humidity) || 0,
      slump: parseFloat(formData.slump) || 0,
      air_content: parseFloat(formData.air_content) || 0,
      cylindersMade: parseInt(formData.cylinders_made) || 0,
      notes: formData.notes,
      checklist: formData.checklist
    };

    await onSave(record);
    setShowForm(false);
    setEditingRecord(null);
    resetForm();
  };

  const resetForm = () => {
    setFormData({
      date: new Date().toISOString().split('T')[0],
      temperature: '',
      humidity: '',
      slump: '',
      air_content: '',
      cylinders_made: '',
      notes: '',
      checklist: defaultChecklist
    });
  };

  const handleCancel = () => {
    setShowForm(false);
    setEditingRecord(null);
    resetForm();
  };

  const handleEmailReport = () => {
    const subject = encodeURIComponent('QC Records Report');
    const body = encodeURIComponent(
      `QC Records for Project\n\n${filteredRecords.map(record => 
        `Date: ${format(new Date(record.date), 'MM/dd/yyyy')}\n` +
        `Temperature: ${record.temperature}°F\n` +
        `Humidity: ${record.humidity}%\n` +
        `Slump: ${record.slump}"\n` +
        `Air Content: ${record.air_content}%\n` +
        `Cylinders Made: ${record.cylindersMade}\n` +
        `Notes: ${record.notes}\n\n`
      ).join('')}`
    );
    window.location.href = `mailto:?subject=${subject}&body=${body}`;
  };

  const filteredRecords = records
    .filter(record => {
      const matchesSearch = 
        record.notes?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        record.temperature.toString().includes(searchTerm) ||
        record.humidity.toString().includes(searchTerm) ||
        record.slump.toString().includes(searchTerm) ||
        record.air_content.toString().includes(searchTerm) ||
        (record.cylindersMade || 0).toString().includes(searchTerm);
      
      const matchesDate = !dateFilter || record.date.includes(dateFilter);
      
      return matchesSearch && matchesDate;
    })
    .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h3 className="text-xl font-semibold text-gray-900">Quality Control Records</h3>
        <div className="flex gap-2">
          <Button
            onClick={() => setShowForm(true)}
            icon={<Plus size={16} />}
          >
            <span className="hidden md:inline">Add Record</span>
          </Button>
          <Button
            onClick={() => generateProjectPDF({ ...records[0], id: projectId })}
            icon={<Download size={16} />}
          >
            <span className="hidden md:inline">Export PDF</span>
          </Button>
          <Button
            onClick={handleEmailReport}
            icon={<Mail size={16} />}
          >
            <span className="hidden md:inline">Email Report</span>
          </Button>
        </div>
      </div>

      <div className="flex gap-4 bg-white p-4 rounded-lg shadow">
        <div className="flex-1">
          <Input
            placeholder="Search records..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            icon={<Search className="h-4 w-4 text-gray-400" />}
            fullWidth
          />
        </div>
        <div className="w-48">
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
          <form onSubmit={handleSubmit} className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <Input
                type="date"
                label="Date"
                value={formData.date}
                onChange={(e) => setFormData({ ...formData, date: e.target.value })}
                required
              />
              <Input
                type="number"
                label="Temperature (°F)"
                value={formData.temperature}
                onChange={(e) => setFormData({ ...formData, temperature: e.target.value })}
                required
              />
              <Input
                type="number"
                label="Humidity (%)"
                value={formData.humidity}
                onChange={(e) => setFormData({ ...formData, humidity: e.target.value })}
                required
              />
              <Input
                type="number"
                label="Slump (inches)"
                value={formData.slump}
                onChange={(e) => setFormData({ ...formData, slump: e.target.value })}
                required
              />
              <Input
                type="number"
                label="Air Content (%)"
                value={formData.air_content}
                onChange={(e) => setFormData({ ...formData, air_content: e.target.value })}
                required
              />
              <Input
                type="number"
                label="Cylinders Made"
                value={formData.cylinders_made}
                onChange={(e) => setFormData({ ...formData, cylinders_made: e.target.value })}
                required
              />
            </div>

            <div>
              <Input
                label="Notes"
                value={formData.notes}
                onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                fullWidth
              />
            </div>

            <div className="border-t pt-6">
              <h4 className="text-lg font-semibold mb-6">Pre-Pour Checklist</h4>

              <section className="mb-6">
                <h5 className="font-medium text-gray-900 mb-4">Reinforcement</h5>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <Input
                    type="number"
                    label="Rebar Spacing (actual)"
                    value={formData.checklist.rebarSpacingActual}
                    onChange={(e) => setFormData({
                      ...formData,
                      checklist: {
                        ...formData.checklist,
                        rebarSpacingActual: parseFloat(e.target.value)
                      }
                    })}
                  />
                  <Input
                    type="number"
                    label="Tolerance ±"
                    value={formData.checklist.rebarSpacingTolerance}
                    onChange={(e) => setFormData({
                      ...formData,
                      checklist: {
                        ...formData.checklist,
                        rebarSpacingTolerance: parseFloat(e.target.value)
                      }
                    })}
                  />
                  <Checkbox
                    label="Pass"
                    checked={formData.checklist.rebarSpacingPass}
                    onChange={(e) => setFormData({
                      ...formData,
                      checklist: {
                        ...formData.checklist,
                        rebarSpacingPass: e.target.checked
                      }
                    })}
                  />
                </div>
              </section>

              <section className="mb-6">
                <h5 className="font-medium text-gray-900 mb-4">Formwork</h5>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-4">
                    <Checkbox
                      label="Pressure Test Pass"
                      checked={formData.checklist.formPressureTestPass}
                      onChange={(e) => setFormData({
                        ...formData,
                        checklist: {
                          ...formData.checklist,
                          formPressureTestPass: e.target.checked
                        }
                      })}
                    />
                    <Checkbox
                      label="Alignment Pass"
                      checked={formData.checklist.formAlignmentPass}
                      onChange={(e) => setFormData({
                        ...formData,
                        checklist: {
                          ...formData.checklist,
                          formAlignmentPass: e.target.checked
                        }
                      })}
                    />
                  </div>
                  <div className="space-y-4">
                    <Input
                      type="number"
                      label="Cover (actual)"
                      value={formData.checklist.formCoverActual}
                      onChange={(e) => setFormData({
                        ...formData,
                        checklist: {
                          ...formData.checklist,
                          formCoverActual: parseFloat(e.target.value)
                        }
                      })}
                    />
                    <Input
                      type="number"
                      label="Cover (spec)"
                      value={formData.checklist.formCoverSpec}
                      onChange={(e) => setFormData({
                        ...formData,
                        checklist: {
                          ...formData.checklist,
                          formCoverSpec: parseFloat(e.target.value)
                        }
                      })}
                    />
                    <Checkbox
                      label="Cover Pass"
                      checked={formData.checklist.formCoverPass}
                      onChange={(e) => setFormData({
                        ...formData,
                        checklist: {
                          ...formData.checklist,
                          formCoverPass: e.target.checked
                        }
                      })}
                    />
                  </div>
                </div>
              </section>

              <section className="mb-6">
                <h5 className="font-medium text-gray-900 mb-4">Subgrade & Utilities</h5>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-4">
                    <Checkbox
                      label="Subgrade Prep (Electrical)"
                      checked={formData.checklist.subgradePrepElectrical}
                      onChange={(e) => setFormData({
                        ...formData,
                        checklist: {
                          ...formData.checklist,
                          subgradePrepElectrical: e.target.checked
                        }
                      })}
                    />
                    <Checkbox
                      label="Conduit Installed"
                      checked={formData.checklist.elevationConduitInstalled}
                      onChange={(e) => setFormData({
                        ...formData,
                        checklist: {
                          ...formData.checklist,
                          elevationConduitInstalled: e.target.checked
                        }
                      })}
                    />
                    <Checkbox
                      label="Sleeves OK"
                      checked={formData.checklist.dimensionSleevesOK}
                      onChange={(e) => setFormData({
                        ...formData,
                        checklist: {
                          ...formData.checklist,
                          dimensionSleevesOK: e.target.checked
                        }
                      })}
                    />
                    <Checkbox
                      label="Pull Cords OK"
                      checked={formData.checklist.compactionPullCordsOK}
                      onChange={(e) => setFormData({
                        ...formData,
                        checklist: {
                          ...formData.checklist,
                          compactionPullCordsOK: e.target.checked
                        }
                      })}
                    />
                  </div>
                  <div className="space-y-4">
                    <Checkbox
                      label="Capillary Barrier"
                      checked={formData.checklist.capillaryBarrierInstalled}
                      onChange={(e) => setFormData({
                        ...formData,
                        checklist: {
                          ...formData.checklist,
                          capillaryBarrierInstalled: e.target.checked
                        }
                      })}
                    />
                    <Checkbox
                      label="Vapor Barrier"
                      checked={formData.checklist.vaporBarrierOK}
                      onChange={(e) => setFormData({
                        ...formData,
                        checklist: {
                          ...formData.checklist,
                          vaporBarrierOK: e.target.checked
                        }
                      })}
                    />
                    <Checkbox
                      label="Insect/Drain Rack"
                      checked={formData.checklist.miscInsectDrainRackOK}
                      onChange={(e) => setFormData({
                        ...formData,
                        checklist: {
                          ...formData.checklist,
                          miscInsectDrainRackOK: e.target.checked
                        }
                      })}
                    />
                    <Checkbox
                      label="Sub-slab Piping"
                      checked={formData.checklist.subslabPipingInstalled}
                      onChange={(e) => setFormData({
                        ...formData,
                        checklist: {
                          ...formData.checklist,
                          subslabPipingInstalled: e.target.checked
                        }
                      })}
                    />
                  </div>
                </div>
              </section>

              <section className="mb-6">
                <h5 className="font-medium text-gray-900 mb-4">Embedded Items</h5>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-4">
                    <Checkbox
                      label="Floor Drains OK"
                      checked={formData.checklist.floorDrainsOK}
                      onChange={(e) => setFormData({
                        ...formData,
                        checklist: {
                          ...formData.checklist,
                          floorDrainsOK: e.target.checked
                        }
                      })}
                    />
                    <Input
                      label="Drains Elevation"
                      value={formData.checklist.floorDrainsElevation}
                      onChange={(e) => setFormData({
                        ...formData,
                        checklist: {
                          ...formData.checklist,
                          floorDrainsElevation: e.target.value
                        }
                      })}
                    />
                  </div>
                  <div className="space-y-4">
                    <Checkbox
                      label="Floor Cleanouts OK"
                      checked={formData.checklist.floorCleanoutsOK}
                      onChange={(e) => setFormData({
                        ...formData,
                        checklist: {
                          ...formData.checklist,
                          floorCleanoutsOK: e.target.checked
                        }
                      })}
                    />
                    <Input
                      label="Cleanouts Elevation"
                      value={formData.checklist.floorCleanoutsElevation}
                      onChange={(e) => setFormData({
                        ...formData,
                        checklist: {
                          ...formData.checklist,
                          floorCleanoutsElevation: e.target.value
                        }
                      })}
                    />
                  </div>
                </div>
              </section>

              <section className="mb-6">
                <h5 className="font-medium text-gray-900 mb-4">Bracing & Equipment</h5>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div className="space-y-4">
                    <Checkbox
                      label="Bracing OK"
                      checked={formData.checklist.bracingOK}
                      onChange={(e) => setFormData({
                        ...formData,
                        checklist: {
                          ...formData.checklist,
                          bracingOK: e.target.checked
                        }
                      })}
                    />
                    <Checkbox
                      label="Screed Boards Set"
                      checked={formData.checklist.screedBoardsSet}
                      onChange={(e) => setFormData({
                        ...formData,
                        checklist: {
                          ...formData.checklist,
                          screedBoardsSet: e.target.checked
                        }
                      })}
                    />
                    <Checkbox
                      label="Screed Checked"
                      checked={formData.checklist.screedBoardsChecked}
                      onChange={(e) => setFormData({
                        ...formData,
                        checklist: {
                          ...formData.checklist,
                          screedBoardsChecked: e.target.checked
                        }
                      })}
                    />
                  </div>
                  <div className="space-y-4">
                    <Checkbox
                      label="Water Stop Placed"
                      checked={formData.checklist.waterStopPlaced}
                      onChange={(e) => setFormData({
                        ...formData,
                        checklist: {
                          ...formData.checklist,
                          waterStopPlaced: e.target.checked
                        }
                      })}
                    />
                    <Checkbox
                      label="Placing Tools Set"
                      checked={formData.checklist.placingToolsSet}
                      onChange={(e) => setFormData({
                        ...formData,
                        checklist: {
                          ...formData.checklist,
                          placingToolsSet: e.target.checked
                        }
                      })}
                    />
                    <Checkbox
                      label="Placing Tools OK"
                      checked={formData.checklist.placingToolsChecked}
                      onChange={(e) => setFormData({
                        ...formData,
                        checklist: {
                          ...formData.checklist,
                          placingToolsChecked: e.target.checked
                        }
                      })}
                    />
                  </div>
                  <div className="space-y-4">
                    <Checkbox
                      label="Finishing Tools Set"
                      checked={formData.checklist.finishingToolsSet}
                      onChange={(e) => setFormData({
                        ...formData,
                        checklist: {
                          ...formData.checklist,
                          finishingToolsSet: e.target.checked
                        }
                      })}
                    />
                    <Checkbox
                      label="Finishing Tools OK"
                      checked={formData.checklist.finishingToolsChecked}
                      onChange={(e) => setFormData({
                        ...formData,
                        checklist: {
                          ...formData.checklist,
                          finishingToolsChecked: e.target.checked
                        }
                      })}
                    />
                    <Checkbox
                      label="Curing Materials"
                      checked={formData.checklist.curingMaterialsAvailable}
                      onChange={(e) => setFormData({
                        ...formData,
                        checklist: {
                          ...formData.checklist,
                          curingMaterialsAvailable: e.target.checked
                        }
                      })}
                    />
                  </div>
                </div>
              </section>
            </div>

            <div className="flex justify-end gap-2">
              <Button
                type="button"
                variant="outline"
                onClick={handleCancel}
              >
                Cancel
              </Button>
              <Button
                type="submit"
                icon={<Save size={16} />}
              >
                {editingRecord ? 'Update Record' : 'Save Record'}
              </Button>
            </div>
          </form>
        </Card>
      )}

      <div className="space-y-4">
        {filteredRecords.length === 0 ? (
          <div className="text-center py-8 bg-gray-50 rounded-lg">
            <p className="text-gray-500">No QC records found</p>
          </div>
        ) : (
          filteredRecords.map((record) => (
            <motion.div
              key={record.id}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              transition={{ duration: 0.2 }}
            >
              <Card key={record.id} className="p-4 hover:shadow-lg transition-shadow">
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
                        <span className="ml-2 text-gray-900">{record.air_content}%</span>
                      </div>
                      <div>
                        <span className="text-gray-500">Cylinders:</span>
                        <span className="ml-2 text-gray-900">{record.cylindersMade || 0}</span>
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