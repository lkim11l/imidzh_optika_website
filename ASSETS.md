# Original local image placeholders

Generated with the built-in ImageGen tool. No production imagery was downloaded. Exact prompts below; each generated once, without retries.

## Optical atlas → dist/assets/products/optical-01.webp … optical-12.webp

Use case: product-mockup. Asset type: premium optical boutique product photography atlas. Create a 2048x1536 landscape image arranged as a mathematically strict 4 columns x 3 rows grid of twelve equal square 512x512 tiles. Seamless uniform very light neutral #f2f1ee background across entire image, no visible lines or tile borders. Exactly one different fully visible optical eyeglass frame centered in each tile with generous clear margins, realistic premium studio photography, soft shadows, consistent scale and front three-quarter view. Every frame must be wholly confined within its own square tile. Reading order left-to-right top-to-bottom: black rectangle; champagne rimless; tortoise cat-eye; silver round; navy acetate; blush oval; titanium aviator; amber geometric; transparent crystal; burgundy cat-eye; dark green rectangle; brown oval. Clear transparent optical lenses. No logos, text, watermarks, humans, props, duplicate frames, extra frames, cropping, or 3D rendering.

## Sunglasses atlas → dist/assets/products/sunglasses-01.webp … sunglasses-12.webp

Use case: product-mockup. Asset type: premium optical boutique sunglasses product photography atlas. Create a 2048x1536 landscape image arranged as a mathematically strict 4 columns x 3 rows grid of twelve equal square 512x512 tiles. Seamless uniform very light neutral #f2f1ee background across entire image, no visible lines or tile borders. Exactly one different fully visible premium sunglasses frame centered in each tile with generous clear margins, realistic premium studio photography, soft shadows, consistent scale and front three-quarter view. Every frame must be wholly confined within its own square tile. Reading order left-to-right top-to-bottom: black wayfarer; gold aviator; tortoise cat-eye; black oversized; silver pilot; honey square; ivory oval; brown butterfly; navy sport; dark green square; rose geometric; black slim rectangle. Tinted sunglass lenses. No logos, text, watermarks, humans, props, duplicate frames, extra frames, cropping, or 3D rendering.

## Editorial sunglasses → dist/assets/sunglasses-editorial.webp

Use case: photorealistic-natural. Asset type: large editorial image for premium optical boutique. Landscape 3:2 photograph, request 1536x1024. Single unbranded dark tortoiseshell angular sunglasses with brown lenses, laid diagonally on warm pale limestone in natural sunlight. Sunglasses fully visible with generous negative space at top. Quiet summer mood, premium editorial still life photography with realistic limestone and acetate textures and natural sunlit shadows. No text, logos, watermarks, props, people, extra glasses, or 3D rendering.

Both returned atlases are 1448×1086 and align to a regular 4×3 grid. Mechanical extraction yields twelve 362×362 tiles per atlas. Atlas source files remain outside the published checkout under `../image-assets/catalog-v2/`; all consumed assets are copied into the site. Product gallery “Детали” is an enlarged view of the same photograph, not a fabricated second angle. Real per-product images can be added to `Product.images` later.

## Focused V2 editorial category image → dist/assets/optical-lifestyle.webp

Generated once using built-in ImageGen, saved as 1536×1024 PNG in `../image-assets/editorial-v2/optical-lifestyle.png` and packaged as local WebP. This is a fictional editorial subject, not a real employee or customer.

Exact prompt:

Use case: photorealistic-natural
Asset type: landscape category photograph for the “Оправы для зрения” section of a premium Russian optical boutique homepage, visually compatible with a limestone sunglasses still life.
Primary request: one refined natural editorial fashion photograph of an anonymous fictional woman around 45 wearing tasteful unbranded translucent smoke optical glasses with clear lenses.
Scene/backdrop: seated near a large window in a quiet light stone urban cafe, warm neutral background with subtle architecture blur.
Subject: dark chestnut shoulder-length hair; simple dark navy jacket over an ivory shirt; calm confident everyday style; looking slightly away from camera.
Style/medium: realistic editorial photography, authentic natural skin texture, no glamour retouching.
Composition/framing: landscape 3:2; medium close portrait, head and shoulders fully visible; enough breathing space around the head and shoulders to crop to a category rectangle; optical glasses clearly visible and well fitted.
Lighting/mood: soft natural daylight, quietly refined and approachable.
Constraints: exactly one image. Fictional person, not a real employee or customer portrait. Clear optical lenses, no sunglasses, no medical context, no logos, no text, no watermark, no jewelry focus, no 3D.

## Static homepage portrait

`dist/assets/hero-portrait-v1.webp` and its 768/640 variants: generated with OpenAI ImageGen on 2026-10-11 for this site. Fictional editorial model wearing glasses; not a customer, owner or catalogue product. Converted to responsive WebP assets. The homepage image can be replaced in the admin content editor.
