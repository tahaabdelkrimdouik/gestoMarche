# Ferhat's replenishment fixes

## Behaviour

- Clicking **À racheter** changes the stock status immediately. The quantity popup is removed.
- Saved quantities and units are retained. Optional inline fields on low/depleted stock cards let the user change them without opening a dialog. **Enregistrer** appears only after a change; invalid values cannot be saved.
- Quantity changes preserve the current stock status. As before, the market selector determines whether an explicit stock/quantity action applies to one market or all associated markets.
- In **Catalogue → modifier/ajouter un produit**, **Fournisseur habituel** remains the primary supplier. Check optional suppliers under **Autres fournisseurs**; uncheck to remove. The primary supplier is excluded, and selecting a new primary removes it from the alternatives.
- The usual supplier's replenishment panel includes products marked `low` or `out` in any market, once per product. A reminder beneath each product lists its alternative suppliers, says **Vérifier la disponibilité**, and exposes existing phone/email contacts when present.
- Alternative contact links do not change the primary supplier or stock. They do not prepare a purchase order. Existing purchasing emails/PDFs remain addressed to the panel's usual supplier and use the displayed product list.
- Products without alternatives work normally. Existing duplicate catalogue records retain separate IDs, prices, market assignments and stock; nothing is inferred from their names or merged.

## Database rollout

Review and apply `supabase/migrations/20261113203129_add_product_alternative_suppliers.sql` **before deploying the frontend**. It assumes the existing products, suppliers, markets and product_markets tables and the earlier quantity/unit migrations are installed.

The migration adds a junction table with a composite primary key, indexed foreign keys and cascading cleanup of alternative links when a product or supplier is deleted. Supplier deletion also refreshes the product cache so removed links do not remain in an edit form. It does not populate alternatives, merge products, change prices, or rewrite existing stock.

RLS checks parent visibility for reads and existing product UPDATE permissions/policies for association writes. All functions run as the caller (`SECURITY INVOKER`); no service key, ownership assumption or authentication model is introduced. Review the intended environment's existing parent policies as part of normal migration review.

`save_product_details` saves scalar product details and alternatives atomically. New products receive available stock rows for the visible markets, as in the existing creation workflow. Editing never writes to `product_markets`, preserving row metadata, market assignments (including none), statuses, quantities and units even when stock changes while the form is open. Omitted alternative IDs preserve existing links; an empty array explicitly removes them. Database constraints/triggers reject primary-as-alternative and duplicate associations, including through older/direct API clients.

Old application clients remain compatible with the additive schema. New reads tolerate the alternative table not yet existing, but new product saves fail safely with a French migration message if the RPC is missing. Do not deploy the new frontend before the migration. Rolling back the frontend does not require dropping the new table or its saved links.

**The initial implementation was prepared without production writes.** The subsequent authorized production release applies the additive schema; existing product and stock records are retained. The catalogue inspection found 225 products, one “Abricots moelleux” record, and three other duplicate-name groups. No automatic associations were created from that inspection.

## Verification

- `npm test`: regression tests for low/out filtering, quantity/unit selection and validation, alternative normalization, legacy products, query joins, error handling and atomic RPC payloads.
- `npx tsc --noEmit`: TypeScript check.
- `npm run build`: local production build.
- `npm run lint`: repository-wide ESLint check passes with six existing warnings.
- `tests/feedback-migration.sql`: executed against disposable local PostgreSQL. It tests create/edit/remove, atomic rollback on invalid links, primary/duplicate rejection, existing duplicate-product separation, empty market assignments, unchanged stock rows/metadata/quantities/units, parent RLS, direct API permissions and supplier deletion cleanup. The fixture runs inside a rolled-back transaction and refuses any database not named `gestomarche_feedback_test`.

Example for an **empty disposable local** test database, using the local PostgreSQL superuser (not a production connection):

```powershell
psql -h 127.0.0.1 -p <local-test-port> -U <local-test-user> -d gestomarche_feedback_test -v ON_ERROR_STOP=1 -f tests/feedback-migration.sql
```

Browser verification passed at **1280×900, 390×844 and 320×568**, using a local production server and intercepted fixture API requests. No browser-test writes reached Supabase. Coverage included desktop/mobile stock actions, inline quantities, failed saves, alternative editing, replenishment reminders, primary-supplier emails/PDFs and horizontal overflow. PDF verification exercised the download fallback; the operating system's native sharing UI was not tested.

The migration must precede the frontend release. Production checks should verify the new table, RPC and live screens, and confirm that existing product/stock checksums are unchanged. Supplier availability is intentionally unknown; reminders and contact links require users to check it.

## File map

- `app/catalogue/page.tsx`: atomic product creation/editing; removes market deletion/recreation during edits.
- `app/stock/page.tsx`: direct status changes and independent quantity/unit writes with failure checks.
- `app/suppliers/page.tsx`: consistent low/out alert counts, supplier data for alternatives, desktop access to the existing panel.
- `components/ProductFormDialog.tsx`, `components/CatalogueScreen.tsx`: alternatives configuration; form stays open with its selections after a failed save.
- `components/ProductCard.tsx`, `components/ReorderQuantityFields.tsx`: direct status buttons and optional inline quantity/unit fields.
- `components/ReorderQuantityDialog.tsx`: removed.
- `components/SupplierDrawer.tsx`, `components/AlternativeSupplierReminder.tsx`: replenishment filtering and alternative contact reminders. Separate layout edits already present in the workspace were preserved.
- `components/PdfGenerator.tsx`: shared replenishment status and consistent French labels.
- `lib/types.ts`, `lib/queries.ts`, `lib/suppliers.ts`, `lib/reorder.ts`: types, relationship reads, atomic save and shared replenishment helpers.
- `supabase/migrations/20261113203129_add_product_alternative_suppliers.sql`: additive database migration.
- `tests/feedback.test.mjs`, `tests/feedback-migration.sql`, `package.json`: regression tests and test command; no new runtime dependencies.
