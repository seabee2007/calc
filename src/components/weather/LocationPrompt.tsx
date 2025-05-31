import React, { useState } from 'react';
import { MapPin } from 'lucide-react';
import Button from '../ui/Button';
import Modal from '../ui/Modal';

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
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');

  const handleGetLocation = () => {
    setIsLoading(true);
    setError('');

    // Check if geolocation is supported
    if (!navigator.geolocation) {
      setError('Geolocation is not supported by your browser');
      setIsLoading(false);
      return;
    }

    // iOS requires high accuracy
    const options = {
      enableHighAccuracy: true,
      timeout: 10000,
      maximumAge: 0
    };

    navigator.geolocation.getCurrentPosition(
      (position) => {
        setIsLoading(false);
        onLocationReceived(position.coords.latitude, position.coords.longitude);
        onClose();
      },
      (error) => {
        setIsLoading(false);
        let errorMsg = 'Unable to retrieve your location. ';
        
        switch (error.code) {
          case error.PERMISSION_DENIED:
            errorMsg += 'Please enable location access in your device settings.';
            break;
          case error.POSITION_UNAVAILABLE:
            errorMsg += 'Location information is unavailable.';
            break;
          case error.TIMEOUT:
            errorMsg += 'Location request timed out.';
            break;
          default:
            errorMsg += 'Please try again.';
        }
        
        setError(errorMsg);
      },
      options
    );
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Get Your Local Weather Data"
    >
      <div className="text-center">
        <div className="bg-blue-50 dark:bg-blue-900/50 p-4 rounded-lg mb-6">
          <p className="text-blue-800 dark:text-blue-200">
            To provide accurate weather-based recommendations, we need access to your location. 
            {navigator.userAgent.includes('iPhone') || navigator.userAgent.includes('iPad') ? 
              ' On iOS devices, you may need to enable location services in Settings > Privacy > Location Services.' : 
              ''}
          </p>
        </div>
        
        <Button
          onClick={handleGetLocation}
          fullWidth
          size="lg"
          isLoading={isLoading}
          icon={<MapPin size={20} />}
          className="shadow-lg hover:shadow-xl transition-shadow"
        >
          Use My Location
        </Button>
        
        {error && (
          <div className="mt-4 p-4 bg-red-50 dark:bg-red-900/50 rounded-lg">
            <p className="text-sm text-red-600 dark:text-red-300">
              {error}
            </p>
            {(error.includes('settings') || error.includes('denied')) && (
              <p className="text-xs text-red-500 dark:text-red-400 mt-2">
                iOS users: Go to Settings &gt; Privacy &amp; Security &gt; Location Services &gt; Safari Websites
              </p>
            )}
          </div>
        )}
      </div>
    </Modal>
  );
};

export default LocationPrompt;