// Local preview of the added Vercel headers only. Does not contact account settings.
import http from 'node:http';
import {readFile,stat} from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
const project=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const root=path.join(project,'dist'),config=JSON.parse(await readFile(path.join(project,'vercel.json'),'utf8'));
const types={'.html':'text/html; charset=utf-8','.js':'text/javascript; charset=utf-8','.css':'text/css; charset=utf-8','.svg':'image/svg+xml','.webp':'image/webp','.jpg':'image/jpeg','.png':'image/png','.mp4':'video/mp4','.webm':'video/webm'};
http.createServer(async(req,res)=>{
 try{
  const url=new URL(req.url,'http://127.0.0.1');
  for(const rule of config.headers||[])if(rule.source==='/(.*)'||(rule.source==='/(admin|cookie)(.*)'&&/^\/(admin|cookie)(?:\/|$)/.test(url.pathname)))for(const h of rule.headers)res.setHeader(h.key,h.value);
  if(['/cookie','/cookie/','/cookie/index.html'].includes(url.pathname)){res.writeHead(308,{Location:'/admin'+url.search});res.end();return;}
  let file=path.resolve(root,'.'+decodeURIComponent(url.pathname));
  if(file!==root&&!file.startsWith(root+path.sep)){res.writeHead(403);res.end();return;}
  try{if((await stat(file)).isDirectory())file=path.join(file,'index.html');}catch{if(!path.extname(file))file=path.join(root,'404.html');}
  const body=await readFile(file);res.setHeader('Content-Type',types[path.extname(file)]||'application/octet-stream');res.end(body);
 }catch{res.writeHead(404);res.end('Not found');}
}).listen(Number(process.env.PORT||4174),'127.0.0.1',()=>console.log('Security preview: http://127.0.0.1:'+(process.env.PORT||4174)));
