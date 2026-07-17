import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import './animations.css'
import App from './App.tsx'
import { registerSW } from 'virtual:pwa-register'
import { debugLog } from './utils/debugLog';

// Register service worker
const updateSW = registerSW({
  onNeedRefresh() {
    debugLog('[PWA] New content available, reloading...')
    // Auto-reload on update for seamless experience
    updateSW(true)
  },
  onOfflineReady() {
    debugLog('[PWA] App ready to work offline')
  },
  onRegisteredSW(swUrl, registration) {
    debugLog('[PWA] Service worker registered:', swUrl)
    
    // Check for updates every hour
    if (registration) {
      setInterval(() => {
        registration.update()
      }, 60 * 60 * 1000) // 1 hour
    }
  },
  onRegisterError(error) {
    console.error('[PWA] Service worker registration failed:', error)
  },
})

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
