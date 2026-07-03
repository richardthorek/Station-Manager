# Troubleshooting

Common problems, roughly in the order people hit them. If none of this helps,
raise it with your brigade's Station Manager admin, or file an issue on the
project's GitHub.

## Access & login

| Problem | Likely cause & fix |
|---|---|
| A home-screen card says **"Not in your plan"** | That feature isn't in your organisation's plan. The owner can upgrade from **Admin → Organization** |
| **"Upgrade required"** message when adding a member/vehicle/station | You've hit a plan limit (Community: 10 members, 1 vehicle, 1 station). Same fix — upgrade, or prune |
| Sign-in book asks for login on the station tablet | The tablet's brigade access token is missing or was revoked — an admin should re-link it (**Admin → Brigade Access**) |
| Can't log in as admin | Check the username; after several failed tries the account is briefly rate-limited — wait a few minutes. Owners can reset other users from **Admin → Organization → Users** |
| Activation link doesn't work | Invite links are one-time — ask the admin to send a fresh one |
| **"Too many requests"** banner | You've hit a rate limit; wait a minute and try again |

## Sign-in book

| Problem | Likely cause & fix |
|---|---|
| Someone's still shown checked in from yesterday | The book rolls over at midnight automatically; if it hasn't, refresh the page. Admins can correct entries |
| A member is missing | Check the search box isn't filtering; on Community, check the 10-member limit |
| Changes don't appear on the other screen | Both devices need internet; look for the offline indicator. Queued actions send automatically when back online |

## Truck checks

| Problem | Likely cause & fix |
|---|---|
| Checklist is empty / "0 items" | The vehicle isn't linked to a **vehicle type** — an admin should set one on the vehicle (Vehicle Check admin → edit vehicle) |
| Someone else's half-done check opens instead of a new one | That's by design — you're **joining** the in-progress check. Finish it or cancel it, don't run two |
| A check shows "In progress" forever | The person navigated away mid-check. An admin can see it in History; complete or abandon it |
| An issue I fixed is still flagged | Issues stay open until **resolved** in the admin dashboard's Follow-ups tab |

## Voice check

See the [voice check guide](voice-check.md#troubleshooting) — mic permissions,
iPad audio unlock, reconnecting, and plan requirements.

## AAR Studio

| Problem | Likely cause & fix |
|---|---|
| "AI service is not configured" / analysis fails | Your organisation needs the AI Pro plan and a signed-in session; if that's right, the server's AI configuration may be down — tell your admin |
| Monthly AI allowance exhausted | The owner can buy a top-up pack from **Admin → Organization** |
| A teammate can't see my review | Cloud backup needs you signed in when you save; check the review shows as backed up, and they've pulled it from **"From your team"** |
| Live transcription won't start | Mic permission (padlock icon → allow microphone), and check the AI allowance |

## App & device

| Problem | Likely cause & fix |
|---|---|
| App looks stale / old version | Close and reopen the installed app; it updates itself on relaunch |
| Blank screen at `/aar` | Force-refresh once (the app cache is being stubborn). If it persists, tell your admin — it's a known deployment seam |
| Nothing loads at all | Check the internet connection; the installed app will still open and queue sign-ins offline |
