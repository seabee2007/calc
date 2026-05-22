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
  position: any | null;
  error: string | null;
  isLoading: boolean;
  isLocationServicesDisabled: boolean;
}

export interface LocationHookResult extends LocationState {
  requestLocation: () => Promise<any | null>;
  checkPermission: () => Promise<'granted' | 'denied' | 'prompt' | 'unknown'>;
  retryAfterSettings: () => Promise<any | null>;
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

  const locationServicesDisabledRef = useRef(false);
  const isSupported = isGeolocationSupported();

  const checkPermission = useCallback(async (): Promise<
    'granted' | 'denied' | 'prompt' | 'unknown'
  > => {
    try {
      const permission = await checkGeolocationPermission();

      setState(prev => ({
        ...prev,
        permission,
        isLocationServicesDisabled: false
      }));

      locationServicesDisabledRef.current = false;
      return permission;
    } catch (error) {
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

      console.warn('[Location] Permission check failed:', error);

      setState(prev => ({
        ...prev,
        permission: 'unknown',
        isLocationServicesDisabled: false
      }));

      locationServicesDisabledRef.current = false;
      return 'unknown';
    }
  }, []);

  const requestLocation = useCallback(async (): Promise<any | null> => {
    console.log('[Location] requestLocation called');
    console.log('[Location] isSupported:', isSupported);

    if (!isSupported) {
      const errorMsg = 'Geolocation is not supported';

      setState(prev => ({
        ...prev,
        error: errorMsg,
        isLoading: false
      }));

      return null;
    }

    setState(prev => ({
      ...prev,
      isLoading: true,
      error: null
    }));

    try {
      const permission = await checkPermission();

      console.log('[Location] permission before request:', permission);

      if (locationServicesDisabledRef.current) {
        setState(prev => ({
          ...prev,
          isLoading: false
        }));

        return null;
      }

      if (permission === 'denied' || permission === 'prompt') {
        const newPermission = await requestLocationPermissions();

        console.log('[Location] permission after request:', newPermission);

        setState(prev => ({
          ...prev,
          permission: newPermission
        }));

        if (newPermission === 'denied') {
          const errorMsg =
            'Location permission denied. Please enable location access and try again.';

          setState(prev => ({
            ...prev,
            error: errorMsg,
            isLoading: false
          }));

          return null;
        }
      }

      const options: PositionOptions = {
        enableHighAccuracy: true,
        timeout: 15000,
        maximumAge: 0
      };

      console.log('[Location] requesting current position...');

      const position = await getCurrentPosition(options);

      console.log('[Location] position received:', position);

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
      console.error('[Location] Location request failed:', error);

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

  const retryAfterSettings = useCallback(async (): Promise<any | null> => {
    locationServicesDisabledRef.current = false;

    setState(prev => ({
      ...prev,
      isLocationServicesDisabled: false,
      error: null
    }));

    return await requestLocation();
  }, [requestLocation]);

  useEffect(() => {
    checkPermission();

    const intervalId = setInterval(async () => {
      if (locationServicesDisabledRef.current) {
        return;
      }

      const currentPermission = await checkPermission();

      setState(prev => {
        if (
          currentPermission === 'granted' &&
          prev.permission === 'denied' &&
          !prev.isLoading &&
          !locationServicesDisabledRef.current
        ) {
          setTimeout(() => requestLocation(), 100);
        }

        return {
          ...prev,
          permission: currentPermission
        };
      });
    }, 5000);

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