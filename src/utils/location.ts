/**
 * Browser/PWA location utilities for handling geolocation permissions and requests.
 */

import {
  formatUSAddress,
  parseLegacyUSAddress,
  validateUSAddress,
  type USAddress,
} from '../types/address';
import { verifyJobsiteAddress } from '../services/geocodeService';

declare global {
  interface Navigator {
    standalone?: boolean;
  }
}

export type LocationPermissionStatus = 'granted' | 'denied' | 'prompt' | 'unknown';

export function isGeolocationSupported(): boolean {
  return typeof navigator !== 'undefined' && 'geolocation' in navigator;
}

export function isPermissionsAPISupported(): boolean {
  return typeof navigator !== 'undefined' && 'permissions' in navigator;
}

export async function checkGeolocationPermission(): Promise<LocationPermissionStatus> {
  try {
    if (navigator.permissions) {
      const result = await navigator.permissions.query({
        name: 'geolocation' as PermissionName,
      });

      return result.state as LocationPermissionStatus;
    }

    return 'prompt';
  } catch (error) {
    console.warn('Browser permission check failed:', error);
    return 'prompt';
  }
}

export async function requestLocationPermissions(): Promise<LocationPermissionStatus> {
  // Browsers prompt for permission from getCurrentPosition().
  return 'prompt';
}

export async function getCurrentPosition(options?: {
  enableHighAccuracy?: boolean;
  timeout?: number;
  maximumAge?: number;
}): Promise<GeolocationPosition> {
  return new Promise((resolve, reject) => {
    if (!navigator.geolocation) {
      reject(new Error('Browser geolocation unavailable'));
      return;
    }

    navigator.geolocation.getCurrentPosition(resolve, reject, {
      enableHighAccuracy: true,
      timeout: 15000,
      maximumAge: 0,
      ...options,
    });
  });
}

export interface GeocodedLocation {
  latitude: number;
  longitude: number;
  address: string;
}

/**
 * Forward geocode a US address via Mapbox (Supabase edge function).
 * Accepts a formatted string or structured USAddress.
 */
export async function geocodeAddress(
  query: string | USAddress,
): Promise<GeocodedLocation | null> {
  try {
    if (typeof query !== 'string') {
      const v = validateUSAddress(query, { requireStreet: false });
      if (!v.ok) return null;
      const result = await verifyJobsiteAddress(query);
      return {
        latitude: result.latitude,
        longitude: result.longitude,
        address: result.formattedAddress,
      };
    }

    const trimmed = query.trim();
    if (!trimmed) return null;

    if (trimmed.includes('|')) {
      const parsed = parseLegacyUSAddress(trimmed);
      const v = validateUSAddress(parsed, { requireStreet: false });
      if (!v.ok) return null;
      const result = await verifyJobsiteAddress(parsed);
      return {
        latitude: result.latitude,
        longitude: result.longitude,
        address: result.formattedAddress,
      };
    }

    const result = await verifyJobsiteAddress(trimmed);
    return {
      latitude: result.latitude,
      longitude: result.longitude,
      address: result.formattedAddress,
    };
  } catch (error) {
    console.warn('Geocode failed:', error);
    return null;
  }
}

/** Build a geocode-ready query from partial US address fields. */
export function geocodeQueryFromUSAddress(addr: Partial<USAddress>): string {
  return formatUSAddress(addr);
}

/**
 * Get readable address from coordinates using reverse geocoding.
 */
export async function reverseGeocode(latitude: number, longitude: number): Promise<string> {
  try {
    const response = await fetch(
      `https://nominatim.openstreetmap.org/reverse?format=json&lat=${latitude}&lon=${longitude}`,
    );

    if (!response.ok) {
      throw new Error('Reverse geocoding failed');
    }

    const data = await response.json();
    const address = data.address || {};
    const parts = [address.road, address.city, address.state].filter(Boolean);

    return parts.length > 0 ? parts.join(', ') : `${latitude.toFixed(4)}, ${longitude.toFixed(4)}`;
  } catch (error) {
    console.warn('Reverse geocoding failed:', error);
    return `${latitude.toFixed(4)}, ${longitude.toFixed(4)}`;
  }
}

export function isIOSDevice(): boolean {
  if (typeof navigator === 'undefined') return false;

  const platform = navigator.platform || '';
  const userAgent = navigator.userAgent || '';
  return /iPad|iPhone|iPod/.test(platform) || /iPad|iPhone|iPod/.test(userAgent);
}

export function isPWA(): boolean {
  if (typeof window === 'undefined') return false;

  return (
    window.matchMedia?.('(display-mode: standalone)').matches ||
    window.matchMedia?.('(display-mode: fullscreen)').matches ||
    navigator.standalone === true
  );
}

export async function openIOSLocationSettings(): Promise<boolean> {
  // Browser apps cannot open iOS app settings directly.
  return false;
}

export function getGeolocationErrorMessage(error: any): string {
  if (error?.code) {
    switch (error.code) {
      case error.PERMISSION_DENIED:
      case 1:
        return 'Location permission was denied. Please enable location access in your browser or device settings.';
      case error.POSITION_UNAVAILABLE:
      case 2:
        return 'Location information is unavailable. Please check your device settings and try again.';
      case error.TIMEOUT:
      case 3:
        return 'Location request timed out. Please try again.';
      default:
        return error.message || 'Unable to access location. Please check your device settings and try again.';
    }
  }

  if (error?.message) {
    const message = error.message.toLowerCase();

    if (message.includes('not enabled') || message.includes('disabled')) {
      return 'Location Services are disabled on your device. Please enable Location Services in your browser or device settings.';
    }

    if (message.includes('permission') || message.includes('denied')) {
      return 'Location permission denied. Please enable location access in your browser or device settings and try again.';
    }

    if (message.includes('unavailable')) {
      return 'Location services are unavailable. Please check your device settings and try again.';
    }

    if (message.includes('timeout')) {
      return 'Location request timed out. Please try again.';
    }
  }

  return 'Unable to access location. Please check your device settings and try again.';
}

export function isLocationServicesDisabled(error: any): boolean {
  const message = error?.message?.toLowerCase?.() ?? '';
  return message.includes('location services are not enabled') || message.includes('disabled');
}

export function isPermissionDenied(error: any): boolean {
  const message = error?.message?.toLowerCase?.() ?? '';
  return error?.code === 1 || message.includes('permission') || message.includes('denied');
}

export function getLocationInstructions(): {
  isIOS: boolean;
  isPWA: boolean;
  instructions: string[];
  systemInstructions: string[];
} {
  const isIOS = isIOSDevice();
  const pwa = isPWA();

  const instructions = [
    'Open your browser site settings for Concrete Calc',
    'Allow Location access for this site',
    'Return to Concrete Calc and tap "Try Again"',
  ];

  const systemInstructions = [
    isIOS ? 'Open iOS Settings' : 'Open your device settings',
    isIOS ? 'Tap "Privacy & Security"' : 'Find Location or Privacy settings',
    'Turn ON Location Services',
    'Return to Concrete Calc and tap "Try Again"',
  ];

  return { isIOS, isPWA: pwa, instructions, systemInstructions };
}

export async function watchPosition(
  callback: (position: GeolocationPosition) => void,
  errorCallback: (error: GeolocationPositionError | Error) => void,
  options?: {
    enableHighAccuracy?: boolean;
    timeout?: number;
    maximumAge?: number;
  },
): Promise<string> {
  if (!navigator.geolocation) {
    const error = new Error('Browser geolocation unavailable');
    errorCallback(error);
    throw error;
  }

  const watchId = navigator.geolocation.watchPosition(callback, errorCallback, {
    enableHighAccuracy: true,
    timeout: 15000,
    ...options,
  });

  return String(watchId);
}

export async function clearWatch(watchId: string): Promise<void> {
  try {
    navigator.geolocation?.clearWatch(Number(watchId));
  } catch (error) {
    console.warn('Failed to clear watch:', error);
  }
}
