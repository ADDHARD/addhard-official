import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {teamDefaults} from '../lib/team-defaults.js';
import {normalizeContent,validate,renderPage,teamHtml,memberCreditsHtml} from '../lib/content.js';

const legacy=JSON.parse(await readFile(new URL('./fixtures/legacy-content.json',import.meta.url)));
const template=await readFile(new URL('../ADDHARD/HTML/index.html',import.meta.url),'utf8');

test('TEAM migration retains all existing profiles and credits without touching legacy input',()=>{
 const data=normalizeContent(legacy);
 assert.deepEqual(data.team.map(member=>member.name),['がりゅー','あまね','あく']);
 assert.deepEqual(data.team.map(member=>member.role),['OWNER','MEMBER','MEMBER']);
 assert.deepEqual(data.team.map(member=>member.credits.length),[4,3,2]);
 assert.deepEqual(data.team[0].credits,['Minase Shapekey','Shinra Shapekey','Komano Shapekey','Hanka Shapekey']);
 assert.equal(data.team[1].image,'/IMG/AMANE-512.webp');
 assert.equal(data.team[2].socialUrl,'https://x.com/aku_waruiko?s=20');
 assert.equal(Object.hasOwn(legacy,'team'),false);
 data.team[0].credits.push('new entry');
 assert.equal(teamDefaults[0].credits.length,4,'initial defaults stay unchanged');
 validate(data);validate(legacy);
 assert.deepEqual(normalizeContent({...legacy,team:[]}).team,[]);
});

test('TEAM credits fill columns vertically in chunks of five while preserving their order',()=>{
 for(const size of [0,5,6,10,11]) {
   const credits=Array.from({length:size},(_,index)=>'Credit '+(index+1));
   const html=memberCreditsHtml(credits);
   const columns=[...html.matchAll(/<ul class="member-credit-column">([\s\S]*?)<\/ul>/g)].map(match=>[...match[1].matchAll(/<li>([\s\S]*?)<\/li>/g)].map(item=>item[1]));
   assert.equal(columns.length,Math.ceil(size/5));
   assert.deepEqual(columns.flat(),credits);
   assert.ok(columns.every(column=>column.length<=5));
   if(size>5)assert.equal(columns[1][0],'Credit 6');
   if(size>10)assert.equal(columns[2][0],'Credit 11');
   if(size===0)assert.equal(html,'');
 }
});

test('TEAM card fields and contribution names are escaped while existing social and icon structure remains',()=>{
 const member=structuredClone(teamDefaults[0]);
 member.name='<img src=x onerror=alert(1)>';
 member.role='<script>alert(1)</script>';
 member.creditLabel='<b>Credits</b>';
 member.credits=['First <script>bad()</script>','Second & third'];
 member.alt='" onload="alert(1)';
 member.socialLabel='<img onerror=x>';
 const html=teamHtml([member]);
 assert.match(html,/<article class="member-card">/);
 assert.match(html,/class="member-mark"/);
 assert.match(html,/<svg viewBox="0 0 24 24" aria-hidden="true">/);
 assert.match(html,/target="_blank" rel="noopener noreferrer"/);
 assert.match(html,/&lt;script&gt;alert\(1\)&lt;\/script&gt;/);
 assert.match(html,/&lt;b&gt;Credits&lt;\/b&gt;/);
 assert.match(html,/<li>First &lt;script&gt;bad\(\)&lt;\/script&gt;<\/li>/);
 assert.match(html,/<li>Second &amp; third<\/li>/);
 assert.match(html,/alt="&quot; onload=&quot;alert\(1\)"/);
 assert.doesNotMatch(html,/<script>|<img onerror=/);
});

test('TEAM validation rejects malformed profiles, unsafe URLs and invalid contribution lists',()=>{
 for(const change of [
   data=>data.team=null,
   data=>data.team=Array.from({length:101},(_,i)=>({...teamDefaults[0],id:'member-'+i})),
   data=>data.team[1].id=data.team[0].id,
   data=>data.team[0].id='<invalid>',
   data=>data.team[0].name='',
   data=>data.team[0].image='javascript:alert(1)',
   data=>data.team[0].socialUrl='javascript:alert(1)',
   data=>data.team[0].socialUrl='https://user:pass@example.test/',
   data=>data.team[0].credits=[''],
   data=>data.team[0].credits=['  '],
   data=>data.team[0].credits=['x'.repeat(201)],
   data=>data.team[0].credits=Array(501).fill('credit'),
   data=>data.team[0].credits=[1],
   data=>data.team[0].visible='true'
 ]){const data=normalizeContent(legacy);change(data);assert.throws(()=>validate(data));}
 const data=normalizeContent(legacy);data.team[0].credits=[];validate(data);
});

test('TEAM replacement works in both initial build and repeated preview and respects hidden or empty collections',()=>{
 const first=renderPage(template,legacy);
 assert.equal([...first.matchAll(/class="member-card"/g)].length,3);
 assert.match(first,/class="member-credit-columns"/);
 assert.match(first,/src="\/IMG\/GARYU.webp"/);
 const data=normalizeContent(legacy);
 data.team[0].credits=Array.from({length:11},(_,i)=>'New work '+(i+1));
 data.team[1].visible=false;
 const second=renderPage(first,data);
 assert.equal([...second.matchAll(/class="member-card"/g)].length,2);
 assert.doesNotMatch(second,/Minase Shapekey<\/li>/);
 assert.match(second,/<li>New work 11<\/li>/);
 assert.doesNotMatch(second,/<h3>あまね<\/h3>/);
 data.team=[];
 const empty=renderPage(second,data);
 assert.doesNotMatch(empty,/class="member-card"/);
 assert.match(empty,/PEOPLE BEHIND/);
 assert.match(empty,/QUICK<br>ANSWERS/);
});
