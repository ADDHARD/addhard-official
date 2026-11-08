export const escapeHtml = v => String(v ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
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
 return data.qa.map((q,i)=>`<details${i===0?' open':''}><summary><span>Q${String(i+1).padStart(2,'0')}</span>${escapeHtml(q.question)}</summary><p>${text(q.answer)}</p></details>`).join('\n');
}
export function renderPage(html,data,archive=false,home='') {
 validate(data);
 if(archive) return html.replace(/(<section class="archive-list"[^>]*>)[\s\S]*?(<\/section>)/,(_,a,b)=>a+newsHtml(data,true,home)+b);
 return html.replace(/(<div class="news-list">)[\s\S]*?(<\/div>)/,(_,a,b)=>a+newsHtml(data)+b).replace(/(<div class="qa-list">)[\s\S]*?(<\/div>)/,(_,a,b)=>a+qaHtml(data)+b);
}
