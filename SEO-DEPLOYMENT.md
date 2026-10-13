# Public catalog and SEO deployment

Vercel serves the homepage, about page, categories, product pages and sitemap through `api/seo.mjs`. The public catalog is read with the existing publishable Supabase key and published-row RLS; no administrator or service-role key is used. Optional server overrides are `SUPABASE_URL` and `SUPABASE_PUBLISHABLE_KEY`.

Only published records without `isMock: true` appear in the storefront, indexable pages and sitemap. Demo records stay in the database and remain editable in management. Products use `/product/<slug>` consistently. Valid legacy `/product?slug=...` addresses return 308. Unknown, unpublished and demo products return 404 with noindex. Database failures return 503 and Retry-After, not 404 or an empty sitemap.

The function caches public catalog data for 30 seconds and Vercel caches successful responses for 30 seconds. A publication, edit, removal or slug change therefore appears within approximately 60 seconds under normal request traffic, without a deployment hook or rebuild. A failed database refresh does not extend the cache. Prices are read from published records; availability and reviews are not invented.

`npm run build` also creates complete static HTML snapshots for public pages and a sitemap from the same database, for portable static hosting. Static-only hosts require a rebuild after catalog changes; live Vercel routes do not. There are no empty loading shells for indexable products or categories. Server and browser share catalog and product rendering functions, metadata and JSON-LD. Supabase outages do not remove already rendered category/product HTML from the browser.

## Verification

- `npm ci`, `npm run build`, `npm run test:seo` (Node 22).
- `npm start` for the local Vercel-function equivalent.
- With Playwright installed or `PLAYWRIGHT_MODULE` pointing to an installed module: `node scripts/verify-seo.cjs`. Set `SEO_BASE_URL` when testing another port or a deployed URL. This checks every sitemap URL with JavaScript disabled and tests browser navigation, canonical, robots, JSON-LD, filters, legacy redirects and 404.
- Confirm Vercel uses the repository root and its checked-in configuration: build `npm run build`, output `dist`, Node 22. Ensure rewrites execute before serving static snapshots and `/api/seo` is present in the deployment's Functions list.
- Confirm a newly published product works at its clean URL and appears in sitemap without redeploying. Unpublish it and verify 404 plus sitemap removal after the short cache expires.

## Account configuration required

Attach both `optikim.ru` and `www.optikim.ru` to the existing Vercel project. Apply the DNS records shown by Vercel and wait for its certificate to be issued. `vercel.json` redirects www to the canonical domain, but an HTTPS certificate must exist before the redirect can run. Do not bypass certificate errors or turn off production security controls.

Add `https://optikim.ru/sitemap.xml` in Google Search Console and Yandex Webmaster using the owner's accounts. Inspect a real product and both categories. Indexability is verified in code; actual search-engine inclusion and field Core Web Vitals require those services.

Run a fresh mobile Lighthouse audit on the homepage, both categories and a real product after deployment. Old `mobile-live.json` measures an earlier homepage and cannot certify the new release. The current responsive WebP hero, image dimensions, lazy category images, local WOFF2 fonts, font-display swap and hashed minified CSS are retained. No font or image URL without a content hash is newly assigned immutable caching.

Product images in the public optika-products bucket are resized to 320/640/960/1280 pixels and encoded as WebP through `api/product-image.mjs`, with responsive srcset and CDN caching. Only UUID filenames in the existing public bucket are accepted; arbitrary URLs and oversized source images are rejected. The original uploads remain unchanged. Static-only hosting must also provide the image endpoint or use original images; the supported production target is Vercel.
