#!/usr/bin/env node
import { watch } from 'fs';
import { promises as fs } from 'fs';
import path from 'path';
import { buildManifest } from './build-manifest.mjs';

const DIR = path.resolve(process.cwd(), 'SWC_youtube_project');
const CFG = path.join(DIR, 'sheets.config.json');
const LOCAL_CSV = path.join(DIR, 'videos.csv');
const OUT = path.join(DIR, 'manifest.json');

let timer = null;
let suppressUntil = 0; // epoch ms to suppress watch reactions (e.g., after our own write)
async function trigger(reason = '') {
  clearTimeout(timer);
  timer = setTimeout(async () => {
    suppressUntil = Date.now() + 500; // ignore self-change events shortly after write
    await buildManifest();
  }, 200);
}

console.log(`Watching ${DIR} for changes...`);
await buildManifest();
watch(DIR, { recursive: false }, async (event, file) => {
  // Ignore writes to the generated manifest to avoid self-trigger loops
  if (file && path.resolve(DIR, file) === OUT) return;
  if (file && path.basename(file) === 'manifest.json') return;
  if (Date.now() < suppressUntil) return;
  trigger(`${event}:${file || ''}`);
});

// Also watch local CSV file if present
try {
  await fs.access(LOCAL_CSV);
  watch(LOCAL_CSV, {}, () => trigger('csv:change'));
} catch (_) {}

// Poll remote CSV if configured
let lastCsvText = '';
async function pollCsv() {
  try {
    const raw = await fs.readFile(CFG, 'utf8');
    const cfg = JSON.parse(raw);
    if (cfg && cfg.csvUrl) {
      const res = await fetch(cfg.csvUrl, { cache: 'no-store' });
      if (res.ok) {
        const text = await res.text();
        if (text !== lastCsvText) {
          lastCsvText = text;
          trigger();
        }
      }
    }
  } catch (_) {}
  setTimeout(pollCsv, 30000); // every 30s
}
pollCsv();
