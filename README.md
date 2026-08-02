# Manifest AI

Build "ManifestAI" — an AI-powered personal transformation app. Tagline: "Turn your intentions into daily actions."

Positioning: credible habit-formation + positive psychology, NOT supernatural claims. Never promise outcomes.

## This first turn: build the foundation only
1. **Design system + app shell.** Calm/Headspace-inspired: soft gradients (indigo → violet → warm amber accents), glassmorphic cards, generous rounded corners (rounded-2xl+), minimal typography, dark mode by default with light toggle, smooth Framer Motion page transitions. Set proper semantic tokens in index.css and tailwind.config — no hardcoded colors in components.

2. **Marketing landing page** at `/`: hero ("Become the person who achieves your goals." + subhead about daily AI coaching, affirmations, journaling and habit tracking), CTA "Start Free", 5-feature section, simple 3-tier pricing (Free / Pro $12mo / Lifetime $149), footer.

3. **Supabase auth**: email/password + Google. Sign up, login, forgot password. Protected `/app/*` routes with a redirect-if-unauthenticated guard. Auto-create a `profiles` row on signup via trigger.

4. **Database schema** with row-level security on every table (owner-only policies, `auth.uid() = user_id`):
- `profiles` (id → auth.users, email, display_name, avatar_url, subscription_tier default 'free', timezone, created_at)
- `goals` (id, user_id, title, why, feeling, category, target_date, status, progress int, created_at)
- `goal_steps` (id, goal_id, user_id, title, completed, order_index, due_date)
- `habits` (id, user_id, name, icon, target_per_week, active, created_at)
- `habit_logs` (id, habit_id, user_id, date, completed) — unique on (habit_id, date)
- `journals` (id, user_id, content, prompt, mood int 1-5, entry_date, created_at)
- `affirmations` (id, user_id, goal_id nullable, text, category, is_favorite, created_at)
- `daily_checkins` (id, user_id, date, gratitude, wins, tomorrow_focus, energy int, visualization_minutes)
- `ai_chats` (id, user_id, title, created_at) and `ai_messages` (id, chat_id, user_id, role, content, created_at)

5. **App shell** at `/app` with a sidebar (desktop) / bottom tab bar (mobile): Dashboard, Coach, Goals, Journal, Habits, Progress, Settings. Create the routes with clean empty states — don't implement the feature logic yet, I'll ask for each one next.

Make the landing page genuinely beautiful — it's the conversion surface. Use real gradient meshes and depth, not flat placeholder blocks.

This project was built with [Lovable](https://lovable.dev).

## Build with Lovable

Continue developing this project in the [Lovable editor](https://lovable.dev/projects/818c7b44-ea4c-44df-aebe-7e2707757e8e).

- **Ship faster**: describe what you want to build and Lovable handles the code.
- **Stay in sync**: every change made in Lovable is committed straight to this repository.
- **Full ownership**: this code is yours. Push to `main` on GitHub and your changes sync back into Lovable, ready for your next prompt.

## Development

Prefer working locally? You need Node.js and npm — [install with nvm](https://github.com/nvm-sh/nvm#installing-and-updating).

```sh
git clone <this-repository-url>
cd <repository-name>
npm i
npm run dev
```
