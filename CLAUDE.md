# CLAUDE.md — Life As Mrs. L (christinmarie.us)

## What This Project Is

Lifestyle/affiliate blog for Christin Marie. Pink/warm brand. Arkansas-based mom, teacher, homebody, Disney lover, book lover, money saver. Monetized via Walmart Creator affiliate program.

**Live site:** https://christinmarie.us
**GitHub repo:** https://github.com/tlachowsky/christinmarie-blog
**Netlify site ID:** eb65fe2a-22ae-47c1-84eb-e8e46b5339b7
**Working folder:** C:\Users\tyler\OneDrive\Documents\Claude\Projects\Christin Marie

---

## Credentials & Secrets

All secrets are stored in two places:
- **Local:** `.env` file in the project root (gitignored)
- **GitHub:** Repo secrets at github.com/tlachowsky/christinmarie-blog/settings/secrets

| Secret | Key Name | Notes |
|---|---|---|
| Netlify token | `NETLIFY_AUTH_TOKEN` | In .env + GitHub secrets |
| Netlify site ID | `NETLIFY_SITE_ID` | eb65fe2a-22ae-47c1-84eb-e8e46b5339b7 |
| GitHub PAT | `GH_TOKEN` | In .env — scopes: repo, workflow |
| Grok API key | `GROK_API_KEY` | In .env + GitHub secrets — model: grok-imagine-image |
| Pinterest App ID | n/a | 1575789 — **client secret pending Pinterest trial access approval** |

**GitHub CLI auth:** Use `$env:GH_TOKEN = "..."` — the `gh auth login --with-token` pipe method doesn't work on Windows PowerShell; use GH_TOKEN env var instead.

**Grok model:** `grok-imagine-image` (grok-2-image-1212 was deprecated 2026-02-24)

---

## Pipeline: How Posts Get Built and Deployed

### Full automated workflow (one push = live site):
```
1. Generate images via Grok API → save to images/
2. Write post HTML (posts/filename.html) using design system classes
3. git add [specific files only] && git commit && git push origin main
4. GitHub Actions (deploy.yml) runs → npx netlify-cli deploy --dir=. --prod
5. Site live at christinmarie.us within ~90 seconds
```

### To push WITHOUT deploying to Netlify:
```
git push origin draft   ← deploy.yml only triggers on main
```

### GitHub Actions workflows (in .github/workflows/):
- **deploy.yml** — Deploys to Netlify on every push to main
- **claude.yml** — Enables @claude mentions in GitHub Issues to trigger post creation (requires ANTHROPIC_API_KEY secret — not yet set)

---

## Design System

Two CSS files live in the project root. Posts reference them with `../` prefix.

| File | Purpose |
|---|---|
| `colors_and_type.css` | Design tokens: colors, fonts, spacing, shadows, radii |
| `styles.css` | Component classes: header, nav, post hero, post body, footer, sidebar, cards |

**Key fonts:** Sacramento (script), Lora (serif headings), Nunito Sans (body)
**Key colors:** `--rose-500: #D87878`, `--cream: #FBF5F0`, `--cocoa-800: #3D2828`

### Classes to use in every post page:
- `.site-header` / `.site-header__inner` / `.brand` / `.site-nav`
- `.post-hero` / `.post-hero__title` / `.post-hero__lede` / `.post-hero__image` (uses background-image)
- `.post-body` (inside `.container`) — use `.drop` on first `<p>` for drop cap
- `.post-sign` for the sign-off line
- `.eyebrow` for date/category label
- `.site-footer` / `.site-footer__grid` / `.site-footer__bottom`

### CSS path rules:
- Root pages (index.html, about.html, etc.): `href="colors_and_type.css"` and `href="styles.css"`
- Post pages (posts/*.html): `href="../colors_and_type.css"` and `href="../styles.css"`

---

## File Structure

```
/
├── index.html               ← Homepage (uses real Christin photos)
├── about.html
├── disclosure.html
├── privacy.html
├── colors_and_type.css      ← Design tokens
├── styles.css               ← Component styles
├── netlify.toml             ← publish = "."
├── .gitignore
├── .env                     ← Local secrets (gitignored)
├── CLAUDE.md                ← This file
│
├── assets/
│   ├── photos/
│   │   ├── christin-selfie.jpg       ← Hero photo on homepage
│   │   └── christin-carmy-porch.jpg  ← Christin + Carmy (sidebar, about)
│   ├── app-icon.jpg                  ← Pinterest developer app icon
│   ├── logo-mark.svg
│   ├── logo-wordmark.svg
│   ├── divider-sprig.svg
│   └── icons/pinterest.svg
│
├── images/                  ← All Grok-generated post images (55 total)
│   ├── back-to-school-*.jpg
│   ├── summer-*.jpg
│   ├── end-of-year-*.jpg
│   ├── spring-refresh-*.jpg
│   ├── disney-*.jpg
│   ├── carmy-*.jpg
│   ├── reading-*.jpg
│   ├── holiday-*.jpg
│   ├── organization-*.jpg
│   ├── classroom-*.jpg
│   ├── teacher-supplies-*.jpg
│   └── dorm-*.jpg
│
├── posts/                   ← 12 blog posts (all styled, all with images)
│   ├── end-of-year-teacher-finds.html
│   ├── walmart-home-spring-refresh.html
│   ├── disney-packing-list.html
│   ├── carmy-dog-walmart-finds.html
│   ├── winter-reading-list.html
│   ├── holiday-home-decor-walmart.html
│   ├── home-organization-favorites.html
│   ├── teacher-classroom-fall-reset.html
│   ├── teacher-supplies-i-buy-myself.html
│   ├── back-to-school-three-kids.html
│   ├── summer-at-home-favorites.html
│   └── dorm-prep-walmart-finds.html
│
└── _strategy/
    └── pinterest-strategy.md   ← Pinterest image specs, board structure, keyword clusters
```

---

## Generating Images with Grok

**Always consult `_strategy/pinterest-strategy.md` for image specs.**

Key Pinterest specs:
- **Size:** 1000×1500px, 2:3 vertical — prompts should specify "vertical portrait"
- **Style:** Warm lifestyle photography, natural light, cream/blush/rose tones, no clutter
- **Human presence:** Hands holding products, partial lifestyle shots stop the scroll
- **No text in images** unless it's a branded title card

### PowerShell image generation pattern:
```powershell
$key = $env:GROK_API_KEY   # load from .env or environment
$headers = @{ "Authorization" = "Bearer $key"; "Content-Type" = "application/json" }
$imgDir = "C:\Users\tyler\OneDrive\Documents\Claude\Projects\Christin Marie\images"

function Invoke-GrokImage($prompt, $filename) {
  $body = @{ model = "grok-imagine-image"; prompt = $prompt; n = 1; response_format = "b64_json" } | ConvertTo-Json
  $r = Invoke-RestMethod -Uri "https://api.x.ai/v1/images/generations" -Method Post -Headers $headers -Body $body -TimeoutSec 60
  $bytes = [Convert]::FromBase64String($r.data[0].b64_json)
  [IO.File]::WriteAllBytes("$imgDir\$filename", $bytes)
  Write-Host "Saved $filename"
}
```

**Cost:** ~$0.028/image. 5 images/post = ~$0.14/post. $20 ≈ 142 posts.

---

## Adding a New Blog Post (Full Workflow)

1. **Read** any existing stub in `posts/` if it exists
2. **Consult** `_strategy/pinterest-strategy.md` for image style guidance
3. **Generate 5 images** via Grok — save to `images/` with descriptive names
4. **Write** `posts/filename.html` using design system classes (see above)
   - Link: `../colors_and_type.css` and `../styles.css`
   - Hero image: `.post-hero__image` div with `background-image` style
   - Content images: `<img>` tags inside `.post-body`
   - First paragraph: add class `drop` for drop cap
   - Sign-off: `<p class="post-sign">-- Christin Marie</p>`
   - Disclosure block: blush-50 background, rose-400 left border
5. **Stage only the new post and its images** — never `git add -A`
6. **Commit and push to main** → Netlify deploys automatically

---

## Blog Content Voice & Brand

- **Name:** Christin Marie — refers to herself as "Mrs. L"
- **Family:** E (oldest, just went to college), P (15yo son), A (14yo daughter), Carmy (dog — small fluffy, NOT a golden retriever)
- **Voice:** Warm, direct, self-aware humor. No apostrophes in contractions written as: "do not", "I am", "it is" (written-out style). Em dashes (--) over commas for pauses.
- **Affiliate tone:** Lead with lifestyle, not product. Value-first, never hard sell.
- **No Walmart branding in post content** unless it's a specific Walmart-focused post

---

## Pinterest Integration (Pending)

**Status:** App created, waiting for Pinterest trial access approval to get client secret.

**App ID:** 1575789
**Client Secret:** PENDING — check developers.pinterest.com when approved

**When approved — steps to complete:**
1. Paste client secret here
2. Store as GitHub secret `PINTEREST_CLIENT_SECRET`
3. Run OAuth authorization URL in Christin's browser to get one-time code
4. Exchange code for access + refresh tokens
5. Add Pinterest pin creation step to `.github/workflows/deploy.yml`
6. Each post push will auto-create 5 pins mapped to correct boards

**Required OAuth scopes:** `boards:read,boards:write,pins:read,pins:write,user_accounts:read`

**Board structure** (from Pinterest strategy):
- Walmart Home Organization Finds
- Teacher Classroom Ideas and Supplies
- Disney Trip Planning Tips
- Books Worth Reading
- Back to School for Teens
- Budget Home Decor Ideas
- Dorm Room Essentials
- Dog Mom Life
- Arkansas Mom Life
