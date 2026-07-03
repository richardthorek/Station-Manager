# Kiosk & App Installation

Station Manager is a **web app that installs like a real app** (a PWA). No app
store, nothing to update — it always runs the latest version.

## Installing on a phone or tablet

- **iPhone / iPad (Safari):** open the app → Share button → **Add to Home
  Screen**. It gets its own icon and opens full-screen.
- **Android (Chrome):** open the app → you'll see an **Install** prompt (or
  menu → *Install app*).
- **Desktop (Chrome/Edge):** click the install icon in the address bar.

The app also shows its own install prompt when it makes sense.

## Setting up the station kiosk tablet

The classic setup: one tablet mounted by the door, always showing the sign-in
book.

1. An admin creates a **brigade access token** and opens its link on the
   tablet ([administrator guide](admin-guide.md#brigade-access--setting-up-kiosks-admin--brigade-access)).
2. Install the app to the home screen (above) and open it — the tablet stays
   in **kiosk mode**, linked to your station, with no login required.
3. Pin it if you like: iPad **Guided Access** or Android **screen pinning**
   keeps the tablet on the sign-in book.

The kiosk can use the sign-in book and truck checks; admin pages always
require a real login.

## Offline behaviour

Sheds have patchy internet; the app is built for it:

- The app itself **loads offline** once installed (it's cached on the
  device).
- If the connection drops mid-use, an **offline indicator** appears and
  sign-ins/actions are **queued on the device**, then sent automatically when
  the connection returns.
- Live updates from other devices resume as soon as you're back online.

The [voice check](voice-check.md) assistant is the exception — it needs a live
connection while you're talking (it reconnects automatically after dropouts).

## Multiple devices

Any mix works simultaneously: wall tablet + members' phones + captain's
laptop. Everything stays in sync in real time — a check-in on one device
appears on all the others within a second.
