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

## Backup and restore (Admin > Backup and restore)
- **Download backup** saves one `.json` file (on a phone: share sheet) with team names, teams of each game + players, winners and points,
  tie-breaks, committee names, match times and Cheer Dance / Mr & Ms Team Ambassador places. Login accounts are not included (they live in Supabase Authentication).
- **Restore** (from file on the web, or from pasted text) REPLACES all the current data with the backup. Download a backup of the current data first.
- Tests: `node scripts/test-backup.mjs`.

## Live board (`/live`)
Rotates: **Standings** (all teams, split into pages only when the screen is too small), **Game progress** (round being played and matches done per game), **Champions**.
All games run at the same time, so there is no "Up next" / "Ready to play" list.

## Audit trail (Admin > Audit trail)
Shows, newest first, **who** did **what** and **when**: sign-ins, sign-outs, wrong passwords, password changes, every winner / points / tie-break set or changed
(with the old value), team names and team slots, committee names, match times, Cheer Dance / Mr & Ms places, accounts and game access, resets and backups.
- Written by **database triggers** (`supabase/schema.sql`), with the account taken from the login, so the app cannot fake or skip it. Only admins can read it.
  Nobody can edit or delete lines from the app, and a trigger blocks it even in SQL (see the comment in the schema to clear it on purpose).
- A save that changes nothing is not logged. Many lines of the same person within 10 seconds (a reset, a restore) are folded into one row you can open.
- Filters: Logins, Winners & points, Teams & setup, Accounts, Resets & backups. **Export to Excel (CSV)** downloads the lines of the current filter.
- Account created / deleted / password reset by an admin are written by the `sf-admin` Edge Function. **Redeploy it** (`supabase functions deploy sf-admin --no-verify-jwt`, or paste `dashboard-single-file.ts`) to get those lines.
- Failed logins are recorded with the username that was typed (at most 20 per minute, so nobody can flood the table).
- To turn it on for an existing project: run `supabase/schema.sql` again in the SQL Editor (safe to repeat). Tests: `node scripts/test-audit.mjs`, `node scripts/test-rls.mjs`.

## Change my password
Every signed-in committee or admin account has **My password** on the Admin tab: current password, new password (at least 8 characters), new password again.
It is logged in the audit trail (never the password itself). An admin can still reset any password in Admin > Accounts.

## Security checklist (do before the event)
What is already protected: the database itself decides who can write (row level security), not only the app. Guests can only read;
a committee account can only write in its assigned games; only admins can create accounts, name teams, reset or delete.
The Supabase `service_role` key is only inside the Edge Function on Supabase, never in the app or on Vercel.
The `anon` key in the app is public by design (it can only do what the rules allow).

Please also do these (a few minutes, in the dashboards):
1. **Supabase > Authentication > Providers > Email**: turn OFF *Allow new users to sign up*.
2. **Supabase > Authentication > Policies/Sign in**: set the minimum password length to 8 or more.
3. Use strong, unique passwords for admin accounts. The app generates 8-character random passwords for new accounts.
4. Turn on 2-step verification (MFA) for your Supabase, Vercel and GitHub accounts. Keep the GitHub repo **private**.
5. Never put the `service_role` key, the `.env` file, or database password in the repo, in Vercel variables, or in chat.
   If a key leaks: Supabase > Project Settings > API > rotate the keys, then update Vercel and redeploy.
6. Delete accounts that are no longer needed (Admin > Manage accounts). Reset a password if a phone was lost.
7. Before the event: Supabase > Database > Backups (or SQL Editor export of the `sf_` tables) so results can be restored.
8. Re-run `supabase/schema.sql` after each update of the app (it is safe to run again).
`vercel.json` already sends security headers (no framing, no sniffing, HTTPS only).

### Install on the phone (PWA)
The Vercel link is an installable app (manifest, icons, service worker). People do not need an app store.
- **Android (Chrome)**: open the link. The Home screen shows an **Install** button (or Chrome menu ⋮ > *Install app*).
- **iPhone (Safari only)**: open the link in Safari > **Share** > **Add to Home Screen** > **Add**.
  (Links opened inside Messenger/Facebook/Viber must be opened in Safari first.)
After installing it opens full screen with the AGI icon. Updates arrive automatically the next time it is opened online.
The page shell works offline, but scores and standings need internet.

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

## Department & players (update)
- The department of each team shows in the team-name picker, the Teams tab and the bracket.
- Only the admin can set team names and encode players (optional, one per line, max 10 per team). Players show under the team in the bracket and Teams tab.
- After updating, run `supabase/schema.sql` again (adds the `players` column) and redeploy to Vercel.

## Match times, WS/WD changes, Cheer Dance & Mr & Ms Team Ambassador
- Admin can set/edit the time of every match (tap the time chip on the match card). Empty = default time. Stored in `sf_match_times`.
- Badminton Women's Singles: 7 teams (Game 4 = Team 4 vs winner of Game 1). Women's Doubles: 6 teams, Round 1 Semi-Finals (Games 1-3), Round 2 Championship = round robin of the 3 winners (Games 4-6); points only break ties on wins.
- Cheer Dance and Mr & Ms Team Ambassador: encode the DEPARTMENT of 1st-8th place (100/75/60/50/40/30/20/10 points; no place = 0). Admin, or a committee account assigned to "Cheer Dance"/"Mr & Ms Team Ambassador" in Accounts. The combined points of a team's department are only the FINAL tie-breaker of the overall ranking (percent first).
- After updating, run `supabase/schema.sql` again (new tables `sf_match_times`, `sf_placements`) and redeploy.

## Offline-safe encoding + My team
- Every change (winner, points, time, team names...) first goes into an **outbox saved on the device** (`src/outbox.js`) and is then sent to Supabase in order. With no/weak signal the change stays visible on the screen and in the outbox (even if the app is closed), a banner shows "N changes waiting to be sent", and it is sent automatically when the connection is back (retries every 15 s, plus when the phone reconnects). Changes the server really refuses (no permission) are dropped and reported.
- Last write wins: if two people change the same match while offline, the one sent last stays.
- The app opens right away with the last saved data when the signal is bad.
- Home > **My team**: each person picks their team name once (kept on that phone) and sees its percent, rank, next games with time and opponent, and results.
- Tests: `node --experimental-strip-types scripts/test-outbox.mjs` and `test-myteam.mjs`.

## Look & Live board
- Style: "arena scoreboard" - navy + gold, Barlow Condensed for numbers/headings, and a color per department ("house" colors in `src/data/departments.js`).
- Home header is a small scoreboard (leading team + one tick per match). Standings > Ranking shows a podium.
- **Live board** (Home > Live board, or open `/live` on the web): full-screen, rotates Standings / Up next / Champions every 10 s; tap = next panel. Made for a TV or projector; updates by itself.
