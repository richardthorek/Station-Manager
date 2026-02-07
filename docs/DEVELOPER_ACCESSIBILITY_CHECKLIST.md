# Developer Accessibility Checklist

## RFS Station Manager - Accessibility Guidelines for Developers

Use this checklist when creating or modifying components to ensure accessibility standards are met.

---

## Before You Start

- [ ] Read `docs/ACCESSIBILITY.md` for project standards
- [ ] Review WCAG 2.1 Level AA guidelines for relevant components
- [ ] Check if similar components exist that you can reference
- [ ] Consider keyboard-only users throughout development
- [ ] Consider screen reader users throughout development

---

## Component Development

### Semantic HTML

- [ ] Use semantic HTML5 elements (`<button>`, `<nav>`, `<main>`, `<header>`, `<footer>`)
- [ ] Avoid `<div>` with click handlers - use `<button>` instead
- [ ] Use `<a>` for navigation, `<button>` for actions
- [ ] Use proper heading hierarchy (h1 → h2 → h3, no skipped levels)
- [ ] Use `<label>` elements for all form inputs
- [ ] Use `<fieldset>` and `<legend>` for grouped form controls

**Example:**
```tsx
// ❌ Bad
<div onClick={handleSubmit}>Submit</div>

// ✅ Good
<button type="button" onClick={handleSubmit}>Submit</button>
```

### ARIA Attributes

- [ ] Add `aria-label` to icon-only buttons
- [ ] Use `aria-labelledby` to reference visible text for labels
- [ ] Add `aria-describedby` for additional context (help text, errors)
- [ ] Mark decorative elements with `aria-hidden="true"`
- [ ] Use `role` attributes only when semantic HTML isn't sufficient
- [ ] Don't override native semantics (e.g., `<button role="link">`)

**Example:**
```tsx
// ❌ Bad
<button>✕</button>

// ✅ Good
<button aria-label="Close dialog">
  <span aria-hidden="true">✕</span>
</button>
```

### Keyboard Navigation

- [ ] All interactive elements are keyboard accessible
- [ ] Tab order is logical (follows visual layout)
- [ ] Enter activates buttons and links
- [ ] Space toggles checkboxes and activates buttons
- [ ] Escape closes modals and cancels actions
- [ ] Arrow keys navigate within custom controls (where appropriate)
- [ ] Focus indicators are visible (no `outline: none` without alternative)
- [ ] Avoid keyboard traps (except in modals with focus trap)

**Example:**
```tsx
// ✅ Good - keyboard accessible custom control
<div
  role="button"
  tabIndex={0}
  onClick={handleClick}
  onKeyDown={(e) => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      handleClick();
    }
  }}
>
  Custom Control
</div>
```

---

## Modals and Dialogs

### Focus Management

- [ ] Use `useFocusTrap` hook for focus trapping
- [ ] Focus first interactive element when modal opens
- [ ] Return focus to trigger element when modal closes
- [ ] Tab cycles through modal elements only (no tab out)

**Example:**
```tsx
import { useFocusTrap } from '../hooks/useFocusTrap';

export function MyModal({ isOpen, onClose }) {
  const modalRef = useFocusTrap<HTMLDivElement>(isOpen);
  
  // ...
  
  return (
    <div ref={modalRef} role="dialog" aria-modal="true">
      {/* Modal content */}
    </div>
  );
}
```

### Escape Key

- [ ] Implement Escape key handler to close modal
- [ ] Clean up event listener on unmount
- [ ] Don't close if form submission is in progress

**Example:**
```tsx
useEffect(() => {
  if (!isOpen) return;
  
  const handleEscape = (event: KeyboardEvent) => {
    if (event.key === 'Escape' && !isSubmitting) {
      onClose();
    }
  };
  
  document.addEventListener('keydown', handleEscape);
  return () => document.removeEventListener('keydown', handleEscape);
}, [isOpen, isSubmitting, onClose]);
```

### ARIA for Modals

- [ ] Add `role="dialog"` (or `role="alertdialog"` for critical actions)
- [ ] Add `aria-modal="true"`
- [ ] Add `aria-labelledby` pointing to modal title ID
- [ ] Add `aria-describedby` for additional context (if needed)
- [ ] Add `role="presentation"` to overlay div

**Example:**
```tsx
<div className="modal-overlay" onClick={onClose} role="presentation">
  <div
    ref={modalRef}
    className="modal-content"
    onClick={(e) => e.stopPropagation()}
    role="dialog"
    aria-modal="true"
    aria-labelledby="modal-title"
    aria-describedby="modal-description"
  >
    <h2 id="modal-title">Modal Title</h2>
    <p id="modal-description">Additional context</p>
    {/* Modal content */}
  </div>
</div>
```

---

## Forms

### Labels and Inputs

- [ ] Every input has an associated label
- [ ] Use `htmlFor` and `id` to link labels and inputs
- [ ] Use `aria-label` only when visible label isn't possible
- [ ] Group related inputs with `<fieldset>` and `<legend>`
- [ ] Mark required fields with `*` and indicate in label text

**Example:**
```tsx
// ✅ Good
<div className="form-group">
  <label htmlFor="name">
    Name <span className="required">*</span>
  </label>
  <input
    id="name"
    type="text"
    value={name}
    onChange={(e) => setName(e.target.value)}
    required
  />
</div>
```

### Error Messages

- [ ] Display errors inline near related fields
- [ ] Link errors to fields with `aria-describedby`
- [ ] Announce errors via live regions
- [ ] Include "Error:" prefix for clarity
- [ ] Use `role="alert"` for error messages

**Example:**
```tsx
<div className="form-group">
  <label htmlFor="email">Email</label>
  <input
    id="email"
    type="email"
    value={email}
    onChange={(e) => setEmail(e.target.value)}
    aria-describedby={error ? "email-error" : undefined}
    className={error ? 'error' : ''}
  />
  {error && (
    <span id="email-error" className="field-error" role="alert">
      <span aria-hidden="true">❌ </span>
      Error: {error}
    </span>
  )}
</div>
```

### Validation

- [ ] Validate on submit, not on every keystroke (for better UX)
- [ ] Announce validation errors to screen readers
- [ ] Move focus to first error field on validation failure
- [ ] Clear error when user corrects the field

---

## Live Regions

### When to Use

Use live regions to announce:
- Check-in/check-out events
- Form submission results
- Import/export results
- Loading state changes
- Search result counts
- Real-time updates

### Implementation

- [ ] Use `announce()` utility from `utils/announcer.ts`
- [ ] Use `'polite'` for non-urgent updates
- [ ] Use `'assertive'` for urgent alerts and errors
- [ ] Keep messages concise and clear
- [ ] Include context in announcements

**Example:**
```tsx
import { announce } from '../utils/announcer';

const handleCheckIn = async (memberId: string) => {
  try {
    await api.checkIn(memberId);
    const member = members.find(m => m.id === memberId);
    announce(`${member.name} checked in successfully`, 'polite');
  } catch (err) {
    announce('Error: Failed to check in', 'assertive');
  }
};
```

---

## Visual Design

### Color and Contrast

- [ ] Text has 4.5:1 contrast ratio minimum (WCAG AA for normal text)
- [ ] Large text (18pt+ or 14pt+ bold) has 3:1 ratio minimum
- [ ] Don't rely on color alone to convey information
- [ ] Add icons or text labels in addition to color

**Example:**
```tsx
// ✅ Good - icon + color + text
<span className="status-error">
  <span aria-hidden="true">❌ </span>
  <span>Error: Connection failed</span>
</span>
```

### Focus Indicators

- [ ] All interactive elements have visible focus state
- [ ] Focus indicator has 3:1 contrast with background
- [ ] Don't use `outline: none` without providing alternative
- [ ] Focus indicator is visible in all color modes

**CSS Example:**
```css
/* ✅ Good */
button:focus-visible {
  outline: 2px solid #215e9e;
  outline-offset: 2px;
}
```

---

## Testing

### Manual Testing

- [ ] Tab through entire page - verify tab order
- [ ] Use only keyboard to complete all tasks
- [ ] Test with screen reader (NVDA or VoiceOver)
- [ ] Test modals open/close with Escape
- [ ] Test form submission and validation
- [ ] Verify focus indicators are visible
- [ ] Check skip-to-content link works

### Automated Testing

- [ ] Run ESLint - fix accessibility warnings
- [ ] Run axe DevTools on the page
- [ ] Fix any critical or serious issues
- [ ] Document moderate issues for future work

**Commands:**
```bash
# Lint check
npm run lint

# Fix auto-fixable issues
npm run lint -- --fix
```

### Browser Testing

Test in multiple browsers:
- [ ] Chrome/Edge
- [ ] Firefox
- [ ] Safari
- [ ] Mobile browsers (iOS Safari, Chrome Android)

---

## Common Patterns

### Icon-Only Buttons

```tsx
<button
  type="button"
  onClick={handleClose}
  aria-label="Close dialog"
>
  <span aria-hidden="true">✕</span>
</button>
```

### Status Messages

```tsx
// Success
<div className="success-message" role="status">
  <span aria-hidden="true">✅ </span>
  <span>Success: Operation completed</span>
</div>

// Error
<div className="error-message" role="alert">
  <span aria-hidden="true">❌ </span>
  <span>Error: Operation failed</span>
</div>
```

### Loading States

```tsx
{loading && (
  <div role="status" aria-live="polite">
    <span className="spinner" aria-hidden="true"></span>
    <span>Loading...</span>
  </div>
)}
```

### Skip Link

```tsx
// Already implemented in App.tsx
<a href="#main-content" className="skip-to-content">
  Skip to main content
</a>

// On each page:
<main id="main-content" tabIndex={-1}>
  {/* Page content */}
</main>
```

---

## Anti-Patterns to Avoid

### ❌ Don't Do This

```tsx
// Missing label
<button>✕</button>

// Div with click handler
<div onClick={handleClick}>Click me</div>

// Color-only status
<span style={{ color: 'red' }}>Error</span>

// No keyboard handler
<div onClick={handleClick}>Action</div>

// Removing focus outline
button:focus { outline: none; }

// Positive tabindex
<div tabIndex={1}>Content</div>
```

### ✅ Do This Instead

```tsx
// Labeled button
<button aria-label="Close">
  <span aria-hidden="true">✕</span>
</button>

// Button element
<button type="button" onClick={handleClick}>Click me</button>

// Icon + text
<span className="error">
  <span aria-hidden="true">❌</span> Error: Message
</span>

// Keyboard support
<button onClick={handleClick}>Action</button>

// Custom focus indicator
button:focus-visible {
  outline: 2px solid #215e9e;
}

// No tabindex (or tabIndex={0} / tabIndex={-1})
<div role="button" tabIndex={0}>Content</div>
```

---

## Resources

### Internal

- `docs/ACCESSIBILITY.md` - Project accessibility standards
- `docs/KEYBOARD_SHORTCUTS.md` - Keyboard navigation guide
- `docs/SCREEN_READER_GUIDE.md` - Screen reader user guide
- `.github/copilot-instructions.md` - Development guidelines

### External

- [WCAG 2.1 Quick Reference](https://www.w3.org/WAI/WCAG21/quickref/)
- [ARIA Authoring Practices](https://www.w3.org/WAI/ARIA/apg/)
- [WebAIM Articles](https://webaim.org/articles/)
- [MDN Accessibility](https://developer.mozilla.org/en-US/docs/Web/Accessibility)
- [axe DevTools](https://www.deque.com/axe/devtools/)

---

## Review Checklist

Before submitting PR:

- [ ] All interactive elements are keyboard accessible
- [ ] All images/icons have alt text or aria-hidden
- [ ] All form inputs have labels
- [ ] Modals have focus traps and Escape handlers
- [ ] Color is not the only indicator
- [ ] Focus indicators are visible
- [ ] Live announcements work for dynamic content
- [ ] Tested with keyboard only
- [ ] Tested with screen reader (if possible)
- [ ] ESLint accessibility warnings addressed
- [ ] axe DevTools run shows no critical issues

---

**Remember**: Accessibility is not optional. It's a fundamental requirement for inclusive software.

**Questions?** Refer to `docs/ACCESSIBILITY.md` or ask in the PR review.

---

**Last Updated**: February 2026  
**Version**: 1.0
