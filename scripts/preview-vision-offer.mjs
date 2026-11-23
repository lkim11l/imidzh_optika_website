import {createTestPreview} from './test-preview.mjs';
import {fixtureProducts} from '../tests/fixtures/test-catalog.mjs';
const products=Array.from({length:25},(_,i)=>({...fixtureProducts[i%3],id:'10000000-0000-4000-8000-'+String(i+1).padStart(12,'0'),slug:'test-frame-'+(i+1),model:'Тестовая модель '+(i+1),popularity:100-i}));
const {server}=createTestPreview({products});
server.prependListener('request',(req,res)=>{
 const end=res.end;
 res.end=function(chunk,...args){
  if(String(res.getHeader('Content-Type')).startsWith('text/html')&&typeof chunk==='string')chunk=chunk.replace('</head>','<link rel="stylesheet" href="/assets/booking.css"></head>');
  return end.call(this,chunk,...args);
 };
});
server.listen(Number(process.env.OPTIKA_TEST_PORT||4186),'127.0.0.1',()=>console.log('Vision offer preview http://127.0.0.1:'+Number(process.env.OPTIKA_TEST_PORT||4186)+'/catalog; synthetic data only'));

