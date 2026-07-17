/**
 * Add to Home Screen Button
 * Context-aware shortcut creation that retains device tokens and links to the current feature
 */

import { useState, useEffect } from 'react';
import { useLocation } from 'react-router-dom';
import { getKioskToken } from '../utils/kioskMode';
import { createShortcutLink } from '../utils/shortcutUtils';
import './AddToHomeScreenButton.css';
import { debugLog } from '../utils/debugLog';

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
}

export function AddToHomeScreenButton() {
  const location = useLocation();
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null);
  const [showButton, setShowButton] = useState(false);
  const kioskToken = getKioskToken();
  const shortcutLink = createShortcutLink(location.pathname);

  useEffect(() => {
    const handleBeforeInstallPrompt = (e: Event) => {
      e.preventDefault();
      setDeferredPrompt(e as BeforeInstallPromptEvent);
      setShowButton(true);
    };

    window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt);

    return () => {
      window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
    };
  }, []);

  const handleAddToHomeScreen = async () => {
    if (!deferredPrompt) {
      return;
    }

    try {
      // Show native install prompt
      await deferredPrompt.prompt();
      const { outcome } = await deferredPrompt.userChoice;

      if (outcome === 'accepted') {
        debugLog('[AddToHomeScreen] Shortcut created:', shortcutLink);
      }

      setDeferredPrompt(null);
      setShowButton(false);
    } catch (error) {
      console.error('Error creating home screen shortcut:', error);
    }
  };

  // Only show if install prompt is available
  if (!showButton || !deferredPrompt) {
    return null;
  }

  // Show button in kiosk mode to emphasize that the shortcut will retain access
  const buttonText = kioskToken
    ? `Add "${shortcutLink.shortName}" to Home Screen`
    : 'Add to Home Screen';

  const tooltipText = kioskToken
    ? 'Creates a shortcut that retains device token access'
    : 'Creates a shortcut to this page';

  return (
    <button
      className="add-to-home-screen-btn"
      onClick={handleAddToHomeScreen}
      title={tooltipText}
      aria-label={buttonText}
    >
      <span className="btn-icon">📱</span>
      {buttonText}
    </button>
  );
}
