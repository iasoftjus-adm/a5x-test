const { defineConfig } = require('@playwright/test');

module.exports = defineConfig({
    testDir: './tests',
    timeout: 30 * 1000,
    retries: 0,
    use: {
        baseURL: 'https://jornallicitante.vercel.app',
        headless: true,
        actionTimeout: 10 * 1000,
        trace: 'off'
    }
});
