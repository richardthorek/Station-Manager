/**
 * Wiki Context Definition
 *
 * Defines the in-app help/wiki drawer context and its type.
 * Separated from WikiProvider to satisfy React Fast Refresh requirements.
 */

import { createContext } from 'react';

export interface WikiContextValue {
  isOpen: boolean;
  /** Slug shown when the panel opens, or null for the table of contents. */
  activeSlug: string | null;
  /** Opens the help panel, optionally jumping straight to a page. */
  open: (slug?: string) => void;
  close: () => void;
  /** Navigates within an already-open panel (or opens it at that page). */
  navigate: (slug: string) => void;
}

export const WikiContext = createContext<WikiContextValue | null>(null);
