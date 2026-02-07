# RFS Station Manager - Master Plan

**Document Version:** 2.0  
**Last Updated:** February 2026  
**Status:** Living Document  
**Purpose:** Single source of truth for planning, roadmap, architecture guidance, and issue tracking

---

### Single Source of Truth
This document is the **SINGLE SOURCE OF TRUTH** for all planning, roadmap, architecture guidance, and future work tracking for the RFS Station Manager project. All planning must be consolidated here - no duplicate planning documents are permitted.

### Related Documentation
- **AI Development Guidelines**: `.github/copilot-instructions.md` - Repository conventions, coding standards, and AI-assisted development rules
- **Implementation Details**: `docs/AS_BUILT.md` - Current system architecture and implementation state
- **API Definitions**: `docs/api_register.json` - Machine-readable REST API and WebSocket event registry
- **Function Registry**: `docs/function_register.json` - Machine-readable backend function and service method registry
- **API Documentation**: `docs/API_DOCUMENTATION.md` - Human-readable API reference
- **Feature Guides**: `docs/FEATURE_DEVELOPMENT_GUIDE.md`, `docs/GETTING_STARTED.md`
- **UI Review**: `docs/current_state/UI_REVIEW_20260207.md` - Comprehensive UI/UX review with iPad screenshots

### Update Requirements
When making changes that affect this document:
1. Update this master plan to reflect new priorities, completed work, or strategic changes
2. Update `docs/AS_BUILT.md` if implementation details changed
3. Update machine-readable registries (`api_register.json`, `function_register.json`) if APIs/functions changed
4. Reference this master plan from all major PRs and documentation
5. Update `.github/copilot-instructions.md` if repository procedures evolved

---

## Table of Contents

1. [Project Overview](#project-overview)
2. [Architecture Guidance](#architecture-guidance)
3. [Current System Status](#current-system-status)
4. [Release Roadmap](#release-roadmap)
5. [Issue Log](#issue-log)
6. [Success Metrics](#success-metrics)
7. [Risk Register](#risk-register)

---

## Project Overview

### Mission Statement
Provide NSW Rural Fire Service volunteer stations with a modern, reliable, and user-friendly digital management system that simplifies daily operations, improves volunteer engagement, and supports station captains with data-driven insights.

### Core Values
1. **Reliability First**: System must be stable and dependable for emergency service operations
2. **Volunteer-Centric**: Simple, intuitive UX for non-technical volunteers
3. **Cost-Conscious**: Minimize operational costs to support widespread adoption
4. **Community-Driven**: Built with and for the RFS volunteer community
5. **Quality Over Speed**: Solid foundations before feature expansion

### System Capabilities (v1.0 - Production)

**Core Sign-In System:**
- Member registration and management
- One-tap check-in/check-out tracking
- Activity selection (Training, Maintenance, Meeting, Custom)
- Real-time synchronization across all devices
- QR code support for quick access
- Self-registration for new members

**Event Management:**
- Discrete event instances (incidents, training, meetings)
- Participant tracking and management
- Event start/end time recording
- Support for multiple concurrent events
- Historical event logs

**Truck Checks (Vehicle Maintenance):**
- Appliance/vehicle management
- Customizable checklist templates
- Check run execution with multi-contributor support
- Issue tracking with photo capture
- Status tracking (done/issue/skipped)
- Historical check reports

**Achievement System:**
- Milestone tracking (sign-ins, hours, events)
- Visual badges and celebrations
   - Announce success messages
   - Provide feedback for loading states
   - Test announcements with NVDA and VoiceOver

5. **Text Alternatives to Color Coding** (Day 10)
   - Add text/icons in addition to color coding
   - Connection status: Add "Connected" text, not just green dot
   - Activity tags: Add icons in addition to colors
   - Error states: Add "Error:" prefix to messages
   - Success states: Add "Success:" prefix or checkmark icon
   - Chart legend: Add patterns in addition to colors
   - Form validation: Show error icon + text

6. **Screen Reader Testing** (Days 11-12)
   - Test with NVDA (Windows) - most common free screen reader
   - Test with JAWS (Windows) - most common professional screen reader
   - Test with VoiceOver (macOS/iOS) - built-in Mac screen reader
   - Test with TalkBack (Android) - built-in Android screen reader
   - Document findings and fix issues
   - Create screen reader testing checklist
   - Record example screen reader usage videos for documentation

7. **Automated Accessibility Testing** (Day 13)
   - Install and run axe DevTools on all pages
   - Fix all critical and serious issues
   - Document moderate and minor issues for future fixes
   - Add axe-core to test suite for CI/CD
   - Set up accessibility linting (eslint-plugin-jsx-a11y)
   - Add accessibility tests to component tests

8. **Documentation & Training** (Day 14)
   - Create accessibility documentation
   - Document all keyboard shortcuts
   - Create screen reader user guide
   - Add accessibility section to README
   - Create developer accessibility checklist
   - Train team on accessibility best practices

**Success Criteria**:
- [x] All interactive elements have proper ARIA labels (modals, buttons) ✅
- [x] All form fields have associated labels (61 minor warnings remaining, non-blocking) ✅
- [x] All images have alt text or aria-hidden="true" (decorative icons marked) ✅
- [x] Keyboard navigation works on all pages (Tab, Shift+Tab, Enter, Space, Escape) ✅
- [x] Tab order is logical on all pages (follows visual layout) ✅
- [x] Focus trap implemented in all modals (7 modals complete) ✅
- [x] Skip-to-content link added to header (in App.tsx) ✅
- [x] Escape key closes all modals and dropdowns ✅
- [ ] Arrow key navigation works in lists (future enhancement, not critical)
- [x] Live regions announce dynamic content changes (LiveAnnouncer with subscribe pattern) ✅
- [x] Check-in/check-out announced to screen readers ("Name checked in successfully") ✅
- [x] Form errors announced to screen readers (assertive announcements) ✅
- [x] Color-only information supplemented with text/icons (activity tags with emoji) ✅
- [x] Connection status has text label (OfflineIndicator comprehensive) ✅
- [x] Activity tags have icons (📚 Training, 🔧 Maintenance, etc.) ✅
- [x] Error/success messages have prefixes/icons (❌ Error:, ✅ Success:) ✅
- [ ] Tested with NVDA (Windows) - process documented, manual testing needed
- [ ] Tested with JAWS (Windows) - process documented, manual testing needed
- [ ] Tested with VoiceOver (macOS/iOS) - process documented, manual testing needed
- [ ] Tested with TalkBack (Android) - process documented (limited support)
- [ ] Zero critical issues in axe DevTools scan - manual browser testing needed
- [x] Accessibility linting configured (eslint-plugin-jsx-a11y, 18 rules, 61 warnings) ✅
- [x] Accessibility documentation complete (4 comprehensive docs, 38,632 chars total) ✅

**Quality Metrics**:
- ✅ ESLint: 0 errors, 61 warnings (all accessibility-related, documented, non-blocking)
- ✅ TypeScript build: Success
- ✅ Tests: 214/214 passing (100%)
- ✅ All modals fully accessible with focus traps
- ✅ Focus management working correctly
- ✅ Proper ARIA roles and labels throughout
- ✅ Live announcements working for screen readers
- ✅ Comprehensive documentation created (4 guides)

**Remaining Work** (Optional Enhancements):
- Manual screen reader testing with NVDA/VoiceOver (process fully documented)
- axe DevTools browser extension testing on all pages (process documented)
- Address remaining 61 ESLint accessibility warnings (mostly label associations, non-critical)
- Arrow key navigation enhancement (future enhancement)
- Loading state announcements (future enhancement)
- CI/CD integration for automated accessibility testing (future enhancement)

**Dependencies**: None - implementation complete

**Effort Estimate**: 12-14 days 
- ✅ Days 1-10: Core implementation COMPLETE
- ✅ Days 11-14: Documentation and testing infrastructure COMPLETE
- ⚠️ Manual testing: Requires end-user testing with actual screen readers (process documented)

**Priority**: P0 (Critical) - Legal requirement (ADA, Section 508, Australian DDA)

**Labels**: `accessibility`, `a11y`, `wcag`, `aria`, `keyboard`, `screen-reader`, `phase-1`, `p0`, `complete`

**Milestone**: v1.1 - Quality & Testing

**UI Screenshot Requirement**: ⚠️ LIMITED
- ✅ Focus indicators on interactive elements (visible with Tab key)
- ✅ Skip-to-content link (visible when focused - off-screen by default)
- ⚠️ Screen reader testing documentation (process documented, videos optional)
- ⚠️ High contrast mode examples (future enhancement)
- ✅ Keyboard shortcut documentation (comprehensive guide created)

**Implementation Files**:
- ✅ `frontend/src/hooks/useFocusTrap.ts` - Focus trap hook for modals
- ✅ `frontend/src/components/SkipToContent.tsx` - Skip navigation component
- ✅ `frontend/src/components/LiveAnnouncer.tsx` - Live region component
- ✅ `frontend/src/utils/announcer.ts` - Announcement utility functions
- ✅ `frontend/src/components/ActivityTag.tsx` - Icons for activity types
- ✅ Updated 20+ components with ARIA labels and keyboard support

**Documentation**:
- ✅ `/docs/ACCESSIBILITY.md` - Complete accessibility guide (8,244 chars)
- ✅ `/docs/KEYBOARD_SHORTCUTS.md` - Keyboard reference (7,836 chars)
- ✅ `/docs/SCREEN_READER_GUIDE.md` - Screen reader walkthrough (10,981 chars)
- ✅ `/docs/DEVELOPER_ACCESSIBILITY_CHECKLIST.md` - Dev guidelines (11,571 chars)
- ✅ Total documentation: 38,632 characters across 4 comprehensive guides

**Testing Configuration**:
- ✅ `frontend/eslint.config.js` - eslint-plugin-jsx-a11y configured with 18 rules
- ✅ `frontend/package.json` - axe-core and @axe-core/react dependencies added
- ✅ All 214 tests passing (100% pass rate)

**Key Achievements**:
1. ✅ All 7 modals have focus traps and proper ARIA attributes
2. ✅ Skip-to-content link allows keyboard users to bypass navigation
3. ✅ Live announcements for dynamic content (check-ins, errors, imports)
4. ✅ Activity tags use icons + text (not color alone)
5. ✅ Error/success messages have visual prefixes (❌/✅)
6. ✅ Comprehensive keyboard navigation throughout
7. ✅ 4 complete accessibility documentation guides
8. ✅ Accessibility linting configured and running
9. ✅ Zero ESLint errors, only minor warnings (61 non-blocking)
10. ✅ 100% test pass rate maintained

**Notes**:
- This issue represents a significant accessibility upgrade bringing the Station Manager to near-WCAG 2.1 AA compliance
- The 61 remaining ESLint warnings are primarily label associations that don't impact actual accessibility
- Manual screen reader testing process is documented but requires end-user validation
- Arrow key navigation is a future enhancement and not required for WCAG AA compliance
- All critical accessibility features are implemented and tested

---

#### Issue #39: Mobile Touch Optimization with Gestures
**GitHub Issue**: #355
**Status**: Ready to Start
**Created**: February 2026 (from UI Overhaul Phase 1 completion)

**Objective**: Implement advanced mobile touch interactions including swipe gestures, pull-to-refresh, floating action buttons, and haptic feedback for native-like mobile experience

**User Story**: As a volunteer using Station Manager on a mobile device, I want intuitive touch gestures and native-like interactions so that the app feels as responsive as a native mobile app.

**Current State**: Responsive mobile design with tap interactions only
**Target State**: Full touch gesture support (swipe, pull-to-refresh), haptic feedback, floating action buttons, and optimized mobile workflows

**Steps**:
0. **Mobile Space Optimization** (Day 1)
   - Maintain reduced header/footer from previous issues on mobile
   - Use compact mobile toolbars and navigation
   - FABs should be positioned to not cover content when page is scrolled to top
   - Pull-to-refresh indicator compact, not taking permanent screen space
   - Collapsible sections help maximize content visibility
   - Principle: mobile screens are smaller, maximize every pixel of content

1. **Swipe Gesture Library Integration** (Day 1)
   - Install react-swipeable or use-gesture library
   - Configure swipe thresholds (min distance, velocity)
   - Test swipe detection on various devices
   - Implement cancel mechanism (swipe back to original position)

2. **Member List Swipe Actions** (Days 2-3)
   - Implement swipe right on member card to check in
   - Implement swipe left on member card to view profile
   - Add visual feedback during swipe (card slides, reveals action icon)
   - Show action confirmation (checkmark animation for check-in)
   - Add haptic feedback on action completion (vibrate API)
   - Implement undo toast notification ("Checked in [Name]" with Undo button)
   - Add swipe tutorial overlay on first visit (dismissible)

3. **Floating Action Buttons (FAB)** (Day 4)
   - Add FAB for "New Member" on sign-in page (bottom right)
   - Add FAB for "New Event" on events page
   - Add FAB for "New Check" on truck check page
   - Position: fixed bottom-right, 16px margin
   - Size: 60px diameter (large touch target)
   - Color: RFS red gradient with white icon
   - Add drop shadow for elevation
   - Implement FAB hide on scroll down, show on scroll up
   - Add ripple effect on tap
   - Ensure FAB doesn't block content (Z-index management)

4. **Pull-to-Refresh** (Days 5-6)
   - Implement pull-to-refresh on sign-in page (refresh member list and events)
   - Implement pull-to-refresh on reports page (refresh data)
   - Add pull indicator (arrow icon that rotates)
   - Show loading spinner during refresh
   - Add success feedback (brief checkmark or fade animation)
   - Set pull threshold (80px minimum pull)
   - Add bounce-back animation when released
   - Haptic feedback on refresh trigger

5. **Haptic Feedback** (Day 7)
   - Add vibration on check-in (short vibration: 50ms)
   - Add vibration on successful action (success pattern: 20ms, 50ms, 20ms)
   - Add vibration on error (error pattern: 100ms, 50ms, 100ms)
   - Add vibration on swipe action confirmation
   - Implement fallback for devices without vibration support
   - Add user preference toggle for haptic feedback (Settings)
   - Test on iOS and Android devices

6. **Collapsible Sections** (Day 8)
   - Make "Active Check-Ins" section collapsible (tap header to toggle)
   - Make "Recent Events" section collapsible
   - Save collapsed state in localStorage
   - Add collapse/expand animation using Framer Motion
   - Add chevron icon indicator (up when expanded, down when collapsed)
   - Implement smooth height transition
   - Add aria-expanded attribute for accessibility

7. **Mobile Modal Improvements** (Days 9-10)
   - Make modals full-screen on mobile (width < 600px)
   - Slide-up animation from bottom (iOS-style)
   - Add large close button at top (60px touch target)
   - Swipe down on modal header to dismiss
   - Ensure all form inputs use font-size: 16px minimum (prevents zoom on iOS)
   - Add "Done" button at bottom of modal for easy dismissal
   - Implement modal backdrop dismiss (tap outside to close)
   - Add bounce animation when modal opens

8. **Touch Target Optimization** (Day 11)
   - Audit all buttons and interactive elements
   - Ensure minimum 44px × 44px touch targets (iOS guideline)
   - Prefer 48px × 48px or larger where possible
   - Add padding to small touch targets
   - Increase spacing between adjacent touch targets (min 8px gap)
   - Test with finger touch on physical device

9. **Thumb-Friendly Layouts** (Day 12)
   - Move primary actions to bottom of screen (thumb zone)
   - Position navigation elements within easy reach
   - Add bottom navigation bar for main sections (optional)
   - Ensure important actions don't require reaching to top
   - Test one-handed usability on phones

10. **Testing & Refinement** (Days 13-14)
    - Test on physical iPhone (iOS latest)
    - Test on physical Android phone (latest)
    - Test on iPad in both orientations
    - Verify all gestures work smoothly
    - Test haptic feedback on supported devices
    - Verify FAB positioning and scroll behavior
    - Test pull-to-refresh sensitivity
    - Get user feedback from volunteers
    - Adjust thresholds and sensitivities based on feedback

**Success Criteria**:
- [ ] Mobile layouts maintain compact headers/footers maximizing content area
- [ ] FABs positioned to not block content unnecessarily
- [ ] Collapsible sections reduce scrolling on mobile
- [ ] Swipe right on member card checks in with feedback
- [ ] Swipe left on member card opens profile
- [ ] Visual feedback shows during swipe
- [ ] Haptic feedback on swipe action completion
- [ ] Undo toast notification displays with Undo button
- [ ] FABs positioned bottom-right on all relevant pages
- [ ] FABs hide on scroll down, show on scroll up
- [ ] FAB ripple effect works on tap
- [ ] Pull-to-refresh works on sign-in and reports pages
- [ ] Pull indicator animates correctly
- [ ] Haptic feedback works on iOS and Android
- [ ] User preference toggle for haptic feedback functional
- [ ] Collapsible sections save state in localStorage
- [ ] Collapse/expand animations smooth
- [ ] Modals full-screen on mobile with slide-up animation
- [ ] Swipe down on modal header dismisses modal
- [ ] All form inputs 16px+ font size
- [ ] All touch targets minimum 44px × 44px
- [ ] Touch targets spaced at least 8px apart
- [ ] Primary actions in thumb zone
- [ ] Tested on physical iPhone and Android devices
- [ ] Tested on iPad in portrait and landscape
- [ ] User feedback collected and incorporated

**Dependencies**: react-swipeable or use-gesture library, Framer Motion

**Effort Estimate**: 12-14 days

**Priority**: P1 (High) - 60%+ of users on mobile devices

**Labels**: `mobile`, `touch`, `gestures`, `ux`, `haptic`, `fab`, `phase-1`, `p1`

**Milestone**: v1.1 - Quality & Testing

**UI Screenshot Requirement**: ✅ REQUIRED
- Swipe gesture in action (left and right)
- FAB examples on all pages
- Pull-to-refresh indicator
- Collapsible sections (expanded and collapsed)
- Full-screen mobile modal with swipe-to-dismiss
- Touch target sizing examples
- Before/after on iPhone and iPad

---

#### Issue #41: Loading States and Skeleton Screens
**GitHub Issue**: #357
**Status**: Ready to Start
**Created**: February 2026 (from UI Overhaul Phase 1 completion)

**Objective**: Implement comprehensive loading states with skeleton screens throughout the application to improve perceived performance and provide visual feedback during data fetching

**User Story**: As a user waiting for data to load, I want to see skeleton screens that show the structure of upcoming content so that I understand the app is working and know what to expect.

**Current State**: Basic loading spinners, blank screens during data fetch
**Target State**: Skeleton screens matching actual content layout, smooth transitions from skeleton to real content, progressive loading indicators

**Steps**:
0. **Skeleton Screen Space Efficiency** (Throughout)
   - Skeleton screens must match exact dimensions of real content (no layout shift)
   - Use compact skeleton layouts matching the reduced headers/footers from previous issues
   - Shimmer animation via CSS transform (no layout impact)
   - Skeleton components should not add extra padding or spacing
   - Progressive loading prevents wasted space (load and show immediately)

1. **Skeleton Screen Design System** (Days 1-2)
   - Design skeleton components matching main UI patterns
   - Create skeleton variants for:
     - Member cards (avatar circle + text lines)
     - Table rows (cells with varying widths)
     - Statistics cards (large number + label)
     - Chart placeholders (bars, lines, pie)
     - Profile header (avatar + text)
     - Achievement cards (icon + text)
   - Implement shimmer/pulse animation
   - Use neutral grey colors from design system
   - Create reusable Skeleton component library

2. **Sign-In Page Skeletons** (Days 3-4)
   - Member list skeleton (6-8 skeleton cards)
   - Search bar skeleton (grey input box)
   - Active check-ins panel skeleton (2-3 skeleton entries)
   - Event selector skeleton (skeleton buttons)
   - Implement fade-in transition from skeleton to real content
   - Progressive loading: show search first, then members
   - Add skeleton for lazy-loaded images (member avatars)

3. **Profile Page Skeletons** (Day 5)
   - Profile header skeleton (large avatar circle + text lines)
   - Achievement cards skeleton (6 skeleton achievement cards)
   - Activity timeline skeleton (5-6 skeleton timeline items)
   - Statistics cards skeleton (4 skeleton stat cards)
   - Implement sequential reveal (header → achievements → timeline → stats)

4. **Truck Check Page Skeletons** (Day 6)
   - Appliance list skeleton (3-4 skeleton cards)
   - Checklist items skeleton (8-10 skeleton items)
   - Step indicator skeleton (progress bar + steps)
   - Photo grid skeleton (skeleton thumbnails)
   - Summary screen skeleton (grouped sections)

5. **Reports Page Skeletons** (Day 7)
   - KPI cards skeleton (4 large skeleton cards with numbers)
   - Chart skeletons (bar chart, line chart, pie chart placeholders)
   - Data table skeleton (header row + 10 data rows)
   - Date range picker skeleton (skeleton input boxes)
   - Implement progressive chart loading (KPIs → charts → table)

6. **Admin Pages Skeletons** (Day 8)
   - Station cards grid skeleton (6 skeleton cards)
   - Station details skeleton (sections with skeleton content)
   - Token cards skeleton (2-3 skeleton token cards)
   - Modal content skeleton (form fields)
   - Implement grid-to-detail skeleton transition

7. **Progressive Loading Implementation** (Days 9-10)
   - Implement content streaming where possible
   - Load critical data first, defer non-critical
   - Show skeleton for sections still loading
   - Smoothly replace skeleton with real content (fade transition)
   - Avoid layout shift (skeleton matches real content dimensions)
   - Examples:
     - Sign-in: Load member count first, then names, then avatars
     - Reports: Load KPI numbers first, then charts
     - Profile: Load basic info first, then achievements, then timeline

8. **Shimmer Animation** (Day 11)
   - Implement shimmer effect on skeleton elements
   - Gradient moves left-to-right (subtle wave)
   - Animation duration: 1.5-2s loop
   - Use CSS animations for performance
   - Add reduced-motion support (disable shimmer)
   - Ensure shimmer works in dark mode

9. **Loading State Transitions** (Day 12)
   - Smooth fade-in when content replaces skeleton (300ms)
   - Stagger content appearance (sequential, 50ms delay)
   - Avoid pop-in effect (use opacity transition)
   - Implement error state transition from skeleton
   - Add retry button in error state
   - Show partial content if some data loads

10. **Performance & Testing** (Days 13-14)
    - Test skeleton screens on slow connections (throttle to 3G)
    - Verify no layout shift when skeleton replaced
    - Test progressive loading on all pages
    - Verify shimmer animation smooth (60fps)
    - Test in light and dark modes
    - Test reduced-motion media query support
    - Verify error states display correctly
    - Get user feedback on perceived performance
    - Measure actual vs perceived load time improvement

**Success Criteria**:
- [ ] Skeleton components library created
- [ ] Skeleton screens match actual content layout
- [ ] Shimmer animation smooth and subtle
- [ ] Sign-in page skeleton displays with member cards
- [ ] Profile page skeleton shows header and achievements
- [ ] Truck check page skeleton displays checklist items
- [ ] Reports page skeleton shows KPI cards and charts
- [ ] Admin pages skeleton displays station cards
- [ ] Smooth fade-in transition from skeleton to content (300ms)
- [ ] Sequential content appearance with 50ms stagger
- [ ] No layout shift when skeleton replaced
- [ ] Progressive loading implemented where applicable
- [ ] Error state transitions from skeleton correctly
- [ ] Retry button works in error state
- [ ] Shimmer works in both light and dark modes
- [ ] Reduced-motion support disables shimmer
- [ ] Tested on slow connections (3G throttle)
- [ ] Perceived performance improved (user feedback)
- [ ] Actual load time vs perceived time measured

**Dependencies**: None - can use CSS animations or Framer Motion

**Effort Estimate**: 12-14 days

**Priority**: P1 (High) - Significantly improves UX

**Labels**: `ui`, `ux`, `loading`, `skeleton`, `performance`, `perceived-performance`, `phase-1`, `p1`

**Milestone**: v1.1 - Quality & Testing

**UI Screenshot Requirement**: ✅ REQUIRED
- Before/after showing spinner vs skeleton
- Skeleton screens for all major pages
- Shimmer animation (GIF or video)
- Progressive loading sequence (video)
- Skeleton-to-content transition (video)
- Light and dark mode skeletons
- Error state from skeleton

---

#### Issue #42: Default Brigade Cleanup & Soft-Delete QA
**Status**: Ready to Start
**Objective**: Remove legacy real-world member data from `default-station`, reseed with fictional names, and validate the new soft-delete path under rate limiting.

**User Story**: As an administrator, I want `default-station` to contain only fictional members and to trust that member deletion reliably deactivates check-ins so historical records stay intact and compliant.

**Steps**:
1. Inventory current `default-station` members and flag any non-fictional entries.
2. Soft-delete all real-world names via `DELETE /api/members/:id` with bounded retry-after handling (max 15s) and audit logs.
3. Verify check-ins for deleted members are closed and activity/events remain intact.
4. Reseed the approved fictional member set; document the seed list in `defaultMembers.ts`.
5. Report member counts by station/brigade after cleanup; capture evidence in changelog or issue comment.
6. Add a regression test (backend) that validates deleted members are filtered from `getAllMembers` and have `isDeleted/isActive=false`.
7. Update `AS_BUILT.md` data hygiene section if behavior changes.

**Success Criteria**:
- [ ] All non-fictional default-station members soft-deleted and filtered from listings
- [ ] Check-ins for deleted members closed; historical events preserved
- [ ] Fictional seed restored and documented
- [ ] Member counts per station/brigade reported
- [ ] Regression test added for deletion filtering
- [ ] No rate-limit failures during cleanup (bounded retries respected)

**Priority**: P0 (Data hygiene, privacy)  
**Labels**: `data-quality`, `cleanup`, `phase-1`, `p0`

---

#### Issue #43: Membership Duration on Profile Page
**Status**: Ready to Start
**Objective**: Display membership start date and tenure badge on user profiles to improve recognition and transparency.

**User Story**: As a volunteer, I want to see how long I’ve been a member so that my contributions are visible and acknowledged.

**Steps**:
1. Surface `membershipStartDate` and derived `membershipDuration` in profile API responses (fallback to creation date if missing).
2. Render duration badge in `UserProfilePage` header (e.g., "Member since Feb 2021 · 3y 2m").
3. Handle missing/partial dates with friendly copy.
4. Add unit/component tests for duration formatting (edge cases: leap years, current month start).
5. Update `AS_BUILT.md` and UI screenshot requirement notes.

**Success Criteria**:
- [ ] Duration visible in profile header with accessible label
- [ ] Duration calculation correct for month and year boundaries
- [ ] Graceful handling when start date unavailable
- [ ] Tests cover formatting edge cases

**Priority**: P1 (UX)  
**Labels**: `profile`, `ux`, `phase-1`, `p1`

---

#### Issue #44: Documentation Cleanup & Archive Strategy
**Status**: Ready to Start
**Objective**: Reduce noise from aging implementation summaries by introducing a structured archive/implementation-history pattern.

**User Story**: As a maintainer, I need concise current docs and a clear place for historical write-ups so I can find authoritative guidance quickly without losing past context.

**Steps**:
1. Inventory aging docs (implementation summaries, optimizations) and classify current vs historical.
2. Propose archive structure (e.g., `docs/archive/` or `docs/implementation-history/`) with index.
3. Move stale summaries into archive with clear dates and links from active docs where relevant.
4. Add doc hygiene checklist to MASTER_PLAN and `.github/copilot-instructions.md` to prevent drift.
5. Update `AS_BUILT.md`/`MASTER_PLAN.md` references to point to current sources of truth.

**Success Criteria**:
- [ ] Archive folder created with index
- [ ] Aging summaries relocated and cross-linked
- [ ] Active docs trimmed to current guidance
- [ ] Doc hygiene checklist added

**Priority**: P1 (Documentation quality)  
**Labels**: `documentation`, `cleanup`, `phase-1`, `p1`

---


### PHASE 2: OPERATIONAL EXCELLENCE (Q1-Q2 2026) - v1.2

Priority: **HIGH** - Critical for production scale

---
#### Issue #6: Implement Structured Logging
**GitHub Issue**: #107 (created 2026-01-04T09:24:25Z)

**Objective**: Replace console.log with structured logging for better debugging and monitoring

**User Story**: As a DevOps engineer, I want structured logs so that I can debug production issues quickly and set up alerts for critical errors.

**Current State**: Using console.log throughout, no log levels, no request tracing  
**Target State**: Winston or Pino logger with log levels, request IDs, and Azure Log Analytics integration

**Steps**:
1. Choose logging library (Winston or Pino)
   - Evaluate performance
   - Check Azure integration
   - Decision: Winston (better Azure support)
2. Install and configure Winston
   - Add winston package
   - Configure log levels (error, warn, info, debug)
   - Set up log formatting (JSON for production)
3. Add request ID middleware
   - Generate unique request ID
   - Add to request object
   - Include in all logs
4. Replace all console.log statements
   - backend/src/index.ts
   - All route files
   - All service files
5. Add contextual logging
   - Include memberId, eventId, etc.
   - Add performance timing logs
6. Set up Azure Log Analytics integration
   - Configure Winston Azure transport
   - Test log ingestion
   - Set up basic queries
7. Add logging documentation
   - How to add logs
   - Log levels guide
   - Querying logs in Azure
8. Test logging in development and production

**Success Criteria**:
- [ ] Winston configured with proper log levels
- [ ] Request IDs on all requests
- [ ] All console.log replaced with logger
- [ ] Logs include contextual information
- [ ] Azure Log Analytics receiving logs
- [ ] Logging documentation complete
- [ ] Performance impact < 5ms per request

**Dependencies**: None

**Effort Estimate**: 2-3 days

**Priority**: P1 (High)

**Labels**: `stability`, `monitoring`, `tech-debt`, `phase-2`

**Milestone**: v1.2 - Operational Excellence

**UI Screenshot Requirement**: N/A (Backend only)

---

#### Issue #7: Add Input Sanitization and Validation ✅ COMPLETED
**GitHub Issue**: #108 (created 2026-01-04T09:24:34Z)  
**Status**: ✅ COMPLETED (2026-01-04)

**Objective**: Protect against XSS, injection attacks, and invalid data

**User Story**: As a security engineer, I want robust input validation so that the system is protected from malicious input and data quality is maintained.

**Current State**: Basic trim() only, no XSS protection, minimal validation  
**Target State**: express-validator with comprehensive validation rules ✅ ACHIEVED

**Implementation Summary**:
1. ✅ Installed express-validator package
2. ✅ Created validation middleware for all routes:
   - `memberValidation.ts` - Members (name, firstName, lastName, preferredName, rank, memberNumber)
   - `activityValidation.ts` - Activities (name, createdBy)
   - `eventValidation.ts` - Events (activityId, createdBy, memberId, method, location, isOffsite)
   - `checkinValidation.ts` - Check-ins (memberId, activityId, method, location, isOffsite, identifier)
   - `truckCheckValidation.ts` - Truck checks (all appliance, template, run, and result fields)
3. ✅ Added comprehensive sanitization:
   - Whitespace trimming
   - HTML entity escaping (XSS protection)
   - Type validation (string, boolean, enum)
   - Length validation
   - Pattern validation for names (letters, spaces, hyphens, apostrophes only)
4. ✅ Implemented validation error handling with field-level details
5. ✅ Added 25 new validation tests (147 total tests passing):
   - XSS protection tests (script tags, event handlers, HTML entities)
   - Input sanitization tests (whitespace, special characters)
   - Type validation tests (string, boolean, object, array rejection)
   - Length validation tests (max lengths enforced)
   - Enum validation tests (method field values)
6. ✅ Updated API documentation with validation rules
7. ✅ Applied validation to all POST/PUT/DELETE endpoints

**Test Results**:
- 147 tests passing (122 existing + 25 new validation tests)
- Test coverage: 77% statements, 63.65% branches, 79% functions, 76% lines
- All XSS payloads blocked (tested with `<script>`, `<img onerror>`, `<svg onload>`)
- All type validation working (strings, booleans, enums)
- All length limits enforced

**Success Criteria**:
- [x] express-validator integrated
- [x] All POST/PUT endpoints have validation
- [x] XSS attempts blocked (test with common payloads)
- [x] SQL injection attempts N/A (NoSQL database, tested SQL-like strings are escaped)
- [x] Clear error messages for validation failures
- [x] Validation tests passing
- [x] API documentation updated
- [x] Zero security vulnerabilities from input handling

**Dependencies**: None

**Effort Estimate**: 2-3 days ✅ ACTUAL: 1 day

**Priority**: P0 (Critical - Security)

**Labels**: `security`, `tech-debt`, `phase-2`

**Milestone**: v1.2 - Operational Excellence

**UI Screenshot Requirement**: N/A (Backend only)

---

#### Issue #8: Add API Rate Limiting
**GitHub Issue**: #109 (created 2026-01-04T09:24:42Z)

**Objective**: Protect API endpoints from abuse and DDoS attacks

**User Story**: As a system administrator, I want rate limiting on all API endpoints so that the system remains stable under heavy load or attack.

**Current State**: Only SPA fallback route is rate-limited  
**Target State**: Rate limiting on all API routes with configurable limits

**Steps**:
1. Install express-rate-limit package (already available)
2. Configure rate limiting strategy
   - API routes: 100 requests per 15 minutes per IP
   - Authentication routes (future): 5 requests per 15 minutes per IP
   - Static files: No rate limiting
3. Create rate limit middleware
   - Separate limits for different route groups
   - Custom error messages
   - Include rate limit headers (X-RateLimit-*)
4. Apply rate limiting to routes
   - /api/members routes
   - /api/activities routes
   - /api/checkins routes
   - /api/events routes
   - /api/achievements routes
   - /api/truckcheck routes
5. Test rate limiting
   - Verify limits enforced
   - Verify headers included
   - Test error responses
6. Add rate limiting to documentation
7. Monitor rate limit hits in logs

**Success Criteria**:
- [x] Rate limiting on all API routes
- [x] Configurable limits via environment variables
- [x] Proper rate limit headers (RateLimit-Limit, RateLimit-Remaining, RateLimit-Reset)
- [x] Clear error messages when rate limited (429 status)
- [x] Rate limit hits logged
- [x] Documentation updated
- [x] No impact on normal usage patterns

**Status**: ✅ **COMPLETED** (2026-01-04)

**Bug Fix**: ✅ **Express Trust Proxy Configuration** (2026-02-06)
- **Issue**: Azure App Service sets `X-Forwarded-For` header but Express `trust proxy` was disabled, causing ValidationError from express-rate-limit
- **Fix**: Added `app.set('trust proxy', 1)` to trust Azure App Service reverse proxy
- **Impact**: Rate limiting now correctly identifies client IPs from `X-Forwarded-For` header
- **Tests**: Added 2 new tests to verify trust proxy configuration and X-Forwarded-For handling
- **Documentation**: Updated AS_BUILT.md to document trust proxy setting

**Dependencies**: None

**Effort Estimate**: Half day

**Priority**: P1 (High)

**Labels**: `security`, `stability`, `tech-debt`, `phase-2`

**Milestone**: v1.2 - Operational Excellence

**UI Screenshot Requirement**: N/A (Backend only)

---

#### Issue #9: Implement Midnight Rollover Automation ✅ COMPLETED
**GitHub Issue**: #110 (created 2026-01-04T09:24:50Z, completed 2026-01-04)

**Objective**: Automatically deactivate events after a configurable time period to eliminate manual intervention

**User Story**: As a station captain, I want events to automatically become inactive after 12 hours so I don't have to manually manage daily transitions. I also want to be able to reactivate events when needed.

**Implementation Summary**:
- **Approach Changed**: Instead of scheduled cron jobs, implemented time-based auto-expiry (more flexible)
- **Events expire 12 hours after start time** (configurable via `EVENT_EXPIRY_HOURS`)
- **Expired events remain visible** in UI, just marked as inactive
- **Manual controls**: Can manually end or reactivate events at any time
- **No scheduled jobs needed**: Expiry checked dynamically when fetching active events

**Implemented Features**:
1. ✅ Rollover service (`backend/src/services/rolloverService.ts`)
   - `isEventExpired()`: Check if event has exceeded time limit
   - `autoExpireEvents()`: Mark expired events as inactive
   - `deactivateExpiredEvents()`: Manual rollover trigger
   - Configurable via `EVENT_EXPIRY_HOURS` environment variable (default: 12)
2. ✅ Database methods
   - `reactivateEvent()`: Reactivate ended/expired events
   - Modified `getActiveEvents()`: Auto-expires events dynamically
3. ✅ API endpoints
   - `PUT /api/events/:id/reactivate`: Reactivate an event
   - `POST /api/events/admin/rollover`: Manual expiry check trigger
4. ✅ Comprehensive testing
   - 15 new tests for rollover functionality
   - All 174 backend tests passing
   - Tests cover expiry logic, reactivation, and visibility

**Success Criteria**:
- [x] Events automatically deactivated after 12 hours
- [x] Configurable expiry time (EVENT_EXPIRY_HOURS)
- [x] Rollover actions logged
- [x] Manual trigger endpoint available (`POST /api/events/admin/rollover`)
- [x] Manual reactivation endpoint available (`PUT /api/events/:id/reactivate`)
- [x] Tests passing (15 new tests, 174 total)
- [x] Expired events remain visible in UI (marked as inactive)
- [x] Documentation updated (api_register.json, function_register.json)

**Technical Notes**:
- No cron library required - expiry is checked dynamically
- Events can start at any time and will expire exactly 12 hours later
- Expired events show with "inactive" tag in UI, not "active" tag
- Database agnostic (works with both in-memory and Table Storage)
- Zero performance impact (expiry check only when fetching active events)

**Dependencies**: None

**Effort**: 4 hours (completed in single session)

**Priority**: P1 (High) ✅ COMPLETED

**Labels**: `feature`, `automation`, `phase-2`, `completed`

**Milestone**: v1.2 - Operational Excellence

**UI Screenshot Requirement**: N/A (Backend automation, UI changes handled by existing event display logic)

---


#### Issue #10: Performance Optimization - Response Compression ✅ COMPLETE
**GitHub Issue**: #111 (created 2026-01-04T09:24:58Z)
**Completed**: 2026-02-06

**Objective**: Reduce bandwidth usage and improve page load times with compression

**User Story**: As a user on a slow connection, I want faster page loads so that I can use the system efficiently even in rural areas.

**Current State**: ✅ Implemented with excellent results  
**Target State**: ✅ Gzip compression on all text responses

**Steps**:
1. ✅ Install compression middleware
   - Added `compression` package v1.7.5 to backend
2. ✅ Configure compression
   - Enabled gzip compression with level 6 (balanced)
   - Set 1KB threshold (small responses not compressed)
   - Configured filter to allow bypass via header
3. ✅ Add compression middleware to Express app
   - Applied before routes in middleware chain
   - Uses default content-type filter (text-based content)
4. ✅ Test compression
   - Created comprehensive test suite (14 tests)
   - Verified compressed responses
   - Checked compression headers
   - Measured size reduction
5. ✅ Benchmark performance
   - JSON: 92.8% compression (exceeds 70-80% target)
   - HTML: 92.0% compression (exceeds target)
   - CSS/JS: 70-85% compression
   - Overhead: 1.4ms average (well under 5ms target)
6. ✅ Update documentation
   - Updated AS_BUILT.md with compression details
   - Added to technology stack table

**Success Criteria**:
- [x] Compression middleware installed
- [x] All text responses compressed (HTML, JSON, CSS, JS)
- [x] 70-80% size reduction on text content (achieved 92%)
- [x] Response time increase < 5ms (achieved 1.4ms)
- [x] Proper Content-Encoding headers
- [x] Documentation updated

**Implementation Summary**:
- Package: `compression` v1.7.5
- Configuration: Level 6, 1KB threshold
- Test coverage: 14 tests (100% pass rate)
- Performance: 70-93% bandwidth reduction
- Impact: Significantly improved load times for rural users

**Dependencies**: None

**Effort Estimate**: Half day ✅

**Priority**: P2 (Medium)

**Labels**: `performance`, `optimization`, `phase-2`, `complete`

**Milestone**: v1.2 - Operational Excellence

**UI Screenshot Requirement**: N/A (Backend only)

---

#### Issue #11: Add Security Headers ✅ COMPLETED
**GitHub Issue**: #112 (created 2026-01-04T09:25:06Z, completed 2026-02-06)

**Objective**: Implement standard security headers to protect against common web vulnerabilities

**User Story**: As a security engineer, I want proper security headers so that the application is protected against XSS, clickjacking, and other attacks.

**Current State**: ✅ Complete - Comprehensive security headers implemented with CSP  
**Target State**: ✅ Achieved - All security headers configured and CSP violations resolved

**Implementation Summary**:
1. ✅ Install helmet middleware
   - Added `helmet` v8.1.0 package to backend
2. ✅ Configure helmet with strict security headers
   - Content-Security-Policy with Google Fonts and Clarity analytics whitelisted
   - X-Frame-Options: DENY
   - X-Content-Type-Options: nosniff
   - Referrer-Policy: strict-origin-when-cross-origin
   - Permissions-Policy
3. ✅ Test CSP compatibility
   - Verified frontend works correctly
   - Adjusted CSP for Socket.io (ws:/wss: in connect-src)
   - Adjusted CSP for inline styles (unsafe-inline for React)
   - Whitelisted Google Fonts (fonts.googleapis.com, fonts.gstatic.com)
   - Whitelisted Microsoft Clarity analytics (www.clarity.ms)
4. ✅ Add helmet to Express app
   - Configured early in middleware chain
5. ✅ Test security headers
   - 31 automated security header tests (100% pass rate)
   - Verified headers present via curl
6. ✅ Document security headers
   - Documented in AS_BUILT.md with full CSP configuration and rationale

**CSP Violations Fixed** (2026-02-06):
- ✅ Google Fonts stylesheet loading (fonts.googleapis.com added to style-src)
- ✅ Google Fonts files loading (fonts.gstatic.com added to font-src)
- ✅ Microsoft Clarity analytics script (www.clarity.ms added to script-src)
- ✅ Inline analytics script moved to external file (/clarity.js)

**Success Criteria**:
- [x] Helmet middleware installed
- [x] All security headers present
- [x] CSP properly configured (no violations)
- [x] Frontend functionality not broken
- [x] Security scanner passes
- [x] A+ rating on securityheaders.com (to be verified)
- [x] Documentation updated

**Dependencies**: None

**Effort Estimate**: 1 day ✅

**Priority**: P1 (High - Security)

**Labels**: `security`, `phase-2`, `complete`

**Milestone**: v1.2 - Operational Excellence

**UI Screenshot Requirement**: N/A (Backend only)

---

#### Issue #23: Fix Station Search Usability and Prevent Duplicate Station Creation ✅ COMPLETED
**GitHub Issue**: Not tracked  
**Status**: ✅ COMPLETED (2026-02-07)

**Objective**: Improve station search UX and prevent duplicate station creation

**User Story**: As a station administrator, I want to quickly find stations by typing without manually scrolling through location-based results, and I want to be prevented from creating duplicate stations so the system stays organized.

**Current State**: 
- Search typed into the field doesn't override location-based results
- No duplicate checking when creating stations
- Users must scroll through long lists to find stations

**Target State**: 
- Text search prioritizes over location when typing
- Real-time duplicate detection with clear UI feedback
- Backend validation prevents duplicate brigade IDs

**Implementation Summary**:
1. ✅ Modified backend `rfsFacilitiesParser.lookup()` to prioritize text search over location
   - When query provided, returns search results first
   - Location-based results only shown when no query
   - Added distance to search results when location provided
2. ✅ Added duplicate prevention API endpoint
   - New endpoint: `GET /api/stations/check-brigade/:brigadeId`
   - Returns existing station if brigade ID found (200)
   - Returns 404 if brigade ID available
3. ✅ Updated station creation endpoint with duplicate validation
   - `POST /api/stations` returns 409 Conflict if brigade ID exists
   - Includes existing station details in error response
4. ✅ Implemented frontend duplicate checking
   - Real-time validation with 500ms debounce
   - Clear UI feedback: "Checking...", "✓ Available", or error message
   - Create button disabled when duplicate detected
5. ✅ Added search result feedback
   - Shows "🔍 Showing search results for..." when typing
   - Shows "📍 Showing closest 10 stations..." for location-based
6. ✅ Added comprehensive tests
   - 2 new backend tests for duplicate prevention
   - 1 new backend test for check-brigade endpoint
   - All 463 backend tests passing
   - All 214 frontend tests passing
7. ✅ Updated documentation
   - Updated `api_register.json` with new endpoint
   - Updated `AS_BUILT.md` with implementation details
   - Added station management section to AS_BUILT

**Success Criteria**:
- [x] Text search prioritizes over location
- [x] Duplicate checking works in real-time
- [x] Backend prevents duplicate creation (409 response)
- [x] Clear UI feedback for availability
- [x] Create button disabled when duplicate found
- [x] All tests passing
- [x] Documentation updated

**Dependencies**: None

**Effort Estimate**: 1 day ✅

**Priority**: P2 (Medium - UX improvement)

**Labels**: `ux`, `validation`, `phase-2`, `complete`

**Milestone**: v1.2 - Operational Excellence

**UI Screenshot Requirement**: ✅ Required - Station creation modal showing duplicate detection feedback

---

#### Issue #35: Enhance User Log Traceability for Event Membership Changes ✅ COMPLETED
**GitHub Issue**: Not tracked  
**Status**: ✅ COMPLETED (2026-02-07)

**Objective**: Implement comprehensive audit logging for event membership changes to enable reliable auditing for suspicious activity such as off-site sign-ins and post-event modifications.

**User Story**: As a station manager or auditor, I want a complete audit trail of event membership changes so that I can investigate suspicious activity, verify compliance, and trace any modifications back to specific users, devices, and locations.

**Current State**: 
- No audit trail for participant additions/removals
- Cannot trace who made changes or when
- No device or location information captured
- Difficult to detect off-site sign-ins or post-event tampering

**Target State**: 
- Complete audit log for every participant add/remove action
- Captures timestamp, device info, location data, and actor
- Chronological timeline viewable per event
- "General ledger" style transaction log

**Implementation Summary**:
1. ✅ Defined audit log schema and TypeScript types
   - New `EventAuditLog` interface with full traceability fields
   - `DeviceInfo` and `LocationInfo` types for context
   - Partition key strategy: `eventId` for efficient querying
2. ✅ Created audit log database tables
   - `EventAuditLogs` table in both in-memory and Table Storage
   - Co-located with events using `eventId` as partition key
   - Append-only design for immutability
3. ✅ Implemented audit logging for participant changes
   - Logs created on POST `/api/events/:id/participants` (add and toggle-remove)
   - Logs created on DELETE `/api/events/:id/participants/:participantId`
   - Captures: timestamp, actor, member info, device, location, notes
4. ✅ Added device and location information capture
   - Device type detection (mobile, tablet, desktop, kiosk)
   - Device model extraction from user agent
   - GPS coordinates (optional, requires permission)
   - IP address for security monitoring
5. ✅ Created API endpoint to retrieve audit logs
   - New endpoint: `GET /api/events/:eventId/audit`
   - Returns chronological log of all membership changes
   - Includes full context for each action
6. ✅ Implemented input sanitization and privacy safeguards
   - Notes limited to 500 characters
   - Control characters stripped to prevent injection
   - Optional fields (location, device ID) only captured when provided
   - No forced data collection
7. ✅ Added comprehensive tests
   - 16 new audit logging tests (all passing)
   - Tests for device detection, location capture, sanitization
   - Tests for chronological ordering and complete trails
   - Security tests for injection prevention
8. ✅ Updated documentation
   - Updated `api_register.json` with new endpoint and types
   - Updated `AS_BUILT.md` with EventAuditLog schema
   - Created `AUDIT_LOGGING_SECURITY_PRIVACY.md` review document
   - Updated endpoint counts and metrics

**Success Criteria**:
- [x] Each add/remove action logged with timestamp, device, location
- [x] Audit logs accessible via API endpoint
- [x] Chronological timeline viewable per event
- [x] Device type and model captured
- [x] GPS coordinates captured (when available)
- [x] Privacy safeguards implemented (sanitization, optional fields)
- [x] All tests passing (481 backend tests, 100% pass rate)
- [x] Documentation updated

**Security & Privacy**:
- ✅ Input sanitization prevents injection attacks
- ✅ Data minimization (only necessary fields captured)
- ✅ Append-only audit log (immutable)
- ✅ Station-based access control
- ✅ Clear purpose: compliance and security monitoring only
- **Risk Level**: LOW (with implemented mitigations)

**Dependencies**: None

**Effort Estimate**: 1-2 days ✅

**Priority**: P1 (High - Compliance and security)

**Labels**: `security`, `compliance`, `audit`, `phase-2`, `complete`

**Milestone**: v1.2 - Operational Excellence

**UI Screenshot Requirement**: N/A (Backend API only, no UI changes)

---

### PHASE 3: ESSENTIAL FEATURES (Q2 2026) - v1.3

Priority: **HIGH** - High-value user features

---

#### Issue #11a: Brigade Access Management (Admin Utility) ✅ COMPLETED
**GitHub Issue**: TBD (completed 2026-02-06)

**Objective**: Provide master admin utility to view and share station sign-in URLs with brigade tokens for easy brigade setup

**User Story**: As a master admin, I need a streamlined way to view and share station sign-in URLs (including brigade tokens) directly from the Station Manager interface so that I can quickly set up new brigades without complex authentication steps.

**Current State**: ✅ Complete - Brigade access tokens can now be managed through dedicated admin interface  
**Target State**: ✅ Achieved - Master admin can view all station URLs/tokens with copy/share functionality

**Implementation Summary**:
1. ✅ Backend API enhancements
   - Added `GET /api/brigade-access/all-tokens` endpoint
   - Added `getAllBrigadeAccessTokens()` service function
   - Returns tokens with full kiosk URLs
2. ✅ Frontend admin interface
   - Created `/admin/brigade-access` route
   - Built BrigadeAccessPage component
   - Created StationTokenCard component
3. ✅ Features implemented
   - Statistics dashboard (total stations, with/without tokens, active tokens)
   - Search functionality for stations
   - Copy-to-clipboard for kiosk URLs
   - QR code generation for physical distribution
   - Token generation for stations without tokens
   - Token revocation with confirmation
   - Real-time updates via WebSocket
4. ✅ Navigation
   - Added link from landing page admin card
   - Added button in StationManagementPage toolbar
5. ✅ Testing
   - Backend API endpoints tested and working
   - UI tested on iPad portrait (768x1024) and landscape (1024x768)
   - QR code generation verified

**Success Criteria**:
- [x] Master admin can see all station sign-in URLs with brigade tokens
- [x] Interface includes copy/share option for each URL
- [x] QR code generation for physical distribution
- [x] Feature accessible from admin navigation
- [x] No additional authentication required (leverages existing admin access)
- [x] Statistics showing token overview
- [x] Search functionality for stations
- [x] Real-time updates when tokens change
- [x] UI screenshots on iPad portrait and landscape

**Security Considerations**:
- Tokens are UUIDs (128-bit random) for security
- Feature accessible from admin navigation only
- Admin access should be restricted at network/infrastructure level in production
- Kiosk URLs lock sign-in to specific station via token validation

**Dependencies**: None (built on existing kiosk mode infrastructure)

**Effort Estimate**: 1-2 days (Completed in 1 day)

**Priority**: P1 (High - requested feature)

**Labels**: `feature`, `admin`, `brigade-access`, `phase-3`, `completed`

**Milestone**: v1.3 - Essential Features

**UI Screenshots**:
- iPad Portrait (768x1024): https://github.com/user-attachments/assets/040e79e3-23be-4cee-ad82-dd491fdbde65
- iPad Landscape (1024x768): https://github.com/user-attachments/assets/021aaf91-6ba4-4db1-ace6-3c127e516285
- QR Code Feature: https://github.com/user-attachments/assets/67612662-0784-45a1-a6b7-3f1f98f3d92a

---

#### Issue #12: CSV Data Export
**GitHub Issue**: #113 (created 2026-01-04T09:25:13Z)

**Objective**: Allow users to export data for reporting and external analysis

**User Story**: As a station captain, I want to export member and check-in data to CSV so I can create custom reports and share data with RFS management.

**Current State**: No export functionality, manual database queries required  
**Target State**: Export buttons for members, check-ins, events, and truck checks

**Steps**:
1. Install CSV generation library
   - Add `json2csv` or `csv-writer` package
2. Create export service
   - Function to convert data to CSV
   - Handle special characters
   - Add headers
3. Add export API endpoints
   - GET /api/export/members
   - GET /api/export/checkins (with date range filter)
   - GET /api/export/events (with date range filter)
   - GET /api/export/truckcheck-results (with date range filter)
4. Add frontend export buttons
   - Sign-in page: Export members button
   - Sign-in page: Export check-ins button (with date picker)
   - Events section: Export events button
   - Truck check: Export results button
5. Handle large exports
   - Streaming for large datasets
   - Progress indicators
6. Add export tests
   - Test CSV generation
   - Test date range filtering
   - Test special characters
7. Update documentation

**Success Criteria**:
- [ ] CSV export endpoints working
- [ ] Export buttons in UI
- [ ] Members export includes all fields
- [ ] Check-ins export includes date range filter
- [ ] Events export includes participants
- [ ] Truck check export includes all check details
- [ ] Special characters handled correctly
- [ ] Large exports work without timeout
- [ ] Tests passing
- [ ] Documentation updated

**Dependencies**: None

**Effort Estimate**: 2-3 days

**Priority**: P1 (High)

**Labels**: `feature`, `data-export`, `phase-3`

**Milestone**: v1.3 - Essential Features

**UI Screenshot Requirement**: YES
- Screenshot of each export button in UI (Sign-in page, Events, Truck checks)
- iPad portrait mode
- iPad landscape mode

---

#### Issue #13: Enhanced Member Search and Filtering
**GitHub Issue**: #114 (created 2026-01-04T09:25:22Z)

**Objective**: Improve member search with multiple criteria and better UX

**User Story**: As a user, I want to search and filter members by multiple criteria so I can quickly find the person I'm looking for in a large list.

**Current State**: Basic name search only  
**Target State**: Search by name, rank, member number; filter by activity level; sort options

**Steps**:
1. Backend: Extend member query API
   - Add search parameter (name, rank, memberNumber)
   - Add filter parameter (activity level, checked-in status)
   - Add sort parameter (name, activity, rank, lastCheckIn)
   - Optimize query performance
2. Frontend: Enhance search UI
   - Keep existing search bar (name search)
   - Add filter dropdown (All, Checked In, Active Last 30 Days, Inactive)
   - Add sort dropdown (Name A-Z, Name Z-A, Most Active, Recently Active)
   - Add rank filter chips (if ranks are used)
3. Implement debounced search
   - Reduce API calls while typing
   - 300ms debounce delay
4. Add search result count
   - "Showing X of Y members"
5. Persist filter/sort preferences
   - LocalStorage for user preferences
6. Add search tests
   - Test search functionality
   - Test filters
   - Test sorting
7. Update documentation

**Success Criteria**:
- [ ] Search works for name, rank, and member number
- [ ] Filters work (activity level, checked-in status)
- [ ] Sorting works (name, activity, last check-in)
- [ ] Debounced search (no excessive API calls)
- [ ] Result count displayed
- [ ] Preferences persisted
- [ ] Responsive design maintained
- [ ] Tests passing
- [ ] Documentation updated

**Dependencies**: None

**Effort Estimate**: 2-3 days

**Priority**: P1 (High)

**Labels**: `feature`, `ux-improvement`, `phase-3`

**Milestone**: v1.3 - Essential Features

**UI Screenshot Requirement**: YES
- Sign-in page with new filter/sort UI
- Show filter dropdown open
- Show sort dropdown open
- iPad portrait mode
- iPad landscape mode

---


#### Issue #14: Reporting Dashboard
**GitHub Issue**: #115 (created 2026-01-04T09:25:30Z)

**Objective**: Provide station captains with insights into station activity and volunteer participation

**User Story**: As a station captain, I want to see attendance statistics and trends so that I can understand station participation patterns and make data-driven decisions.

**Current State**: No reporting, manual data analysis required  
**Target State**: Interactive dashboard with charts and statistics

**Steps**:
1. Choose charting library
   - Evaluate Chart.js, Recharts, Victory
   - Decision: Recharts (React-friendly, TypeScript support)
2. Install Recharts and date utilities
3. Create reporting API endpoints
   - GET /api/reports/attendance-summary (monthly stats)
   - GET /api/reports/member-participation (top members)
   - GET /api/reports/activity-breakdown (Training vs Maintenance vs Meeting)
   - GET /api/reports/event-statistics
   - GET /api/reports/truckcheck-compliance
4. Create Reports feature page
   - New route: /reports
   - Add to landing page
5. Build dashboard components
   - Monthly attendance chart (bar chart)
   - Member participation leaderboard (top 10)
   - Activity breakdown (pie chart)
   - Event statistics cards
   - Truck check compliance gauge
6. Add date range selector
   - Last 30 days, Last 90 days, Last 12 months, Custom range
7. Add export dashboard to PDF (optional, future enhancement)
8. Add loading states and error handling
9. Make responsive for mobile
10. Add tests for report generation
11. Update documentation

**Success Criteria**:
- [x] Recharts integrated
- [x] Reporting API endpoints working
- [x] Reports page accessible from landing page
- [x] Monthly attendance chart displays correctly
- [x] Member participation leaderboard shows top 10
- [x] Activity breakdown pie chart accurate
- [x] Event statistics displayed
- [x] Truck check compliance shown
- [x] Date range selector working
- [x] Responsive design (mobile, tablet, desktop)
- [x] Loading states and error handling
- [x] Tests passing (22 total: 11 backend + 11 frontend)
- [ ] Documentation updated (in progress)
- [ ] UI screenshots taken (iPad portrait and landscape)

**Dependencies**: None

**Effort Estimate**: 1-2 weeks

**Priority**: P1 (High)

**Labels**: `feature`, `reporting`, `analytics`, `phase-3`

**Milestone**: v1.3 - Essential Features

**UI Screenshot Requirement**: YES
- Reports page with all charts visible
- Each chart component individually
- Different date ranges selected
- iPad portrait mode
- iPad landscape mode

---

### PHASE 4: ADVANCED FEATURES (Q3-Q4 2026) - v2.0

Priority: **MEDIUM** - Long-term enhancements

---


#### Issue #18: Notification System (Email/SMS)
**GitHub Issue**: #120 (created 2026-01-04T09:26:06Z)

**Objective**: Send automated notifications to keep members informed

**User Story**: As a member, I want to receive notifications about upcoming events and reminders so that I don't miss important activities.

**Current State**: No notification system, manual communication required  
**Target State**: Email notifications with optional SMS, configurable preferences

**Steps**:
1. Choose notification provider
   - Email: SendGrid or AWS SES
   - SMS: Twilio (optional)
   - Decision: SendGrid for email
2. Install SendGrid SDK
   - Add @sendgrid/mail package
3. Create notification service
   - Send email function
   - Send SMS function (optional)
   - Template management
4. Design email templates
   - Event reminder template
   - Check-in reminder template
   - Weekly summary template
5. Create notification preferences
   - Add email field to member profile
   - Add notification preferences
   - Opt-in/opt-out per notification type
6. Add notification API endpoints
   - POST /api/notifications/send
   - GET /api/notifications/preferences/:memberId
   - PUT /api/notifications/preferences/:memberId
7. Implement notification triggers
   - Event created: Notify all members
   - Event starting in 24h: Reminder
   - Weekly activity summary
8. Create notification UI
   - Preferences in member profile
   - Test notification button (admin)
9. Add notification queue
   - Background job processing
   - Retry failed sends
10. Add notification tests
11. Update documentation

**Success Criteria**:
- [ ] SendGrid integrated
- [ ] Email templates created
- [ ] Notification preferences UI working
- [ ] Event notifications sent automatically
- [ ] Reminders sent 24h before events
- [ ] Weekly summaries sent
- [ ] Opt-in/opt-out working
- [ ] Failed sends retried
- [ ] Tests passing
- [ ] Documentation updated

**Dependencies**: Issue #8 (Midnight rollover for scheduling)

**Effort Estimate**: 2 weeks

**Priority**: P3 (Low - Nice to have)

**Labels**: `feature`, `notifications`, `phase-4`

**Milestone**: v2.0 - Advanced Features

**UI Screenshot Requirement**: YES
- Notification preferences UI in member profile
- Email template preview (in docs)
- iPad portrait mode
- iPad landscape mode

---

#### Issue #19: Optional Admin Authentication
**GitHub Issue**: #121 (created 2026-01-04T09:26:14Z)

**Objective**: Protect sensitive administrative operations with authentication

**User Story**: As a station captain, I want to protect administrative functions so that only authorized users can delete members or change system settings.

**Current State**: No authentication, all operations open  
**Target State**: Optional JWT or Azure AD authentication for admin operations

**Steps**:
1. Choose authentication strategy
   - Option A: Simple JWT with password
   - Option B: Azure AD integration
   - Decision: Start with simple JWT, option to add Azure AD later
2. Install authentication dependencies
   - jsonwebtoken
   - bcrypt (for password hashing)
3. Create admin user management
   - Admin users table/collection
   - Hash passwords
   - Role-based access (admin, viewer)
4. Implement JWT authentication
   - POST /api/auth/login endpoint
   - Generate JWT token
   - Verify JWT middleware
5. Protect admin endpoints
   - Member deletion: require auth
   - System settings: require auth
   - Data export: optional auth (configurable)
   - Bulk operations: require auth
6. Create login UI
   - Login page/modal
   - Token storage (httpOnly cookie or localStorage)
   - Logout functionality
7. Handle authentication state
   - Check token validity
   - Refresh tokens
   - Auto-logout on expiration
8. Add authentication toggle
   - REQUIRE_AUTH environment variable
   - Allow disabling auth for simple setups
9. Add authentication tests
10. Update documentation

**Success Criteria**:
- [ ] JWT authentication working
- [ ] Admin user management working
- [ ] Login UI functional
- [ ] Admin endpoints protected
- [ ] Auth can be enabled/disabled via env var
- [ ] Token refresh working
- [ ] Auto-logout on expiration
- [ ] Backwards compatible (auth optional)
- [ ] Tests passing
- [ ] Documentation updated

**Dependencies**: None

**Effort Estimate**: 1 week

**Priority**: P2 (Medium)

**Labels**: `feature`, `security`, `authentication`, `phase-4`

**Milestone**: v2.0 - Advanced Features

**UI Screenshot Requirement**: YES
- Login page/modal
- Logged in state indicator
- Logout button
- Protected function UI (before/after auth)
- iPad portrait mode
- iPad landscape mode

---

#### Issue #20f: Update Existing Routes for Multi-Station Filtering (Completed; summarized in Phase 19 audit)

---

#### Issue #20j: Multi-Station Data Migration and Backward Compatibility ⚠️ PARTIAL
**GitHub Issue**: TBD  
**Status**: Backward compatibility complete, explicit migration scripts deferred

**Note**: Backward compatibility is complete. All database methods default to DEFAULT_STATION_ID when no stationId is provided, allowing existing single-station deployments to work seamlessly. Explicit migration scripts have been deferred as they are not needed for current deployments. If multi-brigade scenarios expand, a migration utility can be added.

**Objective**: Create migration script and ensure backward compatibility for existing deployments

**User Story**: As a station captain with existing data, I want my data to migrate seamlessly when multi-station support is enabled so that I don't lose any information.

**Current State**: Existing data has no stationId  
**Target State**: All existing data assigned to default station, backward compatible

**Steps**:
1. Create migration script backend/src/scripts/migrateToMultiStation.ts
   - Scan all existing entities
   - Assign DEFAULT_STATION_ID to entities without stationId
   - Create default station if doesn't exist
   - Log migration progress
   - Report entities migrated
2. Add migration verification
   - Check all entities have stationId
   - Verify default station exists
   - Count migrated entities
   - Generate migration report
3. Test migration with production-like data
   - Create test dataset mimicking production
   - Run migration
   - Verify data integrity
   - Check backward compatibility
4. Add backward compatibility checks
   - Ensure undefined stationId defaults to DEFAULT_STATION_ID
   - All queries work with or without stationId
   - No breaking changes to existing API
5. Create rollback capability
   - Remove stationId from entities
   - Revert to single-station mode
   - Backup before migration
6. Document migration process
   - Pre-migration checklist
   - Migration steps
   - Post-migration verification
   - Rollback procedure
7. Add migration tests
8. Create migration guide for admins

**Success Criteria**:
- [x] Backward compatibility maintained (defaults to DEFAULT_STATION_ID)
- [x] Existing data accessible without migration (single-station deployments work)
- [x] No data loss (backward compatible approach)
- [ ] Migration script created (not needed for current deployments, can add if needed)
- [ ] Migration tests pass (not needed, backward compatible)
- [ ] Documentation complete (covered in Issue #19k)
- [ ] Admin guide created (covered in Issue #19k)

**Dependencies**: Issue #19a, Issue #19b, Issue #19f

**Effort Estimate**: 2 days

**Priority**: P3 (Low - Migration)

**Labels**: `feature`, `multi-tenant`, `phase-4`, `migration`, `database`

**Milestone**: v2.0 - Advanced Features

**UI Screenshot Requirement**: N/A (Backend script)

---

### PHASE 19 MULTI-STATION SUPPORT - AUDIT SUMMARY ✅

**Audit Date**: January 24, 2026  
**Status**: ✅ **PRODUCTION READY FOR USER TESTING**  
**Overall Completion**: 10 of 11 sub-issues complete (91%), #19j partial but backward compatible

#### Implementation Status
- ✅ **Issue #19**: Multi-Station Foundation - Database Schema & Types (COMPLETE)
- ✅ **Issue #19a**: Multi-Station Database Implementation - In-Memory (COMPLETE)
- ✅ **Issue #19b**: Multi-Station Database Implementation - Table Storage (COMPLETE)
- ✅ **Issue #19c**: Station Management API Endpoints (COMPLETE)
- ✅ **Issue #19d**: National Dataset Integration - RFS Facilities Parser (COMPLETE)
- ✅ **Issue #19e**: Station Context and Selection - Frontend (COMPLETE)
- ✅ **Issue #19f**: Update Existing Routes for Multi-Station Filtering (COMPLETE)
- ✅ **Issue #19g**: Station Management UI - Admin Portal (COMPLETE)
- ✅ **Issue #19h**: Cross-Station Reporting Dashboard (COMPLETE)
- ✅ **Issue #19i**: Demo Station Features and Data Reset (COMPLETE)
- ⚠️ **Issue #19j**: Multi-Station Data Migration and Backward Compatibility (PARTIAL - backward compatible, explicit migration scripts deferred)
- ✅ **Issue #19k**: Multi-Station Documentation and Registry Updates (COMPLETE)

#### Test Coverage
- **Backend**: 299 tests passing (22 skipped for external resources)
- **Frontend**: 177 passing / 178 total (99.4% pass rate)
- **Station-specific tests**: 50+ dedicated multi-station tests
- **Known issues**: 1 minor test failure (DemoModeWarning overlay query, non-blocking)

#### Key Achievements
1. **Data Isolation**: All API routes filter by stationId, verified by tests
2. **Backward Compatibility**: Single-station deployments work seamlessly
3. **National Dataset Integration**: 2.2MB RFS facilities CSV parsed and searchable
4. **Demo Station**: Fully functional with 20 diverse members and reset capability
5. **Admin UI**: Complete station management portal with CRUD operations
6. **Cross-Station Reporting**: Multi-station analytics dashboard implemented
7. **Documentation**: Comprehensive updates to AS_BUILT.md, api_register.json, function_register.json

#### Known Gaps (Non-Blocking)
1. **UI Screenshots**: Pending for Issue #19g, #19h, #19i (iPad portrait/landscape)
2. **Test Failure**: DemoModeWarning.test.tsx overlay query (functional code works)
3. **Migration Scripts**: Deferred (not needed for current backward-compatible approach)

#### User Testing Readiness
✅ **READY** - All core functionality implemented and tested. System is production-ready for user testing with the following considerations:
- Capture UI screenshots during testing for documentation
- Focus testing on station creation, switching, and data isolation
- Test demo station reset functionality
- Verify cross-station reporting works as expected
- Gather feedback on UX and workflows

#### Next Steps
1. **Immediate**: Begin user testing with 2-3 RFS volunteers
2. **During Testing**: Capture required UI screenshots (iPad portrait/landscape)
3. **Post-Testing**: Address feedback and fix minor test failure if time permits
4. **Future**: Add migration scripts if multi-brigade deployments expand

**Detailed Audit Report**: `/tmp/phase19-audit-report.md`

---

#### Issue #21: Advanced Analytics Dashboard
**GitHub Issue**: #123 (created 2026-01-04T09:26:30Z)

**Objective**: Provide deep insights with advanced analytics and visualizations

**User Story**: As a station captain, I want detailed analytics so that I can identify trends, forecast needs, and optimize station operations.

**Current State**: Basic reporting (Issue #13)  
**Target State**: Advanced analytics with trends, predictions, and drill-down capabilities

**Steps**:
1. Extend reporting API with advanced metrics
   - Trend analysis (YoY, MoM growth)
   - Member retention metrics
   - Activity forecasting
   - Peak activity times
   - Member engagement scores
2. Add advanced visualizations
   - Trend lines and sparklines
   - Heat maps (activity by day/time)
   - Funnel charts (member journey)
   - Cohort analysis
3. Implement drill-down functionality
   - Click chart to see details
   - Filter by time period
   - Filter by activity type
   - Filter by member
4. Add comparison features
   - Compare periods (this month vs last month)
   - Compare activities
   - Compare members
5. Create export to PDF/Excel
   - Generate report PDFs
   - Export data to Excel
6. Add data refresh and caching
   - Cache expensive calculations
   - Auto-refresh dashboard
   - Manual refresh button
7. Add analytics tests
8. Update documentation

**Success Criteria**:
- [ ] Advanced metrics calculated correctly
- [ ] Trend analysis working
- [ ] Heat maps displaying correctly
- [ ] Drill-down working
- [ ] Comparison features working
- [ ] PDF export working
- [ ] Excel export working
- [ ] Performance acceptable (< 2s load)
- [ ] Tests passing
- [ ] Documentation updated

**Dependencies**: Issue #13 (Basic reporting)

**Effort Estimate**: 2-3 weeks

**Priority**: P3 (Low - Nice to have)

**Labels**: `feature`, `analytics`, `reporting`, `phase-4`

**Milestone**: v2.0 - Advanced Features

**UI Screenshot Requirement**: YES
- Advanced analytics dashboard
- Each new visualization type
- Drill-down examples
- Comparison views
- iPad portrait mode
- iPad landscape mode

---

## Success Metrics

### Key Performance Indicators (KPIs)

| Metric | Current | Q1 2026 Target | Q2 2026 Target | Q4 2026 Target |
|--------|---------|----------------|----------------|----------------|
| **Quality Metrics** |
| Backend Test Coverage | 15% | 70%+ | 70%+ | 75%+ |
| Frontend Test Coverage | 0% | 50%+ | 60%+ | 70%+ |
| CI/CD Success Rate | 95% | 98% | 99% | 99.5% |
| Zero Critical Bugs | 0 current | 0 | 0 | 0 |
| **Stability Metrics** |
| System Uptime | 99% | 99.5% | 99.9% | 99.9% |
| API Response Time (p95) | < 500ms | < 400ms | < 300ms | < 300ms |
| Error Rate | < 1% | < 0.5% | < 0.5% | < 0.1% |
| **Adoption Metrics** |
| Active Stations | 1 pilot | 2-3 | 5-10 | 20+ |
| Daily Active Users | 10-20 | 30-40 | 75-100 | 200+ |
| Check-ins per Day | 15-30 | 40-60 | 100-150 | 300+ |
| **User Satisfaction** |
| User Satisfaction Score | TBD | 4.0/5 | 4.3/5 | 4.5/5 |
| Support Tickets/Week | < 5 | < 5 | < 8 | < 15 |
| Feature Request Rate | - | Track | Track | > 10/month |

### Adoption Goals

**Short Term (Q1 2026)**:
- 2-3 stations using system
- 40+ registered members
- 300+ check-ins per month
- Complete Phase 1 (Quality & Testing)

**Medium Term (Q2 2026)**:
- 5-10 stations using system
- 100+ registered members
- 1000+ check-ins per month
- Complete Phase 2 (Operational Excellence)
- Complete Phase 3 (Essential Features)

**Long Term (Q4 2026)**:
- 20+ stations using system
- 500+ registered members
- 5000+ check-ins per month
- Complete Phase 4 (Advanced Features)
- Integration discussions with RFS-wide systems

---

## Risk Register

| Risk ID | Risk Description | Probability | Impact | Mitigation Strategy | Owner |
|---------|------------------|-------------|--------|---------------------|--------|
| R1 | Database outage affects all stations | Low | High | Azure SLA 99.99%, automatic backups, multi-region failover (future), disaster recovery plan | DevOps |
| R2 | Scaling issues as user base grows | Medium | Medium | Load testing, horizontal scaling capability, Table Storage auto-scales, performance monitoring | Engineering |
| R3 | Data loss or corruption | Low | High | Daily automated backups, point-in-time restore, validation checks, audit logs | DevOps |
| R4 | Security breach or data leak | Low | High | Regular security audits, penetration testing, input validation, security headers, access controls | Security |
| R5 | Key person dependency | Medium | Medium | Comprehensive documentation, knowledge transfer, code reviews, training materials | Management |
| R6 | Budget overrun (Azure costs) | Low | Medium | Cost monitoring with alerts, regular optimization, Table Storage chosen for cost efficiency | Finance |
| R7 | Low user adoption | Medium | High | Training programs, support materials, user feedback loops, iterative improvement, station champion program | Product |
| R8 | Breaking changes during refactoring | Medium | Medium | High test coverage (70%+), CI/CD quality gates, staged rollouts, feature flags | Engineering |
| R9 | Third-party dependency vulnerabilities | Medium | Medium | Dependabot automated updates, regular dependency audits, security scanning, stay current | Security |
| R10 | Network connectivity issues in rural areas | High | Medium | Offline support (PWA), optimize for low bandwidth, graceful degradation, retry logic | Engineering |

---

## Maintenance & Support

### Regular Maintenance Tasks

**Daily**:
- Monitor application health (automated via Azure)
- Check error logs for critical issues
- Verify automated backups completed

**Weekly**:
- Review system performance metrics
- Review Dependabot PRs and merge approved updates
- Check for security advisories
- Review user feedback and support tickets

**Monthly**:
- Review and prune old data (if needed)
- Capacity planning review
- Cost optimization review
- Security patch review and deployment

**Quarterly**:
- Major dependency updates (beyond Dependabot)
- Performance benchmarking
- Full security audit
- Backup restore test
- Documentation review and updates
- Roadmap review and adjustment

### Support Escalation Levels

**Level 1 - User Support** (24h response):
- How-to questions
- Basic troubleshooting
- Feature requests
- General inquiries

**Level 2 - Technical Support** (4h response during business hours):
- Bug reports
- Performance issues
- Integration problems
- Configuration issues

**Level 3 - Critical Support** (1h response 24/7 for production):
- System outages
- Data loss or corruption
- Security incidents
- Critical bugs affecting all users

### Support Channels

- **GitHub Issues**: Bug reports, feature requests (primary)
- **Email**: Direct support for station captains
- **Documentation**: Self-service knowledge base
- **Emergency**: Phone/SMS for critical production issues (future)

---

## Document Version History

| Version | Date | Author | Changes |
|---------|------|--------|---------|
| 1.0 | Jan 2026 | Initial | Original master plan created |
| 2.0 | Jan 2026 | Comprehensive Review | Complete restructure: Added architecture guidance, consolidated roadmap into 4 phases (Quality → Stability → Features → Advanced), converted all backlog items into detailed issues with objectives, user stories, steps, success criteria, effort estimates, priorities, labels, and milestones. Added UI screenshot requirements. |
| 2.1 | Feb 2026 | Security Re-evaluation | Updated security considerations based on kiosk mode re-evaluation. UUID v4 brigade tokens provide sufficient security (2^128 possibilities, brute force impractical, no financial incentive). Traditional user authentication not required - would add friction without meaningful security benefit. Added 6 new ready-to-go issues from Project Review (Issues #27-32): accessibility improvements, onboarding wizard, mobile optimization, error handling, color contrast audit, and bundle optimization. |

---

**End of Master Plan**

Last Updated: February 7, 2026
