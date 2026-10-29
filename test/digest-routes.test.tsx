import { copyFileSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { createApp } from '../src/app.js';

// A temp runs dir: runs/ is read-only.
let dir: string;
let app: ReturnType<typeof createApp>;

beforeAll(() => {
  dir = mkdtempSync(join(tmpdir(), 'rig-runs-'));
  copyFileSync('runs/2026-10-28.jsonl', join(dir, '2026-10-28.jsonl'));
  writeFileSync(join(dir, '2026-10-30.jsonl'), '');
  writeFileSync(
    join(dir, '2026-10-31.jsonl'),
    '{"at":"2026-10-31T23:00:00+01:00","job":"b/job","status":"ok","owner":null}\nnot json\n' +
      '{"at":"2026-10-31T23:01:00+01:00","job":"a/job","status":"fail","owner":"rook","error":"boom"}\n',
  );
  app = createApp({ adapter: 'shim', installed: '2026-10-29T14:06:00+01:00', beatEverySeconds: 60, runsDir: dir });
});
afterAll(() => rmSync(dir, { recursive: true, force: true }));

const jobsInHtml = (html: string) => [...html.matchAll(/<tr[^>]*><td>([^<]+)<\/td>/g)].map((m) => m[1]);

describe('GET /digest/:night', () => {
  it('200 with the banner and one row per job, sorted, marks on', async () => {
    process.env.LANE_MARKER = 'TEST-MARKER';
    const res = await app.request('/digest/2026-10-28');
    const html = await res.text();
    expect(res.status).toBe(200);
    expect(html).toContain('TEST-MARKER');
    expect(jobsInHtml(html)).toEqual(['digest/render', 'fixtures/refresh', 'lane/sync', 'notes/backup', 'rig/rotate-logs']);
    expect(html).toContain('3 retries');
    expect(html).toContain('failed');
    expect(html).toContain('<td>—</td>');
    expect(html).not.toContain('<script');
  });

  it('404 for a night with no file', async () => {
    expect((await app.request('/digest/2026-01-01')).status).toBe(404);
    expect((await app.request('/digest/not-a-night')).status).toBe(404);
  });

  it('renders "nothing ran" for an empty night', async () => {
    const res = await app.request('/digest/2026-10-30');
    expect(res.status).toBe(200);
    expect(await res.text()).toContain('nothing ran');
  });

  it('still renders a night with a bad line, and says so', async () => {
    const res = await app.request('/digest/2026-10-31');
    const html = await res.text();
    expect(res.status).toBe(200);
    expect(jobsInHtml(html)).toEqual(['a/job', 'b/job']);
    expect(html).toContain('1 unreadable line');
  });
});

describe('GET /api/digest/:night', () => {
  it('200 with the same jobs, in the same order, as the page', async () => {
    for (const night of ['2026-10-28', '2026-10-31']) {
      const res = await app.request(`/api/digest/${night}`);
      expect(res.status).toBe(200);
      const json = (await res.json()) as { rows: { job: string }[] };
      const page = await (await app.request(`/digest/${night}`)).text();
      expect(json.rows.map((r) => r.job)).toEqual(jobsInHtml(page));
    }
  });

  it('404 for a night with no file', async () => {
    expect((await app.request('/api/digest/2026-01-01')).status).toBe(404);
  });

  it('empty night: no rows', async () => {
    const json = (await (await app.request('/api/digest/2026-10-30')).json()) as { rows: unknown[]; badLines: number };
    expect(json).toMatchObject({ rows: [], badLines: 0 });
  });

  it('bad line counted, not thrown', async () => {
    const json = (await (await app.request('/api/digest/2026-10-31')).json()) as { badLines: number; rows: { owner: string | null }[] };
    expect(json.badLines).toBe(1);
    expect(json.rows[1].owner).toBeNull();
  });
});

describe('status board links', () => {
  it('links each night on disk to its digest, with counts', async () => {
    const html = await (await app.request('/')).text();
    expect(html).toContain('<a href="/digest/2026-10-28">2026-10-28</a>');
    expect(html).toContain('ok 10 · retry 4 · fail 1');
    for (const night of [...html.matchAll(/href="\/digest\/([\d-]+)"/g)].map((m) => m[1])) {
      expect((await app.request(`/digest/${night}`)).status).toBe(200);
    }
  });
});
