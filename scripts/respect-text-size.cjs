const fs = require('node:fs');
for(const file of ['dist/assets/styles.css','dist/assets/shop.css']) {
  let css = fs.readFileSync(file,'utf8');
  css = css.replace(/font-size:([^;}]+)/g,(_,size) => 'font-size:'+size.replace(/([0-9.]+)px/g,(_,number) => `${Number(number)/16}rem`));
  fs.writeFileSync(file,css);
}
