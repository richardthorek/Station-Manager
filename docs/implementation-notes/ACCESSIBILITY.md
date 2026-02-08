# Accessibility Documentation

## Overview

The RFS Station Manager implements comprehensive accessibility features to ensure the application is usable by everyone, including users with disabilities who rely on assistive technologies.

**Compliance Target**: WCAG 2.1 Level AA

---

## Keyboard Navigation

### Global Shortcuts

| Key | Action |
|-----|--------|
| `Tab` | Move focus forward through interactive elements |
| `Shift + Tab` | Move focus backward through interactive elements |
| `Enter` | Activate focused button or link |
| `Space` | Activate focused button or toggle checkbox |
| `Escape` | Close open modal or dropdown |
| `Arrow Keys` | Navigate within lists and dropdowns (where applicable) |

### Skip Navigation

Press `Tab` on page load to reveal the "Skip to main content" link. Press `Enter` to jump directly to the main content area, bypassing navigation.

---

## Screen Reader Support

### Tested Screen Readers

- **NVDA** (Windows) - Free, open-source
- **JAWS** (Windows) - Commercial
- **VoiceOver** (macOS/iOS) - Built-in
- **TalkBack** (Android) - Built-in (limited testing)

### Live Announcements

The application uses ARIA live regions to announce dynamic changes:

| Event | Politeness | Example |
|-------|-----------|---------|
| Check-in | Polite | "John Smith checked in successfully" |
| Check-out | Polite | "Jane Doe checked out" |
| Member added | Polite | "Success: Alice Johnson added as new member" |
| Import success | Assertive | "Success: 15 members imported successfully" |
| Import failure | Assertive | "Error: Import failed for 3 members" |
| Form errors | Assertive | "Error: Failed to save" |
| Loading states | Polite | "Loading..." (future) |

---

## Modals and Dialogs

### Focus Management

All modal dialogs implement:
- **Focus trap**: Tab cycles through elements within the modal
- **Initial focus**: First interactive element receives focus on open
- **Return focus**: Focus returns to trigger element on close
- **Escape to close**: Pressing `Esc` closes the modal

### ARIA Attributes

Modals include proper ARIA markup:
- `role="dialog"` or `role="alertdialog"` for critical actions
- `aria-modal="true"` to indicate modal behavior
- `aria-labelledby` pointing to modal title
- `aria-describedby` for additional context (when needed)

### Modal Components

- NewEventModal
- BulkImportModal
- UserManagement
- EditStationModal
- CreateStationModal
- DeleteConfirmationDialog
- VehicleManagement

---

## Visual Indicators

### Activity Tags

Activity tags include both color and icons for accessibility:

| Activity | Icon | Color |
|----------|------|-------|
| Training | 📚 | Custom |
| Maintenance | 🔧 | Custom |
| Meeting | 💬 | Custom |
| Incident | 🚨 | Custom |
| Drill | 🎯 | Custom |
| Community Event | 👥 | Custom |
| Admin | 📋 | Custom |
| Default | 📌 | Grey |

Icons are marked with `aria-hidden="true"` so screen readers announce only the text.

### Status Messages

Error and success messages include visual prefixes:
- **Error**: ❌ Error: [message]
- **Success**: ✅ Success: [message]

Messages use appropriate ARIA roles:
- `role="alert"` for errors and critical messages
- `role="status"` for success messages and updates

### Connection Status

The offline indicator shows both visual status (colored dot) and text:
- "Offline - Changes will sync when connected"
- "Syncing..."
- "All changes synced"
- "[N] action(s) pending"

---

## Form Accessibility

### Labels and Controls

All form inputs have associated labels:
- Explicit labels using `htmlFor` and `id` attributes
- `aria-label` for icon-only buttons
- `aria-labelledby` for complex controls

### Error Handling

Form validation errors are announced to screen readers:
- Inline error messages below fields
- `aria-describedby` linking field to error message
- Error announcements via live regions

---

## Page Structure

### Landmarks

Each page includes semantic HTML5 landmarks:
- `<header>` - Page header with navigation
- `<main id="main-content">` - Main content area
- `<footer>` - Footer information
- `<nav>` - Navigation sections

### Headings

Proper heading hierarchy (h1 → h2 → h3) is maintained throughout:
- One `<h1>` per page
- Logical nesting of heading levels
- No skipped levels

---

## Known Issues and Limitations

### Autofocus Usage

Some modals use `autoFocus` to improve UX. This triggers ESLint warnings but is intentional for modal interactions.

### Modal Overlay Interactions

Modal overlays have `role="presentation"` and click handlers to close on backdrop click. This triggers "click-events-have-key-events" warnings, but Escape key functionality is provided as the keyboard alternative.

### Custom Dropdown Components

Some custom dropdowns (StationSelector) use `div` elements with click handlers. These include:
- Proper `role` attributes
- Keyboard event handlers
- Focus management
- ARIA states

---

## Testing Checklist

### Manual Testing

- [ ] Navigate entire application using only keyboard
- [ ] Test with screen reader (NVDA or VoiceOver)
- [ ] Verify all interactive elements are focusable
- [ ] Check focus indicators are visible
- [ ] Test modal focus traps
- [ ] Verify Escape key closes modals
- [ ] Test skip-to-content link
- [ ] Check form validation announcements
- [ ] Test live region announcements (check-in/out)

### Automated Testing

- [x] ESLint with jsx-a11y rules configured
- [ ] axe DevTools browser extension run on all pages
- [ ] axe-core integrated into test suite (future)

### Browser Testing

Test accessibility features in:
- Chrome/Edge + NVDA (Windows)
- Firefox + NVDA (Windows)
- Safari + VoiceOver (macOS)
- Safari + VoiceOver (iOS)
- Chrome + TalkBack (Android)

---

## Resources

### External Resources

- [WCAG 2.1 Guidelines](https://www.w3.org/WAI/WCAG21/quickref/)
- [ARIA Authoring Practices Guide](https://www.w3.org/WAI/ARIA/apg/)
- [WebAIM Screen Reader Testing](https://webaim.org/articles/screenreader_testing/)
- [axe DevTools Browser Extension](https://www.deque.com/axe/devtools/)

### Internal Documentation

- `.github/copilot-instructions.md` - Development guidelines
- `docs/MASTER_PLAN.md` - Project roadmap and issues
- `docs/AS_BUILT.md` - System architecture

---

## Developer Guidelines

### Adding New Components

When creating new components:

1. **Use semantic HTML**: Use `<button>`, `<a>`, `<input>` over `<div>` with click handlers
2. **Add proper labels**: All interactive elements need accessible names
3. **Include keyboard support**: Ensure keyboard-only users can interact
4. **Test with screen reader**: Verify announcements are clear and helpful
5. **Check color contrast**: Ensure text is readable (WCAG AA: 4.5:1 for normal text)

### Modal Component Template

```tsx
import { useFocusTrap } from '../hooks/useFocusTrap';

export function MyModal({ isOpen, onClose }) {
  const modalRef = useFocusTrap<HTMLDivElement>(isOpen);
  
  useEffect(() => {
    if (!isOpen) return;
    
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    
    document.addEventListener('keydown', handleEscape);
    return () => document.removeEventListener('keydown', handleEscape);
  }, [isOpen, onClose]);
  
  if (!isOpen) return null;
  
  return (
    <div className="modal-overlay" onClick={onClose} role="presentation">
      <div
        ref={modalRef}
        className="modal-content"
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-labelledby="modal-title"
      >
        <h2 id="modal-title">Modal Title</h2>
        {/* Modal content */}
      </div>
    </div>
  );
}
```

### Announcing Changes

Use the `announce` utility for dynamic updates:

```tsx
import { announce } from '../utils/announcer';

// Polite announcement (non-urgent)
announce('Member checked in successfully', 'polite');

// Assertive announcement (urgent/error)
announce('Error: Failed to save changes', 'assertive');
```

---

## Contact

For accessibility issues or questions:
- Open an issue on GitHub
- Tag with `accessibility` label
- Provide details about assistive technology used

---

**Last Updated**: February 2026  
**Maintained by**: RFS Station Manager Team
