#!/usr/bin/env node
// Convert a CSV exported from the sheet (columns F=image filename, G=video link)
// into SWC_youtube_project/videos.csv (image,link,alt,title)

import { promises as fs } from 'fs';
import path from 'path';

const DIR = path.resolve(process.cwd(), 'SWC_youtube_project');
const INPUT = path.join(DIR, 'sheet.csv');
const OUTPUT = path.join(DIR, 'videos.csv');

function parseCSV(text) {
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
      } else { field += c; }
    } else {
      if (c === '"') inQuotes = true;
      else if (c === ',') { row.push(field); field = ''; }
      else if (c === '\n') { row.push(field); rows.push(row); row = []; field = ''; }
      else if (c === '\r') { /* ignore */ }
      else { field += c; }
    }
  }
  if (field.length > 0 || row.length > 0) { row.push(field); rows.push(row); }
  return rows;
}

function toBaseName(file) { return String(file).trim().replace(/\.[^.]+$/, ''); }

function parseYouTubeId(input) {
  if (!input) return '';
  const str = String(input).trim();
  if (/^[A-Za-z0-9_-]{11}$/.test(str)) return str;
  try {
    const u = new URL(str);
    if (u.hostname === 'youtu.be') return u.pathname.replace(/^\//, '').slice(0, 11);
    if (u.hostname.includes('youtube.com')) {
      if (u.pathname.startsWith('/watch')) return u.searchParams.get('v') || '';
      if (u.pathname.startsWith('/shorts/')) return u.pathname.split('/')[2] || '';
      const parts = u.pathname.split('/');
      const idx = parts.indexOf('embed');
      if (idx !== -1 && parts[idx + 1]) return parts[idx + 1];
    }
  } catch {}
  return '';
}

async function main() {
  const cfgPath = path.join(DIR, 'normalize.config.json');
  let headerRow = true;
  let fIndex = 0; // default: first column is F-equivalent
  let gIndex = 1; // default: second column is G-equivalent
  let carryOver = false; // do not carry F across rows by default
  try {
    const raw = await fs.readFile(cfgPath, 'utf8');
    const cfg = JSON.parse(raw);
    if (typeof cfg.headerRow === 'boolean') headerRow = cfg.headerRow;
    if (Number.isInteger(cfg.fIndex)) fIndex = cfg.fIndex; // 0-based
    if (Number.isInteger(cfg.gIndex)) gIndex = cfg.gIndex; // 0-based
    if (typeof cfg.carryOver === 'boolean') carryOver = cfg.carryOver;
  } catch {}

  const text = await fs.readFile(INPUT, 'utf8');
  const rows = parseCSV(text);
  if (!rows.length) throw new Error('sheet.csv is empty');

  const dataRows = headerRow ? rows.slice(1) : rows;
  let currentBases = [];
  const pairs = []; // { image, link }

  for (const r of dataRows) {
    if (!r || r.length < 2) continue;
    const f = (r[fIndex] || '').trim(); // column F (image file name or comma-separated list)
    const g = (r[gIndex] || '').trim(); // column G (video link)
    if (f) {
      // Allow comma-separated (and Japanese comma) list of images
      currentBases = f.split(/[、,]/).map(s => s.trim()).filter(Boolean);
    } else if (!carryOver) {
      // reset group if carryOver disabled
      currentBases = [];
    }
    if (!currentBases.length) {
      if (!carryOver) continue; // ignore rows before first F appears when carryOver disabled
    }
    if (!g) continue; // skip rows without link
    const id = parseYouTubeId(g);
    if (!id) continue;
    for (const img of currentBases) {
      pairs.push({ image: img, link: g });
    }
  }

  // Build normalized rows grouped by image
  const byImage = new Map();
  for (const p of pairs) {
    const arr = byImage.get(p.image) || [];
    arr.push(p.link);
    byImage.set(p.image, arr);
  }

  let out = 'image,link,alt,title\n';
  for (const [image, links] of byImage) {
    const base = toBaseName(image);
    for (const link of links) {
      out += `${image},${link},${base},\n`;
    }
  }

  await fs.writeFile(OUTPUT, out, 'utf8');
  console.log(`Wrote ${path.relative(process.cwd(), OUTPUT)} with ${pairs.length} rows.`);
}

main().catch((e) => {
  console.error(e?.message || e);
  process.exit(1);
});
