import React, { useEffect } from 'react';
import { MapPin } from 'lucide-react';
import Button from '../ui/Button';
import Modal from '../ui/Modal';
import LocationPermissionAlert from '../ui/LocationPermissionAlert';

interface LocationPromptProps {
  isOpen: boolean;
  onClose: () => void;
  onLocationReceived: (latitude: number, longitude: number) => void;
}

const LocationPrompt: React.FC<LocationPromptProps> = ({
  isOpen,
  onClose,
  onLocationReceived
}) => {
  const handleLocationReceived = (latitude: number, longitude: number) => {
    onLocationReceived(latitude, longitude);
    onClose();
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Get Your Local Weather Data"
    >
      <div className="text-center">
        <div className="bg-blue-50 dark:bg-blue-900/30 p-4 rounded-lg mb-6">
          <p className="text-blue-800 dark:text-blue-200">
            To provide accurate weather-based recommendations, we need access to your location.
          </p>
        </div>
        
        <LocationPermissionAlert
          onLocationReceived={handleLocationReceived}
          onError={(error) => console.warn('Location error:', error)}
          compact={false}
        />
      </div>
    </Modal>
  );
};

export default LocationPrompt;