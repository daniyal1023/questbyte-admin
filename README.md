# Questbyte Labs · Wallpaper Console

Admin page for the Questbyte wallpaper apps (4K HD Wallpaper, Black Wallpapers – AMOLED 4K). Static HTML, talks to Supabase directly.
Deployed with GitHub Pages; writes require signing in as the admin account
(enforced by row-level security in Supabase, not by this page).

This repo is the only copy of the console (the wallpaper app repos no longer carry an `admin/`
folder). Edit `index.html` here and push to redeploy; the Supabase policies it relies on are in
each app repo under `supabase/admin.sql` and `supabase/multi-app.sql`.

Image files are stored in Cloudflare R2 (free egress); uploads go through the small Worker in
[`worker/`](worker/). Setup steps, capacity and how compression works: [`worker/README.md`](worker/README.md).
Until `R2_PUBLIC_URL` / `R2_WORKER_URL` are filled in at the top of `index.html`, uploads fall
back to the Supabase `Wallpaper` bucket.
