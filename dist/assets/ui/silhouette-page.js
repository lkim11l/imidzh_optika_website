import {catalogPageHTML} from './catalog-page.js';
import {silhouetteProducts,SILHOUETTE_PATH} from '../data/brand-pages.js';

export function silhouettePageHTML(products, filters = {}) {
  const clean = {category:'',genders:[],min:null,max:null,sort:'popular',query:'',...filters,brands:[],basePath:SILHOUETTE_PATH};
  return catalogPageHTML(silhouetteProducts(products), clean, {silhouette:true});
}
