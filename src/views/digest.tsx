import type { DigestRow, Night } from '../digest/types.js';

// Plan morning-digest § 2a. Marked: retries of 3 or more, and any `fail`. The mark is text as
// well as colour, so a screenshot, a slow reader and an agent's fetch all see it (ADR 0001).
export function flags(row: DigestRow): string[] {
  const f: string[] = [];
  if (row.retries >= 3) f.push(`${row.retries} retries`);
  if (row.fails > 0) f.push(row.fails === 1 ? 'failed' : `failed ${row.fails}×`);
  return f;
}

const dash = (v: string | null) => (v === null || v === '' ? '—' : v);

export function DigestPage({ night }: { night: Night }) {
  const { counts } = night;
  return (
    <>
      <h1>digest · {night.night}</h1>
      <p class="mute">
        ok {counts.ok} · retry {counts.retry} · fail {counts.fail}
        {night.badLines > 0 ? ` · ${night.badLines} unreadable line${night.badLines === 1 ? '' : 's'}` : ''}
      </p>
      {night.rows.length === 0 ? (
        <p class="mute">nothing ran</p>
      ) : (
        <table>
          <thead>
            <tr>
              <th>job</th>
              <th>owner</th>
              <th>runs</th>
              <th>retries</th>
              <th>last status</th>
              <th>last error</th>
              <th>first</th>
              <th>last</th>
              <th>flag</th>
            </tr>
          </thead>
          <tbody>
            {night.rows.map((r) => {
              const f = flags(r);
              return (
                <tr class={f.length > 0 ? 'warn' : undefined}>
                  <td>{r.job}</td>
                  <td>{dash(r.owner)}</td>
                  <td>{r.runs}</td>
                  <td>{r.retries}</td>
                  <td>{r.lastStatus}</td>
                  <td>{dash(r.lastError)}</td>
                  <td>{r.firstAt}</td>
                  <td>{r.lastAt}</td>
                  <td>{f.length > 0 ? f.join(', ') : '—'}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      )}
    </>
  );
}

export function NoNight({ night }: { night: string }) {
  return (
    <>
      <h1>digest · {night}</h1>
      <p class="warn">no run log for this night</p>
    </>
  );
}
