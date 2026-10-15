# TatNet migration status — 2026-10-14

Base: 8077b54, preserving the restored public About page, background glow, paused forms and removed administrative bookings/email/about tabs.

## Prepared and checked

- Standalone Timeweb server, same-origin limited backend proxy and backend readiness endpoint.
- Build configuration keeps bookings disabled; proxy does not forward booking submissions, bookings or email administration.
- 19 tests passed; 94 pages built against the current source backend. Target data is not yet available for a full target build.
- Private application data export and all 118 storage files saved outside this checkout under `../tmp/migration-backup-20261014/`. Do not commit these files. Includes authentication records and private bookings.
- Media bytes verified against source object metadata; SHA-256 hashes recorded. 100704680 bytes total.
- Transactional data import prepared privately. Not executed. Preserve existing IDs/slugs and rewrite storage origin. Keep email delivery disabled, do not recreate cron jobs.

## Outstanding

- Studio access in Codex still failed with ERR_SSL_PROTOCOL_ERROR; subsequent browser retry was rejected by automatic approval review. No bypass attempted.
- Back up existing target pilot before any import; compare actual target constraints, triggers, policies and Auth schema to source.
- Import application data and files; migrate existing Auth user/identity and administrator mapping after compatibility review and required confirmation. Never log credentials or hashes.
- Verify exact row/file counts and content checksums, public visibility and denied unauthorized changes. Confirm all migrated media references resolve.
- Timeweb app 269739 remains on ee7cb05; later deployment failed after successful build at image pull. Resolve and verify startup before promotion.
- Run full target URL/SEO/admin/media tests and verify HTTPS/access from both networks.
- No production configuration, DNS, Vercel or original database changes have been made by this migration run. Forms stay off.

The JSON export is an application-data backup, not a physical PostgreSQL backup. Storage metadata and Auth records must be restored through a compatible reviewed procedure; their presence in the export alone is not proof of restorability.
