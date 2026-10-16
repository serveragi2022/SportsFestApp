# sf-admin (Edge Function)

Lets a signed-in **admin** create committee accounts inside the app (Admin > Accounts), delete them, and reset their password.
It needs a server because creating a login requires the Supabase *service role* key, which must never be inside the app.

## Deploy (pick one)
**A. Supabase CLI**
```
npm i -g supabase            # or: npx supabase ...
supabase login
supabase link --project-ref YOUR-PROJECT-REF
supabase functions deploy sf-admin --no-verify-jwt
```
**B. Dashboard**: Edge Functions > Deploy a new function > name it `sf-admin` > paste `index.ts`, and add `handler.ts` as a second file.

Turn "Verify JWT" OFF (or deploy with `--no-verify-jwt`): the function checks the caller itself, and the gateway check can reject valid logins with "Invalid JWT". `SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY` are set for you.

The function checks that the caller is listed in `sf_admins` before doing anything.

## If "Create account" fails
The app now shows the real reason. Typical ones:
- *not deployed / not found*: deploy the function (above).
- *Invalid JWT*: redeploy with `--no-verify-jwt`.
- *Only admins can manage accounts*: your login is not in `sf_admins` (see the main README, step 4).
- *relation "sf_staff" does not exist*: run `supabase/schema.sql` again.
More detail: Supabase > Edge Functions > sf-admin > Logs.
