import http from 'node:http';
import { readFile, stat } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)),'../dist');
const types = {'.html':'text/html; charset=utf-8','.css':'text/css; charset=utf-8','.js':'text/javascript; charset=utf-8','.png':'image/png','.webp':'image/webp'};
http.createServer(async(req,res) => {
  try {
    const url = new URL(req.url,'http://127.0.0.1');
    let file = path.resolve(root,'.'+decodeURIComponent(url.pathname));
    if(file !== root && !file.startsWith(root+path.sep)) {res.writeHead(403);res.end();return;}
    try { if((await stat(file)).isDirectory()) file = path.join(file,'index.html'); } catch { if(!path.extname(file)) file = path.join(root,'404.html'); }
    const body = await readFile(file);res.setHeader('Content-Type',types[path.extname(file)] || 'application/octet-stream');res.end(body);
  } catch {res.writeHead(404);res.end('Not found');}
}).listen(4173,'127.0.0.1',() => console.log('http://127.0.0.1:4173'));
