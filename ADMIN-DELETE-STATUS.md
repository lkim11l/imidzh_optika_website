# Admin deletion — 2026-10-22

Requested by the owner for both products/photos and customer bookings.

Implementation is prepared and tested locally; NOT deployed or applied to the live database.
TatNet's Open Studio action opens an inaccessible HTTPS endpoint. Browser policy prevents observing the resulting browser error page. No bypass was attempted. Restore Studio access before applying the migration.

## Activation

1. Open the existing `imidzh-optika-pilot` TatNet database (ID `75618fbb-d598-4f9e-bd86-da976b96ba0a`).
2. Review and apply `supabase/migrations/005_admin_delete.sql` once in its SQL editor. It installs functions/policies and an empty file-cleanup queue; it does not delete existing records.
3. Deploy the prepared application changes to the existing Timeweb production branch `migration/tatnet-full-20261014`. Never push main. Stage only the files associated with this change; this checkout also contains unrelated generated output.
4. Reload `/cookie`, sign in, and verify the product and booking buttons. Actual permanent deletion of a real record needs an explicitly selected target and human confirmation; no real product or customer record was deleted during testing.

## Behavior and limits

- Each deletion requires an explicit modal checkbox and final confirmation.
- SQL rechecks administrator membership and the last known record revision/status.
- Product deletion queues only photos hosted by this exact TatNet instance. Shared references in ALL products (including drafts) and editorial content protect files.
- Physical files are removed through Storage API, never by SQL metadata deletion. Failed cleanup can be retried through a persistent, private queue. It does not sweep unrelated orphaned files or delete bundled `/assets/` images.
- Booking deletion removes the working row and its email-queue entry. Active email delivery blocks deletion until its lease expires. Already delivered mail, legacy databases, logs and backups are outside this operation.
- No automatic age-based purge is enabled; the retention policy still needs owner input.
- Deleting database rows makes space reusable; provider quota reporting, PostgreSQL WAL and backups may not shrink immediately.

## Validation

- All 29 repository tests pass, including the new client deletion and proxy security tests.
- Isolated PostgreSQL (PGlite) test applies migrations 001–005 and verifies admin-only access, anonymous denial, stale revision/status protection, shared/draft/editorial photos, foreign URL exclusion, storage RLS, email-in-flight blocking and queue cascade.
- Browser test on localhost:4190 verified cancellation, disabled confirmation until checked, product deletion with Storage API cleanup, and booking deletion using fictional records only.
- Local proof images are in `../tmp/delete-product-confirmation.png` and `../tmp/delete-booking-button.png`.
