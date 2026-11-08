import {readFile,writeFile} from 'node:fs/promises';
const home=await readFile('ADDHARD/HTML/index.html','utf8');
const archive=await readFile('news.html','utf8');
const decode=s=>s.replace(/&amp;/g,'&').replace(/&lt;/g,'<').replace(/&gt;/g,'>').replace(/&quot;/g,'"').replace(/&#39;/g,"'");
const plain=s=>decode(s.replace(/<br\s*\/?\s*>/g,'\n').replace(/<[^>]*>/g,'').trim());
const news=[...archive.matchAll(/<article class="archive-item">([\s\S]*?)<\/article>/g)].map((m,i)=>{const s=m[1], url=s.match(/<a href="([^"]+)"/)[1];return {id:`news-${i+1}`,date:s.match(/datetime="([^"]+)"/)[1],title:plain(s.match(/<h2>([\s\S]*?)<\/h2>/)[1]),body:plain(s.match(/<p>([\s\S]*?)<\/p>/)[1]),url:url.includes('#')&&!url.startsWith('https:')?'#'+url.split('#')[1]:decode(url),linkLabel:plain(s.match(/<a[^>]*>([\s\S]*?)<span>/)[1])}});
const qa=[...home.matchAll(/<details[^>]*>\s*<summary><span>Q\d+<\/span>([\s\S]*?)<\/summary>\s*<p>([\s\S]*?)<\/p>\s*<\/details>/g)].map((m,i)=>({id:`qa-${i+1}`,question:plain(m[1]),answer:plain(m[2])}));
// Preserve the existing FT reference as a visible URL in the text editor.
qa[3].answer=qa[3].answer.replace('hashedits様のFT','hashedits様のFT（https://hashedits.booth.pm/）');
await writeFile('data/content.json',JSON.stringify({version:1,news,qa},null,2)+'\n');
