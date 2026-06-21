import React, { useState, useEffect } from 'react';
import { ArrowUpOnSquareIcon } from '@heroicons/react/24/outline';

export default function IosInstallBanner() {
  const [showBanner, setShowBanner] = useState(false);

  useEffect(() => {
    // Detect iOS
    const isIos = () => {
      const userAgent = window.navigator.userAgent.toLowerCase();
      return /iphone|ipad|ipod/.test(userAgent);
    };
    
    // Detect if running in standalone mode (PWA installed)
    const isInStandaloneMode = () => {
      return (
        ('standalone' in window.navigator && window.navigator.standalone) ||
        window.matchMedia('(display-mode: standalone)').matches
      );
    };

    if (isIos() && !isInStandaloneMode()) {
      setShowBanner(true);
    }
  }, []);

  if (!showBanner) return null;

  return (
    <div className="mb-4 rounded-xl bg-indigo-50 p-4 border border-indigo-100">
      <div className="flex items-start gap-3">
        <div className="flex-1">
          <h3 className="text-sm font-semibold text-indigo-900">Install app for push notifications</h3>
          <p className="mt-1 text-sm text-indigo-700">
            To receive real-time notifications on iOS, tap <ArrowUpOnSquareIcon className="inline h-4 w-4" /> and select <strong>"Add to Home Screen"</strong>.
          </p>
        </div>
        <button 
          onClick={() => setShowBanner(false)}
          className="text-indigo-400 hover:text-indigo-600 text-sm font-semibold"
        >
          Dismiss
        </button>
      </div>
    </div>
  );
}
