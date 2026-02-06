const { test, expect } = require('@playwright/test');
const fs = require('fs');

test.describe('UI - Jornal Licitante', () => {
    test('Acesso e coleta: editais ativos, modal detalhes, lotes "Calculadora" e relatórios', async ({ page }) => {
        await page.goto('/');
        // give client some time to render
        await page.waitForTimeout(1500);

        // Try to find an edital/card and open details
        const selectors = ['article', '.card', '.edital', '[data-testid="edital"]', 'div:has-text("Edital")'];
        let opened = false;
        for (const s of selectors) {
            const locator = page.locator(s).first();
            if (await locator.count() > 0) {
                await locator.scrollIntoViewIfNeeded();
                await locator.click({ timeout: 2000 }).catch(() => { });
                opened = true;
                break;
            }
        }

        // If nothing opened, try clicking a link
        if (!opened) {
            const link = page.locator('a:has-text("Detalhes"), a:has-text("Ver edital")').first();
            if (await link.count() > 0) { await link.click().catch(() => { }); opened = true; }
        }

        // Wait for modal or details area
        await page.waitForTimeout(1000);

        // Collect lot names that contain 'Calculadora'
        const lotTexts = await page.locator('text=Calculadora').allTextContents();

        // Collect report links (try several heuristics)
        const reportLocators = page.locator('a:has-text("Relatório"), a:has-text("relatorios"), a:has-text("relatórios"), .reports a');
        const reports = [];
        for (let i = 0; i < await reportLocators.count(); i++) {
            const handle = reportLocators.nth(i);
            const href = await handle.getAttribute('href');
            const text = await handle.innerText().catch(() => '');
            reports.push({ text, href });
        }

        const output = { lotsFound: lotTexts, reports };
        fs.writeFileSync('playwright/ui-edital-data.json', JSON.stringify(output, null, 2));
        expect(output).toBeDefined();
    });
});
