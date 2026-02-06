const { test, expect } = require('@playwright/test');
const { writeJson } = require('./helpers/output');
const EditalPage = require('./pages/EditalPage');

function parseDateString(s) {
    if (!s) return null;
    s = String(s).trim();
    // Try dd/mm/yyyy
    const dmy = s.match(/(\b\d{1,2}\/\d{1,2}\/\d{4}\b)/);
    if (dmy) {
        const [d, m, y] = dmy[1].split('/').map(Number);
        return new Date(y, m - 1, d);
    }
    // Try ISO
    const iso = s.match(/(\d{4}-\d{2}-\d{2})/);
    if (iso) return new Date(iso[1]);
    // Try plaintext numbers (year-only) -> ignore
    return null;
}

function startOfDay(d) {
    const x = new Date(d);
    x.setHours(0, 0, 0, 0);
    return x;
}

test.describe('Editais Ativos - validade', () => {
    test('API: encontra editais com data limite no futuro', async ({ request }) => {
        const candidates = ['/api/editais', '/api/edital', '/api/publicacoes', '/api/licitacoes', '/api'];
        let data = null;
        let used = null;
        for (const ep of candidates) {
            const r = await request.get(ep);
            if (r.ok()) {
                used = ep;
                try { data = await r.json(); } catch { try { data = await r.text(); } catch { data = null; } }
                break;
            }
        }
        expect(data).not.toBeNull();

        const editais = Array.isArray(data) ? data : (data && (data.editais || data.items || data.results)) || [];
        const today = startOfDay(new Date());
        const active = [];
        for (const e of editais) {
            const possible = e.dataLimite || e.data_limite || e.data || e.datafim || e.dataFim || e.dt_limite || e.deadline || e.prazo || null;
            const parsed = parseDateString(possible);
            if (parsed && startOfDay(parsed) >= today) active.push({ id: e.id || e._id || e.codigo || null, date: parsed, raw: possible });
        }

        writeJson('playwright/active-editais-api.json', { endpoint: used, found: active.length, active });
        expect(active.length).toBeGreaterThan(0);
    });

    test('UI: abre um edital e valida que a data limite está no futuro', async ({ page }) => {
        const edital = new EditalPage(page);
        await edital.goto('/');
        const opened = await edital.openFirstEdital();
        await page.waitForTimeout(800);

        // collect all visible date-like strings on the page and look for at least one future date
        const content = await page.content();
        const dateRegex = /(\d{1,2}\/\d{1,2}\/\d{4})/g;
        const matches = Array.from(new Set(Array.from(content.matchAll(dateRegex), m => m[1])));
        const today = startOfDay(new Date());
        const future = [];
        for (const d of matches) {
            const p = parseDateString(d);
            if (p && startOfDay(p) >= today) future.push({ raw: d, parsed: p.toISOString() });
        }

        writeJson('playwright/active-editais-ui.json', { opened, matches, future });
        expect(future.length).toBeGreaterThan(0);
    });
});
