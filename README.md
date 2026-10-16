# AGI Sports Fest 2026 (Expo + Supabase)

Scorekeeping app for the Sports Fest. 12 games from `Games Bracket.xlsx`.

## Run
```
npm install
cp .env.example .env     # then fill in your Supabase URL + anon key (see below)
npx expo start           # scan the QR code with Expo Go (SDK 57)
```
Without a `.env` the app runs in **local mode** (everything on the device, you are the admin). Good for trying it out.

## Accounts (Supabase)
| Who | How | Can do |
|---|---|---|
| **Guest** | just open the app (no login) | see brackets, matches, winners, standings (live updates) |
| **Committee** | Admin tab > username + password (made by the admin) | in their assigned games only: choose winners and enter points (team names are set by the admin) |
| **Admin** | Admin tab > sign in | everything: all games, resets, master team list, **create/delete accounts**, assign games |

Committee accounts use a **username + password set by the admin** (no email needed).
Admin: Admin tab > Accounts > **Manage accounts** > New account > pick the games (one or many).
Internally the username becomes `username@sportsfest.example.com`; no emails are ever sent.

### One-time Supabase setup
1. Create a project at supabase.com.
2. **SQL Editor** > New query > paste `supabase/schema.sql` > Run. (Safe to run again.)
3. **Authentication > Users > Add user**: email + password for the FIRST admin, tick *Auto Confirm User*.
4. Make that user an admin (SQL Editor):
   ```sql
   insert into public.sf_admins (user_id)
   select id from auth.users where email = 'admin@example.com'
   on conflict do nothing;
   ```
5. **Authentication > Providers > Email**: turn OFF *Allow new users to sign up*
   (and *Confirm email* does not matter; accounts are created by the admin).
6. Deploy the account function (needs Supabase CLI, once):
   ```
   supabase functions deploy sf-admin --no-verify-jwt
   ```
   It uses the project's service role key on the server only (see `supabase/functions/sf-admin/README.md`).
7. **Project Settings > API**: copy *Project URL* and the *anon public* key into `.env`.
   Never put the `service_role` key in the app.

Permissions are enforced by the database (row level security), not only by the app:
guests can only read; committee can write only in their assigned games; admins can write everything.
Note: a committee member can also clear a result in their own game (needed when changing a winner).

## Put it online (Vercel) - works on iPhone, Android, laptop

No install needed; people just open a link (Safari/Chrome). On iPhone: Share > *Add to Home Screen*.

1. Push this folder to a GitHub repo (`.env` and `node_modules` are not committed).
2. vercel.com > **Add New > Project** > import the repo. `vercel.json` already sets the build
   (`npx expo export --platform web`) and output folder (`dist`). Framework preset: *Other*.
3. **Settings > Environment Variables** (before deploying):
   - `EXPO_PUBLIC_SUPABASE_URL`
   - `EXPO_PUBLIC_SUPABASE_ANON_KEY`
   (anon key only, never the service_role key). Redeploy after changing them.
4. Deploy. Share the `https://<project>.vercel.app` link with everyone.

Or from the terminal: `npm i -g vercel && vercel --prod`.
Test locally: `npm run build:web && npx serve dist`.

## How scoring works
- **Winner only** for most games: open a game, tap **Select winner**, choose the team, confirm. The winner moves to the next match; the loser is **Eliminated**.
- **Points are encoded** (both teams) for: **Pickleball** (all matches), and the **championship round of Darts and Sungka**.
  Higher points wins the match. Equal points: the admin chooses the winner.
- **Round robin championships** (Pickleball WS, Darts, Sungka): most wins = Champion.
  Tie on wins -> the **total points scored** in the round robin decides.
  Still tied -> the admin picks the champion (Tie-breaker box).
- Match buttons are in the **center** of each match card, between the two teams.

## Team names and Standings

Team names have a **department** (EEG/CC, SALES, ACC/FIN, ...). Standings ("By department") lists every team under its
department with a percent: each game the team **wins** adds 20%, up to 100% (about 5 games per team).
For Supabase, run `supabase/seed_teams.sql` once to load the starting team list (local mode already has it).

- Admin > **Team names**: add the names (e.g. "Ambassador") with a color. In each game's **Teams** tab, give Team 1...N a name.
  The same name can be on several teams (Team 1 and Team 2 can both be "Ambassador").
- **Standings** tab: one row per team *name*, adding up wins, losses and championships of all its teams in all games.
  Switch between *Most wins* and *Most champions*. Tap a row to see each game and team.
  Teams without a name are not counted.

## Editing the brackets
`src/data/games.js` holds all 12 games. `{ t: 5 }` = Team 5, `{ w: 3 }` = winner of Game 3, `scoring: true` = points are encoded.
Logic is in `src/engine.js` and `src/standings.js`. Tests: `node scripts/test-engine.mjs` and `node scripts/test-remote.mjs`.

Note: in the Excel, Mobile Legends Game 2 says "Team 1 vs Team 4", but Team 1 already plays Game 1. It is set to **Team 2 vs Team 4** in `games.js`.
