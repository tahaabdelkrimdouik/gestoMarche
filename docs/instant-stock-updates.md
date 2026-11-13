# Instant stock status updates

Stock buttons now update the shared React Query product cache synchronously. Badges, filters, market summaries, quantities and product counts use that same data. Buttons remain enabled, and no stock-status spinner, loading toast or success toast is shown. Initial loading skeletons remain.

`lib/stockStatus.ts` maintains one write queue per product. Only one status request for a product can be in flight, while different products save independently. During a request, additional clicks replace the pending intent **per market**, so a burst normally sends the first request and the final selection. This also handles switching between “Tous les marchés” and individual markets while saving.

Successful responses advance the confirmed status without replacing newer optimistic choices. Failed writes restore only the affected markets to their last acknowledged status and show a short French error. Failures of requests already superseded by newer choices do not undo those choices or display obsolete errors. Partial responses preserve the rows actually acknowledged by Supabase and restore refused rows.

The queue belongs to the QueryClient and survives client-side navigation. Older product reads are cancelled, and a refresh completing while writes are pending is reconciled with pending selections. Routine focus/reconnect freshness is retained. Status changes do not invalidate or refetch the entire catalogue.

Quantity and unit saves remain optional and inline. They patch only those fields in the cache, preserving any pending status. Their mutation is marked silent so it does not activate the global operation overlay. Other application mutations retain their existing feedback. Product cards are memoized, and unchanged products/markets keep their object references so changing one product does not render every card again.

The cache update/cancellation approach follows the [TanStack Query optimistic-update guidance](https://tanstack.com/query/latest/docs/framework/react/guides/optimistic-updates); the per-product coalescing queue adds ordering for consecutive clicks.

## Verification

```powershell
npm test
npx tsc --noEmit
npm run lint
npm run build
```

`tests/stock-status.test.mjs` uses a real QueryClient and controlled request promises to exercise immediate updates, rapid bursts, independent products, all/single-market overlap, HTTP/network-style failures, stale successes/failures, partial acknowledgements, late reads and concurrent quantity changes. It also checks reference preservation and no-op requests.

The optional browser suite uses 225 fixture products on desktop and mobile. All database requests are intercepted. Held responses verify that statuses/counts change before acknowledgement, buttons remain enabled, normal updates show none of the three reported indicators, quantity responses cannot overwrite statuses, no full-list refetch occurs, and queues survive navigation. HTTP failures and disconnected requests verify rollback and French errors. It refuses non-local application URLs.

Verified locally at 1280 px and 390 px: approximately 32–35 ms from the click event to the selected status rendering, zero normal-update product refetches, at most one status request in flight per product, and no browser runtime errors. All 28 automated tests, TypeScript, lint and the production build passed; repository-wide lint retains six existing warnings.

Start the app locally, make Playwright available, then run:

```powershell
$env:STOCK_TEST_BASE_URL = 'http://127.0.0.1:3014'
# If Playwright is outside this project's module path, set PLAYWRIGHT_MODULE
# to its installed package directory. Chrome is the default browser channel.
npm run test:stock-ui
```

No database migration is needed. This release changes client-side state management and uses the existing Supabase stock API without altering the schema.
