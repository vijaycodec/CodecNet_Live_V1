// PATCH 53: Google reCAPTCHA Enterprise Hook (CWE-306 Fix)
// Custom hook to handle reCAPTCHA Enterprise invisible verification

import { useState, useEffect, useCallback } from 'react';

// reCAPTCHA configuration (Production - codecnet.codecnetworks.in)
const RECAPTCHA_SITE_KEY = '6LcgwAEsAAAAAOt45FtSbnP-NV_WThz1M_5nBMlM';

// Declare grecaptcha type
declare global {
  interface Window {
    grecaptcha: {
      enterprise: {
        ready: (callback: () => void) => void;
        execute: (siteKey: string, options: { action: string }) => Promise<string>;
      };
    };
  }
}

interface UseRecaptchaReturn {
  executeRecaptcha: (action: string) => Promise<string | null>;
  isReady: boolean;
  error: string | null;
}

export function useRecaptcha(): UseRecaptchaReturn {
  const [isReady, setIsReady] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    // Check if reCAPTCHA script is loaded
    const checkRecaptchaReady = () => {
      if (typeof window !== 'undefined' && window.grecaptcha && window.grecaptcha.enterprise) {
        window.grecaptcha.enterprise.ready(() => {
          console.log('✅ [RECAPTCHA] reCAPTCHA Enterprise ready');
          setIsReady(true);
          setError(null);
        });
      } else {
        // Retry after a short delay
        setTimeout(checkRecaptchaReady, 100);
      }
    };

    checkRecaptchaReady();
  }, []);

  const executeRecaptcha = useCallback(
    async (action: string): Promise<string | null> => {
      if (!isReady) {
        const errorMsg = 'reCAPTCHA not ready. Please wait...';
        console.error(`❌ [RECAPTCHA] ${errorMsg}`);
        setError(errorMsg);
        return null;
      }

      try {
        console.log(`🔐 [RECAPTCHA] Executing reCAPTCHA for action: ${action}`);

        const token = await window.grecaptcha.enterprise.execute(RECAPTCHA_SITE_KEY, {
          action: action,
        });

        console.log(`✅ [RECAPTCHA] Token generated successfully`);
        setError(null);
        return token;
      } catch (err) {
        const errorMsg = err instanceof Error ? err.message : 'reCAPTCHA execution failed';
        console.error(`❌ [RECAPTCHA] Execution failed:`, err);
        setError(errorMsg);
        return null;
      }
    },
    [isReady]
  );

  return {
    executeRecaptcha,
    isReady,
    error,
  };
}

// Standalone function to execute reCAPTCHA (non-hook version)
export async function executeRecaptcha(action: string): Promise<string | null> {
  return new Promise((resolve, reject) => {
    if (typeof window === 'undefined' || !window.grecaptcha || !window.grecaptcha.enterprise) {
      reject(new Error('reCAPTCHA not loaded'));
      return;
    }

    window.grecaptcha.enterprise.ready(async () => {
      try {
        const token = await window.grecaptcha.enterprise.execute(RECAPTCHA_SITE_KEY, {
          action: action,
        });
        resolve(token);
      } catch (error) {
        reject(error);
      }
    });
  });
}
