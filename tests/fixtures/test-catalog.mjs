// Entirely synthetic records. These IDs, prices and models are never an offer.
// isMock:false exercises the existing real-product checkout without a live catalog.
export const fixtureProducts = Object.freeze([
  ['10000000-0000-4000-8000-000000000001', 'test-optical-one', 'Тестовая оправа 01', 'optical', 1000],
  ['10000000-0000-4000-8000-000000000002', 'test-optical-two', 'Тестовая оправа 02', 'optical', 1500],
  ['10000000-0000-4000-8000-000000000003', 'test-sunglasses-one', 'Тестовые очки 03', 'sunglasses', 2000]
].map(([id, slug, model, category, price], index) => Object.freeze({
  id, slug, brand:'TEST — не товар салона', model, category, gender:'unisex', price,
  isNew:true, isFeatured:index < 2, popularity:100-index,
  images:Object.freeze([Object.freeze({src:'/__fixtures/frame.svg', alt:'Условная иллюстрация тестовых очков'})]),
  shortDescription:'Тестовая модель. Условная цена, не предложение магазина.',
  description:'Искусственные данные для локальной проверки каталога, корзины и заказа. В салон ничего не отправляется.',
  attributes:Object.freeze({'Источник':'Локальная тестовая фикстура', 'Материал':'Условный'}),
  isMock:false, isFixture:true, updatedAt:'2026-11-06T00:00:00.000Z'
})));

// Empty editorial overrides preserve the original checked-in copy/fallbacks.
// Only catalog records and contact submissions remain synthetic.
export const fixtureEditorial = Object.freeze({});

export const fixtureRows = () => fixtureProducts.map(product => ({
  id:product.id, slug:product.slug, data:product, published:true, updated_at:product.updatedAt
}));

export const fixtureCustomer = Object.freeze({
  customer_name:'Тестовый посетитель', customer_phone:'+79990000000', accepted:true
});
