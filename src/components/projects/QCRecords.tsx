import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { Plus, Download, Mail, Save, Trash2, Edit, Search, Calendar, Filter } from 'lucide-react';
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
  const [searchTerm, setSearchTerm] = useState('');
  const [dateFilter, setDateFilter] = useState('');
  const [formData, setFormData] = useState({
    date: new Date().toISOString().split('T')[0],
    temperature: '',
    humidity: '',
    slump: '',
    air_content: '',
    cylinders_made: '',
    notes: ''
  });

  // Update form data when editing record changes
  useEffect(() => {
    if (editingRecord) {
      setFormData({
        date: editingRecord.date,
        temperature: editingRecord.temperature.toString(),
        humidity: editingRecord.humidity.toString(),
        slump: editingRecord.slump.toString(),
        air_content: editingRecord.air_content.toString(),
        cylinders_made: editingRecord.cylindersMade.toString(),
        notes: editingRecord.notes || ''
      });
      setShowForm(true);
    }
  }, [editingRecord]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSave({
      date: formData.date,
      temperature: parseFloat(formData.temperature) || 0,
      humidity: parseFloat(formData.humidity) || 0,
      slump: parseFloat(formData.slump) || 0,
      air_content: parseFloat(formData.air_content) || 0,
      cylindersMade: parseInt(formData.cylinders_made) || 0,
      notes: formData.notes
    });
    setShowForm(false);
    setEditingRecord(null);
    setFormData({
      date: new Date().toISOString().split('T')[0],
      temperature: '',
      humidity: '',
      slump: '',
      air_content: '',
      cylinders_made: '',
      notes: ''
    });
  };

  const handleCancel = () => {
    setShowForm(false);
    setEditingRecord(null);
    setFormData({
      date: new Date().toISOString().split('T')[0],
      temperature: '',
      humidity: '',
      slump: '',
      air_content: '',
      cylinders_made: '',
      notes: ''
    });
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
        record.cylindersMade.toString().includes(searchTerm);
      
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

      {/* Search and Filter Bar */}
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

      {/* Records Library */}
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