export const IMAGE_ID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\.(?:png|jpg|webp)$/;
export const MAX_IMAGE_BYTES = 800000;
const imagePathPattern = /^\/api\/images\/([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\.(?:png|jpg|webp))$/;
const types = new Map([['image/png','png'],['image/jpeg','jpg'],['image/webp','webp']]);
const json = (value,status=200) => new Response(JSON.stringify(value),{status,headers:{'Content-Type':'application/json; charset=utf-8','Cache-Control':'no-store','X-Content-Type-Options':'nosniff'}});
const asBytes = value => value instanceof Uint8Array ? value : new Uint8Array(value);
const ascii = (bytes,start,length) => String.fromCharCode(...bytes.subarray(start,start+length));

function detectedType(bytes) {
 if(bytes.length>=33 && [137,80,78,71,13,10,26,10].every((byte,index)=>bytes[index]===byte) && ascii(bytes,12,4)==='IHDR') {
  const view=new DataView(bytes.buffer,bytes.byteOffset,bytes.byteLength);
  if(view.getUint32(8)===13 && view.getUint32(16)>0 && view.getUint32(20)>0) return 'image/png';
 }
 if(bytes.length>=4 && bytes[0]===255 && bytes[1]===216 && bytes[2]===255 && bytes[bytes.length-2]===255 && bytes[bytes.length-1]===217) return 'image/jpeg';
 if(bytes.length>=20 && ascii(bytes,0,4)==='RIFF' && ascii(bytes,8,4)==='WEBP' && ['VP8 ','VP8L','VP8X'].includes(ascii(bytes,12,4))) {
  const view=new DataView(bytes.buffer,bytes.byteOffset,bytes.byteLength);
  if(view.getUint32(4,true)===bytes.length-8) return 'image/webp';
 }
 return null;
}

async function readLimitedBody(request) {
 if(!request.body) return new Uint8Array();
 const reader=request.body.getReader();
 const chunks=[];let size=0;
 try {
  while(true) {
   const {done,value}=await reader.read();if(done)break;
   size+=value.byteLength;
   if(size>MAX_IMAGE_BYTES){await reader.cancel();return null;}
   chunks.push(value);
  }
 } finally {reader.releaseLock();}
 const result=new Uint8Array(size);let offset=0;
 for(const chunk of chunks){result.set(chunk,offset);offset+=chunk.byteLength;}
 return result;
}

export async function uploadImage(request,store) {
 const type=(request.headers.get('content-type')||'').split(';')[0].trim().toLowerCase();
 if(!types.has(type))return json({error:'画像はPNG・JPEG・WebP形式を選んでください'},415);
 if(Number(request.headers.get('content-length')||0)>MAX_IMAGE_BYTES)return json({error:'画像は800KB以下にしてください'},413);
 const bytes=await readLimitedBody(request);
 if(bytes===null)return json({error:'画像は800KB以下にしてください'},413);
 if(detectedType(bytes)!==type)return json({error:'画像ファイルを確認してください。形式と内容が一致しません'},415);
 const id=crypto.randomUUID()+'.'+types.get(type);
 await store.imagePut({id,type,bytes});
 return json({url:'/api/images/'+id},201);
}

export async function serveImage(request,store,authorized,publishedIds=[]) {
 const id=new URL(request.url).pathname.match(imagePathPattern)?.[1];
 if(!id)return json({error:'画像が見つかりません'},404);
 const image=await store.imageGet(id);
 const isPublic=Boolean(image?.published || publishedIds.includes(id));
 if(!image || !isPublic && !authorized || !types.has(image.type))return json({error:'画像が見つかりません'},404);
 const bytes=asBytes(image.bytes);
 return new Response(request.method==='HEAD'?null:bytes,{headers:{
  'Content-Type':image.type,
  'Content-Length':String(bytes.byteLength),
  'Content-Disposition':'inline',
  'X-Content-Type-Options':'nosniff',
  'Cache-Control':isPublic?'public, max-age=31536000, immutable':'private, no-store'
 }});
}

export function referencedImageIds(content) {
 const ids=new Set();
 for(const key of ['shapekeys','eyeTextures','tools']) {
  for(const item of content[key]||[]) {
   const id=typeof item?.image==='string'?item.image.match(imagePathPattern)?.[1]:null;
   if(id)ids.add(id);
  }
 }
 return [...ids];
}

export async function assertImagesExist(content,store) {
 const ids=referencedImageIds(content);
 if(!ids.length)return;
 const missing=store.imagesMissing?await store.imagesMissing(ids):(await Promise.all(ids.map(async id=>await store.imageGet(id)?null:id))).filter(Boolean);
 if(missing.length)throw new Error('保存された商品画像が見つかりません。画像を選び直してください');
}
