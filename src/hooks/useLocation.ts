import { useState, useEffect, useCallback, useRef } from 'react';
import { 
  getCurrentPosition, 
  checkGeolocationPermission, 
  requestLocationPermissions,
  getGeolocationErrorMessage,
  isGeolocationSupported,
  isLocationServicesDisabled,
  isPermissionDenied
} from '../utils/location';

export interface LocationState {
  permission: 'granted' | 'denied' | 'prompt' | 'unknown';
  position: any | null; // Using Capacitor's position type
  error: string | null;
  isLoading: boolean;
  isLocationServicesDisabled: boolean; // New flag for system-level disabled
}

export interface LocationHookResult extends LocationState {
  requestLocation: () => Promise<any | null>;
  checkPermission: () => Promise<'granted' | 'denied' | 'prompt' | 'unknown'>;
  retryAfterSettings: () => Promise<any | null>; // New function to retry after visiting Settings
  isSupported: boolean;
}

export function useLocation(): LocationHookResult {
  const [state, setState] = useState<LocationState>({
    permission: 'unknown',
    position: null,
    error: null,
    isLoading: false,
    isLocationServicesDisabled: false
  });

  // Use ref to track if Location Services are disabled to avoid polling
  const locationServicesDisabledRef = useRef(false);

  // Check if geolocation is supported (always true in Capacitor)
  const isSupported = isGeolocationSupported();

  // Check permission status using Capacitor API
  const checkPermission = useCallback(async (): Promise<'granted' | 'denied' | 'prompt' | 'unknown'> => {
    try {
      const permission = await checkGeolocationPermission();
      setState(prev => ({ ...prev, permission, isLocationServicesDisabled: false }));
      locationServicesDisabledRef.current = false;
      return permission;
    } catch (error) {
      // Check if Location Services are disabled system-wide
      if (isLocationServicesDisabled(error)) {
        setState(prev => ({ 
          ...prev, 
          permission: 'denied',
          isLocationServicesDisabled: true,
          error: getGeolocationErrorMessage(error)
        }));
        locationServicesDisabledRef.current = true;
        return 'denied';
      }
      
      console.warn('Permission check failed:', error);
      setState(prev => ({ ...prev, permission: 'unknown', isLocationServicesDisabled: false }));
      locationServicesDisabledRef.current = false;
      return 'unknown';
    }
  }, []);

  // Request location with enhanced error handling using Capacitor
  const requestLocation = useCallback(async (): Promise<any | null> => {
    if (!isSupported) {
      const errorMsg = 'Geolocation is not supported';
      setState(prev => ({ ...prev, error: errorMsg, isLoading: false }));
      return null;
    }

    setState(prev => ({ ...prev, isLoading: true, error: null }));

    try {
      // Check permission first
      const permission = await checkPermission();
      
      // If Location Services are disabled system-wide, don't continue
      if (locationServicesDisabledRef.current) {
        setState(prev => ({ ...prev, isLoading: false }));
        return null;
      }
      
      // If permission is denied, try to request it
      if (permission === 'denied' || permission === 'prompt') {
        const newPermission = await requestLocationPermissions();
        setState(prev => ({ ...prev, permission: newPermission }));
        
        if (newPermission !== 'granted') {
          const errorMsg = 'Location permission denied. Please enable location access in Settings and try again.';
          setState(prev => ({ ...prev, error: errorMsg, isLoading: false }));
          return null;
        }
      }

      const options = {
        enableHighAccuracy: true,
        timeout: 15000,
        maximumAge: 0 // Always get fresh location
      };

      const position = await getCurrentPosition(options);
      
      setState(prev => ({ 
        ...prev, 
        position, 
        permission: 'granted',
        isLoading: false,
        error: null,
        isLocationServicesDisabled: false
      }));
      locationServicesDisabledRef.current = false;
      
      return position;
    } catch (error) {
      console.error('Location request failed:', error);
      
      const errorMsg = getGeolocationErrorMessage(error);
      let permission: 'granted' | 'denied' | 'prompt' | 'unknown' = 'unknown';
      let locationServicesDisabled = false;
      
      if (isLocationServicesDisabled(error)) {
        permission = 'denied';
        locationServicesDisabled = true;
        locationServicesDisabledRef.current = true;
      } else if (isPermissionDenied(error)) {
        permission = 'denied';
      }
      
      setState(prev => ({ 
        ...prev, 
        error: errorMsg, 
        permission,
        isLoading: false,
        isLocationServicesDisabled: locationServicesDisabled
      }));
      
      return null;
    }
  }, [isSupported, checkPermission]);

  // Manual retry function for when user returns from Settings
  const retryAfterSettings = useCallback(async (): Promise<any | null> => {
    // Reset the disabled state and try again
    locationServicesDisabledRef.current = false;
    setState(prev => ({ ...prev, isLocationServicesDisabled: false, error: null }));
    
    // Try to get location again
    return await requestLocation();
  }, [requestLocation]);

  // Monitor permission changes by checking periodically (but less frequently)
  useEffect(() => {
    // Check initial permission
    checkPermission();
    
    // Set up periodic permission checking for when user returns from Settings
    const intervalId = setInterval(async () => {
      // Skip checking if we know Location Services are disabled system-wide
      if (locationServicesDisabledRef.current) {
        return;
      }
      
      const currentPermission = await checkPermission();
      
      setState(prev => {
        // If permission was granted and it was previously denied, automatically retry location
        if (currentPermission === 'granted' && prev.permission === 'denied' && !prev.isLoading && !locationServicesDisabledRef.current) {
          // Use setTimeout to avoid calling requestLocation during setState
          setTimeout(() => requestLocation(), 100);
        }
        return { ...prev, permission: currentPermission };
      });
    }, 5000); // Check every 5 seconds

    return () => clearInterval(intervalId);
  }, [checkPermission, requestLocation]);

  return {
    ...state,
    requestLocation,
    checkPermission,
    retryAfterSettings,
    isSupported
  };
} 