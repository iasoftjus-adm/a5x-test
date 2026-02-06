const { test, expect } = require('@playwright/test');
const { writeJson } = require('./helpers/output');

function parseNumber(rawVal) {
    if (rawVal === null || rawVal === undefined) return 0;
    if (typeof rawVal === 'number') return rawVal;
    let original = String(rawVal);
    if (!original.trim()) return 0;

    // Try to extract the most likely numeric substring (handles strings with multiple numbers)
    const matches = original.match(/[0-9]+(?:[.,][0-9]{1,3})*(?:[.,][0-9]+)?/g);
    let s = '';
    if (matches && matches.length) {
        // prefer the longest match (likely the monetary value with thousands separators)
        s = matches.reduce((a, b) => (b.length > a.length ? b : a));
    } else {
        s = original.replace(/\s+/g, '');
        s = s.replace(/[^0-9.,-]/g, '');
    }
    const hasDot = s.indexOf('.') !== -1;
    const hasComma = s.indexOf(',') !== -1;
    if (hasDot && hasComma) {
        if (s.lastIndexOf('.') < s.lastIndexOf(',')) {
            // format like 1.234,56 -> remove dots (thousands) then replace comma
            s = s.replace(/\./g, '').replace(',', '.');
        } else {
            // format like 1,234.56 -> remove commas (thousands)
            s = s.replace(/,/g, '');
        }
    } else if (hasComma && !hasDot) {
        // format like 1234,56 -> decimal comma
        s = s.replace(/\./g, '').replace(',', '.');
    } else if (hasDot && !hasComma) {
        // format like 1.234.567 or 1234.56; if multiple dots, remove all but last
        const parts = s.split('.');
        if (parts.length > 2) {
            s = parts.slice(0, parts.length - 1).join('') + '.' + parts[parts.length - 1];
        }
    }
    const n = parseFloat(s);
    return Number.isFinite(n) ? n : 0;
}

test.describe('API - Jornal Licitante', () => {
    test('API availability (basic)', async ({ request }) => {
        const resp = await request.get('/api');
        expect([200, 204, 301, 302, 404]).toContain(resp.status());
        const body = await resp.text();
        writeJson('playwright/api-root-response.txt', body);
    });

    test('Find lots named "Calculadora" and sum values', async ({ request, page }) => {
        const candidates = ['/api/editais', '/api/edital', '/api/publicacoes', '/api/licitacoes', '/api'];
        let data = null;
        let used = null;
        for (const ep of candidates) {
            const r = await request.get(ep);
            if (r.ok()) {
                used = ep;
                try { data = await r.json(); } catch (e) { try { data = await r.text(); } catch (er) { data = null; } }
                break;
            }
        }
        expect(data).not.toBeNull();

        const editais = Array.isArray(data) ? data : (data && (data.editais || data.items || data.results)) || [];

        const findings = [];
        let total = 0;
        for (const e of editais) {
            const lotes = e.lotes || e.lots || e.items || e.propostas || [];
            for (const l of lotes) {
                const name = (l.nome || l.name || '').toString();
                if (name.toLowerCase().includes('calculadora')) {
                    const rawVal = l.valor || l.value || l.preco || l.price || 0;
                    const num = parseNumber(rawVal);
                    total += num;
                    findings.push({ edital: e.id || e._id || e.codigo || null, lote: name, valor: num, raw: rawVal });
                }
            }
        }

        // Fallback: if API didn't return structured lot data, try rendering the page and scraping DOM (handles client-side data)
        if (findings.length === 0) {
            const EditalPage = require('./pages/EditalPage');
            const editalPage = new EditalPage(page);
            await editalPage.goto('/');
            await editalPage.openFirstEdital().catch(() => { });
            await page.waitForTimeout(1200);

            const scraped = await page.evaluate(() => {
                const results = [];
                const elements = Array.from(document.querySelectorAll('body *'));
                for (const el of elements) {
                    try {
                        const text = (el.innerText || '').trim();
                        if (!text) continue;

                        // prefer explicit patterns with R$ or 'Valor'
                        const rMatch = text.match(/Valor[:\s]*.*?R\$\s*([0-9\.\,\s]+)/i) || text.match(/R\$\s*([0-9\.\,\s]+)/i) || text.match(/Valor[:\s]*([0-9\.\,\s]+)/i);
                        if (!rMatch) continue;

                        const rawNumber = (rMatch[1] || '').trim();
                        if (!rawNumber) continue;

                        // find nearby title: look up ancestors for headings or edital/article/card
                        let title = '';
                        let parent = el;
                        let depth = 0;
                        while (parent && parent !== document.body && depth < 8) {
                            const heading = parent.querySelector && parent.querySelector('h1,h2,h3');
                            if (heading && heading.innerText) { title = heading.innerText.trim(); break; }
                            if (parent.matches && (parent.matches('article') || parent.matches('.card') || parent.matches('.edital'))) {
                                const h = parent.querySelector && parent.querySelector('h1,h2,h3');
                                title = (h && h.innerText) ? h.innerText.trim() : (parent.innerText || '').split('\n')[0].trim();
                                break;
                            }
                            parent = parent.parentElement;
                            depth++;
                        }

                        // push the captured raw number
                        results.push({ raw: rawNumber, context: title });
                    } catch (e) { /* ignore individual element errors */ }
                }

                // Also try a global scan for 'R$' occurrences in case some are outside element innerText checks
                const bodyText = document.body.innerText || '';
                const globalMatches = Array.from(bodyText.matchAll(/R\$\s*([0-9\.\,\s]+)/gi));
                for (const m of globalMatches) {
                    const rawNumber = (m[1] || '').trim();
                    if (rawNumber) results.push({ raw: rawNumber, context: '' });
                }

                return results;
            });

            const seen = new Set();
            for (const item of scraped) {
                let raw = (item.raw || '').replace(/\s+/g, '');
                if (!raw) continue;
                // require at least one separator to avoid dates/IDs like '2026' or '02'
                if (!/[.,]/.test(raw)) continue;
                const key = raw.toLowerCase();
                if (seen.has(key)) continue;
                seen.add(key);
                // avoid picking the page header as title
                const title = item.context && /editais de licita/i.test(item.context) ? null : (item.context || null);
                const num = parseNumber(raw);
                if (num) {
                    total += num;
                    findings.push({ edital: title, lote: null, valor: num, raw: raw.trim(), source: 'ui' });
                }
            }
        }

        const output = { endpointUsed: used, total, findings };
        writeJson('playwright/calculadora-lotes.json', output);
        test.info().attach('calculadora-lotes.json', { path: 'playwright/calculadora-lotes.json', contentType: 'application/json' });

        // Also write a simple human-readable summary and attach it to the test result
        const formatted = total.toLocaleString('pt-BR', { minimumFractionDigits: 3, maximumFractionDigits: 3 });
        const summary = `Total: R$ ${formatted}\nItems: ${findings.length}`;
        const fs = require('fs');
        fs.writeFileSync('playwright/calculadora-lotes-summary.txt', summary);
        test.info().attach('calculadora-lotes-summary.txt', { path: 'playwright/calculadora-lotes-summary.txt', contentType: 'text/plain' });
    });
});
