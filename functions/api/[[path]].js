import {handleApi} from '../../lib/api.js';
export async function onRequest({request,env}){
 if(!env.DB)return new Response(JSON.stringify({error:'下書き保存用DBが未設定です'}),{status:503,headers:{'Content-Type':'application/json'}});
 const unpack=row=>row?{revision:row.revision,content:JSON.parse(row.content),baseSha:row.base_sha,updatedAt:row.updated_at}:null;
 const store={
  get:async()=>unpack(await env.DB.prepare('SELECT * FROM drafts WHERE id=1').first()),
  init:async d=>env.DB.prepare('INSERT OR IGNORE INTO drafts VALUES (1,?,?,?,?)').bind(d.revision,JSON.stringify(d.content),new Date().toISOString(),d.baseSha).run(),
  save:async(rev,data)=>unpack(await env.DB.prepare('UPDATE drafts SET revision=revision+1,content=?,updated_at=? WHERE id=1 AND revision=? RETURNING *').bind(JSON.stringify(data),new Date().toISOString(),rev).first()),
  published:async(oldSha,newSha)=>env.DB.prepare('UPDATE drafts SET base_sha=? WHERE id=1 AND base_sha IS ?').bind(newSha,oldSha).run(),
  attempt:async ip=>{const now=Date.now();const row=await env.DB.prepare('INSERT INTO login_attempts VALUES (?,1,?) ON CONFLICT(ip) DO UPDATE SET attempts=CASE WHEN expires<? THEN 1 ELSE attempts+1 END, expires=CASE WHEN expires<? THEN ? ELSE expires END RETURNING attempts').bind(ip,now+900000,now,now,now+900000).first();return row.attempts<=10}
 };
 const asset=async path=>{const res=await env.ASSETS.fetch(new URL(path,request.url));return res.text()};
 return handleApi(request,env,store,{data:async()=>JSON.parse(await asset('/data/content.json')),template:archive=>asset(archive?'/news.html':'/HTML/index.html')});
}
