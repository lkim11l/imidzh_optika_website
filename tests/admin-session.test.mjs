import test from 'node:test';
import assert from 'node:assert/strict';
import {createAdminSession} from '../dist/assets/data/admin-session.js';
const store=()=>{const data=new Map();return {getItem:k=>data.get(k),setItem:(k,v)=>data.set(k,v),removeItem:k=>data.delete(k),data};};
const token=(extra={})=>({access_token:'access',refresh_token:'refresh',expires_in:3600,user:{id:'id',email:'qa@example.invalid'},password:'never-store',...extra});
function setup(){const temporary=store(),persistent=store();let time=1000000,calls=0;
 const options={scope:'current-backend',temporary,persistent,now:()=>time,refresh:async()=>{calls++;return token({access_token:'rotated',refresh_token:'rotated-refresh'});}};
 return {temporary,persistent,options,next:()=>{time+=3600001;},calls:()=>calls,make:()=>createAdminSession(options)};
}
test('reload restores temporary login, but a new browser tab has no temporary login',()=>{
 const s=setup(),auth=s.make();auth.accept(token());assert.equal(s.make().restore().access_token,'access');
 assert.equal(createAdminSession({...s.options,temporary:store()}).restore(),null);assert.equal(s.persistent.data.size,0);
 assert.ok(!s.temporary.getItem(auth.key).includes('never-store'));
});
test('remembered login survives new tab and switching it off removes persistent credentials',()=>{
 const s=setup(),auth=s.make();auth.accept(token(),true);
 const next=createAdminSession({...s.options,temporary:store()});assert.equal(next.restore().access_token,'access');
 auth.accept(token(),false);assert.equal(s.persistent.data.size,0);auth.clear();assert.equal(s.make().restore(),null);
});
test('concurrent authenticated requests refresh once and persist rotated tokens',async()=>{
 const s=setup(),auth=s.make();auth.accept(token(),true);s.next();
 const sessions=await Promise.all([auth.ensure(),auth.ensure(),auth.ensure()]);assert.equal(s.calls(),1);
 assert.ok(sessions.every(x=>x.access_token==='rotated'));assert.equal(s.make().restore().refresh_token,'rotated-refresh');
});
test('temporary outages preserve login but revoked refresh tokens clear it',async()=>{
 const s=setup();let reject=false;s.options.refresh=async()=>{const e=Error('offline');e.authRejected=reject;throw e;};
 const auth=s.make();auth.accept(token(),true);s.next();await assert.rejects(auth.ensure());assert.ok(s.make().restore());
 reject=true;await assert.rejects(auth.ensure());assert.equal(s.make().restore(),null);
});
test('a late refresh response cannot restore a session after sign out',async()=>{
 const s=setup();let finish;s.options.refresh=()=>new Promise(resolve=>{finish=resolve;});
 const auth=s.make();auth.accept(token(),true);s.next();const refreshing=auth.ensure();auth.clear();finish(token());
 await assert.rejects(refreshing,/завершён/);assert.equal(auth.get(),null);assert.equal(s.make().restore(),null);
});
test('sessions are isolated by backend and malformed saved sessions are ignored',()=>{
 const s=setup(),auth=s.make();auth.accept(token(),true);
 assert.equal(createAdminSession({...s.options,scope:'other-backend'}).restore(),null);
 s.persistent.setItem(auth.key,'{broken json');assert.equal(s.make().restore(),null);
});
