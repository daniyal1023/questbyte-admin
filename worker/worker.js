// Cloudflare Worker that lets the admin console write to the R2 bucket.
//
// The console is a public HTML page, so it can't hold an R2 key. Instead it sends the
// Supabase session token it already has; this Worker asks Supabase who that token belongs to
// and only accepts the admin account. Reads never come here — the bucket's public URL
// (R2.dev subdomain or custom domain) serves the files directly.
//
// Bindings/vars (dashboard → Worker → Settings):
//   BUCKET            R2 bucket binding
//   SUPABASE_URL      https://<project>.supabase.co
//   SUPABASE_KEY      the publishable/anon key (same as the console)
//   ADMIN_EMAIL       the account allowed to upload/delete
//   ALLOWED_ORIGIN    where the console is served from, e.g. https://daniyal1023.github.io

export default {
  async fetch(request, env) {
    const cors = {
      "Access-Control-Allow-Origin": env.ALLOWED_ORIGIN || "*",
      "Access-Control-Allow-Methods": "PUT, DELETE, OPTIONS",
      "Access-Control-Allow-Headers": "Authorization, Content-Type",
    };
    const reply = (status, body = null) => new Response(body, { status, headers: cors });

    if (request.method === "OPTIONS") return reply(204);
    if (request.method !== "PUT" && request.method !== "DELETE") return reply(405, "PUT or DELETE only");

    // Object key = URL path, e.g. PUT /hdwallpapers/full/123-sunset.webp
    const key = decodeURIComponent(new URL(request.url).pathname.slice(1));
    if (!key || key.includes("..") || key.startsWith("/")) return reply(400, "Bad key");

    // Who is calling? Let Supabase validate the token so no secret lives here or in the page.
    const token = (request.headers.get("Authorization") || "").replace(/^Bearer\s+/i, "");
    if (!token) return reply(401, "Sign in first");
    const who = await fetch(`${env.SUPABASE_URL}/auth/v1/user`, {
      headers: { apikey: env.SUPABASE_KEY, Authorization: `Bearer ${token}` },
    });
    if (!who.ok) return reply(401, "Session expired — sign in again");
    const user = await who.json();
    if ((user.email || "").toLowerCase() !== (env.ADMIN_EMAIL || "").toLowerCase()) return reply(403, "Not the admin account");

    if (request.method === "PUT") {
      await env.BUCKET.put(key, request.body, {
        httpMetadata: {
          contentType: request.headers.get("Content-Type") || "application/octet-stream",
          // File names carry a timestamp, so they never change: cache them forever.
          cacheControl: "public, max-age=31536000, immutable",
        },
      });
      return reply(200, JSON.stringify({ key }));
    }
    await env.BUCKET.delete(key);
    return reply(204);
  },
};
