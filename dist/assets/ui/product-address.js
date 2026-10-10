const latin=['a','b','v','g','d','e','e','zh','z','i','y','k','l','m','n','o','p','r','s','t','u','f','h','ts','ch','sh','sch','','y','','e','yu','ya'];
const letters='абвгдеёжзийклмнопрстуфхцчшщъыьэюя';
export function makeProductSlug(brand,model,id){
 const name=`${brand} ${model}`.toLowerCase().replace(/[а-яё]/g,c=>latin[letters.indexOf(c)]).normalize('NFKD').replace(/[\u0300-\u036f]/g,'').replace(/[^a-z0-9]+/g,'-').replace(/^-|-$/g,'').slice(0,110).replace(/-$/,'')||'model';
 return `${name}-${id.replace(/-/g,'')}`;
}
