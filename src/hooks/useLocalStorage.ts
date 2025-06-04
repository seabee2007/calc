import { useState, useEffect } from 'react';

function useLocalStorage<T>(key: string, initialValue: T): [T, (value: T) => void] {
  // Get from local storage then parse stored json or return initialValue
  const readValue = (): T => {
    // Check if we're in a WebView environment
    const isWebView = 'Capacitor' in window;
    
    if (typeof window === 'undefined' || isWebView) {
      return initialValue;
    }

    try {
      const item = window.localStorage.getItem(key);
      return item ? (JSON.parse(item) as T) : initialValue;
    } catch (error) {
      console.warn(`Error reading localStorage key "${key}":`, error);
      return initialValue;
    }
  };

  // State to store our value
  const [storedValue, setStoredValue] = useState<T>(readValue);

  // Return a wrapped version of useState's setter function that persists the new value to localStorage
  const setValue = (value: T): void => {
    try {
      // Allow value to be a function so we have the same API as useState
      const valueToStore = value instanceof Function ? value(storedValue) : value;
      
      // Save state
      setStoredValue(valueToStore);
      
      // Only attempt localStorage in non-WebView environment
      if (typeof window !== 'undefined' && !('Capacitor' in window)) {
        window.localStorage.setItem(key, JSON.stringify(valueToStore));
      }
    } catch (error) {
      console.warn(`Error setting localStorage key "${key}":`, error);
    }
  };

  useEffect(() => {
    // Only add storage event listener in non-WebView environment
    if (typeof window !== 'undefined' && !('Capacitor' in window)) {
      const handleStorageChange = (e: StorageEvent) => {
        if (e.key === key && e.newValue) {
          try {
            setStoredValue(JSON.parse(e.newValue));
          } catch (error) {
            console.warn(`Error parsing storage change for key "${key}":`, error);
          }
        }
      };

      window.addEventListener('storage', handleStorageChange);
      return () => window.removeEventListener('storage', handleStorageChange);
    }
  }, [key]);

  return [storedValue, setValue];
}

export default useLocalStorage;