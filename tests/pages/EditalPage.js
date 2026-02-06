const DEFAULT_SELECTORS = {
    candidates: ['article', '.card', '.edital', '[data-testid="edital"]', 'div:has-text("Edital")'],
    detailsLink: 'a:has-text("Detalhes"), a:has-text("Ver edital")',
    calculadoraText: 'text=Calculadora',
    reportLinks: 'a:has-text("Relatório"), a:has-text("relatorios"), a:has-text("relatórios"), .reports a',
};

class EditalPage {
    constructor(page, selectors = {}) {
        this.page = page;
        this.sel = Object.assign({}, DEFAULT_SELECTORS, selectors);
    }

    async goto(path = '/') {
        await this.page.goto(path);
        await this.page.waitForTimeout(1500);
    }

    async openFirstEdital() {
        let opened = false;
        for (const s of this.sel.candidates) {
            const locator = this.page.locator(s).first();
            if (await locator.count() > 0) {
                await locator.scrollIntoViewIfNeeded();
                await locator.click({ timeout: 2000 }).catch(() => { });
                opened = true;
                break;
            }
        }

        if (!opened) {
            const link = this.page.locator(this.sel.detailsLink).first();
            if (await link.count() > 0) {
                await link.click().catch(() => { });
                opened = true;
            }
        }

        return opened;
    }

    async collectLotTexts() {
        return await this.page.locator(this.sel.calculadoraText).allTextContents();
    }

    async collectReports() {
        const reportLocators = this.page.locator(this.sel.reportLinks);
        const reports = [];
        for (let i = 0; i < await reportLocators.count(); i++) {
            const handle = reportLocators.nth(i);
            const href = await handle.getAttribute('href');
            const text = await handle.innerText().catch(() => '');
            reports.push({ text, href });
        }
        return reports;
    }
}

module.exports = EditalPage;
