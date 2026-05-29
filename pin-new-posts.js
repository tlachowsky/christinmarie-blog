#!/usr/bin/env node
/**
 * pin-new-posts.js
 * Runs in GitHub Actions after every Netlify deploy.
 * 1. Refreshes the Pinterest access token and stores new tokens back to GitHub secrets.
 * 2. Reads pinterest-config.json for post → board mapping.
 * 3. Reads pinned.json to find which posts have already been pinned.
 * 4. Creates pins for any posts not yet pinned.
 * 5. Commits updated pinned.json with [skip ci] to avoid triggering another deploy.
 */

const https = require('https');
const fs = require('fs');
const { execSync } = require('child_process');

const CLIENT_ID     = process.env.PINTEREST_CLIENT_ID;
const CLIENT_SECRET = process.env.PINTEREST_CLIENT_SECRET;
const REFRESH_TOKEN = process.env.PINTEREST_REFRESH_TOKEN;
const REPO          = 'tlachowsky/christinmarie-blog';

let ACCESS_TOKEN = process.env.PINTEREST_ACCESS_TOKEN;

// ─── HTTP helper ───────────────────────────────────────────────────────────────
function request(options, body) {
  return new Promise((resolve, reject) => {
    const req = https.request(options, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        try { resolve({ status: res.statusCode, body: JSON.parse(data) }); }
        catch { resolve({ status: res.statusCode, body: data }); }
      });
    });
    req.on('error', reject);
    if (body) req.write(body);
    req.end();
  });
}

function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

// ─── Token refresh ─────────────────────────────────────────────────────────────
async function refreshToken() {
  console.log('Refreshing Pinterest access token...');
  const creds = Buffer.from(`${CLIENT_ID}:${CLIENT_SECRET}`).toString('base64');
  const body  = `grant_type=refresh_token&refresh_token=${encodeURIComponent(REFRESH_TOKEN)}`;

  const res = await request({
    hostname: 'api.pinterest.com',
    path: '/v5/oauth/token',
    method: 'POST',
    headers: {
      'Authorization':  `Basic ${creds}`,
      'Content-Type':   'application/x-www-form-urlencoded',
      'Content-Length': Buffer.byteLength(body),
    },
  }, body);

  if (res.status !== 200) {
    console.error('Token refresh failed:', JSON.stringify(res.body));
    return false;
  }

  ACCESS_TOKEN = res.body.access_token;
  const newRefresh = res.body.refresh_token;

  // Store back to GitHub secrets so next run stays fresh
  try {
    execSync(`gh secret set PINTEREST_ACCESS_TOKEN --body "${ACCESS_TOKEN}" --repo ${REPO}`);
    execSync(`gh secret set PINTEREST_REFRESH_TOKEN --body "${newRefresh}" --repo ${REPO}`);
    console.log('Tokens stored back to GitHub secrets.');
  } catch (e) {
    console.warn('Could not update GitHub secrets (non-fatal):', e.message);
  }

  return true;
}

// ─── Pin creation ──────────────────────────────────────────────────────────────
async function createPin(boardId, title, description, imageUrl, link) {
  const body = JSON.stringify({
    link,
    title,
    description,
    board_id: boardId,
    media_source: { source_type: 'image_url', url: imageUrl },
  });

  const res = await request({
    hostname: 'api.pinterest.com',
    path: '/v5/pins',
    method: 'POST',
    headers: {
      'Authorization':  `Bearer ${ACCESS_TOKEN}`,
      'Content-Type':   'application/json',
      'Content-Length': Buffer.byteLength(body),
    },
  }, body);

  if (res.status !== 201) {
    throw new Error(`HTTP ${res.status}: ${JSON.stringify(res.body)}`);
  }

  return res.body.id;
}

// ─── Main ──────────────────────────────────────────────────────────────────────
async function main() {
  if (!REFRESH_TOKEN) {
    console.log('PINTEREST_REFRESH_TOKEN not set — skipping pin creation.');
    process.exit(0);
  }

  const ok = await refreshToken();
  if (!ok) {
    console.error('Could not refresh token — aborting pin creation.');
    process.exit(1);
  }

  const config = JSON.parse(fs.readFileSync('pinterest-config.json', 'utf8'));
  const pinned = fs.existsSync('pinned.json')
    ? JSON.parse(fs.readFileSync('pinned.json', 'utf8'))
    : {};

  let created = 0;
  let updated = false;

  for (const [slug, post] of Object.entries(config)) {
    if (pinned[slug] && pinned[slug].length > 0) {
      console.log(`Already pinned: ${slug}`);
      continue;
    }

    console.log(`\nPinning: ${slug}`);
    const imageUrl = `https://christinmarie.us/images/${post.hero_image}`;
    pinned[slug] = [];

    for (const boardId of post.board_ids) {
      try {
        const pinId = await createPin(boardId, post.title, post.description, imageUrl, post.url);
        console.log(`  ✓ Pin ${pinId} → board ${boardId}`);
        pinned[slug].push(pinId);
        created++;
        await sleep(1200); // Pinterest rate limit: ~1 req/sec
      } catch (e) {
        console.error(`  ✗ Board ${boardId}: ${e.message}`);
      }
    }

    updated = true;
  }

  if (updated) {
    fs.writeFileSync('pinned.json', JSON.stringify(pinned, null, 2));

    try {
      execSync('git config user.email "action@github.com"');
      execSync('git config user.name "GitHub Action"');
      execSync('git add pinned.json');
      execSync('git diff --cached --quiet || git commit -m "Update pinned.json [skip ci]"');
      execSync('git push');
      console.log('\nCommitted and pushed pinned.json.');
    } catch (e) {
      console.warn('Could not commit pinned.json (non-fatal):', e.message);
    }
  }

  console.log(`\nDone — ${created} new pin(s) created.`);
}

main().catch(e => { console.error(e); process.exit(1); });
