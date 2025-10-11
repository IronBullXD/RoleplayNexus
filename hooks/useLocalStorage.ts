import { useState, useEffect, Dispatch, SetStateAction } from 'react';

// Fix: Imported Dispatch and SetStateAction and used them in the return type to resolve React namespace errors.
export function useLocalStorage<T>(
  key: string,
  initialValue: T,
): [T, Dispatch<SetStateAction<T>>] {
  const [storedValue, setStoredValue] = useState<T>(() => {
    try {
      const item = window.localStorage.getItem(key);
      // If no item, return initial value
      if (item === null) {
        return initialValue;
      }
      const parsed = JSON.parse(item);

      // If the initial value is an array, ensure the parsed value is also an array.
      if (Array.isArray(initialValue) && !Array.isArray(parsed)) {
        console.warn(
          `Mismatched type for key "${key}" in localStorage. Expected array, got ${typeof parsed}. Falling back to initial value.`,
        );
        return initialValue;
      }

      // If the initial value is a non-null object (and not an array), ensure the parsed value is also a non-null object.
      if (
        typeof initialValue === 'object' &&
        initialValue !== null &&
        !Array.isArray(initialValue) &&
        (typeof parsed !== 'object' || parsed === null || Array.isArray(parsed))
      ) {
        console.warn(
          `Mismatched type for key "${key}" in localStorage. Expected object, got ${typeof parsed}. Falling back to initial value.`,
        );
        return initialValue;
      }

      // Fix: Added 'as T' to ensure the parsed JSON is correctly typed. This resolves cascading 'unknown' type errors in components using this hook.
      return parsed as T;
    } catch (error) {
      console.error(`Error reading localStorage key “${key}”:`, error);
      return initialValue;
    }
  });

  useEffect(() => {
    try {
      window.localStorage.setItem(key, JSON.stringify(storedValue));
    } catch (error) {
      console.error(`Error setting localStorage key “${key}”:`, error);
    }
  }, [key, storedValue]);

  return [storedValue, setStoredValue];
}
