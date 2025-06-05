/**
 * Location utilities for handling geolocation permissions and requests
 * Using Capacitor's native Geolocation plugin for iOS app
 */

import { Geolocation } from '@capacitor/geolocation';
import { Capacitor } from '@capacitor/core';
import { Browser } from '@capacitor/browser';

// Extend Navigator interface for iOS standalone detection
declare global {
  interface Navigator {
    standalone?: boolean;
  }
}

export type LocationPermissionStatus = 'granted' | 'denied' | 'prompt' | 'unknown';

/**
 * Check if geolocation is supported (always true in Capacitor)
 */
export function isGeolocationSupported(): boolean {
  return Capacitor.isNativePlatform();
}

/**
 * Check if the Permissions API is supported
 */
export function isPermissionsAPISupported(): boolean {
  return 'permissions' in navigator;
}

/**
 * Check current geolocation permission status using Capacitor
 */
export async function checkGeolocationPermission(): Promise<LocationPermissionStatus> {
  try {
    const result = await Geolocation.checkPermissions();
    
    // Convert Capacitor permission states to our standard states
    switch (result.location) {
      case 'granted':
        return 'granted';
      case 'denied':
        return 'denied';
      case 'prompt':
      case 'prompt-with-rationale':
        return 'prompt';
      default:
        return 'unknown';
    }
  } catch (error) {
    console.warn('Failed to check geolocation permission:', error);
    return 'unknown';
  }
}

/**
 * Request location permissions using Capacitor
 */
export async function requestLocationPermissions(): Promise<LocationPermissionStatus> {
  try {
    const result = await Geolocation.requestPermissions();
    
    switch (result.location) {
      case 'granted':
        return 'granted';
      case 'denied':
        return 'denied';
      case 'prompt':
      case 'prompt-with-rationale':
        return 'prompt';
      default:
        return 'unknown';
    }
  } catch (error) {
    console.warn('Failed to request geolocation permission:', error);
    return 'unknown';
  }
}

/**
 * Get current position using Capacitor's native geolocation
 */
export async function getCurrentPosition(options?: {
  enableHighAccuracy?: boolean;
  timeout?: number;
  maximumAge?: number;
}): Promise<{
  coords: {
    latitude: number;
    longitude: number;
    accuracy: number;
    altitudeAccuracy?: number | null;
    altitude?: number | null;
    speed?: number | null;
    heading?: number | null;
  };
  timestamp: number;
}> {
  try {
    const defaultOptions = {
      enableHighAccuracy: true,
      timeout: 15000,
      ...options
    };

    const position = await Geolocation.getCurrentPosition(defaultOptions);
    return position;
  } catch (error) {
    console.error('Failed to get current position:', error);
    throw error;
  }
}

/**
 * Get readable address from coordinates using reverse geocoding
 */
export async function reverseGeocode(latitude: number, longitude: number): Promise<string> {
  try {
    const response = await fetch(
      `https://nominatim.openstreetmap.org/reverse?format=json&lat=${latitude}&lon=${longitude}`
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
    // Fallback to coordinates
    return `${latitude.toFixed(4)}, ${longitude.toFixed(4)}`;
  }
}

/**
 * Detect if the device is iOS (always true in iOS Capacitor app)
 */
export function isIOSDevice(): boolean {
  return Capacitor.getPlatform() === 'ios';
}

/**
 * Detect if the app is running as a native app (always true in Capacitor)
 */
export function isPWA(): boolean {
  return false; // Not a PWA, this is a native app
}

/**
 * Open iOS Settings app directly to this app's settings page
 * Uses Capacitor's Browser plugin with app-settings: URL scheme
 */
export async function openIOSLocationSettings(): Promise<boolean> {
  try {
    if (Capacitor.isNativePlatform() && Capacitor.getPlatform() === 'ios') {
      // Use the Browser plugin to open the app's settings page directly
      await Browser.open({ 
        url: 'app-settings:',
        windowName: '_system'
      });
      console.log('Opened iOS app settings using Browser plugin');
      return true;
    }
    return false;
  } catch (error) {
    console.warn('Failed to open iOS settings using Browser plugin:', error);
    // Fallback: still return true to show instructions
    return true;
  }
}

/**
 * Get user-friendly error message for Capacitor geolocation errors
 */
export function getGeolocationErrorMessage(error: any): string {
  // Handle Capacitor-specific error messages
  if (error?.code) {
    switch (error.code) {
      case 'OS-PLUG-GLOC-0007':
        return 'Location Services are disabled on your device. Please enable Location Services in Settings > Privacy & Security > Location Services.';
      case 'OS-PLUG-GLOC-0003':
        return 'Location permission was denied. Please enable location access for this app in Settings.';
      case 'OS-PLUG-GLOC-0001':
        return 'Location request timed out. Please try again.';
      case 'OS-PLUG-GLOC-0002':
        return 'Location information is unavailable. Please try again later.';
      default:
        return error.message || 'Unable to access location. Please check your device settings and try again.';
    }
  }
  
  if (error?.message) {
    const message = error.message.toLowerCase();
    
    if (message.includes('not enabled') || message.includes('disabled')) {
      return 'Location Services are disabled on your device. Please enable Location Services in Settings > Privacy & Security > Location Services.';
    }
    
    if (message.includes('permission') || message.includes('denied')) {
      return 'Location permission denied. Please enable location access in Settings and try again.';
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

/**
 * Check if the error indicates Location Services are disabled system-wide
 */
export function isLocationServicesDisabled(error: any): boolean {
  return error?.code === 'OS-PLUG-GLOC-0007' || 
         error?.message?.includes('Location services are not enabled');
}

/**
 * Check if the error indicates permission was denied
 */
export function isPermissionDenied(error: any): boolean {
  return error?.code === 'OS-PLUG-GLOC-0003' || 
         error?.message?.includes('permission') ||
         error?.message?.includes('denied');
}

/**
 * Check if location permission was previously denied and provide appropriate instructions
 */
export function getLocationInstructions(): {
  isIOS: boolean;
  isPWA: boolean;
  instructions: string[];
  systemInstructions: string[];
} {
  const isIOS = true; // Always iOS in this app
  const pwa = false; // Always native, not PWA
  
  // Instructions for enabling app-specific location permissions
  // These are shown after the Settings app opens directly to the app's page
  const instructions = [
    'In the Settings page that opened, tap "Location"',
    'Select "While Using App" or "Ask Next Time"',
    'Return to this app and tap "Try Again"'
  ];

  // Instructions for enabling system-wide Location Services
  const systemInstructions = [
    'Go to Settings on your iPhone',
    'Tap "Privacy & Security"',
    'Tap "Location Services"',
    'Turn ON "Location Services" at the top',
    'Return to this app and tap "Try Again"'
  ];

  return { isIOS, isPWA: pwa, instructions, systemInstructions };
}

/**
 * Watch position changes (for future use)
 */
export async function watchPosition(
  callback: (position: any) => void,
  errorCallback: (error: any) => void,
  options?: {
    enableHighAccuracy?: boolean;
    timeout?: number;
    maximumAge?: number;
  }
): Promise<string> {
  try {
    const watchId = await Geolocation.watchPosition({
      enableHighAccuracy: true,
      timeout: 15000,
      ...options
    }, callback);
    
    return watchId;
  } catch (error) {
    errorCallback(error);
    throw error;
  }
}

/**
 * Clear position watch
 */
export async function clearWatch(watchId: string): Promise<void> {
  try {
    await Geolocation.clearWatch({ id: watchId });
  } catch (error) {
    console.warn('Failed to clear watch:', error);
  }
}

/**
 * Test function to verify iOS settings opening (for debugging)
 */
export function testIOSSettingsOpening(): void {
  if (typeof window !== 'undefined') {
    (window as any).testIOSSettings = async () => {
      console.log('Testing iOS Settings opening...');
      console.log('Device is iOS:', isIOSDevice());
      console.log('App is native:', Capacitor.isNativePlatform());
      
      const success = await openIOSLocationSettings();
      console.log('Settings opening attempted:', success);
    };
    console.log('iOS settings test function available as window.testIOSSettings()');
  }
}

// Auto-register test function in development
if (process.env.NODE_ENV === 'development') {
  testIOSSettingsOpening();
} 