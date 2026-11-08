import http from 'node:http';
import {readFile,writeFile,mkdir} from 'node:fs/promises';
import {resolve,extname,sep} from 'node:path';
import {randomBytes} from 'node:crypto';
import {handleApi} from '../lib/api.js';
await mkdir('.local',{recursive:true});
const env={...process.env,ADMIN_PASSWORD:process.env.ADMIN_PASSWORD||'addhard-local',SESSION_SECRET:process.env.SESSION_SECRET||randomBytes(32).toString('hex')};
let draft;try{draft=JSON.parse(await readFile('.local/draft.json','utf8'))}catch{}
const persist=()=>writeFile('.local/draft.json',JSON.stringify(draft));
const attempts=new Map();
const store={get:async()=>draft,init:async d=>{draft=d;await persist()},save:async(rev,content)=>{if(draft.revision!==rev)return null;draft={...draft,revision:rev+1,content,updatedAt:new Date().toISOString()};await persist();return draft},published:async(old,next)=>{draft.baseSha=next;await persist()},attempt:async ip=>{let row=attempts.get(ip);if(!row||row.expires<Date.now())row={n:0,expires:Date.now()+900000};row.n++;attempts.set(ip,row);return row.n<=10}};
const assets={data:async()=>JSON.parse(await readFile('data/content.json','utf8')),template:async archive=>readFile(archive?'dist/news.html':'dist/HTML/index.html','utf8')};
const root=resolve('dist');
http.createServer(async(req,res)=>{try{
 const url=new URL(req.url,'http://localhost:8788');
 if(url.pathname.startsWith('/api/')){
  const chunks=[];let size=0;for await(const chunk of req){size+=chunk.length;if(size>1000000){res.writeHead(413);res.end();return}chunks.push(chunk)}
  const response=await handleApi(new Request(url,{method:req.method,headers:req.headers,...(!['GET','HEAD'].includes(req.method)?{body:Buffer.concat(chunks)}:{})}),env,store,assets);
  res.writeHead(response.status,Object.fromEntries(response.headers));res.end(Buffer.from(await response.arrayBuffer()));return;
 }
 let path=decodeURIComponent(url.pathname);if(path.endsWith('/'))path+='index.html';
 const file=resolve(root,'.'+path);if(!file.startsWith(root+sep)){res.writeHead(403);res.end();return}
 const content=await readFile(file);res.writeHead(200,{'Content-Type':({'.html':'text/html; charset=utf-8','.js':'text/javascript','.css':'text/css','.json':'application/json','.svg':'image/svg+xml','.webp':'image/webp','.png':'image/png'}[extname(file)]||'application/octet-stream')});res.end(content);
 }catch{res.writeHead(404);res.end('Not found')}}).listen(8788,'127.0.0.1',()=>console.log('Local admin: http://localhost:8788/admin/ (default local password: addhard-local)'));
