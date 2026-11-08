import {validate,renderPage,normalizeContent} from './content.js';
import {serveImage,uploadImage,referencedImageIds,assertImagesExist} from './media.js';
const encoder=new TextEncoder();
const json=(value,status=200,headers={})=>new Response(JSON.stringify(value),{status,headers:{'Content-Type':'application/json; charset=utf-8','Cache-Control':'no-store',...headers}});
async function digest(v){return [...new Uint8Array(await crypto.subtle.digest('SHA-256',encoder.encode(v)))].map(x=>x.toString(16).padStart(2,'0')).join('')}
async function signature(value,secret){const key=await crypto.subtle.importKey('raw',encoder.encode(secret),{name:'HMAC',hash:'SHA-256'},false,['sign']);return [...new Uint8Array(await crypto.subtle.sign('HMAC',key,encoder.encode(value)))].map(x=>x.toString(16).padStart(2,'0')).join('')}
async function authenticated(request,env){const token=(request.headers.get('cookie')||'').match(/(?:^|;\s*)addhard_session=([^;]+)/)?.[1];if(!token)return false;const [expires,sig]=token.split('.');return Number(expires)>Date.now() && sig===await signature(expires,env.SESSION_SECRET)}
async function github(env,method='GET',body){
 if(!env.GITHUB_TOKEN) throw new Error('GitHub接続が未設定です');
 const branch=env.GITHUB_BRANCH||'main';
 const response=await fetch(`https://api.github.com/repos/ADDHARD/addhard-official/contents/data/content.json${method==='GET'?'?ref='+encodeURIComponent(branch):''}`,{method,headers:{Authorization:`Bearer ${env.GITHUB_TOKEN}`,Accept:'application/vnd.github+json','User-Agent':'ADDHARD-admin','Content-Type':'application/json'},...(body?{body:JSON.stringify({...body,branch})}:{})});
 if(!response.ok) {if(response.status===409||response.status===422) throw new Error('公開データが変更されています。再読み込みして確認してください'); throw new Error(`GitHubとの通信に失敗しました (${response.status})`)}
 return response.json();
}
function decodeContent(value){return JSON.parse(new TextDecoder().decode(Uint8Array.from(atob(value.replace(/\s/g,'')),c=>c.charCodeAt(0))))}
export async function handleApi(request,env,store,assets){
 const path=new URL(request.url).pathname;
 try {
  if(path.startsWith('/api/images/') && ['GET','HEAD'].includes(request.method)) {
   const authorized=Boolean(env.SESSION_SECRET) && await authenticated(request,env);
   // The deployed, publicly readable JSON remains the authority even when a
   // previous best-effort media flag update failed after the GitHub commit.
   const publishedIds=!authorized && assets.data?referencedImageIds(await assets.data()):[];
   return await serveImage(request,store,authorized,publishedIds);
  }
  if(!env.ADMIN_PASSWORD) return json({error:'ADMIN_PASSWORDが未設定です。Cloudflareの「変数と秘密」に登録してください'},503);
  if(!env.SESSION_SECRET) return json({error:'SESSION_SECRETが未設定です。Cloudflareの「変数と秘密」に登録してください'},503);
  if(env.SESSION_SECRET.length<32) return json({error:'SESSION_SECRETは32文字以上必要です。Cloudflareの「変数と秘密」で値を更新してください'},503);
  if(request.method!=='GET' && request.headers.get('origin')!==new URL(request.url).origin) return json({error:'不正なリクエストです'},403);
  if(Number(request.headers.get('content-length')||0)>1000000) return json({error:'入力が大きすぎます'},413);
  if(path==='/api/login' && request.method==='POST') {
   const ip=request.headers.get('CF-Connecting-IP')||'local';
   if(!await store.attempt(ip))return json({error:'時間をおいて再試行してください'},429);
   const {password}=await request.json();
   if(typeof password!=='string'||await digest(password)!==await digest(env.ADMIN_PASSWORD))return json({error:'パスワードが違います'},401);
   const expires=String(Date.now()+8*60*60*1000), token=expires+'.'+await signature(expires,env.SESSION_SECRET);
   return json({ok:true},200,{'Set-Cookie':`addhard_session=${token}; HttpOnly; SameSite=Strict; Path=/api; Max-Age=28800${new URL(request.url).protocol==='https:'?'; Secure':''}`});
  }
  if(!await authenticated(request,env))return json({error:'ログインしてください'},401);
  if(path==='/api/images' && request.method==='POST') return await uploadImage(request,store);
  if(path==='/api/logout' && request.method==='POST')return json({ok:true},200,{'Set-Cookie':'addhard_session=; HttpOnly; SameSite=Strict; Path=/api; Max-Age=0'});
  if(path==='/api/content' && request.method==='GET') {
   let draft=await store.get();
   if(!draft){const published=env.GITHUB_TOKEN?await github(env):null;const data=published?decodeContent(published.content):await assets.data();await store.init({revision:0,content:validate(data),baseSha:published?.sha||null});draft=await store.get()}
   return json({...draft,content:normalizeContent(draft.content),canPublish:Boolean(env.GITHUB_TOKEN)});
  }
  if(path==='/api/content' && request.method==='PUT') {
   const body=await request.json();validate(body.content);
   if(!Number.isInteger(body.revision))return json({error:'リビジョンが必要です'},400);
   // A cached version of the previous editor only knows NEWS and Q&A. Retain
   // newer catalog collections unless the editor explicitly supplies them.
   const current=await store.get();
   for(const key of ['shapekeys','eyeTextures','tools','team']) {
    if(!Object.hasOwn(body.content,key) && Object.hasOwn(current?.content||{},key))body.content[key]=current.content[key];
   }
   const saved=await store.save(body.revision,body.content);
   return saved?json(saved):json({error:'他の画面で下書きが更新されました。再読み込みしてください'},409);
  }
  if(path==='/api/preview' && request.method==='POST') {
   let content,archive;
   if((request.headers.get('content-type')||'').startsWith('application/x-www-form-urlencoded')) {
    const form=await request.formData();content=JSON.parse(form.get('content'));archive=form.get('archive')==='true';
   }else ({content,archive}=await request.json());
   validate(content);
   let html=renderPage(await assets.template(Boolean(archive)),content,Boolean(archive),'/HTML/index.html');
   if(!archive && new URL(request.url).searchParams.get('section')==='team')html=html.replace('<body>','<body data-preview-section="team">');
   const base=archive?'/':'/HTML/';
   return new Response(html.replace('<head>',`<head><base href="${base}">`).replace('</head>','<link rel="stylesheet" href="/admin/preview.css"></head>').replaceAll('renderNewsArchivePage();',''),{headers:{'Content-Type':'text/html; charset=utf-8','Cache-Control':'no-store','X-Robots-Tag':'noindex, nofollow','Content-Security-Policy':"default-src 'self'; script-src 'none'; style-src 'self' https://fonts.googleapis.com; font-src 'self' https://fonts.gstatic.com; img-src 'self' https:; media-src 'self' https://video.twimg.com; object-src 'none'; base-uri 'self'; form-action 'none'; frame-ancestors 'self'"}});
  }
  if(path==='/api/publish' && request.method==='POST') {
   const body=await request.json(), draft=await store.get();
   if(!draft||draft.revision!==body.revision)return json({error:'先に最新の下書きを保存してください'},409);
   validate(draft.content);
   await assertImagesExist(draft.content,store);
   const imageIds=referencedImageIds(draft.content);
   const current=await github(env);
   const serialized=JSON.stringify(draft.content,null,2)+'\n';
   if(JSON.stringify(decodeContent(current.content))===JSON.stringify(draft.content)){
    await store.published(draft.baseSha,current.sha);
    try{if(imageIds.length)await store.imagesPublish(imageIds)}catch{/* Deployed JSON authorizes public media after the build. */}
    return json({ok:true,message:'この内容はGitHubへ送信済みです。公開サイトで反映を確認してください'});
   }
   if(draft.baseSha && current.sha!==draft.baseSha)return json({error:'GitHub上の公開データが変わっています。管理者による差分確認が必要です'},409);
   const bytes=encoder.encode(serialized);let binary='';for(const byte of bytes)binary+=String.fromCharCode(byte);
   const result=await github(env,'PUT',{message:'content: publish website content',content:btoa(binary),sha:current.sha});
   try{await store.published(draft.baseSha,result.content.sha)}catch{
    return json({ok:true,commit:result.commit.sha,message:'GitHubへ更新を送信しました。下書きとの同期に失敗したため、内容を変更せず「更新して公開」をもう一度実行してください。公開サイトにはビルド後に反映されます'});
   }
   try{if(imageIds.length)await store.imagesPublish(imageIds)}catch{/* Deployed JSON authorizes public media after the build. */}
   return json({ok:true,commit:result.commit.sha,message:'GitHubへ更新を送信しました。Cloudflare Pagesのビルド後に反映されます'});
  }
  return json({error:'見つかりません'},404);
 }catch(error){return json({error:error instanceof SyntaxError?'入力形式が正しくありません':error.message},400)}
}
