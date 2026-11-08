import {cp,mkdir,readFile,writeFile,rm} from 'node:fs/promises';
import {renderPage,validate} from '../lib/content.js';
const data=validate(JSON.parse(await readFile('data/content.json','utf8')));
await rm('dist',{recursive:true,force:true}); await mkdir('dist',{recursive:true});
await cp('ADDHARD','dist',{recursive:true});
await cp('admin','dist/admin',{recursive:true});
for(const file of ['news.html','robots.txt','sitemap.xml','google183c793b1275e4e6.html']) await cp(file,`dist/${file}`);
await mkdir('dist/data',{recursive:true}); await cp('data/content.json','dist/data/content.json');
for(const [file,archive,home] of [['HTML/index.html',false,''],['HTML/news.html',true,'./index.html'],['CSS/news.html',true,'../HTML/index.html'],['CSS/news',true,'../HTML/index.html'],['news.html',true,'./HTML/index.html']]) {
 // Legacy CSS/news routes contain only a JavaScript placeholder. Generate them
 // from the full archive template before disabling that old JS renderer.
 const legacyArchive=file.startsWith('CSS/news');
 let source=await readFile(legacyArchive?'news.html':`dist/${file}`,'utf8');
 if(legacyArchive) source=source.replaceAll('./HTML/index.html','../HTML/index.html').replaceAll('./CSS/','../CSS/').replaceAll('./JS/','../JS/').replaceAll('./IMG/','../IMG/');
 await writeFile(`dist/${file}`,renderPage(source,data,archive,home));
}
let main=await readFile('dist/JS/main.js','utf8');
main=main.replace('renderNewsArchivePage();','/* Archive HTML is generated from data/content.json. */');
await writeFile('dist/JS/main.js',main);
const index=await readFile('dist/HTML/index.html','utf8');
await writeFile('dist/index.html',index.replaceAll('../CSS/','/CSS/').replaceAll('../JS/','/JS/').replaceAll('../IMG/','/IMG/'));
await writeFile('dist/_routes.json',JSON.stringify({version:1,include:['/api/*'],exclude:[]}));
await writeFile('dist/_headers','/admin/*\n  Cache-Control: no-store\n  X-Robots-Tag: noindex, nofollow\n  X-Frame-Options: DENY\n  Content-Security-Policy: default-src \'self\'; script-src \'self\'; style-src \'self\'; img-src \'self\' https: blob:; frame-src \'self\'; base-uri \'self\'; form-action \'self\'\n/CSS/news\n  Content-Type: text/html; charset=utf-8\n');
console.log('Built dist: site + admin');
