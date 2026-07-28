# Business Context

gramCarbon operates alongside two other distinct, unrelated projects/models. Do not conflate them when working on code or discussing business logic.

## gramCarbon
This repository. Full-stack feed distribution platform (Next.js 14, MongoDB, WhatsApp, Socket.IO).

## Nainarpalayam — D2F (Direct-to-Farmer)
CH4OW is supplied directly to farmers, with quantity based on their animal count. No intermediary business/distributor in the loop.

## Milky Mist — D2B (Direct-to-Business)
CH4OW is supplied to Milky Mist (the business), which mixes it with feed and supplies it to farmers — either directly, or via distributor societies who then sell it to farmers.

These three are separate projects with separate distribution models. Do not apply one model's logic or assumptions to another.

# Carbon Offset Formula

Default active formula (see `scripts/seed-offset-formula-version.ts` and `lib/offsetEngine.ts`): **0.68 tCO2e/cow/year**, i.e. **≈0.00186 tCO2e/cow/day** (0.68 / 365).

This is stored in `OffsetFormulaVersion` and can be overridden via the `carbon.offsetPerCowPerDay` Settings key.
