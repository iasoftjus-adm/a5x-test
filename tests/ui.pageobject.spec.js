const { test, expect } = require('@playwright/test');
const { writeJson } = require('./helpers/output');
const EditalPage = require('./pages/EditalPage');

test.describe('UI (pageobject) - Jornal Licitante', () => {
    test('Collect edital lots named Calculadora and report links', async ({ page }) => {
        const edital = new EditalPage(page);
        await edital.goto('/');
        await edital.openFirstEdital();
        await page.waitForTimeout(1000);

        const lotTexts = await edital.collectLotTexts();
        const reports = await edital.collectReports();

        const output = { lotsFound: lotTexts, reports };
        writeJson('playwright/ui-edital-data.json', output);
        expect(output).toBeDefined();
    });
});
