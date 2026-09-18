# Wallpaper files on Cloudflare R2

Supabase keeps the **rows** (title, category, URLs) and the admin sign-in. The **image files**
live in a Cloudflare R2 bucket: 10 GB free and no egress charges, so viewing wallpapers costs
nothing however many installs the apps get. The apps don't know or care — `image_url` /
`thumb_url` are plain URLs either way.

`worker.js` is a tiny Cloudflare Worker that the console uploads through. The console is a
public page and cannot hold an R2 key, so it sends its Supabase session token instead; the
Worker asks Supabase who that is and only accepts the admin account.

## One-time setup

### 1. Cloudflare account
1. <https://dash.cloudflare.com/sign-up> → create an account (free plan).
2. Left menu → **R2 Object Storage** → **Get started / Purchase R2 plan**. It asks for a
   payment method even for the free tier; nothing is charged under 10 GB / 10M reads a month.

### 2. Bucket
1. **R2 Object Storage → Create bucket**. Name: `wallpapers`. Location: *Automatic*. Create.
2. Open the bucket → **Settings** → **Public access** → *R2.dev subdomain* → **Allow Access**,
   type `allow`, confirm. Copy the URL it shows (`https://pub-….r2.dev`). That is
   `R2_PUBLIC_URL`.
   *(If you own a domain that's on Cloudflare, use **Custom domains → Add** instead — it's
   faster and not rate-limited. You can switch later with one SQL `update`, see below.)*
3. Still in **Settings → CORS policy → Add CORS policy**, paste:
   ```json
   [{ "AllowedOrigins": ["*"], "AllowedMethods": ["GET"], "AllowedHeaders": ["*"], "MaxAgeSeconds": 86400 }]
   ```
   (needed so the console's thumbnails and the browser preview load from the bucket.)

### 3. Worker
1. Left menu → **Workers & Pages** → **Create** → **Create Worker**. Name it
   `wallpaper-upload`. **Deploy** (it deploys a hello-world first).
2. **Edit code** → select everything in the editor, paste the contents of `worker.js`,
   **Deploy**.
3. Worker → **Settings → Bindings → Add**:
   - **R2 bucket** — variable name `BUCKET`, bucket `wallpapers`.
4. **Settings → Variables and Secrets → Add** (type *Text* for all):
   | Name | Value |
   | --- | --- |
   | `SUPABASE_URL` | same as `SUPABASE_URL` at the top of `index.html` |
   | `SUPABASE_KEY` | same as `SUPABASE_KEY` there |
   | `ADMIN_EMAIL` | the email you sign in to the console with |
   | `ALLOWED_ORIGIN` | `https://daniyal1023.github.io` |
   **Deploy** after saving.
5. Copy the Worker URL from its overview page (`https://wallpaper-upload.<account>.workers.dev`).
   That is `R2_WORKER_URL`.

### 4. Console
In `index.html`, fill in the two constants near the top:
```js
const R2_PUBLIC_URL = "https://pub-xxxxxxxx.r2.dev";
const R2_WORKER_URL = "https://wallpaper-upload.<account>.workers.dev";
```
Commit and push; GitHub Pages redeploys in a minute.

### 5. Test
Open the console, sign in, upload one image. It should say *Uploading … (0.x MB)* and the
new tile's image should open at a `…r2.dev/<app>/full/….webp` URL. In Cloudflare →
R2 → `wallpapers` → Objects you'll see the two files. Delete the test wallpaper from the
console and confirm the objects disappear too.

## What the console does per image

- Decodes in the browser (EXIF orientation applied), fits inside **2160×3840**, never upscales.
- Full image → **WebP, quality 0.85** (a 10 MB PNG becomes ~0.6–1.2 MB).
- Thumbnail → **480 px JPEG, quality 0.82** (~50 KB).
- Uploads both through the Worker; the row gets the public URLs.

Wallpapers uploaded before the switch stay on Supabase Storage and keep working. Deleting one
from the console still removes its files from the Supabase bucket.

## Moving off the r2.dev subdomain later

If you attach a custom domain (Bucket → Settings → Custom domains), point the rows at it:
```sql
update public.wallpapers
set image_url = replace(image_url, 'https://pub-xxxxxxxx.r2.dev', 'https://cdn.yourdomain.com'),
    thumb_url = replace(thumb_url, 'https://pub-xxxxxxxx.r2.dev', 'https://cdn.yourdomain.com');
```
and update `R2_PUBLIC_URL`. The apps pick the new URLs up on their next refresh.

## Capacity

≈ 1 MB per wallpaper (full + thumb) → **~9,000–10,000 wallpapers** in the free 10 GB, shared
across all apps. Beyond that R2 is $0.015 per GB-month (50 GB ≈ $0.60/month). Egress is
free at any scale.
