import {catalogDefaults} from './catalog-defaults.js';
import {teamDefaults} from './team-defaults.js';

export const catalogKeys = ['shapekeys','eyeTextures','tools'];
export const escapeHtml = v => String(v ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));

export function normalizeContent(data) {
  if(!data || typeof data !== 'object' || Array.isArray(data)) throw new Error('データ形式が正しくありません');
  const normalized=structuredClone(data);
  for(const kind of catalogKeys) {
    if(!Object.hasOwn(normalized,kind)) normalized[kind]=structuredClone(catalogDefaults[kind]);
  }
  if(!Object.hasOwn(normalized,'team')) normalized.team=structuredClone(teamDefaults);
  if(Array.isArray(normalized.qa)) for(const item of normalized.qa) {
    if(typeof item?.answer==='string') item.answer=normalizeLegacyAnswer(item.answer);
  }
  return normalized;
}

function normalizeLegacyAnswer(value) {
  return value.replace('hashedits様のFT（https://hashedits.booth.pm/）','[hashedits様のFT](https://hashedits.booth.pm/)');
}

function validHttps(value) {
  if(typeof value!=='string' || !/^https:\/\//i.test(value) || /[\s\\\u0000-\u001f\u007f]/.test(value)) return false;
  try {const url=new URL(value);return url.protocol==='https:' && !url.username && !url.password;}catch{return false;}
}

export function validImage(value) {
  if(validHttps(value)) return true;
  if(typeof value!=='string') return false;
  if(/^\/api\/images\/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\.(?:png|jpg|webp)$/.test(value)) return true;
  // Local assets are rooted under IMG; reject traversal and URL escape tricks.
  if(!value.startsWith('/IMG/') || /[\\%?#\s<>"'\u0000-\u001f\u007f]/.test(value)) return false;
  return value.length>5 && !value.split('/').slice(1).some(part=>part==='.' || part==='..' || part==='');
}
export function validLink(value) {
  return typeof value === 'string' && (value === '' || /^#[\w-]+$/.test(value) || /^https?:\/\//i.test(value) && (()=>{try{return !new URL(value).username && !new URL(value).password}catch{return false}})());
}
export function validate(data) {
  if (!data || data.version !== 1 || !Array.isArray(data.news) || !Array.isArray(data.qa)) throw new Error('データ形式が正しくありません');
  for (const kind of ['news','qa']) {
    if(data[kind].length > 500) throw new Error('登録上限は500件です');
    const ids = new Set();
    for(const item of data[kind]) {
      if(!item || typeof item.id !== 'string' || !item.id || ids.has(item.id)) throw new Error('IDが重複しています');
      ids.add(item.id);
      for(const key of kind === 'news' ? ['title','body','date','url','linkLabel'] : ['question','answer']) {
        if(typeof item[key] !== 'string' || item[key].length > 20000) throw new Error('入力内容を確認してください');
      }
      if(!(kind === 'news' ? item.title.trim() : item.question.trim() && item.answer.trim())) throw new Error('必須項目を入力してください');
      if(kind === 'news' && (!/^\d{4}-\d{2}-\d{2}$/.test(item.date) || !Number.isFinite(Date.parse(item.date)) || new Date(item.date).toISOString().slice(0,10)!==item.date || !validLink(item.url))) throw new Error('日付またはリンクが正しくありません');
    }
  }
  for(const kind of catalogKeys) {
    if(!Object.hasOwn(data,kind)) continue;
    if(!Array.isArray(data[kind]) || data[kind].length>500) throw new Error('商品のデータ形式が正しくありません（各カテゴリ500件まで）');
    const ids=new Set();
    for(const item of data[kind]) {
      if(!item || typeof item.id!=='string' || !item.id || item.id.length>128 || ids.has(item.id)) throw new Error('商品のIDが不正または重複しています');
      ids.add(item.id);
      for(const [key,limit] of Object.entries({name:1000,label:100,url:2048,image:4096,alt:1000,description:5000})) {
        if(typeof item[key]!=='string' || item[key].length>limit) throw new Error('商品名・画像・リンクなどの入力内容を確認してください');
      }
      if(!item.name.trim() || !item.image.trim() || !item.url.trim()) throw new Error('商品名・画像・商品リンクを入力してください');
      if(typeof item.visible!=='boolean') throw new Error('商品の表示設定が正しくありません');
      if(!validHttps(item.url)) throw new Error('商品リンクはhttps://で始まるURLを入力してください');
      if(!validImage(item.image)) throw new Error('商品画像はhttps://の画像URL、アップロード画像、または/IMG/から始まるパスを指定してください');
    }
  }
  if(Object.hasOwn(data,'team')) {
    if(!Array.isArray(data.team) || data.team.length>100) throw new Error('TEAMのデータ形式が正しくありません（100人まで）');
    const ids=new Set();
    for(const member of data.team) {
      if(!member || typeof member.id!=='string' || !/^[A-Za-z0-9_-]{1,128}$/.test(member.id) || ids.has(member.id)) throw new Error('TEAMのIDが不正または重複しています');
      ids.add(member.id);
      for(const [key,limit] of Object.entries({name:200,role:100,initial:10,image:4096,alt:1000,socialUrl:2048,socialLabel:200,creditLabel:200})) {
        if(typeof member[key]!=='string' || member[key].length>limit) throw new Error('TEAMのプロフィール情報を確認してください');
      }
      if(!member.name.trim() || !member.role.trim() || !member.initial.trim() || typeof member.visible!=='boolean') throw new Error('TEAMの名前・役割・表示設定を確認してください');
      if(member.image && !validImage(member.image)) throw new Error('TEAM画像のURLが正しくありません');
      if(member.socialUrl && !validHttps(member.socialUrl)) throw new Error('TEAMのリンクはhttps://で始まるURLを入力してください');
      if(!Array.isArray(member.credits) || member.credits.length>500 || member.credits.some(credit=>typeof credit!=='string' || !credit.trim() || credit.length>200)) throw new Error('担当作品は1件200文字以内、500件までで入力してください');
    }
  }
  return data;
}
const text = v => escapeHtml(v).replace(/\n/g,'<br>');
const link = (n,home) => n.url.startsWith('#') ? home+n.url : n.url;
export function newsHtml(data, archive=false, home='') {
 return data.news.slice(0,archive ? 500 : 4).map(n=> archive
  ? `<article class="archive-item"><time datetime="${escapeHtml(n.date)}">${escapeHtml(n.date.replaceAll('-','.'))}</time><div><h2>${escapeHtml(n.title)}</h2><p>${text(n.body)}</p>${n.url ? `<a href="${escapeHtml(link(n,home))}" rel="noopener noreferrer">${escapeHtml(n.linkLabel || '詳しく見る')} <span>↗</span></a>`:''}</div></article>`
  : `<a href="${escapeHtml(n.url || '#news')}" rel="noopener noreferrer"><time datetime="${escapeHtml(n.date)}">${escapeHtml(n.date.replaceAll('-','.'))}</time><p>${escapeHtml(n.title)}</p><span>↗</span></a>`).join('\n');
}
export function qaHtml(data) {
 return data.qa.map((q,i)=>`<details${i===0?' open':''}><summary><span>Q${String(i+1).padStart(2,'0')}</span>${escapeHtml(q.question)}</summary><p>${answerHtml(q.answer)}</p></details>`).join('\n');
}
export function answerHtml(value) {
 const source=normalizeLegacyAnswer(value);
 const tokens=/\[([^\]\n]{1,1000})\]\((https?:\/\/[^\s)]+)\)|\*\*([^*\n]+)\*\*|\n/g;
 let html='',last=0;
 for(const match of source.matchAll(tokens)) {
   html+=escapeHtml(source.slice(last,match.index));
   if(match[1] && validLink(match[2])) html+=`<a href="${escapeHtml(match[2])}" target="_blank" rel="noopener noreferrer">${escapeHtml(match[1])}</a>`;
   else if(match[3]) html+=`<strong>${escapeHtml(match[3])}</strong>`;
   else if(match[0]==='\n') html+='<br>';
   else html+=escapeHtml(match[0]);
   last=match.index+match[0].length;
 }
 return html+escapeHtml(source.slice(last));
}
function productCard(item,index,kind) {
 const serial=String(index+1).padStart(2,'0');
 const isTool=kind==='tools';
 const label=item.label || (kind==='eyeTextures'?'EYE TEXTURE':isTool?'TOOL':'SHAPEKEY');
 const description=item.description ? `<p class="product-description">${text(item.description)}</p>`:'';
 const image=`<img src="${escapeHtml(item.image)}" alt="${escapeHtml(item.alt || item.name.replace(/\n/g,' '))}" width="620" height="620" loading="lazy" decoding="async" referrerpolicy="no-referrer">`;
 return `<a class="${isTool?'tool':'product'}-card" href="${escapeHtml(item.url)}" target="_blank" rel="noopener noreferrer"><div class="${isTool?'tool':'product'}-image">${image}${isTool?`<span>${serial}</span>`:''}</div><div class="${isTool?'tool':'product'}-meta"><div>${isTool?`<small>${escapeHtml(label)}</small>`:`<span>${escapeHtml(label)} / ${serial}</span>`}<h3>${text(item.name)}</h3>${description}</div><i>↗</i></div></a>`;
}
export function catalogHtml(items,kind) {
 const visible=items.filter(item=>item.visible);
 if(kind==='tools') return visible.map((item,index)=>productCard(item,index,kind)).join('\n');
 const pageClass=kind==='eyeTextures'?'eye-page':'product-page';
 const pageLabel=kind==='eyeTextures'?'アイテクスチャ':'商品';
 const pages=[];
 for(let start=0;start<visible.length;start+=6) {
   pages.push(`<div class="${pageClass}" aria-label="${pageLabel} ${pages.length+1}ページ目">${visible.slice(start,start+6).map((item,index)=>productCard(item,start+index,kind)).join('\n')}</div>`);
 }
 return pages.join('\n');
}
function renderCatalogs(html,data) {
 let result=html
  .replace(/(<div class="product-track">)[\s\S]*?(<\/div>\s*<\/div>\s*<div class="eye-textures">)/,(_,open,close)=>open+catalogHtml(data.shapekeys,'shapekeys')+close)
  .replace(/(<div class="eye-track">)[\s\S]*?(<\/div>\s*<\/div>\s*<\/div>\s*<\/section>)/,(_,open,close)=>open+catalogHtml(data.eyeTextures,'eyeTextures')+close)
  .replace(/(<div class="tool-grid">)[\s\S]*?(<\/div>\s*<\/section>)/,(_,open,close)=>open+catalogHtml(data.tools,'tools')+close);
 for(const [kind,prefix] of [['shapekeys',''],['eyeTextures','eye-']]) {
   const count=Math.ceil(data[kind].filter(item=>item.visible).length/6);
   for(const [name,value] of [['current-page',count?1:0],['total-pages',count]]) result=result.replace(new RegExp(`(<span class="${prefix}${name}">)[^<]*(<\\/span>)`),(_,a,b)=>a+String(value).padStart(2,'0')+b);
 }
 return result;
}
const xIcon='<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24h-6.657l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231 5.45-6.231Zm-1.161 17.52h1.833L7.084 4.126H5.117L17.083 19.77Z"/></svg>';
export function memberCreditsHtml(credits) {
 const columns=[];
 for(let start=0;start<credits.length;start+=5) {
   columns.push(`<ul class="member-credit-column">${credits.slice(start,start+5).map(credit=>`<li>${escapeHtml(credit)}</li>`).join('')}</ul>`);
 }
 return columns.length?`<div class="member-credit-columns" tabindex="0" aria-label="担当作品一覧">${columns.join('')}</div>`:'';
}
export function teamHtml(team) {
 return team.filter(member=>member.visible).map((member,index)=>{
   const image=member.image?`<img src="${escapeHtml(member.image)}" alt="${escapeHtml(member.alt || member.name)}" width="512" height="512" loading="lazy" decoding="async" referrerpolicy="no-referrer">`:'';
   const label=member.creditLabel?`<small class="member-credit-label">${escapeHtml(member.creditLabel)}</small>`:'';
   const social=member.socialUrl?`<a class="member-x" href="${escapeHtml(member.socialUrl)}" target="_blank" rel="noopener noreferrer" aria-label="${escapeHtml(member.name)}のXプロフィール">${xIcon}<span>${escapeHtml(member.socialLabel || member.name)}</span><i>↗</i></a>`:'';
   return `<article class="member-card"><div class="member-top"><span>${String(index+1).padStart(2,'0')}</span><div class="member-mark"><span>${escapeHtml(member.initial)}</span>${image}</div></div><div class="member-details"><p>${escapeHtml(member.role)}</p><h3>${escapeHtml(member.name)}</h3>${label}${memberCreditsHtml(member.credits)}${social}</div></article>`;
 }).join('\n');
}
export function renderPage(html,data,archive=false,home='') {
 validate(data);
 if(archive) return html.replace(/(<section class="archive-list"[^>]*>)[\s\S]*?(<\/section>)/,(_,a,b)=>a+newsHtml(data,true,home)+b);
 const normalized=normalizeContent(data);
 const rendered=renderCatalogs(html.replace(/(<div class="news-list">)[\s\S]*?(<\/div>)/,(_,a,b)=>a+newsHtml(data)+b).replace(/(<div class="qa-list">)[\s\S]*?(<\/div>)/,(_,a,b)=>a+qaHtml(data)+b),normalized);
 return rendered.replace(/(<div class="member-grid">)[\s\S]*?(<\/div>\s*<\/section>)/,(_,open,close)=>open+teamHtml(normalized.team)+close);
}
