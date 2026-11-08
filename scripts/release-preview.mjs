import './deny-live-network.mjs';
import {readFile} from 'node:fs/promises';
import {createTestPreview} from './test-preview.mjs';
const {products}=JSON.parse(await readFile(new URL('../tests/fixtures/catalog-batch-25.json',import.meta.url),'utf8'));
const port=Number(process.env.OPTIKA_RELEASE_PREVIEW_PORT||4176);
if(!Number.isInteger(port)||port<1024||port>65535)throw new Error('Invalid local release-preview port.');
const {server}=createTestPreview({products,editorial:{},contentPreview:false,notice:'ПРЕДВЫПУСКНАЯ ПРОВЕРКА: чистый текст страниц, но данные и обращения тестовые. 25 названий из исторической копии, цены/наличие не подтверждены, изображения условные. Не является опубликованной версией.'});
server.listen(port,'127.0.0.1',()=>process.stdout.write(`Local release-content preview: http://127.0.0.1:${port}/proverka-zreniya\nFixture-only transport and dry-run analytics; no publication.\n`));
