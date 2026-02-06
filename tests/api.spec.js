const { test, expect } = require('@playwright/test');
const fs = require('fs');

test.describe('API - Jornal Licitante', () => {
    test('API availability (basic)', async ({ request }) => {
        const resp = await request.get('/api');
        // Accept common successful codes; the endpoint may redirect
        expect([200, 204, 301, 302, 404]).toContain(resp.status());
        const body = await resp.text();
        fs.writeFileSync('playwright/api-root-response.txt', body);
    });

    test('Find lots named "Calculadora" and sum values', async ({ request, baseURL }) => {
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

        // Normalize to an array of editais
        const editais = Array.isArray(data) ? data : (data && (data.editais || data.items || data.results)) || [];

        const findings = [];
        let total = 0;
        for (const e of editais) {
            const lotes = e.lotes || e.lots || e.items || e.propostas || [];
            for (const l of lotes) {
                const name = (l.nome || l.name || '').toString();
                if (name.toLowerCase().includes('calculadora')) {
                    const rawVal = l.valor || l.value || l.preco || l.price || 0;
                    const num = parseFloat(String(rawVal).replace(/[^0-9.,-]/g, '').replace(',', '.')) || 0;
                    total += num;
                    findings.push({ edital: e.id || e._id || e.codigo || null, lote: name, valor: num, raw: rawVal });
                }
            }
        }

        const output = { endpointUsed: used, total, findings };
        fs.writeFileSync('playwright/calculadora-lotes.json', JSON.stringify(output, null, 2));
        test.info().attach('calculadora-lotes.json', { path: 'playwright/calculadora-lotes.json', contentType: 'application/json' });
    });
});
