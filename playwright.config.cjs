const { defineConfig } = require('@playwright/test');

module.exports = defineConfig({
    testDir: './tests',
    timeout: 120_000,
    workers: 1,
    reporter: 'list',
    use: {
        channel: process.env.PLAYWRIGHT_CHANNEL || 'chrome',
        headless: true,
        launchOptions: {
            args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader'],
        },
    },
    webServer: {
        command: 'node node_modules/http-server/bin/http-server . -a 127.0.0.1 -p 4173 -c-1',
        url: 'http://127.0.0.1:4173',
        reuseExistingServer: false,
    },
});
