import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {handleApi} from '../lib/api.js';
import {normalizeContent} from '../lib/content.js';

const seed=JSON.parse(await readFile(new URL('./fixtures/legacy-content.json',import.meta.url)));
const origin='https://site.example';
const png=Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAusB9Wl6vWQAAAAASUVORK5CYII=','base64');
async function fixture(){
 const env={ADMIN_PASSWORD:'test-admin-password',SESSION_SECRET:'s'.repeat(40),GITHUB_TOKEN:'test-github-token'};
 let draft={revision:0,baseSha:'old-sha',content:structuredClone(seed)};
 const images=new Map();const published=[];
 const store={get:async()=>structuredClone(draft),attempt:async()=>true,
  save:async(rev,content)=>rev!==draft.revision?null:(draft={...draft,revision:rev+1,content:structuredClone(content)}),
  published:async(oldSha,newSha)=>{if(draft.baseSha===oldSha)draft.baseSha=newSha},
  imagePut:async image=>images.set(image.id,{...image,published:false}),imageGet:async id=>images.get(id)||null,
  imagesPublish:async ids=>{published.push(...ids);for(const id of ids)images.get(id).published=true}
 };
 const assets={};
 const call=(path,{method='GET',body,cookie,raw=false,requestOrigin=origin,type='application/json'}={})=>handleApi(new Request(origin+path,{method,headers:{origin:requestOrigin,'Content-Type':type,...(cookie?{cookie}:{})},...(body!==undefined?{body:raw?body:JSON.stringify(body)}:{})}),env,store,assets);
 const response=await call('/api/login',{method:'POST',body:{password:env.ADMIN_PASSWORD}});assert.equal(response.status,200);
 const cookie=response.headers.get('set-cookie').split(';')[0];
 return {call,cookie,images,published,store,assets,getDraft:()=>draft};
}

test('old drafts receive catalogs without replacing unpublished NEWS or its base SHA',async()=>{
 const f=await fixture();f.getDraft().content.news[0].title='保存中の未公開記事';
 const response=await f.call('/api/content',{cookie:f.cookie});assert.equal(response.status,200);
 const result=await response.json();
 assert.equal(result.content.news[0].title,'保存中の未公開記事');assert.equal(result.content.shapekeys.length,9);assert.equal(result.content.eyeTextures.length,35);assert.equal(result.content.tools.length,4);
 assert.equal(result.content.team.length,3);assert.equal(result.content.team[0].name,'がりゅー');
 assert.equal(result.baseSha,'old-sha');assert.equal(result.revision,0);
 assert.equal(Object.hasOwn(f.getDraft().content,'shapekeys'),false,'reading a legacy draft must not rewrite it');
});

test('TEAM contributions save and preview in groups of five without changing published content',async()=>{
 const f=await fixture();const content=normalizeContent(seed);
 content.team=[{...content.team[0],credits:Array.from({length:11},(_,i)=>`担当作品 ${i+1}`)}];
 const saved=await f.call('/api/content',{method:'PUT',cookie:f.cookie,body:{revision:0,content}});assert.equal(saved.status,200);
 const loaded=await f.call('/api/content',{cookie:f.cookie});assert.deepEqual((await loaded.json()).content.team[0].credits,content.team[0].credits);
 f.assets.template=async()=>readFile('ADDHARD/HTML/index.html','utf8');
 const preview=await f.call('/api/preview?section=team',{method:'POST',cookie:f.cookie,body:{content,archive:false}});assert.equal(preview.status,200);
 const html=await preview.text();const columns=[...html.matchAll(/<ul class="member-credit-column">([\s\S]*?)<\/ul>/g)].map(match=>(match[1].match(/<li>/g)||[]).length);
 assert.match(html,/<body data-preview-section="team">/);
 assert.deepEqual(columns,[5,5,1]);assert.equal(f.getDraft().baseSha,'old-sha');
 assert.equal(Object.hasOwn(seed,'team'),false,'legacy published data must remain untouched by draft edits');
});

test('TEAM-only uploaded images are validated and included in publication',async t=>{
 const f=await fixture();const response=await f.call('/api/images',{method:'POST',cookie:f.cookie,body:png,raw:true,type:'image/png'});const {url}=await response.json();
 const content=normalizeContent(seed);content.team[0].image=url;
 await f.call('/api/content',{method:'PUT',cookie:f.cookie,body:{revision:0,content}});
 t.mock.method(globalThis,'fetch',async(request,options)=>options.method==='GET'?Response.json({sha:'old-sha',content:Buffer.from(JSON.stringify(seed)).toString('base64')}):Response.json({content:{sha:'new-sha'},commit:{sha:'team-commit'}}));
 const published=await f.call('/api/publish',{method:'POST',cookie:f.cookie,body:{revision:1}});assert.equal(published.status,200);assert.deepEqual(f.published,[url.split('/').at(-1)]);
 assert.equal((await f.call(url)).status,200);
});

test('an older editor cannot remove saved catalogs or TEAM by omitting them',async()=>{
 const f=await fixture();const complete=normalizeContent(seed);complete.shapekeys[0].name='新商品の表示名';complete.team[0].credits.push('追加の制作実績');
 let response=await f.call('/api/content',{method:'PUT',cookie:f.cookie,body:{revision:0,content:complete}});assert.equal(response.status,200);
 const legacy=structuredClone(seed);legacy.news[0].title='旧画面からのお知らせ更新';
 response=await f.call('/api/content',{method:'PUT',cookie:f.cookie,body:{revision:1,content:legacy}});assert.equal(response.status,200);
 assert.equal(f.getDraft().content.shapekeys[0].name,'新商品の表示名');assert.equal(f.getDraft().content.news[0].title,legacy.news[0].title);assert.equal(f.getDraft().content.team[0].credits.at(-1),'追加の制作実績');
 const empty=structuredClone(legacy);empty.shapekeys=[];empty.team=[];
 response=await f.call('/api/content',{method:'PUT',cookie:f.cookie,body:{revision:2,content:empty}});assert.equal(response.status,200);assert.deepEqual(f.getDraft().content.shapekeys,[]);assert.deepEqual(f.getDraft().content.team,[]);
});

test('image uploads require login and same Origin, and publish releases only referenced images',async t=>{
 const f=await fixture();
 assert.equal((await f.call('/api/images',{method:'POST',body:png,raw:true,type:'image/png'})).status,401);
 assert.equal((await f.call('/api/images',{method:'POST',cookie:f.cookie,body:png,raw:true,type:'image/png',requestOrigin:'https://other.example'})).status,403);
 const upload=await f.call('/api/images',{method:'POST',cookie:f.cookie,body:png,raw:true,type:'image/png'});assert.equal(upload.status,201);
 const {url}=await upload.json();
 const spare=await f.call('/api/images',{method:'POST',cookie:f.cookie,body:png,raw:true,type:'image/png'});const spareUrl=(await spare.json()).url;
 assert.equal((await f.call(url)).status,404);assert.equal((await f.call(url,{cookie:f.cookie})).status,200);
 const content=normalizeContent(seed);content.shapekeys[0].image=url;
 const save=await f.call('/api/content',{method:'PUT',cookie:f.cookie,body:{revision:0,content}});assert.equal(save.status,200);
 const calls=[];t.mock.method(globalThis,'fetch',async(request,options)=>{calls.push(options.method);return options.method==='GET'?Response.json({sha:'old-sha',content:Buffer.from(JSON.stringify(seed)).toString('base64')}):Response.json({content:{sha:'new-sha'},commit:{sha:'new-commit'}})});
 const publish=await f.call('/api/publish',{method:'POST',cookie:f.cookie,body:{revision:1}});assert.equal(publish.status,200);
 assert.deepEqual(calls,['GET','PUT']);assert.deepEqual(f.published,[url.split('/').at(-1)]);
 const publicImage=await f.call(url);assert.equal(publicImage.status,200);assert.match(publicImage.headers.get('Cache-Control'),/public/);
 assert.equal((await f.call(spareUrl)).status,404,'unused upload remains private');
});

test('a missing uploaded image blocks GitHub publication without making external calls',async t=>{
 const f=await fixture();const content=normalizeContent(seed);content.tools[0].image='/api/images/00000000-0000-0000-0000-000000000000.png';
 await f.call('/api/content',{method:'PUT',cookie:f.cookie,body:{revision:0,content}});
 t.mock.method(globalThis,'fetch',async()=>{assert.fail('missing images must be detected before GitHub communication')});
 const response=await f.call('/api/publish',{method:'POST',cookie:f.cookie,body:{revision:1}});assert.equal(response.status,400);assert.match((await response.json()).error,/画像/);
});

test('failed media flags do not strand deployed images or block a subsequent edited publication',async t=>{
 const f=await fixture();
 const upload=await f.call('/api/images',{method:'POST',cookie:f.cookie,body:png,raw:true,type:'image/png'});const {url}=await upload.json();
 const content=normalizeContent(seed);content.shapekeys[0].image=url;
 await f.call('/api/content',{method:'PUT',cookie:f.cookie,body:{revision:0,content}});
 let remote=structuredClone(seed),sha='old-sha',commits=0;
 f.store.imagesPublish=async()=>{throw new Error('temporary media update failure')};
 t.mock.method(globalThis,'fetch',async(request,options)=>{
  if(options.method==='GET')return Response.json({sha,content:Buffer.from(JSON.stringify(remote)).toString('base64')});
  const body=JSON.parse(options.body);assert.equal(body.sha,sha);remote=JSON.parse(Buffer.from(body.content,'base64'));sha='published-'+(++commits);
  return Response.json({content:{sha},commit:{sha:'commit-'+commits}});
 });
 let response=await f.call('/api/publish',{method:'POST',cookie:f.cookie,body:{revision:1}});assert.equal(response.status,200);assert.equal(f.getDraft().baseSha,'published-1');
 assert.equal((await f.call(url)).status,404,'not yet deployed and unflagged remains private');
 f.assets.data=async()=>remote;
 response=await f.call(url);assert.equal(response.status,200);assert.match(response.headers.get('Cache-Control'),/public/);
 const edited=structuredClone(content);edited.shapekeys[0].name='さらに更新した商品名';
 await f.call('/api/content',{method:'PUT',cookie:f.cookie,body:{revision:1,content:edited}});
 response=await f.call('/api/publish',{method:'POST',cookie:f.cookie,body:{revision:2}});assert.equal(response.status,200);assert.equal(commits,2);assert.equal(f.getDraft().baseSha,'published-2');
});
