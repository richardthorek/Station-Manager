/**
 * Preserved Link Component
 * 
 * Custom Link component that automatically preserves query parameters
 * (especially ?demo=true) when navigating between pages.
 * 
 * Usage: Import this instead of React Router's Link:
 *   import { Link } from './components/PreservedLink';
 * 
 * Or use it explicitly:
 *   <PreservedLink to="/signin">Go to Sign In</PreservedLink>
 */

import { Link as RouterLink, LinkProps } from 'react-router-dom';
import { preserveQueryParams } from '../utils/navigation';

export function PreservedLink(props: LinkProps) {
  const { to, ...rest } = props;
  
  // Convert 'to' to string if it's not already, preserving query params
  const preservedTo = typeof to === 'string' 
    ? preserveQueryParams(to)
    : to; // If it's an object, pass it through (less common case)
  
  return <RouterLink to={preservedTo} {...rest} />;
}

// Export as default for easier import aliasing
export default PreservedLink;
