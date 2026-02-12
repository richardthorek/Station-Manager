# Brigade Linking Guide for Station Manager

**Document Version:** 1.0  
**Created:** February 2026  
**Status:** Active Guide  
**Purpose:** Instructions for brigades to link to Station Manager from their own websites

---

## Overview

Station Manager supports secure cross-domain linking, allowing brigades to provide direct access from their own websites while maintaining centralized hosting. This guide explains how to set up brigade-specific access.

---

## Table of Contents

1. [Quick Start](#quick-start)
2. [How Brigade Linking Works](#how-brigade-linking-works)
3. [Setting Up Brigade Access](#setting-up-brigade-access)
4. [Embedding Options](#embedding-options)
5. [Security & Privacy](#security--privacy)
6. [Troubleshooting](#troubleshooting)
7. [Technical Details](#technical-details)

---

## Quick Start

### For Brigade Administrators

**Step 1:** Request a brigade access token from your Station Manager administrator

**Step 2:** Add a link to your website:
```html
<a href="https://station-manager.bungendorerfs.org/signin?brigade=YOUR_TOKEN">
  Sign In to Station Manager
</a>
```

**Step 3:** Test the link - it should:
- Navigate to Station Manager
- Automatically lock to your brigade/station
- Show "Kiosk Mode" indicator
- Allow members to sign in

**Done!** Your brigade members can now access Station Manager directly from your website.

---

## How Brigade Linking Works

### User Flow

```
┌─────────────────────────────────────────────────────────┐
│ Step 1: User visits your brigade website                │
│ Example: https://brigade1.org                           │
└────────────────┬────────────────────────────────────────┘
                 │
                 │ Clicks "Sign In to Station Manager"
                 │
                 ▼
┌─────────────────────────────────────────────────────────┐
│ Step 2: Browser navigates to Station Manager            │
│ URL: https://station-manager.bungendorerfs.org/signin?brigade=TOKEN
└────────────────┬────────────────────────────────────────┘
                 │
                 │ Token validates
                 │
                 ▼
┌─────────────────────────────────────────────────────────┐
│ Step 3: Station Manager locks to your brigade           │
│ - "Kiosk Mode" activated                                │
│ - Station selector disabled                             │
│ - Only your brigade's data visible                      │
└────────────────┬────────────────────────────────────────┘
                 │
                 │ User signs in
                 │
                 ▼
┌─────────────────────────────────────────────────────────┐
│ Step 4: Session persists for browser session            │
│ - Member can check in/out                               │
│ - View profiles, events, etc.                           │
│ - All actions tracked to your station                   │
└──────────────────────────────────────────────────────────┘
```

### Key Benefits

- ✅ **Simple Integration** - Just a link, no complex setup
- ✅ **Secure Access** - Token provides station-specific access
- ✅ **Data Isolation** - Brigade sees only their own data
- ✅ **Seamless UX** - Users don't need separate login
- ✅ **No Maintenance** - Token works indefinitely (unless revoked)

---

## Setting Up Brigade Access

### Step 1: Request a Brigade Access Token

Contact your Station Manager administrator and provide:

1. **Brigade ID** - Your unique brigade identifier
2. **Station ID** - Your station identifier (usually same as brigade ID)
3. **Description** - Purpose of the token (e.g., "Main Brigade Website Link")
4. **Expiration** (optional) - Token validity period

**Example Request:**
```
Subject: Request for Brigade Access Token

Brigade ID: bungeendore-north
Station ID: bungeendore-north
Description: Main website sign-in link
Expiration: Never (or specify days)
```

### Step 2: Administrator Generates Token

The administrator will provide:
- **Token:** `a3d5e8f2-1234-4abc-8def-9876543210ab` (example)
- **Kiosk URL:** `https://station-manager.bungendorerfs.org/signin?brigade=TOKEN`

**Keep the token secure** - it provides access to your station data.

### Step 3: Add Link to Your Website

**Simple Link (Recommended):**
```html
<a href="https://station-manager.bungendorerfs.org/signin?brigade=a3d5e8f2-1234-4abc-8def-9876543210ab"
   target="_blank"
   rel="noopener noreferrer">
  Sign In to Station Manager
</a>
```

**Styled Button:**
```html
<a href="https://station-manager.bungendorerfs.org/signin?brigade=YOUR_TOKEN"
   class="station-manager-button"
   target="_blank"
   rel="noopener noreferrer">
  <img src="rfs-logo.png" alt="RFS" style="height: 20px; margin-right: 8px;">
  Sign In to Station Manager
</a>

<style>
.station-manager-button {
  display: inline-flex;
  align-items: center;
  padding: 12px 24px;
  background-color: #e5281b;  /* RFS red */
  color: white;
  text-decoration: none;
  border-radius: 4px;
  font-weight: 600;
  transition: background-color 0.2s;
}

.station-manager-button:hover {
  background-color: #c41f15;  /* Darker red on hover */
}
</style>
```

**WordPress Shortcode:**
```php
// Add to theme's functions.php
function station_manager_link_shortcode($atts) {
    $atts = shortcode_atts(array(
        'token' => 'YOUR_TOKEN',
        'text' => 'Sign In to Station Manager'
    ), $atts);
    
    $url = 'https://station-manager.bungendorerfs.org/signin?brigade=' . esc_attr($atts['token']);
    $text = esc_html($atts['text']);
    
    return '<a href="' . $url . '" target="_blank" rel="noopener noreferrer">' . $text . '</a>';
}
add_shortcode('station_manager', 'station_manager_link_shortcode');

// Usage in posts/pages:
// [station_manager token="a3d5e8f2-..." text="Sign In"]
```

### Step 4: Test the Link

1. Click the link on your website
2. Verify you're redirected to Station Manager
3. Check for "Kiosk Mode" indicator in the header
4. Verify station name matches your brigade
5. Try signing in as a test member

---

## Embedding Options

### Option 1: Direct Link (Recommended) ✅

**What:** Link from your website to Station Manager  
**User Experience:** New browser tab opens  
**Advantages:** Simple, secure, no CORS issues  
**Disadvantages:** User leaves your website

### Option 2: Popup Window

**What:** Open Station Manager in a popup window  
**User Experience:** Overlay window on your site  
**Advantages:** User stays on your website context  
**Disadvantages:** Popup blockers may interfere

```html
<button onclick="openStationManager()">Sign In to Station Manager</button>

<script>
function openStationManager() {
  const token = 'YOUR_TOKEN';
  const url = `https://station-manager.bungendorerfs.org/signin?brigade=${token}`;
  window.open(url, 'StationManager', 'width=1024,height=768,resizable=yes,scrollbars=yes');
}
</script>
```

### Option 3: iframe Embedding (Not Recommended)

**What:** Embed Station Manager directly in your page  
**User Experience:** Seamless integration  
**Advantages:** Fully integrated user experience  
**Disadvantages:** Requires CORS whitelisting, security implications

**Requirements:**
- Your domain must be added to CORS allowlist
- Contact administrator to request whitelisting
- Security policy (CSP) may block embedding

```html
<!-- Only if your domain is whitelisted -->
<iframe 
  src="https://station-manager.bungendorerfs.org/signin?brigade=YOUR_TOKEN"
  width="100%"
  height="800px"
  frameborder="0"
  sandbox="allow-same-origin allow-scripts allow-forms"
  title="Station Manager">
</iframe>
```

**Note:** Most deployments intentionally block iframe embedding for security.

---

## Security & Privacy

### Token Security

**What is a Brigade Access Token?**
- UUID v4 format: 128-bit random identifier
- Unguessable (2^128 possible combinations)
- Provides access to your station data only
- Does not grant administrative privileges

**Best Practices:**
- ✅ **Use HTTPS** - Always link to `https://` (not `http://`)
- ✅ **Keep Secret** - Don't publish token in public repositories
- ✅ **Monitor Usage** - Request usage logs from administrator if suspicious
- ⚠️ **Rotate Periodically** - Consider annual token rotation
- ⚠️ **Separate Tokens** - Use different tokens for different purposes

**If Token is Compromised:**
1. Contact administrator immediately
2. Request token revocation
3. Generate new token
4. Update all links with new token

### Data Privacy

**What Data is Accessible?**
- Your station's member list
- Your station's check-in/out records
- Your station's events and activities
- Your station's appliances and truck checks

**What Data is NOT Accessible?**
- ❌ Other brigades' data (complete isolation)
- ❌ Administrative functions (station creation, token generation)
- ❌ System configuration

### Compliance

**Privacy Considerations:**
- Member data stays within Station Manager system
- Token provides read/write access to station data
- No personal data transmitted to your website
- Users must consent to data usage (standard RFS policies apply)

---

## Troubleshooting

### Link Doesn't Work

**Symptom:** Clicking link shows error or unexpected behavior

**Solutions:**
1. Check token is correct (no extra spaces or characters)
2. Verify URL is complete: `https://station-manager.bungendorerfs.org/signin?brigade=TOKEN`
3. Test in incognito/private browser window
4. Contact administrator to verify token is active

### Wrong Station Displayed

**Symptom:** Station Manager shows different brigade's data

**Solutions:**
1. Verify token corresponds to your brigade (ask administrator)
2. Clear browser cache and cookies
3. Try in incognito/private browser window
4. Contact administrator to verify token configuration

### Kiosk Mode Not Activating

**Symptom:** Station selector still visible, can switch stations

**Solutions:**
1. Check URL includes `?brigade=TOKEN` parameter
2. Verify token format (should be UUID like `xxxx-xxxx-xxxx-xxxx-xxxx`)
3. Try refreshing page
4. Contact administrator to verify token is valid

### Performance Issues

**Symptom:** Slow loading or unresponsive

**Solutions:**
1. Check internet connection
2. Try different browser
3. Clear browser cache
4. Contact administrator to check system status

### Token Expired

**Symptom:** "Invalid or expired token" message

**Solutions:**
1. Request new token from administrator
2. Update link on website
3. Consider requesting non-expiring token for website links

---

## Technical Details

### Token Format

```
UUID v4: a3d5e8f2-1234-4abc-8def-9876543210ab
Format:  XXXXXXXX-XXXX-4XXX-YXXX-XXXXXXXXXXXX
Length:  36 characters
Entropy: 128 bits (2^128 combinations)
```

### URL Structure

```
https://station-manager.bungendorerfs.org/signin?brigade=TOKEN

Protocol: HTTPS (required)
Domain:   station-manager.bungendorerfs.org (may vary)
Path:     /signin (entry point for kiosk mode)
Query:    brigade=TOKEN (enables kiosk mode)
```

### Session Behavior

**Duration:** Browser session (until tab/browser closed)  
**Storage:** Session-based (not persistent across browser restarts)  
**Scope:** Single browser tab

**Re-authentication:** User must click link again if:
- Browser/tab closed
- Session expires (typically 24 hours)
- Cache cleared

### CORS Requirements

**For Simple Links:** No CORS configuration needed (navigation only)

**For iframe Embedding:** Your domain must be whitelisted:
```bash
# Administrator must add your domain to CORS allowlist
FRONTEND_URLS=https://station-manager.bungendorerfs.org,https://yourbrigade.org
```

### API Integration (Advanced)

If you want to build custom integrations:

1. **Authentication:** Use JWT tokens (not brigade tokens)
2. **Station Context:** Send `X-Station-Id` header with API requests
3. **CORS:** Request domain whitelisting from administrator
4. **Rate Limiting:** Be mindful of API rate limits
5. **Documentation:** See `docs/API_DOCUMENTATION.md`

**Contact administrator before building custom integrations.**

---

## Support & Contact

### Getting Help

**For Brigade Setup Questions:**
- Contact your Station Manager administrator
- Email: [administrator contact]
- Documentation: See `docs/KIOSK_MODE_SETUP.md` (for administrators)

**For Technical Issues:**
- GitHub Issues: [repository URL]
- Documentation: `docs/` directory in repository

**For Feature Requests:**
- GitHub Issues (feature request template)
- Discuss with administrator first

### Request CORS Whitelisting

If your brigade needs iframe embedding or custom API integration:

**Email Template:**
```
Subject: CORS Whitelisting Request for [Brigade Name]

Brigade: [Brigade Name]
Brigade ID: [brigade-id]
Domain: https://yourbrigade.org

Purpose:
[ ] iframe embedding on brigade website
[ ] Custom API integration
[ ] Other: [specify]

Justification:
[Explain why simple linking is insufficient]

Technical Contact:
Name: [Name]
Email: [Email]
Phone: [Phone]
```

---

## Changelog

| Version | Date | Changes |
|---------|------|---------|
| 1.0 | Feb 2026 | Initial guide created |

---

**Document Status:** ✅ Active  
**Review Required:** Annually or when Station Manager hosting changes

---

## Related Documentation

- **Multi-Domain Hosting Analysis:** `docs/MULTI_DOMAIN_HOSTING_ANALYSIS.md`
- **Kiosk Mode Setup (Administrators):** `docs/implementation-notes/KIOSK_MODE_SETUP.md`
- **Authentication Configuration:** `docs/AUTHENTICATION_CONFIGURATION.md`
- **API Documentation:** `docs/API_DOCUMENTATION.md`
- **Deployment Guide:** `docs/AZURE_DEPLOYMENT.md`
