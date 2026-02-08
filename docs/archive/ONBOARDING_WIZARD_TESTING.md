# Interactive Onboarding Wizard - Testing Guide

## Overview
The interactive onboarding wizard has been successfully implemented for Station Manager. This guide explains how to test and verify all features.

## Quick Start

### Triggering the Wizard
1. Navigate to the landing page (root `/`)
2. Click the **"Getting Started"** button (blue button with 🎓 icon)
3. The wizard will open as a full-screen modal overlay

### Resetting for Testing
To see the wizard again after completing it:
```javascript
// Open browser console (F12) and run:
localStorage.removeItem('hasCompletedOnboarding');
// Then refresh the page and click "Getting Started" again
```

## Testing Checklist

### ✅ Step Navigation
- [ ] Click "Next →" to advance to step 2
- [ ] Click "← Back" to return to step 1
- [ ] Verify Back button is disabled on step 1
- [ ] Navigate through all 5 steps using Next button
- [ ] Verify last step shows "Get Started" instead of "Next"

### ✅ Progress Indicator
- [ ] Verify 5 dots are displayed at the top
- [ ] First dot should be active (larger, red) on step 1
- [ ] Previous dots show checkmark (✓) when moving forward
- [ ] Click on any dot to jump directly to that step
- [ ] Verify step counter updates (e.g., "Step 3 of 5")

### ✅ Skip Functionality (3 Methods)
1. **Skip Tour Button**
   - [ ] Click "Skip Tour" button in footer
   - [ ] Wizard should close with animation
   - [ ] Reload page and verify wizard doesn't show again

2. **X Button**
   - [ ] Click the X button in top-right corner
   - [ ] Wizard should close with animation
   - [ ] Verify localStorage is set

3. **Click Outside**
   - [ ] Click on the dark overlay (outside dialog)
   - [ ] Wizard should close
   - [ ] Verify localStorage is set

### ✅ Action Buttons
- [ ] Navigate to Step 3 (Sign-In System)
- [ ] Click "Go to Sign-In →" button
- [ ] Verify navigation to `/signin` page
- [ ] Verify wizard closes and localStorage is set

### ✅ Content Verification
Verify each step displays correctly:

**Step 1: Welcome**
- Icon: 👋
- Title: "Welcome to Station Manager"
- 4 bullet points with checkmarks

**Step 2: Station Selection**
- Icon: 🚒
- Title: "Choose Your Station"
- 4 bullet points about station selection

**Step 3: Sign-In System**
- Icon: ✅
- Title: "Track Member Presence"
- 4 bullet points + action button

**Step 4: Events**
- Icon: 📅
- Title: "Organize Events"
- 4 bullet points about event management

**Step 5: You're Ready**
- Icon: 🎉
- Title: "You're Ready!"
- 4 bullet points + "Get Started" button

### ✅ Responsive Design Testing

#### Desktop (> 1024px)
- [ ] Wizard centered on screen
- [ ] Max-width 700px
- [ ] All content readable and properly spaced
- [ ] Button sizes appropriate for mouse

#### Tablet Portrait (768px - 1024px)
- [ ] Wizard max-width 600px
- [ ] Font sizes adjusted
- [ ] Touch targets minimum 44px
- [ ] Scrollable if content exceeds viewport

#### Tablet Landscape (1024px wide, < 768px tall)
- [ ] Wizard max-width 800px, max-height 85vh
- [ ] Reduced spacing to fit content
- [ ] Scrollable content area
- [ ] All buttons accessible

#### Mobile (< 768px)
- [ ] Wizard nearly full-screen (with 10px margin)
- [ ] Footer buttons wrap to 2 rows if needed
- [ ] Progress dots smaller (10px)
- [ ] Touch targets ≥ 40px
- [ ] Scrollable content

### ✅ Accessibility Testing

#### Keyboard Navigation
- [ ] Tab through all interactive elements
- [ ] Press Enter on progress dots to navigate
- [ ] Press Escape to close wizard (if implemented)
- [ ] Focus indicators visible on all elements

#### Screen Reader
- [ ] ARIA labels present on all buttons
- [ ] Progress dots announce "Go to step X"
- [ ] Close button announces "Skip onboarding"
- [ ] Heading hierarchy is logical

#### High Contrast Mode
- [ ] Progress dots have 3px borders
- [ ] Text readable in high contrast
- [ ] Focus indicators visible

### ✅ Animation Testing

#### Standard Motion
- [ ] Overlay fades in (0.3s)
- [ ] Dialog slides up with bounce effect (0.4s)
- [ ] Icon bounces continuously
- [ ] Buttons have hover animations
- [ ] Progress dots scale on hover

#### Reduced Motion
- [ ] Enable "prefers-reduced-motion" in browser settings
- [ ] Verify animations are disabled
- [ ] Verify functionality still works without animations

### ✅ Performance Testing
- [ ] Wizard loads quickly (< 100ms)
- [ ] No layout shifts when opening
- [ ] Smooth 60fps animations
- [ ] No console errors
- [ ] Memory doesn't leak on repeated open/close

## Browser Compatibility

Test in the following browsers:

### Required
- [ ] Chrome/Edge 90+ (Desktop)
- [ ] Chrome Mobile (Android)
- [ ] Safari 14+ (Desktop)
- [ ] Safari (iOS/iPadOS)

### Recommended
- [ ] Firefox 88+ (Desktop)
- [ ] Samsung Internet (Mobile)

## Screenshot Requirements

As per Issue #28, capture screenshots of all 5 steps on iPad:

### iPad Portrait (768 x 1024)
- [ ] Screenshot of Step 1
- [ ] Screenshot of Step 2
- [ ] Screenshot of Step 3
- [ ] Screenshot of Step 4
- [ ] Screenshot of Step 5

### iPad Landscape (1024 x 768)
- [ ] Screenshot of Step 1
- [ ] Screenshot of Step 2
- [ ] Screenshot of Step 3
- [ ] Screenshot of Step 4
- [ ] Screenshot of Step 5

**How to capture:**
1. Open browser dev tools (F12)
2. Toggle device toolbar (Ctrl+Shift+M)
3. Select "iPad" from device dropdown
4. Toggle orientation button for portrait/landscape
5. Take screenshots (browser's built-in screenshot tool or OS tool)

## Common Issues & Solutions

### Wizard doesn't appear
- Check if localStorage has `hasCompletedOnboarding` set to `true`
- Clear localStorage and try again
- Verify "Getting Started" button is visible and clickable

### Animations are laggy
- Check if "prefers-reduced-motion" is enabled
- Close other browser tabs to free up resources
- Try a different browser for comparison

### Tests failing
```bash
cd frontend
npm test -- OnboardingWizard.test.tsx
```
- Verify all 19 tests pass
- Check console for error messages
- Ensure mock dependencies are set up correctly

## Test Results Template

```
Date: ____________________
Tester: __________________
Browser: _________________
Device: __________________

Step Navigation:         [ ] Pass  [ ] Fail
Progress Indicator:      [ ] Pass  [ ] Fail
Skip Functionality:      [ ] Pass  [ ] Fail
Action Buttons:          [ ] Pass  [ ] Fail
Content Display:         [ ] Pass  [ ] Fail
Responsive Design:       [ ] Pass  [ ] Fail
Accessibility:           [ ] Pass  [ ] Fail
Animations:             [ ] Pass  [ ] Fail

Notes:
_______________________________________
_______________________________________
_______________________________________
```

## Development Commands

```bash
# Run tests
cd frontend
npm test

# Run tests in watch mode
npm run test:watch

# Run tests with coverage
npm run test:coverage

# Build frontend
npm run build

# Run dev server
npm run dev
```

## Additional Notes

- The wizard uses RFS brand colors (red, lime, blue)
- All text is in plain language, avoiding technical jargon
- Icons are large and friendly (emoji-based)
- Animations are smooth but not distracting
- The wizard respects user preferences (reduced motion, high contrast)
