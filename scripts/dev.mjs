import http from 'node:http';
import {readFile,writeFile,mkdir} from 'node:fs/promises';
import {resolve,extname,sep} from 'node:path';
import {randomBytes} from 'node:crypto';
import {handleApi} from '../lib/api.js';
import {IMAGE_ID_PATTERN} from '../lib/media.js';
await mkdir('.local',{recursive:true});
const env={...process.env,ADMIN_PASSWORD:process.env.ADMIN_PASSWORD||'addhard-local',SESSION_SECRET:process.env.SESSION_SECRET||randomBytes(32).toString('hex')};
let draft;try{draft=JSON.parse(await readFile('.local/draft.json','utf8'))}catch{}
let persistence=Promise.resolve();
const persist=value=>{
 const serialized=JSON.stringify(value);
 const write=persistence.catch(()=>{}).then(()=>writeFile('.local/draft.json',serialized));
 persistence=write;return write;
};
const attempts=new Map();
const imagePath=id=>{if(!IMAGE_ID_PATTERN.test(id))throw new Error('画像IDが正しくありません');return '.local/images/'+id;};
const imageMetadata=async id=>{try{return JSON.parse(await readFile(imagePath(id)+'.json','utf8'))}catch(error){if(error.code==='ENOENT')return null;throw error}};
const store={
 get:async()=>draft,
 init:async d=>{if(!draft){draft=structuredClone(d);await persist(draft)}},
 save:async(rev,content)=>{
  if(draft.revision!==rev)return null;
  const saved={...draft,revision:rev+1,content:structuredClone(content),updatedAt:new Date().toISOString()};
  draft=saved;await persist(saved);return saved;
 },
 published:async(old,next)=>{if(draft.baseSha===old){draft={...draft,baseSha:next};await persist(draft)}},
 attempt:async ip=>{let row=attempts.get(ip);if(!row||row.expires<Date.now())row={n:0,expires:Date.now()+900000};row.n++;attempts.set(ip,row);return row.n<=10},
 imageGet:async id=>{const metadata=await imageMetadata(id);if(!metadata)return null;try{return {...metadata,bytes:await readFile(imagePath(id))}}catch(error){if(error.code==='ENOENT')return null;throw error}},
 imagePut:async({id,type,bytes})=>{
  const path=imagePath(id);await mkdir('.local/images',{recursive:true});
  await writeFile(path,bytes,{flag:'wx'});await writeFile(path+'.json',JSON.stringify({type,published:false}),{flag:'wx'});
 },
 imagesMissing:async ids=>{const missing=[];for(const id of ids){if(!await store.imageGet(id))missing.push(id)}return missing},
 imagesPublish:async ids=>{for(const id of ids){const metadata=await imageMetadata(id);if(metadata)await writeFile(imagePath(id)+'.json',JSON.stringify({...metadata,published:true}))}}
};
const assets={data:async()=>JSON.parse(await readFile('data/content.json','utf8')),template:async archive=>readFile(archive?'dist/news.html':'dist/HTML/index.html','utf8')};
const root=resolve('dist');
const port=Number(process.env.PORT||8788);
http.createServer(async(req,res)=>{try{
 const url=new URL(req.url,`http://localhost:${port}`);
 if(url.pathname.startsWith('/api/')){
  const chunks=[];let size=0;for await(const chunk of req){size+=chunk.length;if(size>1000000){res.writeHead(413);res.end();return}chunks.push(chunk)}
  const response=await handleApi(new Request(url,{method:req.method,headers:req.headers,...(!['GET','HEAD'].includes(req.method)?{body:Buffer.concat(chunks)}:{})}),env,store,assets);
  res.writeHead(response.status,Object.fromEntries(response.headers));res.end(Buffer.from(await response.arrayBuffer()));return;
 }
 let path=decodeURIComponent(url.pathname);if(path.endsWith('/'))path+='index.html';
 const file=resolve(root,'.'+path);if(!file.startsWith(root+sep)){res.writeHead(403);res.end();return}
 const content=await readFile(file);res.writeHead(200,{'Content-Type':({'.html':'text/html; charset=utf-8','.js':'text/javascript','.css':'text/css','.json':'application/json','.svg':'image/svg+xml','.webp':'image/webp','.png':'image/png'}[extname(file)]||'application/octet-stream')});res.end(content);
 }catch{res.writeHead(404);res.end('Not found')}}).listen(port,'127.0.0.1',()=>console.log(`Local admin: http://localhost:${port}/admin/ (default local password: addhard-local)`));
