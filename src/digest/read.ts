import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { NIGHT, type DigestRow, type Night, type ReadNight, type RunStatus } from './types.js';

type Line = { at: string; job: string; status: RunStatus; owner: string | null; error: string | null };

const STATUSES: readonly string[] = ['ok', 'retry', 'fail'];

// Parse at the edge: anything that isn't a well-formed line is a bad line.
function parseLine(text: string): Line | null {
  let v: unknown;
  try {
    v = JSON.parse(text);
  } catch {
    return null;
  }
  if (typeof v !== 'object' || v === null || Array.isArray(v)) return null;
  const o = v as Record<string, unknown>;
  const { at, job, status, owner, error } = o;
  if (typeof at !== 'string' || Number.isNaN(Date.parse(at))) return null;
  if (typeof job !== 'string' || job === '') return null;
  if (typeof status !== 'string' || !STATUSES.includes(status)) return null;
  if (owner !== null && typeof owner !== 'string') return null;
  if (error !== undefined && error !== null && typeof error !== 'string') return null;
  return { at, job, status: status as RunStatus, owner, error: typeof error === 'string' ? error : null };
}

export function foldNight(night: string, text: string): Night {
  const rows = new Map<string, DigestRow & { lastMs: number; firstMs: number }>();
  const counts = { ok: 0, retry: 0, fail: 0 };
  let badLines = 0;

  for (const raw of text.split('\n')) {
    if (raw.trim() === '') continue;
    const line = parseLine(raw);
    if (!line) {
      badLines++;
      continue;
    }
    counts[line.status]++;
    const ms = Date.parse(line.at);
    const row = rows.get(line.job);
    if (!row) {
      rows.set(line.job, {
        job: line.job,
        owner: line.owner,
        runs: 1,
        retries: line.status === 'retry' ? 1 : 0,
        lastStatus: line.status,
        lastError: line.error,
        firstAt: line.at,
        lastAt: line.at,
        firstMs: ms,
        lastMs: ms,
      });
      continue;
    }
    row.runs++;
    if (line.status === 'retry') row.retries++;
    if (ms < row.firstMs) {
      row.firstMs = ms;
      row.firstAt = line.at;
    }
    if (ms >= row.lastMs) {
      row.lastMs = ms;
      row.lastAt = line.at;
      row.lastStatus = line.status;
      row.owner = line.owner;
      if (line.error !== null) row.lastError = line.error;
    }
  }

  const sorted = [...rows.values()]
    .sort((a, b) => (a.job < b.job ? -1 : a.job > b.job ? 1 : 0))
    .map(({ firstMs: _f, lastMs: _l, ...row }) => row);
  return { night, rows: sorted, counts, badLines };
}

export const readNight: ReadNight = (runsDir, night) => {
  if (!NIGHT.test(night)) return null;
  let text: string;
  try {
    text = readFileSync(join(runsDir, `${night}.jsonl`), 'utf8');
  } catch {
    return null;
  }
  return foldNight(night, text);
};
