# RFS Station Management App - Plan Document

## Executive Summary

This document outlines the plan for developing an RFS (Rural Fire Service) Station Management application. The initial feature will be a digital sign-in system that allows members to check in/out of the station with activity tracking. The system will support multiple access methods (kiosk iPads, personal phones, QR codes) with real-time state synchronization across all devices.

---

## 1. Project Overview

### 1.1 Problem Statement
The RFS station needs a modern, efficient way to track member presence and activities. The current manual process needs to be replaced with a digital solution that:
- Works across multiple devices and locations
- Provides real-time updates
- Tracks activities associated with each visit
- Is quick and easy to use (one-tap sign-in)

### 1.2 Goals
- Streamline member check-in/check-out process
- Enable real-time visibility of who is at the station
- Track activities being performed (training, maintenance, meetings, etc.)
- Support multiple access points (kiosk iPads, mobile phones, QR codes)
- Provide foundation for future features

---

## 2. Feature Requirements

### 2.1 Core Features (MVP)

#### 2.1.1 Sign-In System
- **One-tap sign-in**: Users can select their name from a list and tap to sign in
- **Quick search**: Type a few letters to filter the member list
- **One-tap undo**: Tap again to undo the sign-in (no formal sign-out needed)
- **Persistent state**: Check-in status maintained until changed or midnight rollover

#### 2.1.2 Activity Selection
- **Pre-defined activities**: Training, Maintenance, Meeting
- **Custom activities**: Users can add custom activity types
- **Activity persistence**: Selected activity remains active until changed or midnight
- **Activity association**: Each check-in is associated with the current activity

#### 2.1.3 Multi-Device Support
- **Kiosk mode**: Two iPads at fixed locations in the station
- **Mobile web**: Accessible via personal phones/devices
- **QR code access**: Members can scan unique QR codes for quick sign-in

#### 2.1.4 Real-Time Synchronization
- **Live updates**: Changes reflect across all devices nearly immediately (< 2 seconds)
- **Conflict resolution**: Handle simultaneous actions gracefully
- **Offline resilience**: Handle temporary network interruptions

### 2.2 Future Features (Post-MVP)
*To be defined based on user feedback and needs*

---

## 3. Technical Architecture

### 3.1 Technology Stack Recommendations

**QUESTIONS FOR DECISION:**
- Q1: Do you have a preference for frontend framework? (React, Vue, Angular, Svelte, etc.)
- Q2: Do you have a preference for backend technology? (Node.js, Python, .NET, Go, etc.)
- Q3: What is the hosting environment? (Cloud provider preference? On-premises server?)
- Q4: Database preference? (PostgreSQL, MySQL, MongoDB, Firebase, etc.)
- Q5: Budget considerations for cloud services?

**Suggested Stack (pending answers above):**
- **Frontend**: React with TypeScript for type safety
- **Backend**: Node.js with Express or NestJS
- **Real-time**: WebSocket (Socket.io) or Server-Sent Events
- **Database**: PostgreSQL for reliability
- **Hosting**: Cloud platform (AWS, Azure, GCP) or Firebase for simplicity
- **Authentication**: JWT tokens or OAuth2

### 3.2 System Components

#### 3.2.1 Frontend Application
- Responsive web application
- Progressive Web App (PWA) for offline capability
- Kiosk mode UI (simplified, large touch targets)
- Mobile-optimized UI
- QR code scanner integration

#### 3.2.2 Backend Services
- RESTful API for CRUD operations
- WebSocket server for real-time updates
- QR code generation and validation
- Activity management service
- Member management service
- Check-in/check-out logic

#### 3.2.3 Database Schema (Initial)
```
Members
- id (UUID)
- name (string)
- qr_code (string, unique)
- created_at (timestamp)
- updated_at (timestamp)

Activities
- id (UUID)
- name (string)
- is_custom (boolean)
- created_by (member_id, nullable)
- created_at (timestamp)

CheckIns
- id (UUID)
- member_id (foreign key)
- activity_id (foreign key)
- check_in_time (timestamp)
- check_in_method (enum: kiosk, mobile, qr)
- location (string, optional)
- is_active (boolean)
- created_at (timestamp)
- updated_at (timestamp)

ActiveActivity
- id (UUID)
- activity_id (foreign key)
- set_at (timestamp)
- set_by (member_id)
```

**QUESTIONS FOR DECISION:**
- Q6: Should we track check-out times explicitly, or only check-ins?
- Q7: Do we need to track which specific kiosk/location was used?
- Q8: Should there be a limit on how many people can be checked in at once?
- Q9: Do we need historical reporting on check-ins and activities?

### 3.3 Real-Time Synchronization Strategy

**Options to consider:**
1. **WebSocket bidirectional communication** (Socket.io)
   - Pros: True real-time, bidirectional, efficient
   - Cons: More complex, requires WebSocket support

2. **Server-Sent Events (SSE)**
   - Pros: Simpler than WebSocket, built into HTTP
   - Cons: One-way (server to client only)

3. **Polling**
   - Pros: Simple, works everywhere
   - Cons: Higher latency, more server load

**QUESTIONS FOR DECISION:**
- Q10: What is the expected number of concurrent users/devices?
- Q11: What is the network reliability at the station?

**Recommended**: WebSocket (Socket.io) for best user experience, with fallback to polling

---

## 4. User Experience Design

### 4.1 User Flows

#### 4.1.1 Standard Sign-In Flow
1. User opens app (kiosk/mobile/QR)
2. User sees current activity (e.g., "Training")
3. User sees list of members (or search box)
4. User taps their name
5. Confirmation feedback (visual/audio)
6. User is checked in and appears in "Currently Signed In" list
7. Update propagates to all devices

#### 4.1.2 QR Code Sign-In Flow
1. User scans their unique QR code
2. System identifies user
3. User sees current activity
4. User confirms or selects different activity
5. User is checked in automatically
6. Update propagates to all devices

#### 4.1.3 Activity Change Flow
1. Authorized user accesses activity selection
2. Selects new activity (or creates custom one)
3. Confirmation required
4. New activity becomes active station-wide
5. All subsequent check-ins use new activity
6. Update propagates to all devices

#### 4.1.4 Undo Sign-In Flow
1. User taps their name in the "Signed In" list
2. Confirmation dialog: "Undo check-in?"
3. User confirms
4. Check-in is removed
5. Update propagates to all devices

### 4.2 UI/UX Requirements

**QUESTIONS FOR DECISION:**
- Q12: Should kiosks require any authentication or be completely open?
- Q13: Should there be different permission levels (admin vs member)?
- Q14: What accessibility requirements should we consider?
- Q15: Should the app support multiple languages?
- Q16: Do you have brand colors/logo for the RFS station?

#### 4.2.1 Kiosk Interface
- **Large touch targets** (minimum 60px)
- **High contrast** for visibility
- **Minimal navigation** to reduce complexity
- **Auto-lock/timeout** to return to main screen
- **Always-on display** showing current activity and signed-in members

#### 4.2.2 Mobile Interface
- **Responsive design** for various screen sizes
- **Touch-optimized** controls
- **Quick access** to common actions
- **Camera access** for QR scanning

#### 4.2.3 Visual Feedback
- **Success animations** on check-in
- **Error messages** that are clear and actionable
- **Loading states** during sync
- **Connection status** indicator

---

## 5. Security & Access Control

### 5.1 Authentication Strategy

**QUESTIONS FOR DECISION:**
- Q17: How should members be registered in the system? (Admin adds them? Self-registration?)
- Q18: Should kiosk devices have any PIN/password protection?
- Q19: Should QR codes expire or be permanent?
- Q20: What happens if someone's QR code is lost/stolen?

**Initial Recommendations:**
- Kiosks: No authentication (physical security assumed)
- Mobile: Simple PIN or email/password
- QR codes: Generate permanent codes, allow regeneration if compromised
- Admin functions: Password-protected

### 5.2 Data Privacy
- Store minimal personal information
- No sensitive data in QR codes
- Secure WebSocket connections (WSS)
- HTTPS everywhere
- Regular data cleanup (auto-delete old records?)

**QUESTIONS FOR DECISION:**
- Q21: How long should historical check-in data be retained?
- Q22: Are there any privacy regulations we need to comply with?

---

## 6. Technical Specifications

### 6.1 Performance Requirements
- **Page load**: < 2 seconds on 3G connection
- **Real-time sync**: < 2 seconds across devices
- **Check-in action**: < 500ms response time
- **Concurrent users**: Support at least 50 simultaneous users
- **Uptime**: 99.5% availability target

### 6.2 Compatibility Requirements
- **Browsers**: Chrome, Safari, Firefox, Edge (last 2 versions)
- **iOS**: iOS 13+ (for iPad kiosks)
- **Android**: Android 8+
- **Screen sizes**: 320px to 2048px width

### 6.3 Midnight Rollover Logic
**QUESTIONS FOR DECISION:**
- Q23: What timezone should be used for midnight rollover?
- Q24: What happens to checked-in users at midnight? (Auto check-out? Carry forward?)
- Q25: What happens to the active activity at midnight? (Reset to default? Keep previous?)

**Proposed Logic:**
- Run scheduled job at midnight local time
- Clear all active check-ins (or optionally carry forward)
- Optionally reset activity to default (e.g., "Training")
- Archive previous day's data
- Send notifications if needed

---

## 7. Development Phases

### Phase 1: Foundation (Weeks 1-2)
- [ ] Set up development environment
- [ ] Initialize project structure
- [ ] Set up database
- [ ] Create basic member management
- [ ] Create basic activity management
- [ ] Deploy development environment

### Phase 2: Core Sign-In Feature (Weeks 3-4)
- [ ] Implement check-in/check-out API
- [ ] Build member list UI
- [ ] Add search functionality
- [ ] Implement activity selection
- [ ] Create kiosk-optimized interface
- [ ] Add visual feedback and animations

### Phase 3: Real-Time Sync (Week 5)
- [ ] Set up WebSocket infrastructure
- [ ] Implement real-time state broadcasting
- [ ] Handle connection/reconnection logic
- [ ] Test synchronization across multiple devices
- [ ] Optimize for performance

### Phase 4: Multi-Device Support (Week 6)
- [ ] Implement QR code generation
- [ ] Build QR code scanning feature
- [ ] Optimize mobile interface
- [ ] Test on actual iPad kiosks
- [ ] Test on various mobile devices

### Phase 5: Polish & Launch (Week 7-8)
- [ ] Implement midnight rollover
- [ ] Add error handling and edge cases
- [ ] Security hardening
- [ ] User testing and feedback
- [ ] Documentation
- [ ] Production deployment
- [ ] Training for station members

### Phase 6: Post-Launch (Ongoing)
- [ ] Monitor usage and performance
- [ ] Gather user feedback
- [ ] Bug fixes and improvements
- [ ] Plan next features

---

## 8. Testing Strategy

### 8.1 Testing Types
- **Unit tests**: Core business logic
- **Integration tests**: API endpoints, database operations
- **E2E tests**: Critical user flows
- **Real-time sync tests**: Multi-device scenarios
- **Load tests**: Concurrent user handling
- **Manual tests**: Device-specific testing (iPads, phones)

### 8.2 Test Scenarios
1. Multiple users checking in simultaneously
2. Activity change while users are signed in
3. Network interruption and reconnection
4. Midnight rollover behavior
5. QR code scanning in various lighting conditions
6. Rapid check-in/undo actions
7. Browser refresh during active session

**QUESTIONS FOR DECISION:**
- Q26: Do you have specific devices/iPads to test on?
- Q27: Should we do beta testing with actual station members?

---

## 9. Deployment & Operations

### 9.1 Hosting Strategy

**QUESTIONS FOR DECISION:**
- Q28: Do you have existing hosting infrastructure?
- Q29: Budget for hosting costs? (estimate ~$20-100/month depending on choice)
- Q30: Who will maintain the application after launch?

**Options:**
1. **Cloud Platform (AWS/Azure/GCP)**
   - Pros: Scalable, reliable, professional
   - Cons: More expensive, requires technical knowledge

2. **Firebase/Supabase**
   - Pros: Simple, built-in real-time, generous free tier
   - Cons: Vendor lock-in, limited customization

3. **Heroku/Railway/Render**
   - Pros: Easy deployment, good developer experience
   - Cons: Can be expensive as you scale

4. **Self-hosted**
   - Pros: Complete control, potentially cheaper
   - Cons: Requires maintenance, less reliable

### 9.2 Deployment Pipeline
- **Version control**: Git (GitHub/GitLab)
- **CI/CD**: Automated testing and deployment
- **Staging environment**: Test before production
- **Monitoring**: Error tracking, performance monitoring
- **Backups**: Automated database backups

### 9.3 Maintenance Plan
- Regular security updates
- Database backup verification
- Performance monitoring
- User support process
- Bug fix prioritization

---

## 10. Success Metrics

### 10.1 Key Performance Indicators
- **Adoption rate**: % of members using the system
- **Check-in frequency**: Average check-ins per day
- **System reliability**: Uptime percentage
- **User satisfaction**: Feedback scores
- **Sync performance**: Average sync latency

### 10.2 Initial Goals (First Month)
- 80% member adoption
- < 1 second average sync time
- 99%+ uptime
- Zero critical bugs
- Positive user feedback

---

## 11. Risk Assessment

### 11.1 Technical Risks
| Risk | Impact | Likelihood | Mitigation |
|------|--------|------------|------------|
| Real-time sync fails | High | Medium | Implement fallback polling, robust error handling |
| Device compatibility issues | Medium | Medium | Extensive testing, progressive enhancement |
| Database performance | Medium | Low | Proper indexing, query optimization |
| Network reliability | High | Medium | Offline support, connection monitoring |
| Security vulnerabilities | High | Low | Security audit, regular updates |

### 11.2 Operational Risks
| Risk | Impact | Likelihood | Mitigation |
|------|--------|------------|------------|
| Low user adoption | High | Medium | Training, simple UX, gather feedback |
| iPad/kiosk hardware failure | Medium | Low | Have backup devices, cloud backup |
| Midnight rollover bugs | Medium | Medium | Extensive testing, manual override |
| Support burden | Medium | Medium | Good documentation, simple design |

---

## 12. Open Questions Summary

### Technical Questions
1. Frontend framework preference? (React, Vue, Angular, Svelte)
2. Backend technology preference? (Node.js, Python, .NET, Go)
3. Hosting environment? (Cloud provider or on-premises)
4. Database preference? (PostgreSQL, MySQL, MongoDB, Firebase)
5. Budget for cloud services?
6. Should we track check-out times explicitly?
7. Track which specific kiosk/location was used?
8. Limit on concurrent check-ins?
9. Need for historical reporting?
10. Expected number of concurrent users/devices?
11. Network reliability at the station?

### UX/Security Questions
12. Should kiosks require authentication?
13. Different permission levels (admin vs member)?
14. Accessibility requirements?
15. Multi-language support needed?
16. Brand colors/logo for RFS station?
17. How should members be registered? (Admin adds or self-registration)
18. Should kiosk devices have PIN/password?
19. Should QR codes expire or be permanent?
20. What happens if QR code is lost/stolen?
21. How long to retain historical data?
22. Privacy regulations to comply with?

### Operational Questions
23. Timezone for midnight rollover?
24. What happens to checked-in users at midnight?
25. What happens to active activity at midnight?
26. Specific devices/iPads for testing?
27. Beta testing with station members?
28. Existing hosting infrastructure?
29. Budget for hosting costs?
30. Who will maintain the application?

---

## 13. Next Steps

### Immediate Actions (After Q&A)
1. **Review and answer questions** in this document
2. **Prioritize features** if any scope adjustment needed
3. **Select technology stack** based on answers
4. **Set up project repository** and development environment
5. **Create detailed user stories** for each feature
6. **Design database schema** in detail
7. **Create wireframes/mockups** for key screens
8. **Set up project management** (GitHub Issues, Trello, etc.)

### Creating Development Issues
Once questions are answered, create issues for:
- **Setup & Infrastructure**: Repo setup, CI/CD, hosting
- **Database Design**: Schema, migrations, seed data
- **Member Management**: CRUD operations, QR generation
- **Activity Management**: CRUD operations, custom activities
- **Check-In System**: Core logic, API endpoints
- **Real-Time Sync**: WebSocket setup, state management
- **Kiosk UI**: Interface design and implementation
- **Mobile UI**: Responsive design, QR scanning
- **Midnight Rollover**: Scheduled job, cleanup logic
- **Testing**: Unit, integration, E2E tests
- **Documentation**: User guide, admin guide, API docs
- **Deployment**: Production setup, monitoring

---

## 14. Appendix

### A. Glossary
- **RFS**: Rural Fire Service
- **Kiosk**: Fixed iPad station for sign-ins
- **QR Code**: Quick Response code for rapid check-in
- **MVP**: Minimum Viable Product
- **PWA**: Progressive Web App
- **WebSocket**: Protocol for real-time bidirectional communication
- **CI/CD**: Continuous Integration/Continuous Deployment

### B. References
- [To be added: Links to relevant documentation, standards, etc.]

### C. Change Log
| Date | Version | Changes | Author |
|------|---------|---------|--------|
| 2025-11-14 | 1.0 | Initial plan document | Copilot |

---

**Document Status**: DRAFT - Awaiting stakeholder review and Q&A

**Next Review Date**: [To be scheduled after initial review]

**Approval**: [ ] Pending [ ] Approved [ ] Needs Revision
