import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {handleApi} from '../lib/api.js';

const seed=JSON.parse(await readFile(new URL('./fixtures/legacy-content.json',import.meta.url)));
const origin='https://admin.example';
const endpoint='https://api.github.com/repos/ADDHARD/addhard-official/contents/data/content.json';
const encode=data=>Buffer.from(JSON.stringify(data,null,2)+'\n','utf8').toString('base64');

async function fixture(){
 const env={ADMIN_PASSWORD:'test-only-password',SESSION_SECRET:'test-only-session-secret-'.repeat(2),GITHUB_TOKEN:'test-only-github-token',GITHUB_BRANCH:'release/content-admin'};
 const content=structuredClone(seed);
 content.news[0].title='新しいお知らせ 😀 café';
 content.news[0].body='日本語の本文\n２行目と絵文字 🎉';
 let draft={revision:7,content,baseSha:'previous-file-sha'};
 const published=[];
 const store={
  attempt:async()=>true,
  get:async()=>structuredClone(draft),
  published:async(oldSha,newSha)=>{
   published.push({oldSha,newSha});
   if(draft.baseSha===oldSha)draft={...draft,baseSha:newSha};
  }
 };
 const call=(path,body,cookie)=>handleApi(new Request(origin+'/api/'+path,{method:'POST',headers:{origin,'Content-Type':'application/json',...(cookie?{cookie}:{})},body:JSON.stringify(body)}),env,store,{});
 const login=await call('login',{password:env.ADMIN_PASSWORD});
 assert.equal(login.status,200);
 const cookie=login.headers.get('set-cookie').split(';')[0];
 return{env,content,published,getDraft:()=>draft,call,cookie};
}

test('authorized publish writes only the selected branch content JSON with SHA and Unicode data',async t=>{
 const f=await fixture();
 const calls=[];
 t.mock.method(globalThis,'fetch',async(url,options)=>{
  calls.push({url:String(url),options});
  if(options.method==='GET')return Response.json({sha:'previous-file-sha',content:encode(seed)});
  assert.equal(options.method,'PUT');
  return Response.json({content:{sha:'next-file-sha'},commit:{sha:'new-commit-sha'}});
 });
 const unauthenticated=await f.call('publish',{revision:7});
 assert.equal(unauthenticated.status,401);
 assert.equal(calls.length,0,'authentication must precede any GitHub request');
 const response=await f.call('publish',{revision:7},f.cookie);
 assert.equal(response.status,200);
 const result=await response.json();
 assert.equal(result.commit,'new-commit-sha');
 assert.equal(calls.length,2);
 const [get,put]=calls;
 assert.equal(get.url,endpoint+'?ref=release%2Fcontent-admin');
 assert.equal(put.url,endpoint);
 assert.equal(put.options.headers.Authorization,'Bearer '+f.env.GITHUB_TOKEN);
 const body=JSON.parse(put.options.body);
 assert.equal(body.branch,'release/content-admin');
 assert.equal(body.sha,'previous-file-sha');
 assert.equal(Buffer.from(body.content,'base64').toString('utf8'),JSON.stringify(f.content,null,2)+'\n');
 assert.deepEqual(JSON.parse(Buffer.from(body.content,'base64').toString('utf8')),f.content);
 assert.deepEqual(f.published,[{oldSha:'previous-file-sha',newSha:'next-file-sha'}]);
 assert.equal(f.getDraft().baseSha,'next-file-sha');
 assert.ok(!JSON.stringify(result).includes(f.env.GITHUB_TOKEN));
});

test('a changed remote SHA rejects publication without writing or advancing the draft base',async t=>{
 const f=await fixture();
 const remote=structuredClone(seed);remote.news[0].title='外部から編集したお知らせ';
 const calls=[];
 t.mock.method(globalThis,'fetch',async(url,options)=>{
  calls.push({url:String(url),method:options.method});
  assert.equal(options.method,'GET','conflict must prevent a GitHub write');
  return Response.json({sha:'external-file-sha',content:encode(remote)});
 });
 const response=await f.call('publish',{revision:7},f.cookie);
 assert.equal(response.status,409);
 assert.match((await response.json()).error,/GitHub上の公開データが変わっています/);
 assert.deepEqual(calls,[{url:endpoint+'?ref=release%2Fcontent-admin',method:'GET'}]);
 assert.deepEqual(f.published,[]);
 assert.equal(f.getDraft().baseSha,'previous-file-sha');
});

test('retrying already-published identical Unicode content repairs base SHA without another PUT',async t=>{
 const f=await fixture();
 const calls=[];
 t.mock.method(globalThis,'fetch',async(url,options)=>{
  calls.push({url:String(url),method:options.method});
  assert.equal(options.method,'GET','an identical retry must not create another commit');
  // GitHub may wrap the Base64 body over multiple lines.
  return Response.json({sha:'already-published-sha',content:encode(f.content).match(/.{1,60}/g).join('\n')+'\n'});
 });
 const response=await f.call('publish',{revision:7},f.cookie);
 assert.equal(response.status,200);
 const result=await response.json();
 assert.equal(result.ok,true);
 assert.match(result.message,/送信済み/);
 assert.deepEqual(f.published,[{oldSha:'previous-file-sha',newSha:'already-published-sha'}]);
 assert.equal(f.getDraft().baseSha,'already-published-sha');
 assert.equal(calls.length,1);
 assert.equal(calls[0].method,'GET');
});
