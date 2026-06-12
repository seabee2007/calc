import React, { useState, useEffect, useRef } from 'react';
import { AlertTriangle, MapPin, Settings, RefreshCw, CheckCircle } from 'lucide-react';
import Button from './Button';
import { useLocation } from '../../hooks/useLocation';
import { isIOSDevice, openIOSLocationSettings, getLocationInstructions } from '../../utils/location';
interface LocationPermissionAlertProps {
  onLocationReceived?: (latitude: number, longitude: number) => void;
  onError?: (error: string) => void;
  className?: string;
  compact?: boolean;
}

const LocationPermissionAlert: React.FC<LocationPermissionAlertProps> = ({
  onLocationReceived,
  onError,
  className = '',
  compact = false
}) => {
  const { permission, position, error, isLoading, requestLocation, isSupported, isLocationServicesDisabled, retryAfterSettings } = useLocation();
  const [showInstructions, setShowInstructions] = useState(false);
  const [hasTriedOnce, setHasTriedOnce] = useState(false);
  const [hasOpenedSettings, setHasOpenedSettings] = useState(false);
  const onLocationReceivedRef = useRef(onLocationReceived);
  const onErrorRef = useRef(onError);
  const lastReportedCoordsRef = useRef<{ lat: number; lon: number } | null>(null);
  const lastReportedErrorRef = useRef<string | null>(null);

  onLocationReceivedRef.current = onLocationReceived;
  onErrorRef.current = onError;

  // Detect device context for browser/PWA permission instructions.
  const isIOS = isIOSDevice();

  // Handle successful location — only notify once per coordinate pair
  useEffect(() => {
    if (!position) return;

    const { latitude, longitude } = position.coords;
    const last = lastReportedCoordsRef.current;
    if (last && last.lat === latitude && last.lon === longitude) return;

    lastReportedCoordsRef.current = { lat: latitude, lon: longitude };
    onLocationReceivedRef.current?.(latitude, longitude);
  }, [position]);

  // Handle errors — only notify once per distinct error message
  useEffect(() => {
    if (!error || error === lastReportedErrorRef.current) return;
    lastReportedErrorRef.current = error;
    onErrorRef.current?.(error);
  }, [error]);

  const handleRequestLocation = async () => {
    setHasTriedOnce(true);
    await requestLocation();
  };

  const handleRetryAfterSettings = async () => {
    await retryAfterSettings();
  };

  const handleOpenSettings = async () => {
    if (isIOS) {
      try {
        const success = await openIOSLocationSettings();
        if (success) {
          setShowInstructions(true);
          setHasOpenedSettings(true);
        } else {
          setShowInstructions(true);
        }
      } catch (error) {
        console.warn('Failed to open settings:', error);
        setShowInstructions(true);
      }
    } else {
      setShowInstructions(true);
    }
  };

  const { instructions, systemInstructions } = getLocationInstructions();

  // Don't show if geolocation is not supported
  if (!isSupported) {
    return (
      <div className={`bg-red-50 dark:bg-red-900/30 border border-red-200 dark:border-red-800 rounded-lg p-4 ${className}`}>
        <div className="flex items-center">
          <AlertTriangle className="h-5 w-5 text-red-600 dark:text-red-400 mr-3" />
          <div>
            <p className="text-red-800 dark:text-red-200 font-medium">Location Not Supported</p>
            <p className="text-red-700 dark:text-red-300 text-sm mt-1">
              Location services are not available on this device.
            </p>
          </div>
        </div>
      </div>
    );
  }

  // Show success state when location is available
  if (position && !error) {
    if (compact) {
      return (
        <div className={`bg-green-50 dark:bg-green-900/30 border border-green-200 dark:border-green-800 rounded-lg p-3 ${className}`}>
          <div className="flex items-center">
            <CheckCircle className="h-4 w-4 text-green-600 dark:text-green-400 mr-2" />
            <span className="text-green-800 dark:text-green-200 text-sm font-medium">Location enabled</span>
          </div>
        </div>
      );
    }
    return null; // Don't show the full alert when location is working
  }

  // Determine the error type and appropriate messaging
  const isSystemDisabled = isLocationServicesDisabled;
  const isAppPermissionDenied = permission === 'denied' && !isSystemDisabled;

  return (
    <div className={`bg-yellow-50 dark:bg-yellow-900/25 border border-yellow-200 dark:border-yellow-800 rounded-lg p-4 ${className}`}>
      <div className="flex items-start">
        <div className="flex-shrink-0">
          <AlertTriangle className="h-5 w-5 text-yellow-600 dark:text-yellow-400 mt-0.5" />
        </div>
        
        <div className="ml-3 flex-1">
          <h3 className="text-yellow-800 dark:text-yellow-100 font-medium text-sm">
            {isSystemDisabled 
              ? 'Location Services Disabled'
              : isAppPermissionDenied
              ? 'Location Access Required'
              : 'Enable Location Services'
            }
          </h3>
          
          <div className="mt-2 text-yellow-700 dark:text-yellow-200 text-sm">
            {isSystemDisabled ? (
              <p>
                Location Services are turned off system-wide on your device. You need to enable 
                Location Services in your iPhone Settings first.
              </p>
            ) : isAppPermissionDenied ? (
              <p>
                Location permission was denied for this app. Please enable location access in your device settings 
                to get weather data and find nearby concrete suppliers.
              </p>
            ) : (
              <p>
                This app needs access to your location to provide weather-based concrete mix 
                recommendations and find nearby suppliers.
              </p>
            )}
          </div>

          {error && (
            <div className="mt-2 text-red-700 dark:text-red-200 text-sm bg-red-50 dark:bg-red-900/30 border border-red-200 dark:border-red-800 rounded p-2">
              {error}
            </div>
          )}

          <div className="mt-3 flex flex-col sm:flex-row gap-2">
            {!isSystemDisabled && permission !== 'denied' ? (
              <Button
                onClick={handleRequestLocation}
                disabled={isLoading}
                size="sm"
                className="bg-yellow-600 hover:bg-yellow-700 text-white"
              >
                {isLoading ? (
                  <>
                    <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
                    Getting Location...
                  </>
                ) : (
                  <>
                    <MapPin className="h-4 w-4 mr-2" />
                    Enable Location
                  </>
                )}
              </Button>
            ) : (
              <Button
                onClick={handleOpenSettings}
                size="sm"
                variant="outline"
                className="border-yellow-600 text-yellow-700 hover:bg-yellow-50 dark:border-yellow-500 dark:text-yellow-200 dark:hover:bg-yellow-900/40"
              >
                <Settings className="h-4 w-4 mr-2" />
                {isSystemDisabled ? 'Open Settings' : 'Open App Settings'}
              </Button>
            )}

            {hasOpenedSettings && (isSystemDisabled || isAppPermissionDenied) && (
              <Button
                variant="primary"
                size="sm"
                onClick={handleRetryAfterSettings}
                disabled={isLoading}
                isLoading={isLoading}
              >
                {isLoading ? (
                  <>
                    <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
                    Checking...
                  </>
                ) : (
                  <>
                    <RefreshCw className="h-4 w-4 mr-2" />
                    Try Again
                  </>
                )}
              </Button>
            )}

            {(hasTriedOnce || isSystemDisabled || isAppPermissionDenied) && (
              <Button
                onClick={() => setShowInstructions(!showInstructions)}
                variant="ghost"
                size="sm"
                className="text-yellow-700 hover:text-yellow-800 hover:bg-yellow-100 dark:text-yellow-200 dark:hover:text-yellow-100 dark:hover:bg-yellow-900/40"
              >
                {showInstructions ? 'Hide' : 'Show'} Instructions
              </Button>
            )}
          </div>

          {showInstructions && (
            <div className="mt-4 p-3 bg-yellow-100 dark:bg-yellow-900/40 border border-yellow-300 dark:border-yellow-700 rounded-lg">
              <h4 className="font-medium text-yellow-800 dark:text-yellow-100 text-sm mb-2">
                {isSystemDisabled 
                  ? 'How to enable Location Services:'
                  : hasOpenedSettings 
                  ? 'Complete these steps in the Settings app:'
                  : 'Tap the button above to open Settings, then:'
                }
              </h4>
              <ol className="text-yellow-700 dark:text-yellow-200 text-sm space-y-1">
                {(isSystemDisabled ? systemInstructions : instructions).map((instruction, index) => (
                  <li key={index} className="flex items-start">
                    <span className="font-medium mr-2 text-yellow-600 dark:text-yellow-400 min-w-[1.5rem]">
                      {index + 1}.
                    </span>
                    <span>{instruction}</span>
                  </li>
                ))}
              </ol>
              {isSystemDisabled && (
                <div className="mt-3 pt-3 border-t border-yellow-300 dark:border-yellow-700">
                  <p className="text-yellow-700 dark:text-yellow-200 text-xs">
                    📌 <strong>Important:</strong> After enabling Location Services, you may also need to 
                    enable location access for this specific app.
                  </p>
                </div>
              )}
              <div className="mt-3 pt-3 border-t border-yellow-300 dark:border-yellow-700">
                <p className="text-yellow-700 dark:text-yellow-200 text-xs">
                  💡 After making changes in Settings, return to this app and the location should work automatically.
                </p>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default LocationPermissionAlert; 