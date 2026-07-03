# Achievements & Gamification System

## Overview

The RFS Station Manager now includes a fun, optional achievement system to gamify volunteer participation and encourage engagement. Members earn achievements by checking into various activities (training, maintenance, meetings) and can track their progress over time.

## Features

### 20 Unique Achievements

Achievements are organized into 5 categories:

#### Training Achievements
- 📚 **Training Enthusiast** - Attended 5 training sessions (Bronze)
- 🎓 **Training Veteran** - Attended 15 training sessions (Silver)
- 🏆 **Training Master** - Attended 30 training sessions (Gold)
- 🔥 **Training Triple** - Attended training 3 weeks in a row (Silver, Streak)
- 🔥🔥 **Training Inferno** - Attended training 6 weeks in a row (Gold, Streak)

#### Maintenance Achievements
- 🔧 **Maintenance Hero** - Completed 5 maintenance checks (Bronze)
- 🛠️ **Maintenance Champion** - Completed 15 maintenance checks (Silver)
- ⚙️ **Maintenance Legend** - Completed 30 maintenance checks (Gold)
- 🛠️🔥 **Maintenance Streak** - Completed maintenance 4 weeks in a row (Silver, Streak)
- 🚒 **Truck Inspector** - Completed your first truck check (Bronze)

#### Meeting Achievements
- 💬 **Meeting Regular** - Attended 5 meetings (Bronze)
- 🗣️ **Meeting Advocate** - Attended 10 meetings (Silver)
- 🧠 **Strategic Thinker** - Attended all meetings in a calendar month (Gold)

#### Pattern Achievements
- ⚔️ **Wednesday Warrior** - Most Wednesday check-ins in a month (Gold)
- 🛡️ **Weekend Defender** - Most weekend check-ins in a month (Gold)
- 🌅 **Early Bird** - Most morning (6am-9am) check-ins in a month (Silver)
- 🦉 **Night Owl** - Most evening (6pm-9pm) check-ins in a month (Silver)

#### Milestone Achievements
- ⭐ **All-Rounder** - Participated in training, maintenance, and a meeting in one week (Silver)
- 💎 **Perfect Month** - Completed 2 trainings, 4 maintenance checks, and 1 meeting in a month (Platinum)
- 💯 **Century Club** - Reached 100 total check-ins (Platinum)
- 🏃 **First Responder** - First to check in on 5 different days (Gold)

### Achievement Tiers

Achievements are categorized by tier, which indicates their difficulty:
- **Bronze** - Entry-level achievements for getting started
- **Silver** - Mid-level achievements requiring consistent participation
- **Gold** - Advanced achievements for dedicated volunteers
- **Platinum** - Elite achievements for exceptional commitment

### Visual Elements

#### Achievement Badges
- Colorful badges with emoji icons
- Tier-based color schemes (bronze, silver, gold, platinum)
- Active streak indicators with fire emoji (🔥)
- "NEW" label for recently earned achievements
- Progress bars for unearned achievements

#### Celebration Animations
When a member earns a new achievement, they receive a celebratory pop-up with one of four animation effects:
- **Confetti** - Colorful confetti raining down
- **Fireworks** - Explosive bursts of color
- **Stars** - Twinkling star effects
- **Burst** - Radial particle explosion

Animations auto-dismiss after 3 seconds and don't block user interaction.

## User Experience

### Viewing Achievements

Members can view their achievements on their profile page by:
1. Navigating to Sign In page
2. Clicking on their name to view their profile
3. Scrolling to the "Achievements" section

The achievements section displays:
- Total achievements earned
- Number of active streaks
- Recently earned achievements (last 5)
- All earned achievements as badges
- Progress toward unearned achievements with progress bars

### Earning Achievements

Achievements are earned automatically when members:
- Check into events (training, maintenance, meetings)
- Complete truck checks
- Maintain consistent participation patterns
- Reach milestone activity counts

The system recalculates achievements each time a profile is viewed, ensuring up-to-date information.

## Technical Implementation

### Backend Components

**Achievement Service** (`backend/src/services/achievementService.ts`)
- Calculates achievements based on member participation history
- Tracks streaks and patterns
- Provides progress toward unearned achievements

**Achievement Routes** (`backend/src/routes/achievements.ts`)
- `GET /api/achievements/:memberId` - Get full achievement summary
- `GET /api/achievements/:memberId/recent` - Get recently earned achievements
- `GET /api/achievements/:memberId/progress` - Get progress toward achievements

**Achievement Types** (`backend/src/types/achievements.ts`)
- Type definitions for 20 achievement types
- Achievement metadata (name, description, emoji, tier, category)
- Member achievement tracking with dates and status

### Frontend Components

**AchievementBadge** (`frontend/src/components/AchievementBadge.tsx`)
- Displays individual achievement badges
- Three variants: full, compact, icon-only
- Shows progress bars for unearned achievements
- Supports locked/unlocked states

**AchievementGrid** (`frontend/src/components/AchievementGrid.tsx`)
- Displays collections of achievements in a responsive grid
- Automatically highlights recently earned achievements
- Supports filtering and sorting

**AchievementCelebration** (`frontend/src/components/AchievementCelebration.tsx`)
- Pop-up celebration animation component
- Four animation effects (confetti, fireworks, stars, burst)
- Auto-dismisses after configurable duration
- Non-blocking overlay that doesn't interrupt workflow

### Integration Points

**User Profile Page** (`frontend/src/features/profile/UserProfilePage.tsx`)
- Displays achievement summary statistics
- Shows achievement badges and progress
- Integrated seamlessly with existing profile layout

## API Usage

### Get Member Achievements
```javascript
const summary = await api.getMemberAchievements(memberId);
```

Returns:
```json
{
  "memberId": "...",
  "memberName": "John Doe",
  "totalAchievements": 5,
  "achievements": [...],
  "recentlyEarned": [...],
  "activeStreaks": [...],
  "progress": [...]
}
```

### Display Achievement Badge
```jsx
import { AchievementBadge } from '../components/AchievementBadge';

<AchievementBadge 
  achievement={achievementData} 
  variant="compact"
  showNew={true}
/>
```

### Show Celebration
```jsx
import { AchievementCelebration } from '../components/AchievementCelebration';

{newAchievement && (
  <AchievementCelebration
    achievement={newAchievement}
    effect="random"
    duration={3000}
    onDismiss={() => setNewAchievement(null)}
  />
)}
```

## Customization

### Adding New Achievements

1. Add achievement type to `achievementTypes` in both frontend and backend
2. Add definition to `ACHIEVEMENT_DEFINITIONS`
3. Implement calculation logic in `AchievementService.calculateAchievements()`
4. Choose appropriate emoji, tier, and category

### Modifying Animation Effects

Edit `AchievementCelebration.tsx` to:
- Add new animation effects
- Adjust animation duration
- Customize colors and particles
- Change celebration card styling

### Styling Achievements

Modify `AchievementBadge.css` to:
- Change tier colors
- Adjust badge sizes
- Customize progress bars
- Add new badge variants

## Future Enhancements

Potential additions for the achievement system:
- Leaderboards for competitive achievements (Wednesday Warrior, etc.)
- Achievement notifications on check-in
- Social sharing of achievements
- Custom achievements created by station administrators
- Achievement milestones (e.g., "Earned 10 achievements")
- Seasonal/time-limited achievements
- Team-based achievements
- Export achievement history as PDF

## Privacy & Data

- All achievement data is calculated on-demand from existing check-in records
- No separate achievement database is maintained (except in-memory cache)
- Achievements are visible only to the member on their profile page
- No personal achievement data is shared without explicit consent

## Support

For issues or questions about the achievement system:
1. Check this documentation
2. Review the code comments in the achievement components
3. Open an issue on GitHub with detailed description and screenshots
