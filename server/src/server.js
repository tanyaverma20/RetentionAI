import { app } from './app.js';
import { env } from './config/env.js';

app.listen(env.port, () => {
  console.log(`RetentionAI server listening on port ${env.port}`);
});
