# Project Structure Examples — Before/After

This directory demonstrates the difference between shallow/bad organization and deep/good organization. Focus on the structural difference, not the code content.

---

## TypeScript Example

### Before — Shallow, Technical Layering

```
ecommerce-app/
├── src/
│   ├── services/
│   │   ├── orderService.ts
│   │   ├── inventoryService.ts
│   │   ├── pricingService.ts
│   │   └── monitoringService.ts
│   ├── handlers/
│   │   ├── checkoutHandler.ts
│   │   ├── inventoryHandler.ts
│   │   └── monitoringHandler.ts
│   ├── utils/
│   │   ├── taxCalculator.ts
│   │   ├── discountCalculator.ts
│   │   ├── priceFormatter.ts
│   │   ├── addressParser.ts
│   │   └── currencyParser.ts
│   ├── types/
│   │   ├── orders.ts
│   │   ├── inventory.ts
│   │   ├── pricing.ts
│   │   └── monitoring.ts
│   ├── config/
│   │   ├── app.config.ts
│   │   └── stores.config.ts
│   └── index.ts
├── tests/
│   ├── unit/
│   │   ├── orders.test.ts
│   │   └── inventory.test.ts
│   └── integration/
│       └── e2e.test.ts
├── package.json
└── tsconfig.json
```

**Problems**:

- Related code scattered across `services/`, `handlers/`, `utils/`, `types/`
- Can't find all order processing logic in one place
- File paths don't indicate domain
- 19 files spread across five technical-layer directories in `src/`

---

### After — Deep, Grouped by Domain

```
ecommerce-app/
├── src/
│   ├── orders/
│   │   ├── index.ts                 # Public facade (3-5 exports)
│   │   ├── checkout.ts
│   │   ├── fulfillment.ts
│   │   ├── types.ts
│   │   └── utils/
│   │       ├── tax.ts
│   │       └── discounts.ts
│   ├── inventory/
│   │   ├── index.ts
│   │   ├── warehouse.ts
│   │   ├── supplier.ts
│   │   └── types.ts
│   ├── pricing/
│   │   ├── index.ts
│   │   └── fetcher.ts
│   ├── monitoring/
│   │   ├── index.ts
│   │   └── alerts.ts
│   ├── config/
│   │   ├── app.ts
│   │   └── stores.ts
│   └── index.ts
├── tests/
│   ├── unit/                       # Contract per module (Pattern 0.5)
│   │   ├── orders.test.ts
│   │   ├── inventory.test.ts
│   │   └── pricing.test.ts
│   └── stack/                      # Full-stack tests (Pattern 1.1)
│       ├── orders.test.ts
│       └── inventory.test.ts
├── AGENTS.md                        # Agent contract (CLAUDE.md imports it)
├── README.md                        # Overview
├── package.json
└── tsconfig.json
```

**Improvements**:

- Each domain self-contained
- Deep modules: simple `index.ts` facades hide implementation
- Progressive disclosure: domain → module → implementation
- File paths signal domain: `orders/utils/tax.ts`

---

## Python Example

### Before — Shallow, Flat Structure

```
ecommerce_bot/
├── bot.py
├── orders.py
├── inventory.py
├── pricing.py
├── monitoring.py
├── tax_estimator.py
├── discount.py
├── price_fetcher.py
├── alert_sender.py
├── order_processor.py
├── inventory_sync.py
├── store_config.py
├── utils.py
├── constants.py
├── models.py
├── serializers.py
├── validators.py
├── tests/
│   ├── test_orders.py
│   ├── test_inventory.py
│   ├── test_pricing.py
│   └── test_utils.py
├── requirements.txt
└── setup.py
```

**Problems**:

- 17 modules at the root, with no structure
- No indication of which files belong together
- `utils.py` and `constants.py` become dumping grounds
- Can't navigate without reading everything

---

### After — Deep, Domain-Based Structure

```
ecommerce_bot/
├── src/
│   ├── orders/
│   │   ├── __init__.py             # Public facade
│   │   ├── processor.py
│   │   ├── fulfillment.py
│   │   ├── models.py
│   │   ├── validators.py           # Order validation stays in the orders domain
│   │   └── utils/
│   │       ├── tax.py
│   │       └── discounts.py
│   ├── inventory/
│   │   ├── __init__.py
│   │   ├── sync.py
│   │   ├── warehouse.py
│   │   └── models.py
│   ├── pricing/
│   │   ├── __init__.py
│   │   └── fetcher.py
│   ├── monitoring/
│   │   ├── __init__.py
│   │   └── alerts.py
│   ├── config/
│   │   ├── __init__.py
│   │   ├── constants.py            # Constants live with the config they belong to
│   │   └── stores.py
│   └── bot.py
├── tests/
│   ├── unit/                       # Contract per module (Pattern 0.5)
│   │   ├── test_orders.py
│   │   ├── test_inventory.py
│   │   └── test_pricing.py
│   └── stack/                      # Full-stack tests (Pattern 1.1)
│       ├── test_orders.py
│       └── test_inventory.py
├── AGENTS.md                        # Agent contract (CLAUDE.md imports it)
├── README.md                        # Overview
├── requirements.txt
└── setup.py
```

**Improvements**:

- Clear domain boundaries
- `__init__.py` exports controlled public interface
- Related code co-located
- Start at the domain directory, then open the module you need
- No `shared/` or `utils.py` at the top level: code used by one domain lives in that domain

---

## Key Differences Summary

| Aspect | Before | After |
|--------|--------|-------|
| **Grouping** | Technical layer (`services/`, `utils/`) | Domain/capability (`orders/`, `inventory/`) |
| **Exports** | Many functions, leaking internals | 3-5 exports per module |
| **Discovery** | Flat or scattered | Progressive disclosure |
| **Navigation** | File paths meaningless | File paths signal domain |
| **Testing** | Unit tests beside a few unscoped integration tests | Unit tests as each module's contract, stack tests at domain boundaries |

---

## See Also

- [L0 Foundation](../../docs/L0-foundation.md) — Deep modules, progressive disclosure, grouping by domain
- [L1 Closed Loop Design](../../docs/L1-feedback-loops.md) — Stack tests at module boundaries
- [L2 Behavioral Guardrails](../../docs/L2-behavioral-guardrails.md) — Skills that carry structural conventions
