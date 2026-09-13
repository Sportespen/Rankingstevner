// Captures World Athletics' own internal GraphQL endpoint + rotating access key by watching a
// real athlete page load its own data, then stores it in Cloudflare KV for the site's Functions
// to read directly.
//
// World Athletics has no public API. worldathletics.org's own frontend calls an internal GraphQL
// backend using a short-lived "x-api-key" header that only ever appears in real browser network
// traffic - there is no documented way to request one. The whole app used to depend entirely on
// a third-party service (worldathletics.nimarion.de) that does exactly this trick on our behalf -
// confirmed live to be a single point of failure when that service went down for 24+ hours with
// no ETA and no way for us to reach its maintainer. This script runs the same trick ourselves
// (via GitHub Actions, see .github/workflows/refresh-wa-graphql-key.yml), so a future outage of
// that one third party can no longer take down athlete lookups here - see functions/_shared/
// wa-graphql.js for how the stored credentials get used.
import { chromium } from 'playwright';

const ATHLETE_URL = 'https://worldathletics.org/athletes/-/14989292';
const CAPTURE_TIMEOUT_MS = 30000;

async function captureCredentials() {
  const browser = await chromium.launch();
  try {
    const page = await browser.newPage();
    let found = null;
    // The GraphQL call fires client-side, asynchronously, after the page's own initial HTML has
    // already loaded - listening on every outgoing request (rather than trying to read the final
    // page content) is the only way to see the header at all.
    page.on('request', (req) => {
      if (found) return;
      const apiKey = req.headers()['x-api-key'];
      if (apiKey) found = { apiKey, endpoint: req.url() };
    });
    await page.goto(ATHLETE_URL, { waitUntil: 'load', timeout: CAPTURE_TIMEOUT_MS }).catch(() => {});
    const deadline = Date.now() + CAPTURE_TIMEOUT_MS;
    while (!found && Date.now() < deadline) {
      await page.waitForTimeout(500);
    }
    return found;
  } finally {
    await browser.close();
  }
}

async function writeToCloudflareKv(config) {
  const { CLOUDFLARE_API_TOKEN, CLOUDFLARE_ACCOUNT_ID, CLOUDFLARE_KV_NAMESPACE_ID } = process.env;
  if (!CLOUDFLARE_API_TOKEN || !CLOUDFLARE_ACCOUNT_ID || !CLOUDFLARE_KV_NAMESPACE_ID) {
    throw new Error('Missing CLOUDFLARE_API_TOKEN / CLOUDFLARE_ACCOUNT_ID / CLOUDFLARE_KV_NAMESPACE_ID env vars');
  }
  const url = `https://api.cloudflare.com/client/v4/accounts/${CLOUDFLARE_ACCOUNT_ID}/storage/kv/namespaces/${CLOUDFLARE_KV_NAMESPACE_ID}/values/wa_graphql_config`;
  const res = await fetch(url, {
    method: 'PUT',
    headers: { Authorization: `Bearer ${CLOUDFLARE_API_TOKEN}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ ...config, updatedAt: new Date().toISOString() }),
  });
  if (!res.ok) throw new Error(`Cloudflare KV write failed: ${res.status} ${await res.text()}`);
}

async function main() {
  const config = await captureCredentials();
  if (!config) {
    console.error('Could not capture an x-api-key from a live World Athletics page load within the timeout.');
    process.exit(1);
  }
  console.log(`Captured GraphQL endpoint: ${config.endpoint}`);
  await writeToCloudflareKv(config);
  console.log('Stored fresh World Athletics GraphQL credentials in Cloudflare KV.');
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
