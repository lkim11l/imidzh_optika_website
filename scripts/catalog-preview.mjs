import './deny-live-network.mjs';
import {readFile} from 'node:fs/promises';
import {createTestPreview} from './test-preview.mjs';
const {products}=JSON.parse(await readFile(new URL('../tests/fixtures/catalog-batch-25.json',import.meta.url),'utf8'));
const port=Number(process.env.OPTIKA_CATALOG_TEST_PORT||4175);
if(!Number.isInteger(port)||port<1024||port>65535)throw new Error('Invalid local catalog port.');
const {server}=createTestPreview({products,editorial:{},notice:'Каталог из сохранённой копии: 25 реальных названий моделей. Цены и характеристики исторические, актуальность наличия не проверена. Изображения условные; это не предложение к продаже.'});
server.listen(port,'127.0.0.1',()=>process.stdout.write(`Offline catalog snapshot: http://127.0.0.1:${port}/catalog/sunglasses\nNo live catalog, mail or analytics.\n`));
