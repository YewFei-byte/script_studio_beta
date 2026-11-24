// Script added to the page only in the editor (renderPage({ editor: true })).
// The preview iframe is sandboxed (no same-origin access), so it talks to the
// editor with postMessage:
//
//   iframe -> editor
//     { type: 'ready' }                                  page loaded
//     { type: 'select', id }                             a section was clicked
//     { type: 'textFocus', path, plain }                 a text was clicked (✨ buttons apply to it)
//     { type: 'text', path, value, plain }               a text edit was finished
//     { type: 'image', path } / { type: 'video', path }  a photo / video slot was clicked
//     { type: 'scroll', y }                              current scroll position
//   editor -> iframe
//     { type: 'select', id, scroll }                     highlight a section
//     { type: 'scrollTo', y }                            restore scroll after a re-render
//
// Text is edited in place (plain text only). Enter or clicking away saves,
// Escape cancels. Links don't navigate while editing.

export const EDITOR_BRIDGE_JS = `(function(){
var d=document,root=d.documentElement,lang=root.getAttribute('data-lang')||'en',editing=null,original='';
function send(m){parent.postMessage(Object.assign({ssEditor:true},m),'*');}
function sectionOf(el){return el&&el.closest?el.closest('[data-section-id]'):null;}
function select(id,scroll){
  d.querySelectorAll('[data-section-id].sel').forEach(function(s){s.classList.remove('sel');});
  if(!id)return;
  var s=d.querySelector('[data-section-id="'+id+'"]');
  // window.scrollTo, not scrollIntoView: the latter also scrolls the editor
  // around the iframe.
  if(s){s.classList.add('sel');if(scroll)scrollTo({top:Math.max(0,s.getBoundingClientRect().top+scrollY-72),behavior:'smooth'});}
}
function startEdit(el){
  if(editing===el)return;
  if(editing)finish(true);
  editing=el;
  original=el.getAttribute('data-empty')?'':el.textContent;
  if(el.getAttribute('data-empty'))el.textContent='';
  try{el.contentEditable='plaintext-only';}catch(e){el.contentEditable='true';}
  if(el.contentEditable!=='plaintext-only')el.contentEditable='true';
  el.focus();
  var r=d.createRange();r.selectNodeContents(el);r.collapse(false);var s=getSelection();s.removeAllRanges();s.addRange(r);
  send({type:'textFocus',path:el.getAttribute('data-edit'),plain:el.hasAttribute('data-plain')});
}
function finish(save){
  var el=editing;if(!el)return;editing=null;
  el.removeAttribute('contenteditable');
  var value=el.textContent.replace(/\\s+/g,' ').trim();
  if(!save){el.textContent=original;return;}
  if(value===original.trim())return;
  el.setAttribute('data-'+lang,value);
  send({type:'text',path:el.getAttribute('data-edit'),value:value,plain:el.hasAttribute('data-plain')});
}
d.addEventListener('click',function(e){
  var t=e.target;
  var link=t.closest&&t.closest('a,summary');
  var editable=t.closest&&t.closest('[data-edit]');
  var img=t.closest&&t.closest('[data-edit-img]');
  var vid=t.closest&&t.closest('[data-edit-video]');
  if(link)e.preventDefault();
  var sec=sectionOf(t);
  if(sec){select(sec.getAttribute('data-section-id'));send({type:'select',id:sec.getAttribute('data-section-id')});}
  else{select(null);send({type:'select',id:null});}
  if(editable){e.preventDefault();startEdit(editable);return;}
  if(editing&&!editing.contains(t))finish(true);
  if(img){send({type:'image',path:img.getAttribute('data-edit-img')});}
  else if(vid){send({type:'video',path:vid.getAttribute('data-edit-video')});}
},true);
d.addEventListener('keydown',function(e){
  if(!editing)return;
  if(e.key==='Enter'){e.preventDefault();finish(true);editing&&editing.blur();}
  else if(e.key==='Escape'){e.preventDefault();finish(false);}
});
d.addEventListener('focusout',function(e){if(editing&&e.target===editing)finish(true);});
var ticking=false;
addEventListener('scroll',function(){if(ticking)return;ticking=true;requestAnimationFrame(function(){ticking=false;send({type:'scroll',y:scrollY});});},{passive:true});
addEventListener('message',function(e){
  var m=e.data||{};
  if(m.type==='select')select(m.id,m.scroll);
  else if(m.type==='scrollTo')scrollTo(0,m.y||0);
});
send({type:'ready'});
})();`;
