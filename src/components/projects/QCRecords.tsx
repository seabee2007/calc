import React, { useState } from 'react';
import { motion } from 'framer-motion';
import { Plus, Download, Mail, Save, Trash2, Edit } from 'lucide-react';
import { QCRecord } from '../../types';
import Button from '../ui/Button';
import Input from '../ui/Input';
import Card from '../ui/Card';
import { format } from 'date-fns';
import { generateProjectPDF } from '../../utils/pdf';

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
  const [formData, setFormData] = useState({
    date: new Date().toISOString().split('T')[0],
    temperature: '',
    humidity: '',
    slump: '',
    airContent: '',
    cylindersMade: '',
    notes: ''
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSave({
      date: formData.date,
      temperature: parseFloat(formData.temperature),
      humidity: parseFloat(formData.humidity),
      slump: parseFloat(formData.slump),
      airContent: parseFloat(formData.airContent),
      cylindersMade: parseInt(formData.cylindersMade),
      notes: formData.notes
    });
    setShowForm(false);
    setFormData({
      date: new Date().toISOString().split('T')[0],
      temperature: '',
      humidity: '',
      slump: '',
      airContent: '',
      cylindersMade: '',
      notes: ''
    });
  };

  const handleEmailReport = () => {
    const subject = encodeURIComponent('QC Records Report');
    const body = encodeURIComponent(
      `QC Records for Project\n\n${records.map(record => 
        `Date: ${format(new Date(record.date), 'MM/dd/yyyy')}\n` +
        `Temperature: ${record.temperature}°F\n` +
        `Humidity: ${record.humidity}%\n` +
        `Slump: ${record.slump}"\n` +
        `Air Content: ${record.airContent}%\n` +
        `Cylinders Made: ${record.cylindersMade}\n` +
        `Notes: ${record.notes}\n\n`
      ).join('')}`
    );
    window.location.href = `mailto:?subject=${subject}&body=${body}`;
  };

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h3 className="text-xl font-semibold text-gray-900">Quality Control Records</h3>
        <div className="flex gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => setShowForm(true)}
            icon={<Plus size={16} />}
          >
            Add Record
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => generateProjectPDF({ ...records[0], id: projectId })}
            icon={<Download size={16} />}
          >
            Export PDF
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={handleEmailReport}
            icon={<Mail size={16} />}
          >
            Email Report
          </Button>
        </div>
      </div>

      {showForm && (
        <Card className="p-6">
          <form onSubmit={handleSubmit} className="space-y-4">
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
                value={formData.airContent}
                onChange={(e) => setFormData({ ...formData, airContent: e.target.value })}
                required
              />
              <Input
                type="number"
                label="Cylinders Made"
                value={formData.cylindersMade}
                onChange={(e) => setFormData({ ...formData, cylindersMade: e.target.value })}
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
            <div className="flex justify-end gap-2">
              <Button
                type="button"
                variant="outline"
                onClick={() => setShowForm(false)}
              >
                Cancel
              </Button>
              <Button
                type="submit"
                icon={<Save size={16} />}
              >
                Save Record
              </Button>
            </div>
          </form>
        </Card>
      )}

      <div className="space-y-4">
        {records.map((record) => (
          <Card key={record.id} className="p-4">
            <div className="flex justify-between items-start">
              <div className="space-y-2">
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
                  <p className="text-sm text-gray-600">{record.notes}</p>
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
        ))}
      </div>
    </div>
  );
};

export default QCRecords;