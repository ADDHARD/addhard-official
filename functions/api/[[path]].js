import {handleApi} from '../../lib/api.js';
import {IMAGE_ID_PATTERN} from '../../lib/media.js';

export function createD1Store(db) {
 const unpack=row=>row?{revision:row.revision,content:JSON.parse(row.content),baseSha:row.base_sha,updatedAt:row.updated_at}:null;
 let mediaReady;
 const ensureMedia=()=>mediaReady??=db.prepare('CREATE TABLE IF NOT EXISTS media (id TEXT PRIMARY KEY, type TEXT NOT NULL, bytes BLOB NOT NULL, published INTEGER NOT NULL DEFAULT 0, created_at TEXT NOT NULL)').run();
 const assertId=id=>{if(!IMAGE_ID_PATTERN.test(id))throw new Error('画像IDが正しくありません');};
 const store={
  get:async()=>unpack(await db.prepare('SELECT * FROM drafts WHERE id=1').first()),
  init:async d=>db.prepare('INSERT OR IGNORE INTO drafts VALUES (1,?,?,?,?)').bind(d.revision,JSON.stringify(d.content),new Date().toISOString(),d.baseSha).run(),
  save:async(rev,data)=>unpack(await db.prepare('UPDATE drafts SET revision=revision+1,content=?,updated_at=? WHERE id=1 AND revision=? RETURNING *').bind(JSON.stringify(data),new Date().toISOString(),rev).first()),
  published:async(oldSha,newSha)=>db.prepare('UPDATE drafts SET base_sha=? WHERE id=1 AND base_sha IS ?').bind(newSha,oldSha).run(),
  attempt:async ip=>{const now=Date.now();const row=await db.prepare('INSERT INTO login_attempts VALUES (?,1,?) ON CONFLICT(ip) DO UPDATE SET attempts=CASE WHEN expires<? THEN 1 ELSE attempts+1 END, expires=CASE WHEN expires<? THEN ? ELSE expires END RETURNING attempts').bind(ip,now+900000,now,now,now+900000).first();return row.attempts<=10},
  imageGet:async id=>{
   assertId(id);await ensureMedia();
   const row=await db.prepare('SELECT type,bytes,published FROM media WHERE id=?').bind(id).first();
   return row?{type:row.type,bytes:new Uint8Array(row.bytes),published:Boolean(row.published)}:null;
  },
  imagePut:async({id,type,bytes})=>{
   assertId(id);await ensureMedia();
   const binary=bytes instanceof Uint8Array?bytes:new Uint8Array(bytes);
   await db.prepare('INSERT INTO media (id,type,bytes,published,created_at) VALUES (?,?,?,0,?)').bind(id,type,binary.slice().buffer,new Date().toISOString()).run();
  },
  imagesMissing:async ids=>{
   if(!ids.length)return[];ids.forEach(assertId);await ensureMedia();
   const found=new Set();
   for(let offset=0;offset<ids.length;offset+=100){const chunk=ids.slice(offset,offset+100);const result=await db.prepare(`SELECT id FROM media WHERE id IN (${chunk.map(()=>'?').join(',')})`).bind(...chunk).all();for(const row of result.results)found.add(row.id);}
   return ids.filter(id=>!found.has(id));
  },
  imagesPublish:async ids=>{
   if(!ids.length)return;ids.forEach(assertId);await ensureMedia();
   for(let offset=0;offset<ids.length;offset+=100){const chunk=ids.slice(offset,offset+100);await db.prepare(`UPDATE media SET published=1 WHERE id IN (${chunk.map(()=>'?').join(',')})`).bind(...chunk).run();}
  }
 };
 return store;
}

export async function onRequest({request,env}){
 if(!env.DB)return new Response(JSON.stringify({error:'下書き保存用DBが未設定です'}),{status:503,headers:{'Content-Type':'application/json'}});
 const store=createD1Store(env.DB);
 const asset=async path=>{const res=await env.ASSETS.fetch(new URL(path,request.url));return res.text()};
 return handleApi(request,env,store,{data:async()=>JSON.parse(await asset('/data/content.json')),template:archive=>asset(archive?'/news.html':'/HTML/index.html')});
}
