# Jornal Licitante — Playwright Tests

Breve projeto Playwright com testes de UI e API para o desafio técnico.

Setup rápido

1. Instale dependências (requer Node.js >= 16):

```powershell
cd "c:\New folder\playwright"
npm install
npm run install:playwright
```

2. Executar testes:

```powershell
npm test
```

Decisões e notas
- Usei `@playwright/test` para testes de UI e API no mesmo projeto.
- Alguns endpoints e seletores da aplicação são assumidos de forma resiliente — se a API retornar dados em forma diferente, os testes tentam normalizar e gerar um relatório JSON em `playwright/`.
- Saídas geradas:
  - `playwright/api-root-response.txt` — corpo bruto da rota `/api` (quando disponível)
  - `playwright/calculadora-lotes.json` — resultados da busca por lotes "Calculadora" (endpoint detectado automaticamente)
  - `playwright/ui-edital-data.json` — dados coletados na UI (lotes e links de relatórios)

O que poderia ser melhorado
- Ajustar seletores da UI com acesso ao DOM real.
- Especificar endpoints concretos após inspeção do Swagger.
