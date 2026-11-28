// These five confirmations were supplied by the salon on 28 November 2026.
// Update this list and dist/feeds/silhouette-five.xml together after each change.
const confirmedAt = Date.parse('2026-11-28T21:01:00+03:00');
const validUntil = Date.parse('2026-12-08T21:01:00+03:00');
const confirmed = new Map([
  ['05a40b2a-c18b-4620-be9c-c630ac036513',['silhouette-8722-6560-sg-05a40b2ac18b4620be9cc630ac036513',29797]],
  ['4b8a644f-3a7d-4c37-80ac-48a16dcc5fd7',['silhouette-8722-7530-sg-4b8a644f3a7d4c3780ac48a16dcc5fd7',29797]],
  ['edde9026-9316-4a90-98f8-1bcf02301390',['silhouette-8722-9040-sg-polarized-edde902693164a9098f81bcf02301390',35997]],
  ['df7313fc-4e07-4661-8446-f8477ce4c958',['silhouette-8722-9140-00-00-sg-df7313fc4e0746618446f8477ce4c958',29797]],
  ['07936c80-ed5c-4b89-b929-77fa09016235',['silhouette-8727-6560-00-00-sg-silhouette-07936c80ed5c4b89b92977fa09016235',36997]],
]);

export function verifiedAvailability(product, now = Date.now()) {
  const record = confirmed.get(product?.id);
  if (!record || !Number.isFinite(now) || now < confirmedAt || now >= validUntil ||
      product.isMock === true || product.brand !== 'Silhouette' || product.category !== 'sunglasses' ||
      product.slug !== record[0] || product.price !== record[1]) return null;
  return {schema:'https://schema.org/InStock', label:'Наличие подтверждено салоном 28 ноября 2026 года.'};
}
