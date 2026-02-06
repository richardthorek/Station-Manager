import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import './InstallPrompt.css';

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
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
    if (isInstalled || isRecentlyDismissed) {
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
        className="install-prompt-overlay"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        transition={{ duration: 0.3 }}
      >
        <motion.div
          className="install-prompt"
          initial={{ scale: 0.9, y: 20, opacity: 0 }}
          animate={{ scale: 1, y: 0, opacity: 1 }}
          exit={{ scale: 0.9, y: 20, opacity: 0 }}
          transition={{ type: 'spring', stiffness: 300, damping: 30 }}
        >
          <button
            className="install-prompt__close"
            onClick={handleDismiss}
            aria-label="Close install prompt"
          >
            ✕
          </button>

          <div className="install-prompt__icon">
            <img src="/android-chrome-192x192.png" alt="Station Manager" />
          </div>

          <div className="install-prompt__content">
            <h2>Install Station Manager</h2>
            <p>
              Install this app on your device for quick access and offline functionality.
              Works even when you lose connection!
            </p>

            <ul className="install-prompt__features">
              <li>
                <span className="feature-icon">📱</span>
                <span>Quick access from home screen</span>
              </li>
              <li>
                <span className="feature-icon">🔄</span>
                <span>Automatic background updates</span>
              </li>
              <li>
                <span className="feature-icon">📡</span>
                <span>Works offline with sync</span>
              </li>
              <li>
                <span className="feature-icon">🚀</span>
                <span>Faster load times</span>
              </li>
            </ul>
          </div>

          <div className="install-prompt__actions">
            <button
              className="install-button primary"
              onClick={handleInstallClick}
            >
              Install App
            </button>
            <button
              className="install-button secondary"
              onClick={handleDismiss}
            >
              Not Now
            </button>
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
}
