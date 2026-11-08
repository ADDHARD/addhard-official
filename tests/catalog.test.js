import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import vm from 'node:vm';
import {catalogDefaults} from '../lib/catalog-defaults.js';
import {normalizeContent,validate,validImage,renderPage,catalogHtml,qaHtml,answerHtml} from '../lib/content.js';

const legacy=JSON.parse(await readFile(new URL('./fixtures/legacy-content.json',import.meta.url)));
const template=await readFile(new URL('../ADDHARD/HTML/index.html',import.meta.url),'utf8');

test('old drafts migrate all current cards without mutating old data or clearing explicit empty collections',()=>{
 const data=normalizeContent(legacy);
 assert.equal(data.shapekeys.length,9);
 assert.equal(data.eyeTextures.length,35);
 assert.equal(data.tools.length,4);
 assert.equal(data.shapekeys[0].name,'Milltina');
 assert.equal(data.eyeTextures[0].name,'Lumina');
 assert.equal(data.eyeTextures[4].name,'Milltina');
 assert.equal(data.eyeTextures.at(-1).id,'eye-6427471');
 assert.equal(data.tools[0].name,'Shape Folder\nViewer');
 assert.equal(data.tools[1].label,'MATERIAL TOOL');
 assert.deepEqual(Object.keys(legacy),['version','news','qa']);
 data.shapekeys[0].name='changed';
 assert.equal(catalogDefaults.shapekeys[0].name,'Milltina');
 const empty=normalizeContent({...legacy,eyeTextures:[]});
 assert.deepEqual(empty.eyeTextures,[]);
 validate(legacy);
 validate(data);
});

test('catalog validation rejects hostile URL schemes and malformed entries',()=>{
 for(const change of [
  data=>data.shapekeys[0].image='javascript:alert(1)',
  data=>data.shapekeys[0].image='data:image/svg+xml,<svg onload="alert(1)">',
  data=>data.shapekeys[0].image='//evil.example/image.png',
  data=>data.shapekeys[0].image='/IMG/../admin/index.html',
  data=>data.shapekeys[0].image='/IMG/%2e%2e/admin/index.html',
  data=>data.shapekeys[0].image='/api/images/------------------------------------.webp',
  data=>data.shapekeys[0].url='javascript:alert(1)',
  data=>data.shapekeys[0].url='https://user:password@example.test/',
  data=>data.shapekeys[0].visible='false',
  data=>data.shapekeys[0].name='',
  data=>data.shapekeys[1].id=data.shapekeys[0].id,
  data=>data.tools=null
 ]){const data=normalizeContent(legacy);change(data);assert.throws(()=>validate(data));}
 assert.equal(validImage('/IMG/example.webp'),true);
 assert.equal(validImage('/api/images/00000000-0000-4000-8000-000000000001.webp'),true);
 assert.equal(validImage('https://images.example.test/product.png?v=2&size=600'),true);
});

test('catalog rendering escapes editable text and attributes and preserves manually chosen order',()=>{
 const data=normalizeContent(legacy);
 data.shapekeys.reverse();
 data.shapekeys[0].name='<img src=x onerror=alert(1)>';
 data.shapekeys[0].alt='" onload="alert(1)';
 data.shapekeys[0].description='line 1\n<script>alert(1)</script>';
 const result=renderPage(template,data);
 assert.match(result,/&lt;img src=x onerror=alert\(1\)&gt;/);
 assert.match(result,/alt="&quot; onload=&quot;alert\(1\)"/);
 assert.match(result,/line 1<br>&lt;script&gt;alert\(1\)&lt;\/script&gt;/);
 assert.ok(result.indexOf('href="'+data.shapekeys[0].url+'"')<result.indexOf('href="'+data.shapekeys[1].url+'"'));
 assert.equal([...result.matchAll(/class="product-card"/g)].length,44);
 assert.equal([...result.matchAll(/class="tool-card"/g)].length,4);
 assert.match(result,/<span class="total-pages">02<\/span>/);
 assert.match(result,/<span class="eye-total-pages">06<\/span>/);
});

test('hidden products, removals and growing categories recalculate pages and serial labels',()=>{
 const data=normalizeContent(legacy);
 const source=data.shapekeys[0];
 data.shapekeys=Array.from({length:14},(_,i)=>({...source,id:'new-'+i,name:'product '+i,visible:i!==0}));
 data.eyeTextures=[];data.tools=[];
 const result=renderPage(template,data);
 assert.equal([...result.matchAll(/class="product-page"/g)].length,3);
 assert.equal([...result.matchAll(/class="product-card"/g)].length,13);
 assert.match(result,/<span class="total-pages">03<\/span>/);
 assert.match(result,/<span class="eye-current-page">00<\/span>/);
 assert.match(result,/<span class="eye-total-pages">00<\/span>/);
 assert.doesNotMatch(result,/class="tool-card"/);
 assert.doesNotMatch(result,/>product 0<\/h3>/);
 assert.match(result,/SHAPEKEY \/ 13/);
 assert.doesNotMatch(result,/SHAPEKEY \/ 14/);
 data.shapekeys=[];
 const empty=renderPage(template,data);
 assert.match(empty,/<span class="current-page">00<\/span>/);
 assert.equal([...empty.matchAll(/class="product-page"/g)].length,0);
 assert.equal(catalogHtml([],'tools'),'');
});

test('rendering an already-built home replaces catalogs completely for preview',()=>{
 const data=normalizeContent(legacy);
 const first=renderPage(template,data);
 data.shapekeys=[{...data.shapekeys[0],name:'Preview only card'}];
 data.eyeTextures=[];data.tools=[];
 const preview=renderPage(first,data);
 assert.equal([...preview.matchAll(/class="product-card"/g)].length,1);
 assert.match(preview,/Preview only card/);
 assert.doesNotMatch(preview,/>Chocolat<\/h3>/);
 assert.doesNotMatch(preview,/class="tool-card"/);
});

test('carousel controller does not rebuild cards and safely handles an empty collection',async()=>{
 const js=await readFile(new URL('../ADDHARD/JS/main.js',import.meta.url),'utf8');
 const code=js.slice(js.indexOf('// Catalog markup is generated'));
 assert.doesNotMatch(code,/\.innerHTML\s*=/);
 const events=new Map();
 const track={style:{},querySelectorAll:()=>[],addEventListener:(name,fn)=>events.set(name,fn)};
 const previous={addEventListener:(name,fn)=>events.set('prev',fn)};
 const next={addEventListener:(name,fn)=>events.set('next',fn)};
 const current={},total={};
 const nodes={'.product-track':track,'.carousel-prev':previous,'.carousel-next':next,'.current-page':current,'.total-pages':total};
 vm.runInNewContext(code,{document:{querySelector:selector=>nodes[selector]||null}});
 assert.equal(current.textContent,'00');assert.equal(total.textContent,'00');
 assert.equal(previous.disabled,true);assert.equal(next.disabled,true);
 events.get('next')();assert.equal(track.style.transform,'translateX(-0%)');
 events.get('touchstart')({touches:[{clientX:100}]});
 events.get('touchend')({changedTouches:[{clientX:0}]});
 assert.equal(current.textContent,'00');
});

test('Q&A restores the original FT link and supports safe inline links and emphasis',()=>{
 const data=normalizeContent(legacy);
 assert.match(data.qa[3].answer,/\[hashedits様のFT\]\(https:\/\/hashedits.booth.pm\/\)/);
 assert.match(qaHtml(legacy),/<a href="https:\/\/hashedits.booth.pm\/" target="_blank" rel="noopener noreferrer">hashedits様のFT<\/a>/);
 const custom={...legacy,qa:[{id:'custom',question:'Q',answer:'My custom [guide](https://example.test/path?a=1&b=2)\n**大事** <script>x</script>'}]};
 assert.equal(normalizeContent(custom).qa[0].answer,custom.qa[0].answer);
 const result=qaHtml(custom);
 assert.match(result,/href="https:\/\/example.test\/path\?a=1&amp;b=2"/);
 assert.match(result,/<br><strong>大事<\/strong> &lt;script&gt;x&lt;\/script&gt;/);
 assert.doesNotMatch(answerHtml('[danger](javascript:alert(1)) [also](data:text/html,x) [credentials](https://user:pass@example.test/)'),/<a /);
 assert.match(answerHtml('[<img onerror=x>](https://example.test/)'),/>&lt;img onerror=x&gt;<\/a>/);
});
