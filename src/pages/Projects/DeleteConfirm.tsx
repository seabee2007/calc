import React, { useEffect, useRef } from 'react';
import Card from '../../components/ui/Card';
import Button from '../../components/ui/Button';
import { soundService } from '../../services/soundService';

interface DeleteConfirmProps {
  show: boolean;
  type: 'project' | 'calculation' | null;
  onCancel: () => void;
  onConfirm: () => void;
}

export default function DeleteConfirm({ show, type, onCancel, onConfirm }: DeleteConfirmProps) {
  const prevShow = useRef(show);

  useEffect(() => {
    if (show && !prevShow.current) {
      soundService.play('modal');
    }
    prevShow.current = show;
  }, [show]);

  if (!show) return null;

  const handleConfirm = () => {
    // Remove duplicate delete sound - already played when trash icon was clicked
    // soundService.play('trash');
    onConfirm();
  };

  const handleCancel = () => {
    soundService.play('click');
    onCancel();
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <Card className="p-6 max-w-md mx-4">
        <h3 className="text-lg font-semibold mb-4">Confirm Delete</h3>
        <p className="text-gray-600 mb-6">
          Are you sure you want to delete this {type}? This action cannot be undone.
        </p>
        <div className="flex justify-end space-x-3">
          <Button variant="outline" onClick={handleCancel}>
            Cancel
          </Button>
          <Button variant="danger" onClick={handleConfirm}>
            Delete
          </Button>
        </div>
      </Card>
    </div>
  );
}