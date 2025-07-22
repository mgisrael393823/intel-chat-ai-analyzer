import { useState, useEffect } from 'react';

const MOBILE_BREAKPOINT = 1024; // lg breakpoint - below this is mobile

export const useIsMobile = () => {
  const [isMobile, setIsMobile] = useState(false);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    // Check if window is defined (client-side)
    if (typeof window === 'undefined') {
      setIsLoading(false);
      return;
    }

    const checkIsMobile = () => {
      const width = window.innerWidth;
      const userAgent = navigator.userAgent;
      
      // Combine viewport width and user agent detection
      const isSmallViewport = width < MOBILE_BREAKPOINT;
      const isMobileDevice = /iPhone|iPad|iPod|Android|BlackBerry|Opera Mini|IEMobile|WPDesktop/i.test(userAgent);
      
      // Consider it mobile if either viewport is small OR it's a mobile device
      setIsMobile(isSmallViewport || (isMobileDevice && width < 1200));
      setIsLoading(false);
    };

    // Initial check
    checkIsMobile();

    // Add resize listener with debouncing
    let timeoutId: NodeJS.Timeout;
    const handleResize = () => {
      clearTimeout(timeoutId);
      timeoutId = setTimeout(checkIsMobile, 100);
    };

    window.addEventListener('resize', handleResize);
    
    // Also listen for orientation change on mobile devices
    window.addEventListener('orientationchange', () => {
      setTimeout(checkIsMobile, 200); // Delay to allow for orientation to complete
    });

    return () => {
      window.removeEventListener('resize', handleResize);
      window.removeEventListener('orientationchange', checkIsMobile);
      clearTimeout(timeoutId);
    };
  }, []);

  return { isMobile, isLoading };
};