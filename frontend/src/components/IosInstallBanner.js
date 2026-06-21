import React, { useState, useEffect } from 'react';
const ArrowUpOnSquareIcon = (props) => (
  <svg fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" {...props}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M3 16.5v2.25A2.25 2.25 0 0 0 5.25 21h13.5A2.25 2.25 0 0 0 21 18.75V16.5m-13.5-9L12 3m0 0 4.5 4.5M12 3v13.5" />
  </svg>
);

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
