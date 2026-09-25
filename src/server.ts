import { createApp } from './app';

const { app, config } = createApp();

app.listen(config.port, () => {
  console.log(`Job Discovery Service listening on port ${config.port}`);
});
