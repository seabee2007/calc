import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { Plus, Save, Trash2, Edit, Search, Calendar } from 'lucide-react';
import type { QCRecord } from '../../types';
import Button from '../ui/Button';
import Input from '../ui/Input';
import Card from '../ui/Card';
import { format } from 'date-fns';

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
    airContent: '',
    cylindersMade: '',
    notes: ''
  });

  useEffect(() => {
    if (!editingRecord) return;
    
    setFormData({
      date: editingRecord.date.split('T')[0],
      temperature: editingRecord.temperature.toString(),
      humidity: editingRecord.humidity.toString(),
      slump: editingRecord.slump.toString(),
      airContent: editingRecord.airContent.toString(),
      cylindersMade: editingRecord.cylindersMade.toString(),
      notes: editingRecord.notes || ''
    });
    setShowForm(true);
  }, [editingRecord]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    const payload = {
      date: formData.date,
      temperature: parseFloat(formData.temperature),
      humidity: parseFloat(formData.humidity),
      slump: parseFloat(formData.slump),
      airContent: parseFloat(formData.airContent),
      cylindersMade: parseInt(formData.cylindersMade),
      notes: formData.notes
    };

    await onSave(payload);
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
      airContent: '',
      cylindersMade: '',
      notes: ''
    });
  };

  const filteredRecords = records
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

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <h3 className="text-xl font-semibold text-gray-900 dark:text-white">Quality Control Records</h3>
        <Button 
          onClick={() => { resetForm(); setEditingRecord(null); setShowForm(true); }} 
          icon={<Plus size={16} />}
        >
          Add Record
        </Button>
      </div>

      <div className="flex flex-col sm:flex-row gap-4">
        <div className="flex-1">
          <Input
            placeholder="Search records..."
            value={searchTerm}
            onChange={e => setSearchTerm(e.target.value)}
            icon={<Search className="h-4 w-4 text-gray-400 dark:text-gray-500" />}
            fullWidth
          />
        </div>
        <div className="w-full sm:w-48">
          <Input
            type="date"
            value={dateFilter}
            onChange={e => setDateFilter(e.target.value)}
            icon={<Calendar className="h-4 w-4 text-gray-400 dark:text-gray-500" />}
            fullWidth
          />
        </div>
      </div>

      {showForm && (
        <Card className="p-6">
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <Input
                type="date"
                label="Date"
                value={formData.date}
                onChange={e => setFormData({ ...formData, date: e.target.value })}
                required
                fullWidth
              />
              <Input
                type="number"
                label="Temperature (°F)"
                value={formData.temperature}
                onChange={e => setFormData({ ...formData, temperature: e.target.value })}
                required
                fullWidth
              />
              <Input
                type="number"
                label="Humidity (%)"
                value={formData.humidity}
                onChange={e => setFormData({ ...formData, humidity: e.target.value })}
                required
                fullWidth
              />
              <Input
                type="number"
                label="Slump (inches)"
                value={formData.slump}
                onChange={e => setFormData({ ...formData, slump: e.target.value })}
                required
                fullWidth
              />
              <Input
                type="number"
                label="Air Content (%)"
                value={formData.airContent}
                onChange={e => setFormData({ ...formData, airContent: e.target.value })}
                required
                fullWidth
              />
              <Input
                type="number"
                label="Cylinders Made"
                value={formData.cylindersMade}
                onChange={e => setFormData({ ...formData, cylindersMade: e.target.value })}
                required
                fullWidth
              />
            </div>
            <Input
              label="Notes"
              value={formData.notes}
              onChange={e => setFormData({ ...formData, notes: e.target.value })}
              fullWidth
            />

            <div className="flex justify-end gap-2">
              <Button 
                type="button" 
                variant="outline" 
                onClick={() => { setShowForm(false); setEditingRecord(null); resetForm(); }}
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

      <div className="space-y-4">
        {filteredRecords.length === 0 ? (
          <div className="text-center py-8 bg-gray-50 dark:bg-gray-800 rounded-lg">
            <p className="text-gray-500 dark:text-gray-400">No QC records found</p>
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
                <div className="flex flex-col space-y-4">
                  <div className="flex items-center justify-between">
                    <div className="flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-4">
                      <h4 className="font-medium text-gray-900 dark:text-white">
                        {format(new Date(record.date), 'MMM d, yyyy')}
                      </h4>
                      <div className="flex items-center gap-2 text-gray-600 dark:text-gray-300">
                        <span>{record.temperature}°F</span>
                        <span className="text-gray-300 dark:text-gray-600">|</span>
                        <span>{record.humidity}% RH</span>
                      </div>
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
                        className="text-red-600 hover:text-red-700 dark:text-red-400 dark:hover:text-red-300"
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                    <div className="bg-gray-50 dark:bg-gray-700 p-3 rounded-lg">
                      <span className="text-gray-500 dark:text-gray-400 text-sm">Slump:</span>
                      <span className="ml-2 font-medium text-gray-900 dark:text-white">{record.slump}"</span>
                    </div>
                    <div className="bg-gray-50 dark:bg-gray-700 p-3 rounded-lg">
                      <span className="text-gray-500 dark:text-gray-400 text-sm">Air Content:</span>
                      <span className="ml-2 font-medium text-gray-900 dark:text-white">{record.airContent}%</span>
                    </div>
                    <div className="bg-gray-50 dark:bg-gray-700 p-3 rounded-lg">
                      <span className="text-gray-500 dark:text-gray-400 text-sm">Cylinders:</span>
                      <span className="ml-2 font-medium text-gray-900 dark:text-white">{record.cylindersMade}</span>
                    </div>
                  </div>

                  {record.notes && (
                    <div className="bg-blue-50 dark:bg-blue-900/50 p-3 rounded-lg">
                      <p className="text-sm text-blue-900 dark:text-blue-100">{record.notes}</p>
                    </div>
                  )}
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