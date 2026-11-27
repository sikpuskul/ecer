import { createApp } from './app';
import type { WorkerEnv } from './env';
import { processDueGenerationJobsBatch } from './modules/documents/service';
import { processDueEmailJobsBatch } from './modules/email/service';

const app = createApp();

export default {
  fetch: app.fetch,
  async scheduled(_controller: ScheduledController, env: WorkerEnv, ctx: ExecutionContext) {
    ctx.waitUntil(
      Promise.all([processDueGenerationJobsBatch(env, 2), processDueEmailJobsBatch(env, 3)]),
    );
  },
};
