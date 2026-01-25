import { useState, useEffect } from 'react';

/**
 * Custom hook for managing fade-in visibility state
 * @param delay - Delay in milliseconds before setting visible to true (default: 100)
 * @returns boolean indicating visibility state
 */
export const useFadeInVisibleState = (delay: number = 100): boolean => {
  const [isVisible, setIsVisible] = useState(false);

  useEffect(() => {
    const timer = setTimeout(() => {
      setIsVisible(true);
    }, delay);

    return () => clearTimeout(timer);
  }, [delay]);

  return isVisible;
};
