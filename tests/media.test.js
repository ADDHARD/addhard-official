import test from 'node:test';
import assert from 'node:assert/strict';
import {DatabaseSync} from 'node:sqlite';
import {uploadImage,serveImage,referencedImageIds,assertImagesExist,MAX_IMAGE_BYTES} from '../lib/media.js';
import {createD1Store} from '../functions/api/[[path]].js';

// A real one-pixel PNG. Product uploads are re-encoded by the admin before storage.
const png=Uint8Array.from(atob('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAusB9Wl6vWQAAAAASUVORK5CYII='),c=>c.charCodeAt(0));
const request=(body,type='image/png',headers={})=>new Request('https://site.example/api/images',{method:'POST',headers:{'Content-Type':type,...headers},body});
function memoryStore(){const images=new Map();return {images,imagePut:async image=>images.set(image.id,{...image,published:false}),imageGet:async id=>images.get(id)||null,imagesPublish:async ids=>{for(const id of ids){const image=images.get(id);if(image)image.published=true}}}}

test('uploaded draft images stay private until publish and HEAD retains headers',async()=>{
 const store=memoryStore();
 const response=await uploadImage(request(png),store);
 assert.equal(response.status,201);
 const {url}=await response.json();assert.match(url,/^\/api\/images\/[0-9a-f-]+\.png$/);
 const imageRequest=new Request('https://site.example'+url);
 assert.equal((await serveImage(imageRequest,store,false)).status,404);
 const draft=await serveImage(imageRequest,store,true);
 assert.equal(draft.status,200);assert.equal(draft.headers.get('Content-Type'),'image/png');assert.equal(draft.headers.get('Cache-Control'),'private, no-store');
 assert.deepEqual(new Uint8Array(await draft.arrayBuffer()),png);
 const id=url.split('/').at(-1);await store.imagesPublish([id]);
 const published=await serveImage(imageRequest,store,false);
 assert.equal(published.status,200);assert.match(published.headers.get('Cache-Control'),/public.*immutable/);assert.equal(published.headers.get('X-Content-Type-Options'),'nosniff');
 const head=await serveImage(new Request(imageRequest,{method:'HEAD'}),store,false);
 assert.equal(head.status,200);assert.equal(head.headers.get('Content-Length'),String(png.byteLength));assert.equal((await head.arrayBuffer()).byteLength,0);
 assert.equal((await serveImage(new Request('https://site.example/api/images/not-an-id.png'),store,true)).status,404);
});

test('uploads reject active content, MIME mismatch and bodies over the streaming limit',async()=>{
 const store=memoryStore();
 assert.equal((await uploadImage(request('<svg onload="alert(1)"></svg>','image/svg+xml'),store)).status,415);
 assert.equal((await uploadImage(request('<html>image</html>'),store)).status,415);
 assert.equal((await uploadImage(request(png,'image/jpeg'),store)).status,415);
 assert.equal((await uploadImage(request(png,'image/png',{'Content-Length':String(MAX_IMAGE_BYTES+1)}),store)).status,413);
 const stream=new ReadableStream({start(controller){controller.enqueue(new Uint8Array(400001));controller.enqueue(new Uint8Array(400000));controller.close()}});
 const oversized=new Request('https://site.example/api/images',{method:'POST',headers:{'Content-Type':'image/png'},body:stream,duplex:'half'});
 assert.equal((await uploadImage(oversized,store)).status,413);
 assert.equal(store.images.size,0);
});

test('deployed image references make an unflagged image public without exposing other drafts',async()=>{
 const store=memoryStore();
 const {url}=await (await uploadImage(request(png),store)).json();
 const {url:otherUrl}=await (await uploadImage(request(png),store)).json();
 const id=url.split('/').at(-1);
 assert.equal((await serveImage(new Request('https://site.example'+url),store,false)).status,404);
 const referenced=await serveImage(new Request('https://site.example'+url),store,false,[id]);
 assert.equal(referenced.status,200);
 assert.match(referenced.headers.get('Cache-Control'),/public.*immutable/);
 assert.equal(store.images.get(id).published,false,'trusted deployed references need not mutate the upload record');
 assert.equal((await serveImage(new Request('https://site.example'+otherUrl),store,false,[id])).status,404);
 assert.equal((await serveImage(new Request('https://site.example'+otherUrl),store,true,[id])).status,200);
});

test('referenced uploads are deduplicated and missing images block publication',async()=>{
 const store=memoryStore();const uploaded=await uploadImage(request(png),store);const {url}=await uploaded.json();
 const content={shapekeys:[{image:url},{image:url}],eyeTextures:[{image:'https://images.example/cover.png'}],tools:[]};
 assert.deepEqual(referencedImageIds(content),[url.split('/').at(-1)]);
 await assertImagesExist(content,store);
 store.images.clear();await assert.rejects(()=>assertImagesExist(content,store),/画像が見つかりません/);
 await assertImagesExist({news:[],qa:[]},{});
});

test('D1 media table is created lazily and stores binary bytes with bulk publication',async()=>{
 const db=new DatabaseSync(':memory:');
 const calls=[];
 const adapt=sql=>{
  calls.push(sql);
  const execute=args=>({
   async first(){return db.prepare(sql).get(...args)||null},
   async all(){return {results:db.prepare(sql).all(...args)}},
   async run(){const result=db.prepare(sql).run(...args);return {meta:{changes:Number(result.changes)}}}
  });
  return {...execute([]),bind(...args){return execute(args.map(value=>value instanceof ArrayBuffer?new Uint8Array(value):value))}};
 };
 try{
  const store=createD1Store({prepare:adapt});assert.equal(calls.length,0);
  const result=await uploadImage(request(png),store);assert.equal(result.status,201);
  const {url}=await result.json();const id=url.split('/').at(-1);
  const row=await store.imageGet(id);assert.deepEqual(row.bytes,png);assert.equal(row.published,false);
  assert.deepEqual(await store.imagesMissing([id,'00000000-0000-0000-0000-000000000000.png']),['00000000-0000-0000-0000-000000000000.png']);
  await store.imagesPublish([id]);assert.equal((await store.imageGet(id)).published,true);
  assert.equal(calls.filter(sql=>sql.startsWith('CREATE TABLE')).length,1);
  await assert.rejects(()=>store.imageGet('../escape.png'),/画像ID/);
 }finally{db.close()}
});
