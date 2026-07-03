# The Sign-In Book

The sign-in book replaces the paper book by the station door. It shows who is
at the station right now, what they're doing, and keeps the history for
reporting. Every screen at the station updates instantly — sign in on the
kiosk and it appears on everyone's phone straight away.

## Checking in and out

1. Open **Sign In** from the home screen (on the station kiosk it's usually
   already open).
2. Find your name — scroll, or start typing in the search box. Members can be
   filtered and sorted if the list is long.
3. Tap your name to **check in**. You'll see immediate confirmation (a toast
   message and your tile moving to the checked-in group).
4. Tap your name again when you leave to **check out**. Your visit duration is
   recorded.

Other ways to sign in:

- **QR code** — every member has a personal QR code on their
  [profile](profiles-and-achievements.md). Scanning it checks you in without
  touching the kiosk.
- **Your own phone** — install the app ([how](kiosk-and-pwa.md)) or follow
  your brigade's sign-in link and tap your name there.
- **Sign-in link** — brigades can share a direct link (`/sign-in`) that works
  from a brigade website or a QR poster on the shed wall. See
  [linking from your brigade website](brigade-website-linking.md).

**Forgot to check out?** The system rolls the book over at midnight so nobody
stays "at the station" forever. Admins can also correct entries.

## Activities — what's happening at the station

The station has a **current activity** (Training, Maintenance, Meeting, and so
on). Set it from the activity selector at the top of the sign-in page; everyone
who checks in while it's active is recorded against it. That's what powers the
attendance breakdowns in [reports](reports.md) and the
[achievements](achievements.md) system.

## Events — organised sessions with a start and end

For anything you want tracked as a discrete session — a training night, a
hazard reduction, a callout debrief — create an **event**:

1. Tap **New event** on the sign-in page, give it a name and type.
2. Members join the event as they check in (or are added to it).
3. **End the event** when it's done. Participants and duration are recorded,
   and the event appears in reports.

Every join/leave is kept in the event's audit trail, so the record stands up
later.

## Adding new members

Anyone can be added from the sign-in page (**Add member**) with just a name.
Admins can also:

- **Import a member list** from CSV (Sign In → import) — good for first setup.
- **Invite a member to their own login** from their profile page — they get a
  one-time activation link.

On the free Community plan a brigade can have up to 10 members; Basic and AI
Pro are unlimited.
