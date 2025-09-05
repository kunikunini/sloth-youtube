#!/usr/bin/env node
import { promises as fs } from 'fs';
import path from 'path';

const ROOT = process.cwd();
const DIR = path.resolve(ROOT, 'SWC_youtube_project');
const OUT = path.join(DIR, 'manifest.json');

const IMAGE_EXTS = new Set(['.png', '.jpg', '.jpeg', '.webp', '.gif', '.svg']);

function toBaseName(file) {
  return file.replace(/\.[^.]+$/, '');
}

function parseCSV(text) {
  // Minimal CSV parser supporting quotes and commas
  const rows = [];
  let row = [];
  let field = '';
  let inQuotes = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (inQuotes) {
      if (c === '"') {
        if (text[i + 1] === '"') { field += '"'; i++; }
        else { inQuotes = false; }
      } else {
        field += c;
      }
    } else {
      if (c === '"') inQuotes = true;
      else if (c === ',') { row.push(field); field = ''; }
      else if (c === '\n') { row.push(field); rows.push(row); row = []; field = ''; }
      else if (c === '\r') { /* skip */ }
      else { field += c; }
    }
  }
  if (field.length > 0 || row.length > 0) { row.push(field); rows.push(row); }
  if (!rows.length) return { headers: [], records: [] };
  const headers = rows[0].map(h => h.trim().toLowerCase());
  const records = rows.slice(1).map(r => Object.fromEntries(headers.map((h, idx) => [h, (r[idx] ?? '').trim()])));
  return { headers, records };
}

function parseYouTubeId(input) {
  if (!input) return '';
  const str = String(input).trim();
  // Direct ID (11 chars alnum, -, _ typical) – accept if plausible
  if (/^[A-Za-z0-9_-]{11}$/.test(str)) return str;
  try {
    const u = new URL(str);
    if (u.hostname === 'youtu.be') {
      return u.pathname.replace(/^\//, '').slice(0, 11);
    }
    if (u.hostname.includes('youtube.com')) {
      if (u.pathname.startsWith('/watch')) {
        return u.searchParams.get('v') || '';
      }
      if (u.pathname.startsWith('/shorts/')) {
        return u.pathname.split('/')[2] || '';
      }
      // embed or other forms
      const parts = u.pathname.split('/');
      const idx = parts.indexOf('embed');
      if (idx !== -1 && parts[idx + 1]) return parts[idx + 1];
    }
  } catch (_) {}
  return '';
}

async function loadSheetMap() {
  // Priority: sheets.config.json (csvUrl) -> local videos.csv -> none
  const cfgPath = path.join(DIR, 'sheets.config.json');
  try {
    const raw = await fs.readFile(cfgPath, 'utf8');
    const cfg = JSON.parse(raw);
    if (cfg && typeof cfg.csvUrl === 'string' && cfg.csvUrl) {
      try {
        const res = await fetch(cfg.csvUrl, { cache: 'no-store' });
        if (res.ok) {
          const text = await res.text();
          const { records } = parseCSV(text);
          return buildVideoMapFromRecords(records);
        }
      } catch (e) {
        console.warn('CSV fetch failed:', e?.message || e);
      }
    }
  } catch (_) {}

  // Fallback to local CSV if exists
  const localCsv = path.join(DIR, 'videos.csv');
  try {
    const text = await fs.readFile(localCsv, 'utf8');
    const { records } = parseCSV(text);
    return buildVideoMapFromRecords(records);
  } catch (_) {}

  return new Map();
}

function buildVideoMapFromRecords(records) {
  // Expected columns (case-insensitive): image, base, alt, video_id, title
  const map = new Map(); // key: base (without extension) -> { alt?, videos: [] }
  for (const r of records) {
    const image = r.image || '';
    const base = (r.base || (image ? toBaseName(image) : '')).trim();
    const alt = r.alt || '';
    const link = r.link || r.url || '';
    const videoId = r.video_id || r.videoid || r.id || parseYouTubeId(link) || '';
    const title = r.title || '';
    if (!base) continue;
    if (!map.has(base)) map.set(base, { alt: '', videos: [] });
    const entry = map.get(base);
    if (alt) entry.alt = alt; // override alt if provided
    if (videoId) entry.videos.push({ id: videoId, title });
  }
  return map;
}

async function loadSheetViaServiceAccount() {
  // Config and creds files
  const cfgPath = path.join(DIR, 'sheets.sa.json');
  try {
    const raw = await fs.readFile(cfgPath, 'utf8');
    const cfg = JSON.parse(raw);
    if (!cfg || !cfg.spreadsheetId) return null;
    const credPath = cfg.credentialsPath
      ? path.isAbsolute(cfg.credentialsPath)
        ? cfg.credentialsPath
        : path.join(ROOT, cfg.credentialsPath)
      : path.join(DIR, 'service-account.json');
    const credRaw = await fs.readFile(credPath, 'utf8');
    const creds = JSON.parse(credRaw);
    const token = await getServiceAccountAccessToken(creds, 'https://www.googleapis.com/auth/spreadsheets.readonly');
    const sheetName = cfg.sheetName || 'Sheet1';
    // Only fetch F and G columns as requested
    const range = cfg.range || `${sheetName}!F:G`;
    const url = `https://sheets.googleapis.com/v4/spreadsheets/${encodeURIComponent(cfg.spreadsheetId)}/values/${encodeURIComponent(range)}?majorDimension=ROWS`;
    const res = await fetch(url, { headers: { Authorization: `Bearer ${token}` }, cache: 'no-store' });
    if (!res.ok) {
      console.warn('Sheets API error:', res.status, await res.text());
      return null;
    }
    const data = await res.json();
    const values = Array.isArray(data.values) ? data.values : [];
    // Expect header row? If cfg.headerRow === false then treat all as data
    const startIdx = cfg.headerRow === false ? 0 : 1;
    const map = new Map();
    for (let i = startIdx; i < values.length; i++) {
      const row = values[i] || [];
      const image = (row[0] || '').trim(); // F列: 画像ファイル名
      const link = (row[1] || '').trim();  // G列: 動画リンク
      if (!image || !link) continue;
      const base = toBaseName(image);
      if (!map.has(base)) map.set(base, { alt: base, videos: [] });
      const id = parseYouTubeId(link);
      if (!id) continue;
      map.get(base).videos.push({ id, title: '' });
    }
    return map;
  } catch (e) {
    // No config or failed – ignore
    return null;
  }
}

async function getServiceAccountAccessToken(creds, scope) {
  const { client_email, private_key } = creds || {};
  if (!client_email || !private_key) throw new Error('Invalid service account credentials');
  const now = Math.floor(Date.now() / 1000);
  const header = base64url(JSON.stringify({ alg: 'RS256', typ: 'JWT' }));
  const claims = base64url(JSON.stringify({
    iss: client_email,
    scope,
    aud: 'https://oauth2.googleapis.com/token',
    iat: now,
    exp: now + 3600,
  }));
  const signInput = `${header}.${claims}`;
  const signature = signRs256(signInput, private_key);
  const jwt = `${signInput}.${signature}`;
  const form = new URLSearchParams({
    grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer',
    assertion: jwt,
  });
  const res = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: form.toString(),
  });
  if (!res.ok) throw new Error(`Token failed: ${res.status}`);
  const data = await res.json();
  return data.access_token;
}

function base64url(str) {
  return Buffer.from(str).toString('base64').replace(/=/g, '').replace(/\+/g, '-').replace(/\//g, '_');
}

import crypto from 'crypto';
function signRs256(input, privateKey) {
  const signer = crypto.createSign('RSA-SHA256');
  signer.update(input);
  signer.end();
  const sig = signer.sign(privateKey);
  return sig.toString('base64').replace(/=/g, '').replace(/\+/g, '-').replace(/\//g, '_');
}

export async function buildManifest() {
  try {
    const entries = await fs.readdir(DIR, { withFileTypes: true });
    const EXCLUDE = [
      /channels4_banner/i,
      /background_yonewaits_3_5/i,
      /^background/i,
      /^sloth_logo/i,
      /footer_img/i
    ];
    const images = entries
      .filter((e) => e.isFile() && IMAGE_EXTS.has(path.extname(e.name).toLowerCase()))
      .map((e) => e.name)
      // exclude non-character assets (banners, background, logos)
      .filter((name) => !EXCLUDE.some((re) => re.test(name)))
      .sort((a, b) => a.localeCompare(b, 'ja'));

    // Priority: Service Account Sheets -> Published CSV -> Local CSV -> Sidecar
    const saMap = await loadSheetViaServiceAccount();
    const sheetMap = saMap || await loadSheetMap();

    const characters = [];
    for (const file of images) {
      const base = toBaseName(file);
      const sidecars = [
        path.join(DIR, `${base}.videos.json`),
        path.join(DIR, `${base}.json`),
      ];
      let alt = base;
      let videos = [];
      for (const sc of sidecars) {
        try {
          const raw = await fs.readFile(sc, 'utf8');
          const obj = JSON.parse(raw);
          if (obj.alt) alt = obj.alt;
          if (Array.isArray(obj.videos)) videos = obj.videos;
          break;
        } catch (_) {
          // ignore missing/invalid
        }
      }
      // Sheet data overrides sidecar if present
      if (sheetMap && sheetMap.has(base)) {
        const fromSheet = sheetMap.get(base);
        if (fromSheet.alt) alt = fromSheet.alt;
        if (Array.isArray(fromSheet.videos) && fromSheet.videos.length) {
          videos = fromSheet.videos;
        }
      }
      // Deduplicate and sanitize videos by id
      if (Array.isArray(videos) && videos.length) {
        const seen = new Set();
        videos = videos.filter((v) => {
          const id = v && v.id ? String(v.id).trim() : '';
          if (!id) return false;
          if (seen.has(id)) return false;
          seen.add(id);
          return true;
        }).map((v) => ({ id: String(v.id).trim(), title: v.title ? String(v.title) : '' }));
      }
      characters.push({
        image: `./SWC_youtube_project/${file}`,
        alt,
        videos,
      });
    }

    const manifest = {
      generatedAt: new Date().toISOString(),
      characters,
    };
    await fs.writeFile(OUT, JSON.stringify(manifest, null, 2), 'utf8');
    console.log(`Wrote manifest with ${characters.length} characters -> ${path.relative(ROOT, OUT)}`);
  } catch (err) {
    console.error('Manifest build failed:', err?.message || err);
    process.exitCode = 1;
  }
}

// Always attempt to run when executed directly or via npm script
buildManifest();
