#!/usr/bin/env node
import { watch } from 'fs';
import { promises as fs } from 'fs';
import path from 'path';
import { buildManifest } from './build-manifest.mjs';

const DIR = path.resolve(process.cwd(), 'SWC_youtube_project');
const CFG = path.join(DIR, 'sheets.config.json');
const LOCAL_CSV = path.join(DIR, 'videos.csv');

let timer = null;
async function trigger() {
  clearTimeout(timer);
  timer = setTimeout(() => buildManifest(), 200);
}

console.log(`Watching ${DIR} for changes...`);
await buildManifest();
watch(DIR, { recursive: false }, async (_event, _file) => {
  trigger();
});

// Also watch local CSV file if present
try {
  await fs.access(LOCAL_CSV);
  watch(LOCAL_CSV, {}, () => trigger());
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
