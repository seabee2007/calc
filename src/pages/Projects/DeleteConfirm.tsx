import React from 'react';
import Card from '../../components/ui/Card';
import Button from '../../components/ui/Button';

interface DeleteConfirmProps {
  show: boolean;
  type: 'project' | 'calculation' | null;
  onCancel: () => void;
  onConfirm: () => void;
}

export default function DeleteConfirm({ show, type, onCancel, onConfirm }: DeleteConfirmProps) {
  if (!show) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <Card className="p-6 max-w-md mx-4">
        <h3 className="text-lg font-semibold mb-4 text-gray-900 dark:text-white">Confirm Delete</h3>
        <p className="text-gray-600 dark:text-gray-300 mb-6">
          Are you sure you want to delete this {type}? This action cannot be undone.
        </p>
        <div className="flex justify-end space-x-3">
          <Button variant="outline" onClick={onCancel}>
            Cancel
          </Button>
          <Button variant="danger" onClick={onConfirm}>
            Delete
          </Button>
        </div>
      </Card>
    </div>
  );
}