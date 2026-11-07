import { createApp } from './app';
import { logger } from './utils/logger';

const { app, config } = createApp();

app.listen(config.port, () => {
  logger.info(`Job Discovery Service listening on port ${config.port}`);
});
