const { test } = require('node:test');
const assert = require('node:assert/strict');
const vm = require('node:vm');
const fs = require('node:fs');
const schema = JSON.parse(fs.readFileSync('sections/moya-talk.liquid', 'utf8').split('{% schema %}')[1].split('{% endschema %}')[0]);
const defaults = schema.presets[0].blocks.map(b => ({ key:b.settings.key, prompt:b.settings.prompt, start:0, end:0, options:[1,2].map(i => Object.fromEntries(['label','reply','next','motion','action','link'].map(k => [k === 'link' ? 'href' : k,b.settings[`option_${i}_${k}`]]))) }));
function fixture({ reduced = false, nodes = defaults, mediaFailure = false } = {}) {
  let frames = new Map(), frameId = 0, now = 0, reducedQuery, mobileQuery;
  const videos = [];
  class Element {
    constructor(tag='div') { this.tagName=tag.toUpperCase(); this.children=[]; this.dataset={}; this.attrs={}; this.handlers={}; this.hidden=false; this.isConnected=true; this._text=''; this.style={setProperty(k,v){this[k]=v;},getPropertyValue(k){return this[k] || '';}}; this.classes=new Set(); this.classList={add:(...a)=>a.forEach(x=>this.classes.add(x)),remove:(...a)=>a.forEach(x=>this.classes.delete(x)),contains:x=>this.classes.has(x),toggle:(x,on)=>{if(on??!this.classes.has(x))this.classes.add(x);else this.classes.delete(x);}}; }
    set className(s){ this.classes=new Set(s.split(' ')); } get className(){return [...this.classes].join(' ');}
    set textContent(s){this._text=s || '';this.children=[];} get textContent(){return this._text+this.children.map(x=>x.textContent).join('');}
    get childElementCount(){return this.children.length;} get offsetHeight(){return this.stage?1950:750;}
    setAttribute(k,v){this.attrs[k]=v;} getAttribute(k){return this.attrs[k] ?? null;} hasAttribute(k){return k in this.attrs;}
    append(...a){for(const e of a){this.children.push(e);e.parent=this;}} replaceChildren(...a){this.children=[];this._text='';this.append(...a);}
    addEventListener(name,fn,options={}){(this.handlers[name]??=[]).push(fn);options.signal?.addEventListener('abort',()=>this.removeEventListener(name,fn),{once:true});}
    removeEventListener(name,fn){this.handlers[name]=(this.handlers[name]||[]).filter(x=>x!==fn);}
    emit(name,extra={}){for(const fn of [...(this.handlers[name]||[])])fn({target:this,...extra});}
    matches(s){if(s.includes(','))return s.split(',').some(x=>this.matches(x.trim()));if(s==='button'||s==='a'||s==='video')return this.tagName===s.toUpperCase();const m=s.match(/^\[data-([\w-]+)(?:="([^"]+)")?\]$/);if(m){const key=m[1].replace(/-([a-z])/g,(_,c)=>c.toUpperCase());return key in this.dataset && (m[2]===undefined||this.dataset[key]===m[2]);}return false;}
    querySelectorAll(s){return this.children.flatMap(c=>[...(c.matches(s)?[c]:[]),...c.querySelectorAll(s)]);} querySelector(s){return this.querySelectorAll(s)[0] || null;}
    closest(s){return this.matches(s)?this:this.parent?.closest(s);} contains(e){return e===this||this.children.some(c=>c.contains(e));}
    focus(){doc.activeElement=this;}
    getBoundingClientRect(){const top=this.stage?(this.rootTop ?? -750):this.dataset.options!==undefined?520:this.dataset.asked!==undefined?350:0;const height=this.stage?1950:this.dataset.options!==undefined?120:this.dataset.asked!==undefined?100:this.dataset.answer!==undefined?250:750;return {top,bottom:top+height,height,width:1440,left:0,right:1440};}
    cloneNode(){return new Element('img');}
  }
  class Video extends Element {
    constructor(name){super('video');this.dataset={clip:name,desktop:`${name}-d.mp4`,mobile:`${name}-m.mp4`};this.readyState=0;this.duration=1;this.paused=true;this.ended=false;this._time=0;videos.push(this);}
    set src(s){this.attrs.src=s;} get src(){return this.attrs.src;}
    set currentTime(t){this._time=t;this.ended=false;queueMicrotask(()=>this.emit('seeked'));} get currentTime(){return this._time;}
    load(){queueMicrotask(()=>{if(mediaFailure){this.error={code:4};this.emit('error');}else{this.readyState=4;this.emit('loadeddata');}});}
    play(){this.paused=false;this.emit('playing');return Promise.resolve();} pause(){this.paused=true;}
    advance(dt){if(this.paused||this.frozen)return;this._time+=dt/1000;if(this._time>=this.duration){if(this.loop)this._time%=this.duration;else{this._time=this.duration;this.ended=true;this.paused=true;this.emit('ended');}}}
  }
  const doc=new Element();doc.documentElement={clientHeight:750};doc.hidden=false;doc.activeElement=null;doc.createElement=t=>new Element(t);doc.createTextNode=t=>{const e=new Element('#text');e.textContent=t;return e;};
  let Type;const window=new Element();window.scrollTo=()=>{};
  const context={HTMLElement:Element,document:doc,window,innerHeight:750,scrollY:0,location:{href:'https://example.test/'},URL,AbortController,DOMException,console,setTimeout,clearTimeout,queueMicrotask,
    matchMedia:q=>{const e=new Element();e.matches=q.includes('reduced')?reduced:false;if(q.includes('reduced'))reducedQuery=e;else mobileQuery=e;return e;},
    getComputedStyle:()=>({getPropertyValue:()=>''}),requestAnimationFrame:fn=>{const id=++frameId;frames.set(id,fn);return id;},cancelAnimationFrame:id=>frames.delete(id),
    IntersectionObserver:class{constructor(cb){this.cb=cb;}observe(target){queueMicrotask(()=>this.cb([{isIntersecting:true,target}]));}disconnect(){}},ResizeObserver:class{observe(){}disconnect(){}},customElements:{get:()=>undefined,define:(n,t)=>Type=t}};
  vm.runInNewContext(fs.readFileSync('assets/moya-talk.js','utf8'),context);
  const root=new Type();root.stage=true;root.dataset={motion:'true',reveal:'true',start:'opening',speed:'10',delay:'0'};root.style['--talk-distance']='100';
  const add=(key,tag='div',parent=root)=>{const e=new Element(tag);e.dataset[key]='';parent.append(e);return e;};
  add('stage');const ui=add('interface');const options=add('options','div',ui);add('reply','p',ui);add('answer','article',ui).hidden=true;add('asked','article',ui).hidden=true;add('question','p',ui);add('listening','div',ui);add('dots','img',ui);add('live','p',ui);add('config');const n=add('nodes','script');n.textContent=JSON.stringify(nodes);add('arrow','template').content={cloneNode:()=>new Element('img')};
  const p1=add('poster');p1.dataset.poster='intro';const p2=add('poster');p2.dataset.poster='full';for(const name of ['intro','breathe','hug','return','look-up','look-down'])root.append(new Video(name));
  root.connectedCallback();
  const advance=async(ms=100)=>{for(let elapsed=0;elapsed<ms;elapsed+=50){now+=50;for(const v of videos)v.advance(50);const pending=[...frames.values()];frames.clear();pending.forEach(fn=>fn(now));await Promise.resolve();await Promise.resolve();}};
  const choose=(i=0)=>{const target=options.children[i];assert.ok(target,'Choice should be available');options.emit('click',{target,detail:1,preventDefault(){}});return target;};
  const schedule=()=>doc.emit('scroll');
  return {root,doc,options,videos,advance,choose,schedule,reducedQuery,mobileQuery,frames};
}
test('scroll entry reveals Listening and prepares only intro, idle and immediate branch clips',async()=>{const f=fixture();await f.advance(500);assert.equal(f.root.querySelector('[data-interface]').hidden,false);assert.equal(f.options.children.length,2);assert.equal(f.videos.filter(v=>v.src).length,4);f.root.disconnectedCallback();});
test('all four branches complete and restart; duplicate click cannot change selected question',async()=>{
 for(const [first,second] of [[0,0],[0,1],[1,0],[1,1]]){const f=fixture();await f.advance(500);const button=f.choose(first);f.options.emit('click',{target:button,detail:1,preventDefault(){}});assert.equal(f.root.querySelector('[data-question]').textContent,defaults[0].options[first].label);await f.advance(9000);assert.equal(f.options.children.length,2);f.choose(second);await f.advance(9000);assert.equal(f.options.children[0].textContent,'Show me the science');assert.equal(f.options.children[0].tagName,'A');f.choose(1);assert.equal(f.options.children[0].textContent,"Let's talk a little");assert.equal(f.root.querySelector('[data-asked]').hidden,true);f.root.disconnectedCallback();}
});
test('hidden tab pauses both animation and response clock, then resumes',async()=>{const f=fixture();await f.advance(500);f.choose();await f.advance(300);f.doc.hidden=true;f.schedule();await f.advance(100);const times=f.videos.map(v=>v.currentTime);await f.advance(10000);assert.deepEqual(f.videos.map(v=>v.currentTime),times);assert.equal(f.options.children.length,0);f.doc.hidden=false;f.schedule();await f.advance(10000);assert.equal(f.options.children.length,2);f.root.disconnectedCallback();});
test('reduced motion keeps dialogue usable with no video requests',async()=>{const f=fixture({reduced:true});await f.advance(300);assert.equal(f.videos.filter(v=>v.src).length,0);f.choose();await f.advance(500);assert.equal(f.options.children[0].textContent,'Just listen to me');f.root.disconnectedCallback();});
test('failed videos fall back to poster and dialogue completes',async()=>{const f=fixture({mediaFailure:true});await f.advance(300);f.choose();await f.advance(10000);assert.equal(f.options.children[0].textContent,'Just listen to me');f.root.disconnectedCallback();});
test('broken destinations, self loops and unsafe links are filtered',async()=>{const nodes=JSON.parse(JSON.stringify(defaults));nodes[0].options[0].next='missing';nodes[0].options[1]={label:'Unsafe',action:'link',href:'javascript:alert(1)'};const f=fixture({nodes});await f.advance(100);assert.equal(f.root.dataset.configValid,'false');assert.equal(f.options.children.length,0);f.root.disconnectedCallback();});
test('disconnect clears animation frames and pauses all videos',async()=>{const f=fixture();await f.advance(500);f.choose();await f.advance(100);f.root.disconnectedCallback();await Promise.resolve();assert.equal(f.frames.size,0);assert.ok(f.videos.every(v=>v.paused));});

test('reverse scroll suspends a reply and returning resumes the same question',async()=>{const f=fixture();await f.advance(500);f.choose(1);await f.advance(300);f.root.rootTop=0;f.schedule();await f.advance(5000);assert.equal(f.root.querySelector('[data-interface]').hidden,true);assert.ok(f.videos.every(v=>v.paused));f.root.rootTop=-750;f.schedule();await f.advance(9000);assert.equal(f.root.querySelector('[data-question]').textContent,'Just stay with me');assert.equal(f.options.children[0].textContent,'A soft hug, please');f.root.disconnectedCallback();});
test('device rendition changes preserve the selected branch',async()=>{const f=fixture();await f.advance(500);f.choose(1);await f.advance(300);f.mobileQuery.matches=true;f.mobileQuery.emit('change');await f.advance(9000);assert.equal(f.root.querySelector('[data-question]').textContent,'Just stay with me');assert.equal(f.options.children[0].textContent,'A soft hug, please');assert.ok(f.videos.filter(v=>v.src).every(v=>v.src.endsWith('-m.mp4')));f.root.disconnectedCallback();});

test('a longer replacement clip is allowed to finish instead of timing out while advancing',async()=>{const nodes=JSON.parse(JSON.stringify(defaults));nodes[0].end=1;const f=fixture({nodes});f.videos.find(v=>v.dataset.clip==='look-up').duration=14;await f.advance(500);f.choose();await f.advance(10000);assert.equal(f.options.children.length,0);await f.advance(10000);assert.equal(f.options.children[0].textContent,'Just listen to me');f.root.disconnectedCallback();});
test('a stalled reply falls back after eight seconds without an extra eight-second wait',async()=>{const f=fixture();await f.advance(500);f.choose();await f.advance(300);f.videos.find(v=>v.dataset.clip==='look-up').frozen=true;await f.advance(14000);assert.equal(f.options.children[0].textContent,'Just listen to me');f.root.disconnectedCallback();});

test('gestures hold their final frame before the return clip starts',async()=>{for(const [choice,motion,returnMotion,remaining] of [[0,'look-up','look-down',600],[1,'hug','return',1300]]){const f=fixture();await f.advance(500);f.choose(choice);await f.advance(1300);const gesture=f.videos.find(v=>v.dataset.clip===motion),back=f.videos.find(v=>v.dataset.clip===returnMotion);assert.equal(gesture.ended,true);assert.ok(gesture.classList.contains('is-active'));assert.equal(back.src,undefined);await f.advance(remaining);assert.ok(back.src,'Return clip should start after the final-frame hold');assert.equal(f.options.children.length,0,'Options wait until the return has completed');f.root.disconnectedCallback();}});
