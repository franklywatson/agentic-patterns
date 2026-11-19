# Project Structure Examples — Before/After

This directory demonstrates the difference between technical layering and grouping by domain. Focus on the structural difference, not the code content. For a team reorganizing by domain ([Pattern 0.2](../../docs/L0-foundation.md#pattern-02--progressive-disclosure)); documentation only, nothing to run.

---

## TypeScript Example

### Before — Shallow, Technical Layering

```text
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

```text
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

## Python Layout

A Python project takes the same shape: replace a flat root of 17 modules (`orders.py`, `utils.py`, `constants.py`) with one package per domain (`orders/`, `inventory/`), each with an `__init__.py` that exports the public interface, tests split into `tests/unit/` and `tests/stack/`, and no top-level `utils.py`.

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
- [L1 Closed Loop Design and Verification](../../docs/L1-feedback-loops.md) — Stack tests at domain boundaries
- [L2 Behavioral Guardrails](../../docs/L2-behavioral-guardrails.md) — Skills that carry structural conventions
