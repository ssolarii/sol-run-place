const $=id=>document.getElementById(id);
const reduced=matchMedia('(prefers-reduced-motion:reduce)'),finePointer=matchMedia('(hover:hover) and (pointer:fine)');
const params=new URLSearchParams(location.search);
let world=null,motion=!reduced.matches;
function track(name,data={}){if(location.hostname==='sol.run.place'&&typeof gtag==='function')gtag('event',name,data)}
for(const a of document.querySelectorAll('[data-attribution]')){const u=new URL(a.href);for(const [key,value] of params)if(key.startsWith('utm_'))u.searchParams.set(key,value);a.href=u.href}

// Normal anchors and scrolling remain the navigation, including without graphics.
const destinations=['projects','about','quicklinks'];
function activeSection(id){for(const a of document.querySelectorAll('.comp-frame nav>a')){if(a.hash==='#'+id)a.setAttribute('aria-current','location');else a.removeAttribute('aria-current')}world?.setSection(id)}
for(const a of document.querySelectorAll('a[href^="#"]'))a.addEventListener('click',()=>{const id=a.hash.slice(1);if(destinations.includes(id)){activeSection(id);track('world_station',{station:id});if(id!=='projects'&&!reduced.matches){const section=$(id);section.classList.remove('arriving');requestAnimationFrame(()=>section.classList.add('arriving'))}}});
const navigationObserver=new IntersectionObserver(entries=>{const visible=entries.filter(entry=>entry.isIntersecting).sort((a,b)=>b.intersectionRatio-a.intersectionRatio);if(visible[0])activeSection(visible[0].target.id)},{rootMargin:'-10% 0px -40% 0px',threshold:[0,.1,.3]});for(const id of destinations)navigationObserver.observe($(id));
function updateMotion(){const enabled=motion&&!reduced.matches;$('motion-toggle').textContent='Leaf motion: '+(enabled?'on':'off');$('motion-toggle').setAttribute('aria-pressed',String(!enabled));$('motion-toggle').setAttribute('aria-label',enabled?'Pause leaf motion':'Resume leaf motion');$('motion-toggle').disabled=reduced.matches;world?.setMotion(enabled)}
$('motion-toggle').addEventListener('click',()=>{motion=!motion;updateMotion()});reduced.addEventListener('change',()=>{motion=!reduced.matches;updateMotion();snapNoteForReduced()});updateMotion();
const hero=$('projects');
hero.addEventListener('pointermove',event=>{if(!finePointer.matches||!motion||reduced.matches)return;const r=hero.getBoundingClientRect();world?.setPointer((event.clientX-r.left)/r.width*2-1,(event.clientY-r.top)/r.height*2-1)});
hero.addEventListener('pointerleave',()=>world?.setPointer(0,0));
let scrollFrame=0;addEventListener('scroll',()=>{if(scrollFrame)return;scrollFrame=requestAnimationFrame(()=>{const r=hero.getBoundingClientRect();world?.setScroll(-r.top/Math.max(r.height,1));scrollFrame=0})},{passive:true});
if(params.get('view')!=='simple')import('./scene.js').then(module=>module.createWorld({container:$('world'),motionAllowed:motion,onReady:()=>hero.classList.add('mesh-ready'),onFailure:()=>hero.classList.remove('mesh-ready')})).then(scene=>{world=scene;updateMotion()}).catch(()=>hero.classList.remove('mesh-ready'));

// Semantic paper stays whole at rest; a single subdivided surface bends its
// shared paper-and-ink texture during peeling. Failure retains the HTML note.
const board=$('note-board'),surface=$('curl-surface'),peelButton=$('peel-note'),reset=$('reset-note');
let progress=0,target=0,noteFrame=0,peeled=false,paperCurl=null,noteStart=0,noteFrom=0;
function curve(){board.classList.toggle('curl-bending',progress>0&&Boolean(paperCurl));paperCurl?.setProgress(progress)}
function animateNote(timestamp){const elapsed=Math.min(1,(timestamp-noteStart)/450);progress=noteFrom+(target-noteFrom)*(1-Math.pow(1-elapsed,3));curve();noteFrame=elapsed<1?requestAnimationFrame(animateNote):0}
function snapNoteForReduced(){if(reduced.matches){cancelAnimationFrame(noteFrame);noteFrame=0;progress=target;curve()}}
function setPeel(value,store=true){peeled=value;target=value?1:0;board.classList.toggle('peeled',value);peelButton.setAttribute('aria-expanded',String(value));peelButton.disabled=value;$('note-back').hidden=!value;reset.hidden=!value;cancelAnimationFrame(noteFrame);if(reduced.matches){progress=target;curve()}else{noteFrom=progress;noteStart=performance.now();noteFrame=requestAnimationFrame(animateNote)}if(store)try{localStorage.setItem('sol-world-note-peeled-v1',String(value))}catch{};if(value&&store)reset.focus({preventScroll:true})}
peelButton.addEventListener('click',()=>{setPeel(true);track('world_note_peel')});reset.addEventListener('click',()=>{setPeel(false);peelButton.focus({preventScroll:true})});
import('./scene.js').then(module=>module.createPaperCurl({container:surface,source:board,front:$('note-front'),action:peelButton.querySelector('.note-action')})).then(curl=>{paperCurl=curl;board.classList.add('curl-enhanced');curve()}).catch(()=>board.classList.remove('curl-enhanced'));
try{if(localStorage.getItem('sol-world-note-peeled-v1')==='true')setPeel(true,false)}catch{}
fetch('./notes.json').then(r=>{if(!r.ok)throw Error();return r.json()}).then(note=>{if(typeof note.front==='string'&&note.front.trim())$('note-front').textContent=note.front;if(typeof note.back==='string'&&note.back.trim())$('note-back').textContent=note.back;paperCurl?.refresh()}).catch(()=>{});

// Root-relative floors respond to text enlargement. An enlarged or very narrow
// composition becomes a readable flow instead of overlapping absolute layers.
function syncReadingLayout(){const size=parseFloat(getComputedStyle(document.documentElement).fontSize);hero.classList.toggle('reading-layout',size>17.6||hero.getBoundingClientRect().width<340);hero.style.setProperty('--reading-scale',String(Math.max(1,Math.min(2,hero.getBoundingClientRect().width/390))))}
new ResizeObserver(syncReadingLayout).observe(document.documentElement);addEventListener('resize',syncReadingLayout);syncReadingLayout();
for(const kind of ['private','guestbook']){const input=$(kind+'-body'),counter=$(kind+'-count'),form=$(kind+'-form');input.addEventListener('input',()=>{counter.textContent=input.value.length.toLocaleString()+' / '+input.maxLength.toLocaleString()});form.addEventListener('submit',event=>{if(form.querySelector('[type=submit]').disabled){event.preventDefault();$(kind+'-status').textContent='Messages are still connecting. Try again in a moment.'}})}
import('./music.js').catch(()=>{$('np-label').textContent='Music updates unavailable';$('recent-message').textContent='Listening history is temporarily unavailable. You can still open Last.fm.'});

import('./submissions.js').catch(()=>{for(const kind of ['private','guestbook']){document.getElementById(kind+'-status').textContent='Messages could not load. Reload the page to try again.'}document.getElementById('guestbook-message').textContent='The guestbook could not load. Reload the page to try again.'});
