// Tests de bout en bout : Playwright démarre le serveur sur une base temporaire.
import { defineConfig } from '@playwright/test';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const PORT = 3210;
// E2E_URL=https://mon-site.onrender.com npm run test:e2e  → teste un site déjà en ligne.
const URL_EXTERNE = process.env.E2E_URL;

export default defineConfig({
  testDir: 'tests/e2e',
  timeout: 180_000,
  use: {
    baseURL: URL_EXTERNE ?? `http://localhost:${PORT}`,
    trace: 'retain-on-failure',
    // Facultatif : chemin d'un Chromium déjà installé (sinon : npx playwright install chromium).
    launchOptions: process.env.CHROMIUM_PATH ? { executablePath: process.env.CHROMIUM_PATH } : {},
  },
  webServer: URL_EXTERNE
    ? undefined
    : {
        command: 'node server/index.js',
        url: `http://localhost:${PORT}/api/stats/classement`,
        reuseExistingServer: false,
        env: {
          PORT: String(PORT),
          JWT_SECRET: 'secret-e2e',
          SQLITE_FILE: join(tmpdir(), `chroma-e2e-${Date.now()}.db`),
        },
      },
});
