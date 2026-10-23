import test from 'node:test';
import assert from 'node:assert/strict';
import {deleteProduct,deleteBooking,cleanupProductFiles} from '../dist/assets/ui/admin-delete.js';

test('failed product deletion never attempts file deletion',async()=>{
 const calls=[];await assert.rejects(deleteProduct({id:'p',updated_at:'revision'},async(path)=>{calls.push(path);throw Error('conflict');}));
 assert.deepEqual(calls,['/rest/v1/rpc/optika_delete_product']);
});
test('cleanup can resume after partial failure and never accepts arbitrary paths',async()=>{
 const name='11111111-1111-1111-1111-111111111111.jpg',calls=[];
 const api=async(path,options)=>{calls.push([path,options]);if(path.includes('pending'))return [{name}];throw Error('offline');};
 const result=await cleanupProductFiles(api);assert.equal(result.failed,true);assert.equal(result.deleted,0);
 assert.equal(calls[1][0],'/storage/v1/object/optika-products');assert.deepEqual(calls[1][1].body,{prefixes:[name]});assert.equal(calls[1][1].authenticated,true);
 const invalid=[];await cleanupProductFiles(async(path)=>{invalid.push(path);return [{name:'../other-bucket/file.jpg'}];});assert.equal(invalid.length,1);
});
test('successful deletion cleans only server-authorized files and reconciles the queue',async()=>{
 let pending=0;const calls=[];
 const result=await deleteProduct({id:'p',updated_at:'revision'},async(path,options)=>{
  calls.push([path,options]);if(path.endsWith('optika_delete_product'))return true;
  if(path.includes('pending'))return pending++?[]:[{name:'11111111-1111-1111-1111-111111111111.webp'}];return [];
 });
 assert.deepEqual(calls[0][1].body,{product_id:'p',expected_updated_at:'revision'});assert.equal(calls.length,4);assert.equal(result.cleanup.failed,false);
});
test('booking deletion includes its last known status and creation time',async()=>{
 await deleteBooking({id:'b',status:'closed',created_at:'date'},async(path,options)=>{
  assert.equal(path,'/rest/v1/rpc/optika_delete_booking');assert.equal(options.authenticated,true);
  assert.deepEqual(options.body,{booking_id:'b',expected_status:'closed',expected_created_at:'date'});
 });
});
