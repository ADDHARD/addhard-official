const $ = selector => document.querySelector(selector);
const sections = {
  news: {title:'NEWS', list:'お知らせ', edit:'お知らせを編集'},
  qa: {title:'Q&A', list:'質問', edit:'質問と回答を編集'},
  shapekeys: {title:'ShapeKeys', list:'商品', edit:'ShapeKeysの商品を編集', label:'SHAPEKEY'},
  eyeTextures: {title:'EYE Textures', list:'商品', edit:'EYE Texturesの商品を編集', label:'EYE TEXTURE'},
  tools: {title:'Tools', list:'商品', edit:'Toolsの商品を編集', label:'TOOL'}
};
let content, revision=0, tab='news', selected=0, dirty=false, busy=false, canPublish=false, linkContext;
const isProduct = key => ['shapekeys','eyeTextures','tools'].includes(key);
const status = (message,error=false) => {
  $('#status').textContent=message;
  $('#status').classList.toggle('error',error);
};
function element(tag,text,props={}) {
  const node=document.createElement(tag);
  if(text) node.textContent=text;
  Object.assign(node,props);
  return node;
}
async function responseData(response) {
  let data;
  try {data=await response.json()} catch {throw new Error('通信に失敗しました。時間をおいてもう一度お試しください。')}
  if(!response.ok) {
    const error=new Error(data.error || '処理を完了できませんでした');
    error.status=response.status;
    throw error;
  }
  return data;
}
async function api(path,method='GET',body) {
  return responseData(await fetch('/api/'+path,{
    method, headers:{'Content-Type':'application/json'},
    ...(body ? {body:JSON.stringify(body)} : {})
  }));
}
function state() {
  $('#save-state').textContent=dirty ? '● 未保存の変更があります' : '✓ 下書き保存済み';
  $('#workspace').inert=busy;
  $('nav').inert=busy;
  $('#workspace').setAttribute('aria-busy',String(busy));
  $('#publish').disabled=busy || !canPublish;
  for(const id of ['save','preview','add']) $('#'+id).disabled=busy;
}
async function run(fn) {
  if(busy) return;
  busy=true; state();
  try {await fn()} catch(error) {status(error.message,true)}
  finally {busy=false; state()}
}
function mark() {dirty=true; state()}
function imageSource(value) {
  if(typeof value!=='string' || /[\\\s\u0000-\u001f\u007f]/.test(value)) return '';
  if(/^\/api\/images\/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\.(?:png|jpg|webp)$/.test(value)) return value;
  if(value.startsWith('/IMG/') && !/[%?#<>"']/.test(value) && !value.split('/').slice(1).some(part=>part==='.' || part==='..' || !part)) return value;
  if(!/^https:\/\//i.test(value)) return '';
  try {
    const url=new URL(value);
    return url.protocol==='https:' && !url.username && !url.password ? url.href : '';
  } catch {return ''}
}
function renderList() {
  const list=$('#items'); list.replaceChildren();
  content[tab].forEach((item,index) => {
    const row=element('div','',{className:'item'+(index===selected?' selected':'')});
    const open=element('button','',{type:'button',className:'item-open'});
    open.setAttribute('aria-pressed',String(index===selected));
    if(isProduct(tab)) {
      const thumbnail=element('span','',{className:'list-image'});
      const source=imageSource(item.image);
      if(source) {
        const image=element('img','',{src:source,alt:'',loading:'lazy',width:48,height:48,referrerPolicy:'no-referrer'});
        image.onerror=()=>image.hidden=true;
        thumbnail.append(image);
      }
      open.append(thumbnail);
    }
    const copy=element('span','',{className:'item-copy'});
    copy.append(element('small',tab==='news' ? item.date : tab==='qa' ? `Q${String(index+1).padStart(2,'0')}` : (item.label || sections[tab].title)));
    copy.append(element('span',item.title || item.question || item.name));
    if(isProduct(tab) && !item.visible) copy.append(element('span','非表示',{className:'visibility-badge'}));
    open.append(copy);
    open.onclick=()=>{if(busy)return; selected=index; render()};
    row.append(open);
    const order=element('div','',{className:'order'});
    for(const [label,delta] of [['↑',-1],['↓',1]]) {
      const button=element('button',label,{
        type:'button',disabled:index+delta<0 || index+delta>=content[tab].length,
        title:delta<0?'上へ移動':'下へ移動'
      });
      button.setAttribute('aria-label',`${item.title || item.question || item.name}を${delta<0?'上':'下'}へ移動`);
      button.onclick=()=>{
        if(busy)return;
        [content[tab][index],content[tab][index+delta]]=[content[tab][index+delta],content[tab][index]];
        selected=index+delta; mark(); render();
      };
      order.append(button);
    }
    row.append(order); list.append(row);
  });
}
function imageEditor(item) {
  const block=element('section','',{className:'image-editor'});
  block.append(element('h3','商品画像'));
  const preview=element('div','',{className:'image-preview'});
  const image=element('img','',{alt:'商品画像の確認',referrerPolicy:'no-referrer',hidden:true});
  const message=element('p','画像を選択するか、画像URLを入力してください。',{className:'hint'});
  preview.append(image,message); block.append(preview);
  let refreshTimer;
  const refreshImage=()=>{
    const source=imageSource(item.image);
    image.hidden=true;
    message.hidden=false;
    if(!source) {
      image.removeAttribute('src');
      message.textContent=item.image?'https://から始まる画像URLを入力してください。':'画像を選択するか、画像URLを入力してください。';
      return;
    }
    message.textContent='画像を読み込んでいます…';
    image.onload=()=>{image.hidden=false; message.hidden=true};
    image.onerror=()=>{
      image.hidden=true;
      message.hidden=false;
      message.textContent='画像を読み込めませんでした。URLを確認するか、PCから画像を選び直してください。';
    };
    image.src=source;
  };
  refreshImage();
  const pickerLabel=element('label','PCから画像を選ぶ');
  const picker=element('input','',{type:'file',accept:'image/png,image/jpeg,image/webp'});
  pickerLabel.append(picker); block.append(pickerLabel);
  const urlLabel=element('label','画像URL *');
  const urlInput=element('input','',{type:'text',value:item.image || '',placeholder:'https://…'});
  urlInput.oninput=()=>{
    item.image=urlInput.value; mark(); renderList();
    clearTimeout(refreshTimer); refreshTimer=setTimeout(refreshImage,300);
  };
  urlLabel.append(urlInput); block.append(urlLabel);
  block.append(element('p','PNG・JPEG・WebPを選べます。画像は表示に適したサイズへ自動調整します。',{className:'hint'}));
  picker.onchange=()=>{
    const file=picker.files?.[0];
    if(!file) return;
    const itemTab=tab;
    run(async()=>{
      status('画像を調整してアップロードしています…');
      const blob=await compressImage(file);
      const result=await responseData(await fetch('/api/images',{
        method:'POST',headers:{'Content-Type':blob.type},body:blob
      }));
      if(!imageSource(result.url)) throw new Error('画像の保存先を確認できませんでした。もう一度お試しください。');
      if(!content[itemTab].includes(item)) throw new Error('商品が変更されました。編集画面を開き直してください。');
      item.image=result.url;
      if(!item.alt.trim()) item.alt=item.name.replace(/\n/g,' ');
      mark(); render();
      status('画像を設定しました。「下書き保存」で保存できます。');
    }).finally(()=>{picker.value=''});
  };
  return block;
}
async function compressImage(file) {
  if(!['image/png','image/jpeg','image/webp'].includes(file.type)) throw new Error('PNG・JPEG・WebPの画像を選んでください。');
  if(file.size>20*1024*1024) throw new Error('20MB以下の画像を選んでください。');
  let bitmap;
  try {bitmap=await createImageBitmap(file)} catch {throw new Error('画像を読み込めませんでした。別の画像を選んでください。')}
  try {
    if(!bitmap.width || !bitmap.height) throw new Error('画像のサイズを確認できませんでした。');
    const canvas=document.createElement('canvas');
    const context=canvas.getContext('2d');
    if(!context) throw new Error('このブラウザーで画像を調整できませんでした。');
    let maxEdge=1600;
    for(let resize=0;resize<5;resize++) {
      const scale=Math.min(1,maxEdge/Math.max(bitmap.width,bitmap.height));
      canvas.width=Math.max(1,Math.round(bitmap.width*scale));
      canvas.height=Math.max(1,Math.round(bitmap.height*scale));
      context.drawImage(bitmap,0,0,canvas.width,canvas.height);
      for(const quality of [.88,.74,.6,.46]) {
        const blob=await new Promise(resolve=>canvas.toBlob(resolve,'image/webp',quality));
        if(!blob || blob.type!=='image/webp') throw new Error('画像の変換に失敗しました。別のブラウザーでお試しください。');
        if(blob.size<=750000) return blob;
      }
      maxEdge=Math.round(maxEdge*.7);
    }
    throw new Error('画像を小さくできませんでした。サイズの小さい画像を選んでください。');
  } finally {bitmap.close()}
}
function addAnswerLinkButton(form,input,item) {
  const insert=element('button','リンクを挿入',{type:'button',className:'insert-link'});
  insert.onclick=()=>{
    const start=input.selectionStart, end=input.selectionEnd;
    linkContext={input,item,start,end};
    $('#link-text').value=input.value.slice(start,end);
    $('#link-url').value='';
    $('#link-error').textContent='';
    $('#link-dialog').showModal();
    (start===end?$('#link-text'):$('#link-url')).focus();
  };
  form.append(insert,element('p','回答内の文字を選択して「リンクを挿入」を押すと、その文字からページを開けるようにできます。',{className:'hint'}));
}
function render() {
  for(const button of document.querySelectorAll('[data-tab]')) {
    const active=button.dataset.tab===tab;
    button.classList.toggle('active',active);
    button.setAttribute('aria-pressed',String(active));
  }
  $('#section-title').textContent=sections[tab].title;
  $('#list-title').textContent=`${sections[tab].list}一覧（${content[tab].length}件）`;
  renderList();
  const form=$('#edit-form'); form.replaceChildren();
  const item=content[tab][selected];
  if(!item) {form.append(element('p','「＋ 追加」からコンテンツを登録できます。')); return}
  form.append(element('small','EDIT CONTENT'),element('h2',sections[tab].edit));
  if(isProduct(tab)) {
    const visibleLabel=element('label','',{className:'visibility-control'});
    const checkbox=element('input','',{type:'checkbox',checked:item.visible});
    checkbox.onchange=()=>{item.visible=checkbox.checked; mark(); renderList()};
    visibleLabel.append(checkbox,element('span','公式サイトに表示する'));
    form.append(visibleLabel,element('p','表示・非表示の変更は「更新して公開」したときに反映されます。',{className:'hint'}));
  }
  const fields=tab==='news'
    ? [['date','日付','date'],['title','タイトル *','text'],['body','本文','textarea'],['url','リンク先（https://… または #qa）','text'],['linkLabel','リンクの表示名','text']]
    : tab==='qa'
      ? [['question','質問 *','text'],['answer','回答 *','textarea']]
      : [['name','商品名 *（改行できます）','short-textarea'],['label','カテゴリの表示名','text'],['description','説明文','textarea'],['url','商品ページのURL *','url'],['alt','画像の説明（読み上げ用）','text']];
  for(const [key,label,type] of fields) {
    const wrap=element('label',label);
    const input=element(type.includes('textarea')?'textarea':'input','',{value:item[key] || ''});
    if(!type.includes('textarea')) input.type=type;
    if(type==='short-textarea') {input.className='short-textarea'; input.rows=2}
    input.oninput=()=>{item[key]=input.value; mark(); renderList()};
    wrap.append(input); form.append(wrap);
    if(tab==='qa' && key==='answer') addAnswerLinkButton(form,input,item);
  }
  if(isProduct(tab)) form.append(imageEditor(item));
  form.append(element('p','* は必須項目です。改行はそのまま反映されます。HTMLタグは文字として表示されます。',{className:'hint'}));
  const remove=element('button','この項目を削除',{type:'button',className:'delete'});
  remove.onclick=()=>{
    if(busy)return;
    if(confirm('この項目を下書きから削除しますか？')) {
      content[tab].splice(selected,1); selected=Math.max(0,selected-1); mark(); render();
    }
  };
  form.append(remove);
}
function showContent(data) {
  content=data.content; revision=data.revision; canPublish=data.canPublish; dirty=false;
  $('#login').hidden=true; $('#workspace').hidden=false;
  render(); state();
  status(canPublish?'下書きを読み込みました':'GitHub接続後に公開できます。');
}
$('#login').onsubmit=async event=>{
  event.preventDefault();
  if(busy)return;
  const submit=$('#login button'); submit.disabled=true;
  try {
    await api('login','POST',{password:$('#password').value});
    $('#password').value=''; showContent(await api('content'));
  } catch(error) {status(error.message,true)}
  finally {submit.disabled=false}
};
for(const button of document.querySelectorAll('[data-tab]')) button.onclick=()=>{
  if(!content || busy)return;
  tab=button.dataset.tab; selected=0; render();
};
$('#add').onclick=()=>{
  if(busy)return;
  const id=crypto.randomUUID();
  const item=tab==='news'
    ? {id,date:new Intl.DateTimeFormat('sv-SE',{timeZone:'Asia/Tokyo'}).format(new Date()),title:'新しいお知らせ',body:'',url:'',linkLabel:'詳しく見る'}
    : tab==='qa'
      ? {id,question:'新しい質問',answer:''}
      : {id,name:'新しい商品',label:sections[tab].label,description:'',url:'',image:'',alt:'',visible:true};
  content[tab].unshift(item); selected=0; mark(); render();
  (isProduct(tab) ? $('#edit-form .short-textarea') : tab==='news' ? $('#edit-form input[type=text]') : $('#edit-form input'))?.focus();
};
async function save() {
  const snapshot=structuredClone(content);
  const result=await api('content','PUT',{content:snapshot,revision});
  revision=result.revision; dirty=JSON.stringify(snapshot)!==JSON.stringify(content);
  status('下書きを保存しました。公式サイトはまだ更新されていません');
}
$('#save').onclick=()=>run(save);
async function preview(archive=false) {
  const form=$('#preview-request');
  form.elements.namedItem('content').value=JSON.stringify(content);
  form.elements.namedItem('archive').value=String(archive);
  if(!$('#preview-dialog').open) $('#preview-dialog').showModal();
  form.submit();
}
$('#preview-dialog iframe').addEventListener('load',()=>{
  const frameDocument=$('#preview-dialog iframe').contentDocument;
  if(frameDocument?.contentType==='application/json') {
    try {status(JSON.parse(frameDocument.body.textContent).error,true); $('#preview-dialog').close()}
    catch {status('プレビューを読み込めませんでした',true)}
  }
});
$('#preview').onclick=()=>run(()=>preview(tab==='news'));
$('#preview-home').onclick=()=>run(()=>preview(false));
$('#preview-news').onclick=()=>run(()=>preview(true));
$('#close-preview').onclick=()=>$('#preview-dialog').close();
$('#publish').onclick=()=>run(async()=>{await save(); if(!dirty)$('#publish-dialog').showModal()});
$('#cancel-publish').onclick=()=>$('#publish-dialog').close();
$('#confirm-publish').onclick=()=>{
  $('#publish-dialog').close();
  run(async()=>{const result=await api('publish','POST',{revision}); status(result.message)});
};
$('#logout').onclick=()=>run(async()=>{
  if(dirty && !confirm('未保存の変更があります。ログアウトしますか？'))return;
  await api('logout','POST'); dirty=false; location.reload();
});
$('#link-form').onsubmit=event=>{
  event.preventDefault();
  const label=$('#link-text').value.trim(), value=$('#link-url').value.trim();
  let url;
  try {url=new URL(value)} catch {$('#link-error').textContent='https://から始まるリンク先を入力してください。'; return}
  if(!['https:','http:'].includes(url.protocol) || url.username || url.password) {$('#link-error').textContent='http://またはhttps://から始まるリンク先を入力してください。'; return}
  if(!label || /[\[\]\r\n]/.test(label)) {$('#link-error').textContent='表示する文字を入力してください。[ ]や改行は使えません。'; return}
  if(!linkContext)return;
  const {input,item,start,end}=linkContext;
  const target=url.href.replaceAll('(','%28').replaceAll(')','%29');
  input.setRangeText(`[${label}](${target})`,start,end,'end');
  item.answer=input.value; mark();
  $('#link-dialog').close(); input.focus(); linkContext=null;
};
$('#cancel-link').onclick=()=>$('#link-dialog').close();
$('#link-dialog').addEventListener('close',()=>{if(linkContext){linkContext.input.focus();linkContext=null}});
addEventListener('beforeunload',event=>{if(dirty){event.preventDefault();event.returnValue=''}});
api('content').then(showContent).catch(error=>{if(error.status!==401)status(error.message,true)});
