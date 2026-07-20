/**
 * Wiki Hook
 *
 * Custom hook to open/close the in-app help drawer from anywhere in the app.
 * Must be used within a WikiProvider.
 *
 * @example
 * ```tsx
 * function TruckCheckPage() {
 *   const { open } = useWiki();
 *   return <button onClick={() => open('truck-checks')}>Help</button>;
 * }
 * ```
 */

import { useContext } from 'react';
import { WikiContext, type WikiContextValue } from '../contexts/wikiContext';

export function useWiki(): WikiContextValue {
  const context = useContext(WikiContext);
  if (!context) {
    throw new Error('useWiki must be used within a WikiProvider');
  }
  return context;
}
