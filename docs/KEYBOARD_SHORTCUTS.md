# Keyboard Shortcuts Guide

## RFS Station Manager - Keyboard Navigation

This guide covers all keyboard shortcuts available in the RFS Station Manager application.

---

## Global Shortcuts

### Navigation

| Shortcut | Action | Notes |
|----------|--------|-------|
| `Tab` | Move to next interactive element | Cycles through buttons, links, form fields |
| `Shift + Tab` | Move to previous interactive element | Goes backward through tab order |
| `Enter` | Activate focused element | Works on buttons and links |
| `Space` | Activate focused button | Also toggles checkboxes |
| `Escape` | Close modal or cancel action | Closes any open modal dialog |

### Skip Navigation

| Shortcut | Action | Notes |
|----------|--------|-------|
| `Tab` (on page load) | Reveal skip link | Shows "Skip to main content" link |
| `Enter` (when skip link focused) | Jump to main content | Bypasses header and navigation |

---

## Page-Specific Shortcuts

### Sign-In Page

**Member List:**
- `Tab` / `Shift + Tab` - Navigate between member cards
- `Enter` / `Space` - Check in selected member
- `Arrow Down` / `Arrow Up` - Navigate search results (future)

**Event Management:**
- `Tab` to "+ New Event" button - Opens event creation modal
- `Enter` on event card - Select event
- `Enter` on "End Event" - End current event

**Search:**
- Type in search box to filter members
- Results update in real-time
- Navigate filtered results with Tab

### Modals and Dialogs

**All Modals:**
- `Tab` - Cycle through modal controls (focus trapped inside)
- `Shift + Tab` - Cycle backward
- `Escape` - Close modal and return focus
- `Enter` - Submit form or confirm action

**Specific Modals:**

**New Event Modal:**
- `Tab` through activity options
- `Enter` / `Space` - Select activity type
- `Enter` on "Start Event" - Create event

**Bulk Import Modal:**
- `Tab` to upload area
- `Enter` / `Space` - Open file browser
- Drag and drop also supported

**User Management:**
- `Tab` through member list
- `Enter` on "Edit" - Edit member
- `Enter` on "Delete" - Delete member
- Form fields navigable with Tab

### Reports Page

**Filter Controls:**
- `Tab` through date pickers and dropdowns
- `Arrow keys` in dropdowns to select options
- `Enter` to apply filters

**Chart Navigation:**
- Charts are rendered as images with alt text
- Use headings (`h2`, `h3`) to navigate sections

### Truck Check Pages

**Checklist:**
- `Tab` through checklist items
- `Space` - Toggle checkbox
- `Enter` on status buttons - Change status (Done/Issue/Skipped)
- `Tab` to "Add Photo" - Upload issue photo

**Template Editor:**
- `Tab` through checklist items
- `Enter` on "Add Item" - Add new item
- `Delete` key (when item focused) - Remove item (future)

### Admin Pages

**Station Management:**
- `Tab` through station list
- `Enter` on station row - View details
- `Enter` on "Edit" - Edit station
- `Enter` on "Delete" - Delete station

**Brigade Access:**
- `Tab` through station list
- `Enter` on "Generate URL" - Create access URL
- `Ctrl/Cmd + C` (when URL focused) - Copy URL

---

## Form Controls

### Text Input

| Shortcut | Action |
|----------|--------|
| `Tab` | Move to next field |
| `Shift + Tab` | Move to previous field |
| `Arrow keys` | Move cursor within text |
| `Home` | Jump to start of line |
| `End` | Jump to end of line |
| `Ctrl/Cmd + A` | Select all text |

### Select Dropdowns

| Shortcut | Action |
|----------|--------|
| `Space` / `Enter` | Open dropdown |
| `Arrow Down` | Next option |
| `Arrow Up` | Previous option |
| `Enter` | Select option |
| `Escape` | Close without selecting |
| `Type letters` | Jump to option starting with letter |

### Checkboxes

| Shortcut | Action |
|----------|--------|
| `Space` | Toggle checked state |
| `Tab` | Move to next control |

### Radio Buttons

| Shortcut | Action |
|----------|--------|
| `Arrow Down` / `Arrow Right` | Next option |
| `Arrow Up` / `Arrow Left` | Previous option |
| `Space` | Select option |
| `Tab` | Move to next control group |

---

## List Navigation

### Member Lists

**Current Implementation:**
- `Tab` - Move to next member card
- `Shift + Tab` - Move to previous member card
- `Enter` / `Space` - Activate action (check in/out)

**Future Enhancement (Planned):**
- `Arrow Down` - Move to next member in list
- `Arrow Up` - Move to previous member in list
- `Home` - Jump to first member
- `End` - Jump to last member
- `Page Down` - Scroll down one page
- `Page Up` - Scroll up one page

### Event Log

- `Tab` - Move to next event card
- `Enter` - Select event
- Scroll with mouse wheel or Page Up/Down

---

## Browser Shortcuts

These standard browser shortcuts also work:

| Shortcut | Action |
|----------|--------|
| `Ctrl/Cmd + R` | Reload page |
| `Ctrl/Cmd + T` | New tab |
| `Ctrl/Cmd + W` | Close tab |
| `Ctrl/Cmd + +` | Zoom in |
| `Ctrl/Cmd + -` | Zoom out |
| `Ctrl/Cmd + 0` | Reset zoom |
| `F5` | Refresh page |
| `F11` | Toggle fullscreen |
| `Ctrl/Cmd + P` | Print |

---

## Screen Reader Specific

### NVDA (Windows)

| Shortcut | Action |
|----------|--------|
| `Insert + Down Arrow` | Read from current position |
| `Insert + B` | Read entire page |
| `H` | Next heading |
| `Shift + H` | Previous heading |
| `D` | Next landmark |
| `Shift + D` | Previous landmark |
| `F` | Next form field |
| `Shift + F` | Previous form field |
| `B` | Next button |
| `Shift + B` | Previous button |

### JAWS (Windows)

Similar to NVDA, but uses `Insert` or `Caps Lock` as modifier key.

### VoiceOver (macOS/iOS)

| Shortcut | Action |
|----------|--------|
| `Cmd + F5` | Toggle VoiceOver on/off (macOS) |
| `VO + A` | Read from current position (VO = Ctrl + Option) |
| `VO + Right Arrow` | Next item |
| `VO + Left Arrow` | Previous item |
| `VO + Cmd + H` | Next heading |
| `VO + Cmd + J` | Next form control |

---

## Accessibility Features

### Focus Indicators

- All interactive elements show a visible focus indicator (blue outline)
- Focus order follows visual layout (left-to-right, top-to-bottom)
- Focus is trapped within modals (Tab cycles within modal)

### Skip Links

- "Skip to main content" link appears on Tab press
- Allows keyboard users to bypass navigation
- Available on all pages

### Live Announcements

Screen readers automatically announce:
- Check-ins and check-outs
- Form submission results (success/error)
- Import results
- Dynamic content changes

### Error Messages

- Error messages appear inline near related fields
- Screen readers announce errors via ARIA live regions
- Visual indicators include ❌ icon and "Error:" prefix

---

## Tips for Keyboard Navigation

1. **Use Tab to explore**: Press Tab repeatedly to discover all interactive elements
2. **Look for focus indicators**: Blue outline shows where you are
3. **Use Escape to go back**: Closes modals and cancels actions
4. **Enable screen reader**: For full accessibility, use NVDA (free) or built-in screen readers
5. **Zoom if needed**: Browser zoom (Ctrl/Cmd +/-) works well with the app

---

## Reporting Issues

If you encounter keyboard navigation issues:

1. **Document the issue:**
   - What page were you on?
   - What were you trying to do?
   - What keyboard shortcuts did you use?
   - What happened vs. what you expected?

2. **Report it:**
   - Open an issue on GitHub
   - Tag with `accessibility` and `keyboard-navigation` labels
   - Include browser and screen reader (if applicable)

---

## Future Enhancements

Planned keyboard navigation improvements:

- [ ] Arrow key navigation in member lists
- [ ] Keyboard shortcuts for common actions (Ctrl+N for new member)
- [ ] Customizable keyboard shortcuts
- [ ] Quick search with `/` key
- [ ] Jump to sections with number keys (1-9)

---

**Last Updated**: February 2026  
**Version**: 1.0  
**See also**: `docs/ACCESSIBILITY.md` for full accessibility documentation
