import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile,access} from 'node:fs/promises';
import {execFileSync} from 'node:child_process';
import {DatabaseSync} from 'node:sqlite';
import {onRequest} from '../functions/api/[[path]].js';
import {handleApi} from '../lib/api.js';

const data=JSON.parse(await readFile(new URL('../data/content.json',import.meta.url)));
const origin='https://admin.example';
const settings={ADMIN_PASSWORD:'regression-test-password',SESSION_SECRET:'a'.repeat(40)};

test('all public archive routes contain full generated HTML and resolvable assets',async()=>{
 execFileSync(process.execPath,['scripts/build.mjs']);
 for(const path of ['news.html','HTML/news.html','CSS/news.html','CSS/news']){
  const html=await readFile(`dist/${path}`,'utf8');
  assert.equal([...html.matchAll(/class="archive-item"/g)].length,data.news.length,path);
  assert.match(html,/class="menu-button"/,`${path} has a usable header`);
  assert.doesNotMatch(html,/<noscript>/,`${path} must not retain the old JS-only placeholder`);
  for(const attribute of [...html.matchAll(/(?:href|src)="([^"]+)"/g)]){
   const href=attribute[1];
   if(!href.startsWith('./')&&!href.startsWith('../'))continue;
   const url=new URL(href,`https://site.example/${path}`);
   await access('dist'+url.pathname);
  }
 }
 const main=await readFile('dist/JS/main.js','utf8');
 assert.doesNotMatch(main,/^renderNewsArchivePage\(\);/m);
 const headers=await readFile('dist/_headers','utf8');
 assert.match(headers,/\/CSS\/news\n  Content-Type: text\/html/);
});

test('D1 save returns its own revision even if another save occurs before response',async()=>{
 const db=new DatabaseSync(':memory:');
 try{
  db.exec(await readFile('schema.sql','utf8'));
  db.prepare('INSERT INTO drafts VALUES (1,0,?,?,?)').run(JSON.stringify(data),'initial','base');
  let injectOtherSave=false;
  const other=structuredClone(data);other.news[0].title='Other editor';
  const afterUpdate=sql=>{
   if(injectOtherSave && sql.startsWith('UPDATE drafts SET revision=')){
    injectOtherSave=false;
    db.prepare('UPDATE drafts SET revision=revision+1,content=? WHERE id=1').run(JSON.stringify(other));
   }
  };
  const env={...settings,DB:{prepare(sql){return{async first(){return db.prepare(sql).get()??null},bind(...args){return{
   async first(){const row=db.prepare(sql).get(...args);afterUpdate(sql);return row??null},
   async run(){const result=db.prepare(sql).run(...args);afterUpdate(sql);return{meta:{changes:Number(result.changes)}}}
  }}}}}};
  const call=(path,method='GET',body,cookie)=>onRequest({request:new Request(origin+'/api/'+path,{method,headers:{origin,'Content-Type':'application/json',...(cookie?{cookie}:{})},...(body?{body:JSON.stringify(body)}:{})}),env});
  const login=await call('login','POST',{password:settings.ADMIN_PASSWORD});
  assert.equal(login.status,200);
  const cookie=login.headers.get('set-cookie').split(';')[0];
  injectOtherSave=true;
  const response=await call('content','PUT',{revision:0,content:data},cookie);
  const saved=await response.json();
  assert.equal(response.status,200);
  assert.equal(saved.revision,1,'response must identify this save, not a later SELECT');
  assert.deepEqual(saved.content,data);
  assert.equal(db.prepare('SELECT revision FROM drafts').get().revision,2);
  const stale=await call('content','PUT',{revision:saved.revision,content:data},cookie);
  assert.equal(stale.status,409,'the intervening editor must remain protected');
 }finally{db.close()}
});

test('preview form navigation has independent asset CSP and correct template bases',async()=>{
 const store={attempt:async()=>true};
 const login=await handleApi(new Request(origin+'/api/login',{method:'POST',headers:{origin,'Content-Type':'application/json'},body:JSON.stringify({password:settings.ADMIN_PASSWORD})}),settings,store,{});
 const cookie=login.headers.get('set-cookie').split(';')[0];
 const assets={template:async archive=>readFile(archive?'news.html':'ADDHARD/HTML/index.html','utf8')};
 for(const archive of [false,true]){
  const response=await handleApi(new Request(origin+'/api/preview',{method:'POST',headers:{origin,cookie,'Content-Type':'application/x-www-form-urlencoded'},body:new URLSearchParams({content:JSON.stringify(data),archive:String(archive)})}),settings,store,assets);
  assert.equal(response.status,200);
  const html=await response.text();
  const base=html.match(/<base href="([^"]+)">/)[1];
  const css=html.match(/<link rel="stylesheet" href="([^"]+)"/)[1];
  assert.equal(new URL(css,new URL(base,origin)).pathname,'/CSS/style.css');
  const policy=response.headers.get('Content-Security-Policy');
  assert.match(policy,/script-src 'none'/);
  assert.match(policy,/style-src 'self' https:\/\/fonts.googleapis.com/);
  assert.match(policy,/font-src 'self' https:\/\/fonts.gstatic.com/);
  assert.match(policy,/img-src 'self' https:/);
  assert.match(policy,/media-src 'self' https:\/\/video.twimg.com/);
 }
 const app=await readFile('admin/app.js','utf8');
 assert.doesNotMatch(app,/\.srcdoc\s*=/,'preview response CSP must survive navigation');
 const html=await readFile('admin/index.html','utf8');
 assert.match(html,/action="\/api\/preview" method="post" target="site-preview"/);
 assert.match(html,/<iframe name="site-preview"[^>]*sandbox="allow-same-origin"/);
});
