import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import './InstallPrompt.css';

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
}

/**
 * Detects if the current device is a mobile device (iOS or Android)
 */
function isMobileDevice(): boolean {
  const userAgent = navigator.userAgent.toLowerCase();
  const isIOS = /iphone|ipad|ipod/.test(userAgent);
  const isAndroid = /android/.test(userAgent);
  return isIOS || isAndroid;
}

export function InstallPrompt() {
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null);
  const [showPrompt, setShowPrompt] = useState(false);
  const [isInstalled, setIsInstalled] = useState(() =>
    window.matchMedia('(display-mode: standalone)').matches
  );
  const [isRecentlyDismissed, setIsRecentlyDismissed] = useState(() => {
    const dismissed = localStorage.getItem('install-prompt-dismissed');
    if (!dismissed) {
      return false;
    }
    const dismissedTime = parseInt(dismissed, 10);
    const daysSinceDismissed = (Date.now() - dismissedTime) / (1000 * 60 * 60 * 24);
    return daysSinceDismissed < 30;
  });

  useEffect(() => {
    // Only show on mobile devices
    if (!isMobileDevice() || isInstalled || isRecentlyDismissed) {
      return;
    }

    const handleBeforeInstallPrompt = (e: Event) => {
      // Prevent the mini-infobar from appearing on mobile
      e.preventDefault();
      
      // Store the event so it can be triggered later
      setDeferredPrompt(e as BeforeInstallPromptEvent);
      
      // Show the install prompt after a delay
      setTimeout(() => {
        setShowPrompt(true);
      }, 5000); // Show after 5 seconds
    };

    const handleAppInstalled = () => {
      console.log('[InstallPrompt] PWA was installed');
      setIsInstalled(true);
      setShowPrompt(false);
      setDeferredPrompt(null);
    };

    window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
    window.addEventListener('appinstalled', handleAppInstalled);

    return () => {
      window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
      window.removeEventListener('appinstalled', handleAppInstalled);
    };
  }, [isInstalled, isRecentlyDismissed]);

  const handleInstallClick = async () => {
    if (!deferredPrompt) {
      return;
    }

    // Show the install prompt
    await deferredPrompt.prompt();

    // Wait for the user to respond to the prompt
    const { outcome } = await deferredPrompt.userChoice;
    
    console.log(`[InstallPrompt] User response: ${outcome}`);

    // Clear the deferred prompt
    setDeferredPrompt(null);
    setShowPrompt(false);

    if (outcome === 'accepted') {
      console.log('[InstallPrompt] User accepted the install prompt');
    } else {
      // User dismissed, store timestamp
      localStorage.setItem('install-prompt-dismissed', Date.now().toString());
      setIsRecentlyDismissed(true);
    }
  };

  const handleDismiss = () => {
    setShowPrompt(false);
    localStorage.setItem('install-prompt-dismissed', Date.now().toString());
    setIsRecentlyDismissed(true);
  };

  // Don't show if already installed or no prompt available
  if (isInstalled || isRecentlyDismissed || !showPrompt || !deferredPrompt) {
    return null;
  }

  return (
    <AnimatePresence>
      <motion.div
        className="install-prompt-notification"
        initial={{ y: -100, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        exit={{ y: -100, opacity: 0 }}
        transition={{ type: 'spring', stiffness: 300, damping: 30 }}
      >
        <div className="install-prompt-notification__content">
          <div className="install-prompt-notification__icon">
            <img src="/android-chrome-192x192.png" alt="Station Manager" />
          </div>
          <div className="install-prompt-notification__text">
            <strong>Install Station Manager</strong>
            <p>Add to home screen for quick access and offline use</p>
          </div>
        </div>
        
        <div className="install-prompt-notification__actions">
          <button
            className="install-notification-button primary"
            onClick={handleInstallClick}
            aria-label="Install app"
          >
            Install
          </button>
          <button
            className="install-notification-button close"
            onClick={handleDismiss}
            aria-label="Dismiss notification"
          >
            ✕
          </button>
        </div>
      </motion.div>
    </AnimatePresence>
  );
}
