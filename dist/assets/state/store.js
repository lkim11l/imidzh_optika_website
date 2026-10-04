const FAVORITES_KEY = 'imidzh-optika:favorites:v1';
const CART_KEY = 'imidzh-optika:cart:v1';
let favorites = new Set();
let cart = [];
let knownIds = new Set();
let storageAvailable = true;
const read = key => { try { return JSON.parse(localStorage.getItem(key) || '[]'); } catch { return []; } };
const write = (key, value) => { try { localStorage.setItem(key, JSON.stringify(value)); } catch { storageAvailable = false; } };
const quantity = value => Math.max(1, Math.min(99, Math.floor(Number(value) || 1)));
function load() {
  const savedFavorites = read(FAVORITES_KEY);
  favorites = new Set(Array.isArray(savedFavorites) ? savedFavorites.filter(id => typeof id === 'string' && knownIds.has(id)) : []);
  const savedCart = read(CART_KEY);
  const merged = new Map();
  if(Array.isArray(savedCart)) savedCart.forEach(item => {
    if(item && knownIds.has(item.id) && Number.isFinite(item.quantity) && item.quantity > 0) merged.set(item.id, quantity((merged.get(item.id) || 0) + item.quantity));
  });
  cart = [...merged].map(([id, quantity]) => ({id,quantity}));
}
const notify = () => window.dispatchEvent(new CustomEvent('optika:statechange', {detail:{storageAvailable}}));
export const shopStore = {
  initialize(products) { knownIds = new Set(products.map(product => product.id)); load(); },
  getFavorites() { return [...favorites]; },
  isFavorite(id) { return favorites.has(id); },
  toggleFavorite(id) { if(!knownIds.has(id)) return; favorites.has(id) ? favorites.delete(id) : favorites.add(id); write(FAVORITES_KEY, [...favorites]); notify(); },
  getCart() { return cart.map(item => ({...item})); },
  cartCount() { return cart.reduce((total,item) => total + item.quantity, 0); },
  addToCart(id) { if(!knownIds.has(id)) return; const item = cart.find(item => item.id === id); if(item) item.quantity = quantity(item.quantity + 1); else cart.push({id,quantity:1}); write(CART_KEY,cart); notify(); },
  setQuantity(id, value) { const item = cart.find(item => item.id === id); if(item) { item.quantity = quantity(value); write(CART_KEY,cart); notify(); } },
  removeFromCart(id) { cart = cart.filter(item => item.id !== id); write(CART_KEY,cart); notify(); },
  canPersist() { return storageAvailable; }
};
window.addEventListener('storage', event => { if(event.key === FAVORITES_KEY || event.key === CART_KEY || event.key === null) {load(); notify();} });
