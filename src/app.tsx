import { Hono } from 'hono';
import { loadConfig, type RigConfig } from './config.js';
import { readNight } from './digest/read.js';
import { lane } from './lane.js';
import { readStatus } from './status.js';
import { DigestPage, NoNight } from './views/digest.js';
import { Layout } from './views/layout.js';
import { StatusBoard } from './views/status.js';

export function createApp(config: RigConfig = loadConfig()) {
  const app = new Hono();

  app.get('/health', (c) => c.json({ ok: true, lane: lane().id }));

  app.get('/', (c) => {
    const status = readStatus(config);
    const nights = status.nights.map((night) => ({ night, counts: readNight(config.runsDir, night)?.counts ?? null }));
    return c.html(
      <Layout title="status" lane={lane()}>
        <StatusBoard status={status} nights={nights} />
      </Layout>,
    );
  });

  // The page and the JSON read the same Night, so they can't disagree (ADR 0001).
  app.get('/digest/:night', (c) => {
    const name = c.req.param('night');
    const night = readNight(config.runsDir, name);
    if (!night) {
      return c.html(
        <Layout title={`digest · ${name}`} lane={lane()}>
          <NoNight night={name} />
        </Layout>,
        404,
      );
    }
    return c.html(
      <Layout title={`digest · ${night.night}`} lane={lane()}>
        <DigestPage night={night} />
      </Layout>,
    );
  });

  app.get('/api/digest/:night', (c) => {
    const name = c.req.param('night');
    const night = readNight(config.runsDir, name);
    if (!night) return c.json({ error: 'no run log for this night', night: name }, 404);
    return c.json(night);
  });

  return app;
}
