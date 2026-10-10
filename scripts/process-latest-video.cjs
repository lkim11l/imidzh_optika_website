const fs=require('fs');const {chromium}=require('playwright');
(async()=>{const b=await chromium.launch({executablePath:'C:/Users/Ruslan/AppData/Local/ms-playwright/chromium-1234/chrome-win64/chrome.exe'});const p=await b.newPage();const src=fs.readFileSync('dist/assets/hero/assembly-latest.mp4').toString('base64');
console.log(await p.evaluate(async src=>{const v=document.createElement('video');v.src=URL.createObjectURL(new Blob([Uint8Array.from(atob(src),c=>c.charCodeAt(0))],{type:'video/mp4'}));await new Promise(r=>v.onloadeddata=r);window.v=v;return {w:v.videoWidth,h:v.videoHeight,d:v.duration};},src));
const out='dist/assets/hero/assembly-latest-final';fs.mkdirSync(out+'/mobile',{recursive:true});
for(let i=0;i<80;i++){const result=await p.evaluate(async i=>{const v=window.v;await new Promise(r=>{v.onseeked=r;v.currentTime=.01+(v.duration-.07)*i/79});const w=v.videoWidth,h=v.videoHeight,c=document.createElement('canvas');c.width=w;c.height=h;const x=c.getContext('2d',{willReadFrequently:true});x.drawImage(v,0,0);const im=x.getImageData(0,0,w,h),a=im.data;const rawLum=new Float32Array(w*h);for(let i=0;i<w*h;i++){const j=i*4;rawLum[i]=.2126*a[j]+.7152*a[j+1]+.0722*a[j+2];}const cols=12,rows=8,grid=[];
for(let gy=0;gy<rows;gy++)for(let gx=0;gx<cols;gx++){const vals=[];for(let y=Math.floor(gy*h/rows);y<(gy+1)*h/rows;y+=4)for(let z=Math.floor(gx*w/cols);z<(gx+1)*w/cols;z+=4){const j=(y*w+z)*4;vals.push(.2126*a[j]+.7152*a[j+1]+.0722*a[j+2]);}vals.sort((a,b)=>a-b);grid.push(vals[Math.floor(vals.length*.94)]);}
for(let y=0;y<h;y++)for(let z=0;z<w;z++){let fx=Math.max(0,Math.min(cols-1,z/w*cols-.5)),fy=Math.max(0,Math.min(rows-1,y/h*rows-.5)),gx=Math.floor(fx),gy=Math.floor(fy),dx=fx-gx,dy=fy-gy;const g=(xx,yy)=>grid[Math.min(rows-1,yy)*cols+Math.min(cols-1,xx)];const bg=(g(gx,gy)*(1-dx)+g(gx+1,gy)*dx)*(1-dy)+(g(gx,gy+1)*(1-dx)+g(gx+1,gy+1)*dx)*dy;const j=(y*w+z)*4,lum=.2126*a[j]+.7152*a[j+1]+.0722*a[j+2];let t=Math.max(0,Math.min(1,(bg-lum-9)/40));t=t*t*(3-2*t);a[j+3]=(y<h*.08||y>=h*.92||z<w*.025||z>=w*.975)?0:Math.round(t*255);if(t>0&&t<1)for(let k=0;k<3;k++)a[j+k]=Math.max(0,Math.min(255,(a[j+k]-bg*(1-t))/t));}
// Keep soft edge pixels only near the solid frame or lens contours.
// Diffuse background texture and floor shadows have no such support.
const dist=new Float32Array(w*h);dist.fill(9999);
for(let i=0;i<w*h;i++)if(a[i*4+3]>=140)dist[i]=0;
for(let y=0;y<h;y++)for(let z=0;z<w;z++){const i=y*w+z;if(z)dist[i]=Math.min(dist[i],dist[i-1]+1);if(y)dist[i]=Math.min(dist[i],dist[i-w]+1);if(y&&z)dist[i]=Math.min(dist[i],dist[i-w-1]+1.414);if(y&&z<w-1)dist[i]=Math.min(dist[i],dist[i-w+1]+1.414);}
for(let y=h-1;y>=0;y--)for(let z=w-1;z>=0;z--){const i=y*w+z;if(z<w-1)dist[i]=Math.min(dist[i],dist[i+1]+1);if(y<h-1)dist[i]=Math.min(dist[i],dist[i+w]+1);if(y<h-1&&z<w-1)dist[i]=Math.min(dist[i],dist[i+w+1]+1.414);if(y<h-1&&z)dist[i]=Math.min(dist[i],dist[i+w-1]+1.414);}
for(let i=0;i<w*h;i++){const j=i*4;if(a[j+3]<20||dist[i]>12)a[j+3]=0;else if(dist[i]>6)a[j+3]=Math.round(a[j+3]*(12-dist[i])/6);}
// Remove detached soft shadows: actual hardware and lens edges contain dark detail.
const seen=new Uint8Array(w*h),queue=new Int32Array(w*h);
for(let root=0;root<w*h;root++){if(seen[root]||a[root*4+3]<20)continue;let head=0,tail=1,minLum=255;queue[0]=root;seen[root]=1;
while(head<tail){const i=queue[head++],xx=i%w,yy=Math.floor(i/w);minLum=Math.min(minLum,rawLum[i]);for(let dy=-1;dy<=1;dy++)for(let dx=-1;dx<=1;dx++){if(!dx&&!dy)continue;const nx=xx+dx,ny=yy+dy;if(nx<0||nx>=w||ny<0||ny>=h)continue;const ni=ny*w+nx;if(!seen[ni]&&a[ni*4+3]>=20){seen[ni]=1;queue[tail++]=ni;}}}
if(minLum>140)for(let k=0;k<tail;k++)a[queue[k]*4+3]=0;
}
for(let i=0;i<w*h;i++)if(a[i*4+3]<20)a[i*4+3]=0;
x.putImageData(im,0,0);const results=[];for(const width of [Math.min(1920,w),Math.min(960,w)]){const d=document.createElement('canvas');d.width=width;d.height=Math.round(width*h/w);const q=d.getContext('2d');q.imageSmoothingQuality='high';q.drawImage(c,0,0,d.width,d.height);results.push(d.toDataURL('image/webp',.98).split(',')[1]);}return results;},i);for(let k=0;k<2;k++)fs.writeFileSync(out+(k?'/mobile':'')+'/'+String(i).padStart(2,'0')+'.webp',Buffer.from(result[k],'base64'));if(i%20===0)console.log('frames',i);}
await b.close();})();

