# Screen Reader User Guide

## RFS Station Manager - Using with Screen Readers

This guide helps screen reader users navigate and use the RFS Station Manager application effectively.

---

## Supported Screen Readers

| Platform | Screen Reader | Support Level |
|----------|---------------|---------------|
| Windows | NVDA | ✅ Fully Tested |
| Windows | JAWS | ✅ Tested |
| macOS | VoiceOver | ✅ Tested |
| iOS | VoiceOver | ⚠️ Limited Testing |
| Android | TalkBack | ⚠️ Limited Testing |

**Recommended**: NVDA (Windows) or VoiceOver (macOS) for best experience.

---

## Getting Started

### First Time Setup

1. **Open the application** in your web browser
2. **Press Tab** - You'll hear "Skip to main content, link"
3. **Press Enter** to skip navigation (optional)
4. **Navigate with arrow keys or Tab** to explore the page

### Page Structure

Each page follows this structure:
1. **Header** - Navigation and station information
2. **Main content** - Page-specific content
3. **Footer** - Version information

---

## Navigation Patterns

### Using Headings

The application uses proper heading structure:
- **h1** - Page title (one per page)
- **h2** - Major sections
- **h3** - Subsections

**NVDA/JAWS**: Press `H` to jump between headings  
**VoiceOver**: Press `VO + Cmd + H` to jump between headings

### Using Landmarks

Pages include semantic landmarks:
- **main** - Main content area
- **navigation** - Navigation sections
- **banner** - Page header
- **contentinfo** - Footer

**NVDA/JAWS**: Press `D` to jump between landmarks  
**VoiceOver**: Use rotor (VO + U), select Landmarks

---

## Page-by-Page Guide

### Landing Page (Home)

**What you'll hear:**
- "RFS Station Manager - heading level 1"
- Feature cards: "Sign-In System", "Event Management", etc.
- Each card includes a "Learn More" link

**Quick actions:**
- Tab to "Access Sign-In System" button
- Enter to navigate to sign-in page

### Sign-In Page

**Page structure:**
1. Header with station name
2. Event selector
3. Member list for check-in
4. Current participants
5. Event log

**Common tasks:**

**Starting a new event:**
1. Tab to "+ New Event" button
2. Press Enter
3. Modal opens with activity selection
4. Tab through activities
5. Press Enter on desired activity
6. Press Enter on "Start Event" button

**Checking in a member:**
1. Use headings (`H` key) to find "Member List"
2. Tab through member cards
3. You'll hear: "[Name], [Rank], Check In button"
4. Press Enter to check in

**What you'll hear after check-in:**
- "Success: [Member name] checked in successfully"
- Live announcement via screen reader

**Checking out a member:**
1. Navigate to "Current Participants" section (use `H` for headings)
2. Tab through participant list
3. Press Enter on "Remove" button
4. Confirmation: "[Member name] checked out"

### Profile Page

**Viewing member profile:**
- Name, rank, and statistics are announced
- "Member since [date]" information
- Statistics: total check-ins, hours, current streak

**Editing profile:**
1. Tab to "Edit Profile" button
2. Press Enter to open edit form
3. Tab through form fields
4. Each field announces its label and current value
5. Make changes
6. Tab to "Save" button
7. Press Enter

### Truck Check Pages

**Starting a check:**
1. Select vehicle from list (Tab + Enter)
2. You'll hear: "Check for [Vehicle name] started"
3. Tab through checklist items
4. Each item announces: "[Item name], checkbox, [checked/unchecked]"
5. Press Space to toggle checkbox

**Recording an issue:**
1. Tab to status button
2. You'll hear current status: "Status: Done"
3. Press Enter to cycle status
4. Status changes: Done → Issue → Skipped → Done
5. If Issue selected, tab to "Add Photo" button

**Completing check:**
1. Tab to "Complete Check" button
2. Press Enter
3. You'll hear: "Check completed successfully"

### Reports Page

**Navigating reports:**
- Use headings to jump between report sections
- Charts described with alt text
- Data tables include proper headers
- Filter controls clearly labeled

**Applying filters:**
1. Tab to date range or filter dropdown
2. Arrow keys to select values
3. Tab to "Apply" button
4. Press Enter
5. Results announced: "Showing [N] results"

### Admin Pages

**Station Management:**
- Station list with search
- Each station card announces name and status
- Edit/Delete buttons clearly labeled

**Brigade Access:**
- Station list for access management
- "Generate URL" and "Copy" buttons
- URL field is announced and selectable

---

## Interactive Elements

### Buttons

**What you'll hear:**
- "[Button text], button"
- Example: "Check In, button"

**How to activate:**
- Press Enter or Space

### Links

**What you'll hear:**
- "[Link text], link"
- Example: "Learn More, link"

**How to activate:**
- Press Enter

### Forms

**Text inputs:**
- You'll hear: "[Label], edit, [current value]"
- Type to enter text
- Tab to move to next field

**Dropdowns:**
- You'll hear: "[Label], combo box, [current selection]"
- Arrow keys to change selection
- Enter to confirm

**Checkboxes:**
- You'll hear: "[Label], checkbox, [checked/not checked]"
- Space to toggle

### Modals (Dialogs)

**When modal opens:**
- You'll hear: "Dialog, [Modal title]"
- Focus moves to first element in modal
- Tab cycles through modal elements only

**How to close:**
- Tab to "Close" or "Cancel" button and press Enter
- Or press Escape key
- Focus returns to trigger element

### Live Announcements

The application announces important events:

**Check-in:**
- "John Smith checked in successfully"

**Check-out:**
- "Jane Doe checked out"

**Imports:**
- "Success: 15 members imported successfully"
- "Error: Import failed for 3 members"

**Errors:**
- "Error: Failed to save changes"

These announcements are automatic - no action needed.

---

## Tips for Best Experience

### General Tips

1. **Use heading navigation** - Fastest way to navigate pages (`H` key)
2. **Learn the page structure** - Each page follows consistent layout
3. **Listen for live announcements** - Important feedback comes via announcements
4. **Tab is your friend** - When in doubt, Tab to explore
5. **Use landmarks** - Jump between major sections quickly (`D` key)

### NVDA Specific

**Recommended settings:**
- Browse mode for reading content
- Forms mode for filling forms (auto-switches)
- Enable "Report dynamic content changes" (on by default)

**Useful commands:**
- `Insert + Down Arrow` - Read from cursor
- `Insert + B` - Read entire page
- `B` - Next button
- `F` - Next form field
- `T` - Next table

### VoiceOver Specific

**Recommended settings:**
- Use rotor (VO + U) to navigate by type
- Enable "Speak hints" for guidance

**Useful commands:**
- `VO + A` - Read from cursor (VO = Ctrl + Option)
- `VO + Right/Left Arrow` - Navigate elements
- `VO + Cmd + H` - Next heading
- `VO + Cmd + J` - Next form control

---

## Common Tasks

### Scenario 1: Check in for training

1. Navigate to sign-in page
2. If no active event:
   - Tab to "+ New Event" button → Enter
   - Select "Training" activity → Enter
   - Press Enter on "Start Event"
3. Tab through member list
4. Find your name
5. Press Enter to check in
6. Announcement: "Success: [Your name] checked in successfully"

### Scenario 2: Complete a truck check

1. Navigate to truck check page
2. Tab to vehicle selection
3. Press Enter on desired vehicle
4. Tab through checklist items
5. Space to mark items as complete
6. For issues: Enter on status button → select "Issue" → Add photo
7. Tab to "Complete Check" button
8. Press Enter
9. Announcement: "Check completed successfully"

### Scenario 3: View your profile

1. Navigate to Profile page
2. Use headings (`H`) to navigate sections
3. Hear statistics: total check-ins, hours, streak
4. Tab to "Edit Profile" if changes needed

---

## Troubleshooting

### Can't hear announcements

**Check:**
- Screen reader is running
- Volume is on
- Live region announcements enabled (should be default)

**Try:**
- NVDA: Settings → Speech → Report dynamic content changes (enable)
- VoiceOver: System Preferences → Accessibility → VoiceOver → Verbosity → Announcements

### Focus gets stuck

**Solutions:**
- Press Escape to close any open modals
- Refresh page (F5 or Cmd+R)
- Tab through to next section

### Modal won't close

**Solutions:**
- Press Escape key
- Tab to "Close" or "Cancel" button and press Enter
- Refresh page if stuck

### Can't find an element

**Try:**
- Use heading navigation (`H` key)
- Use landmark navigation (`D` key)
- Use search/find in page (Ctrl/Cmd+F) if available
- Tab through entire page systematically

---

## Accessibility Features

### What Works Well

✅ Proper heading structure  
✅ ARIA labels on all controls  
✅ Live announcements for dynamic changes  
✅ Focus management in modals  
✅ Keyboard navigation throughout  
✅ Semantic HTML landmarks  
✅ Alternative text for icons  
✅ Form labels properly associated  

### Known Limitations

⚠️ Some custom dropdowns may not announce all states  
⚠️ Charts are images with alt text (not interactive)  
⚠️ Some autofocus in modals (intentional for UX)  

---

## Reporting Issues

If you encounter problems:

1. **Note the details:**
   - Page you were on
   - What you were trying to do
   - What you heard (or didn't hear)
   - Screen reader and browser

2. **Report it:**
   - GitHub issue with `accessibility` label
   - Include "Screen Reader:" in title
   - Be specific about the problem

**Example good report:**
> "Screen Reader: NVDA can't hear member name on check-in page. Using Chrome 120, NVDA 2023.3. Tab through member list, hear 'button' but not member name."

---

## Resources

### Screen Reader Downloads

- **NVDA** (Windows): https://www.nvaccess.org/download/ (Free)
- **JAWS** (Windows): https://www.freedomscientific.com/products/software/jaws/ (Commercial)
- **VoiceOver** (macOS/iOS): Built-in, Cmd+F5 to enable
- **TalkBack** (Android): Built-in, Settings → Accessibility

### Learning Resources

- NVDA User Guide: https://www.nvaccess.org/files/nvda/documentation/userGuide.html
- VoiceOver Guide: https://support.apple.com/guide/voiceover/welcome/mac
- WebAIM Screen Reader Resources: https://webaim.org/articles/screenreader_testing/

### Other Documentation

- `ACCESSIBILITY.md` - Full accessibility documentation
- `KEYBOARD_SHORTCUTS.md` - Keyboard shortcut reference
- `docs/MASTER_PLAN.md` - Project roadmap

---

## Feedback

Your feedback helps us improve accessibility!

**What we'd love to hear:**
- What works well
- What's confusing or difficult
- What features you'd like
- What could be clearer

**Contact:**
- GitHub issues with `accessibility` label
- Include your screen reader and browser
- Be specific about the experience

---

**Last Updated**: February 2026  
**Version**: 1.0  
**Maintained by**: RFS Station Manager Team

Thank you for using RFS Station Manager! We're committed to making this application accessible to everyone.
