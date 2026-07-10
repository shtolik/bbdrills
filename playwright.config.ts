import { PlaywrightTestConfig } from '@playwright/test';

const config: PlaywrightTestConfig = {
  testDir: 'tests',
  testMatch: /.*playwright\.spec\.ts$/,
  timeout: 30_000,
  use: {
    headless: true,
    viewport: { width: 1280, height: 720 },
  },
  webServer: {
    // Use a Node-based static server so Playwright can start it without Python dependency
    command: 'npx http-server ./ -p 8000',
    port: 8000,
    reuseExistingServer: process.env.CI ? false : true,
    timeout: 120_000,
  },
};

export default config;
