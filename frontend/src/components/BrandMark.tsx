/**
 * StationKit "SK" monogram tile — the brand mark used in the app shell,
 * admin nav, and launcher headers (replaces the old Bushie Tools flame icon).
 * A styled `<span>`, not an icon, per the design-system handoff (§11).
 */

import './BrandMark.css';

interface BrandMarkProps {
  /** Pixel size of the square tile. Defaults to 32 (header-scale). */
  size?: number;
}

export function BrandMark({ size = 32 }: BrandMarkProps) {
  return (
    <span className="brand-mark" style={{ width: size, height: size }} aria-hidden="true">
      <span className="brand-mark__letters" style={{ fontSize: size * 0.42 }}>SK</span>
      <span className="brand-mark__bar" />
    </span>
  );
}
