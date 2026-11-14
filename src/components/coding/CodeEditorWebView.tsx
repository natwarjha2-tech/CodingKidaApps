/**
 * Lightweight mobile code editor.
 *
 * CodeMirror 5 (≈200 KB, built for touch screens) inside ONE WebView — Monaco
 * (the desktop editor) officially doesn't support mobile browsers. The code is
 * only EDITED here; it runs on the server (/api/code/run), never on the phone.
 *
 * - Syntax highlighting for Java / C / Python / JavaScript, line numbers,
 *   bracket matching + auto-close, active-line highlight, word wrap, 4-space tabs
 * - A coding key bar (Tab, brackets, ; = < > …, arrows, undo/redo) that keeps
 *   the editor focused, because these keys are painful on a phone keyboard
 * - Dark / light theme and font size, switched without reloading
 * - Falls back to a plain monospace textarea if CodeMirror can't load (offline
 *   on first open) — same as the desktop's Monaco fallback
 *
 * The WebView caches the CDN files (LOAD_CACHE_ELSE_NETWORK), so after the first
 * open the editor loads from the phone. Unmounted when the screen closes, so it
 * uses no memory in the background.
 */
import { forwardRef, useImperativeHandle, useMemo, useRef } from 'react';
import { StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';
import { WebView, type WebViewMessageEvent } from 'react-native-webview';

const CM = 'https://cdnjs.cloudflare.com/ajax/libs/codemirror/5.65.16';

export type EditorTheme = 'dark' | 'light';

export interface CodeEditorHandle {
  setCode: (code: string) => void;
  setMode: (mode: string) => void;
  setTheme: (theme: EditorTheme) => void;
  setFontSize: (px: number) => void;
  focus: () => void;
  appendLine: (line: string) => void;
  setErrors: (errs: { line?: number; severity?: string }[]) => void;
}

interface Props {
  initialCode: string;
  mode: string;
  theme: EditorTheme;
  fontSize: number;
  onChange: (code: string) => void;
  onCursor?: (line: number, col: number) => void;
  onReady?: (fallback: boolean) => void;
  style?: StyleProp<ViewStyle>;
}

// JSON for embedding inside <script> (no "</script>" break-out).
const js = (v: unknown) => JSON.stringify(v).replace(/</g, '\\u003c').replace(/\u2028/g, '\\u2028').replace(/\u2029/g, '\\u2029');

function buildHtml(init: { code: string; mode: string; theme: EditorTheme; fontSize: number }): string {
  return `<!DOCTYPE html><html><head>
<meta name="viewport" content="width=device-width,initial-scale=1,maximum-scale=1,user-scalable=no">
<link rel="stylesheet" href="${CM}/codemirror.min.css">
<script src="${CM}/codemirror.min.js"></script>
<script src="${CM}/mode/clike/clike.min.js"></script>
<script src="${CM}/mode/python/python.min.js"></script>
<script src="${CM}/mode/javascript/javascript.min.js"></script>
<script src="${CM}/addon/edit/closebrackets.min.js"></script>
<script src="${CM}/addon/edit/matchbrackets.min.js"></script>
<script src="${CM}/addon/selection/active-line.min.js"></script>
<style>
*{box-sizing:border-box;-webkit-tap-highlight-color:transparent}
html,body{margin:0;height:100%;overflow:hidden;background:var(--bg)}
body.dark{--bg:#000;--gut:#000;--ln:#555;--lna:#888;--txt:#d4d4d4;--act:rgba(255,255,255,.05);--sel:rgba(108,71,255,.35);--bar:#11111b;--key:#1f1f2e;--keyt:#e2e8f0;--line:rgba(255,255,255,.08)}
body.light{--bg:#fff;--gut:#f8f9fa;--ln:#999;--lna:#333;--txt:#212529;--act:rgba(0,0,0,.04);--sel:rgba(108,71,255,.2);--bar:#f1f3f5;--key:#fff;--keyt:#212529;--line:rgba(0,0,0,.1)}
#ed{position:absolute;top:0;left:0;right:0;bottom:44px}
.CodeMirror,#fb{height:100%;background:var(--bg);color:var(--txt);font-family:'JetBrains Mono','Fira Code',Menlo,Consolas,monospace;line-height:1.5}
.CodeMirror-gutters{background:var(--gut);border-right:1px solid var(--line)}
.CodeMirror-linenumber{color:var(--ln)}
.CodeMirror-activeline-background{background:var(--act)}
.cm-errline{background:rgba(239,68,68,.18)!important}
.cm-warnline{background:rgba(245,158,11,.15)!important}
.CodeMirror-activeline .CodeMirror-linenumber{color:var(--lna)}
.CodeMirror-selected,.CodeMirror-focused .CodeMirror-selected{background:var(--sel)!important}
.CodeMirror-cursor{border-left:2px solid #a78bfa}
.CodeMirror-matchingbracket{outline:1px solid #a78bfa;color:inherit!important}
body.dark .cm-keyword{color:#569cd6}body.dark .cm-def{color:#dcdcaa}body.dark .cm-variable,body.dark .cm-variable-2,body.dark .cm-property{color:#9cdcfe}
body.dark .cm-variable-3,body.dark .cm-type,body.dark .cm-builtin{color:#4ec9b0}body.dark .cm-string,body.dark .cm-string-2{color:#ce9178}
body.dark .cm-number{color:#b5cea8}body.dark .cm-comment{color:#6a9955;font-style:italic}body.dark .cm-meta{color:#c586c0}body.dark .cm-atom{color:#569cd6}body.dark .cm-operator{color:#d4d4d4}
body.light .cm-keyword{color:#0000ff}body.light .cm-def{color:#795e26}body.light .cm-variable,body.light .cm-variable-2,body.light .cm-property{color:#001080}
body.light .cm-variable-3,body.light .cm-type,body.light .cm-builtin{color:#267f99}body.light .cm-string,body.light .cm-string-2{color:#a31515}
body.light .cm-number{color:#098658}body.light .cm-comment{color:#008000;font-style:italic}body.light .cm-meta{color:#af00db}body.light .cm-atom{color:#0000ff}
#fb{width:100%;border:0;outline:0;resize:none;padding:10px 12px;white-space:pre;overflow:auto}
#kb{position:absolute;left:0;right:0;bottom:0;height:44px;background:var(--bar);border-top:1px solid var(--line);display:flex;align-items:center;gap:5px;padding:0 6px;overflow-x:auto;overflow-y:hidden;white-space:nowrap;scrollbar-width:none}
#kb::-webkit-scrollbar{display:none}
#kb span{flex:0 0 auto;min-width:36px;height:32px;line-height:32px;text-align:center;padding:0 9px;border-radius:7px;background:var(--key);color:var(--keyt);font:600 15px Menlo,Consolas,monospace;border:1px solid var(--line);user-select:none;-webkit-user-select:none}
#kb span.w{font-family:-apple-system,Roboto,sans-serif;font-size:13px;color:#a78bfa}
</style></head>
<body class="${init.theme === 'light' ? 'light' : 'dark'}">
<div id="ed"></div>
<div id="kb"></div>
<script>
(function(){
var INIT=${js(init)};
var post=function(o){try{window.ReactNativeWebView.postMessage(JSON.stringify(o));}catch(e){}};
var ed=document.getElementById('ed'), cm=null, ta=null, fs=INIT.fontSize;
var tChange=null, tCur=null, errLines=[];
function emitChange(){clearTimeout(tChange);tChange=setTimeout(function(){post({t:'change',code:getCode()});},200);}
function getCode(){return cm?cm.getValue():(ta?ta.value:'');}
function applyFont(){var el=cm?cm.getWrapperElement():ta;if(el){el.style.fontSize=fs+'px';}if(cm)cm.refresh();}
function emitCursor(){clearTimeout(tCur);tCur=setTimeout(function(){
  if(cm){var c=cm.getCursor();post({t:'cursor',line:c.line+1,col:c.ch+1});}
  else if(ta){var b=ta.value.slice(0,ta.selectionStart).split('\\n');post({t:'cursor',line:b.length,col:b[b.length-1].length+1});}
},120);}
if(window.CodeMirror){
  cm=CodeMirror(ed,{value:INIT.code,mode:INIT.mode,lineNumbers:true,lineWrapping:true,indentUnit:4,tabSize:4,indentWithTabs:false,
    smartIndent:true,matchBrackets:true,autoCloseBrackets:true,styleActiveLine:true,inputStyle:'contenteditable',
    spellcheck:false,autocorrect:false,autocapitalize:false,viewportMargin:30,
    extraKeys:{Tab:function(c){if(c.somethingSelected())c.indentSelection('add');else c.replaceSelection('    ');}}});
  cm.setSize('100%','100%');
  cm.on('change',emitChange);cm.on('cursorActivity',emitCursor);
}else{
  ta=document.createElement('textarea');ta.id='fb';ta.spellcheck=false;ta.setAttribute('autocorrect','off');ta.setAttribute('autocapitalize','off');
  ta.placeholder='// Write your code here...';ta.value=INIT.code;ed.appendChild(ta);
  ta.addEventListener('input',emitChange);ta.addEventListener('keyup',emitCursor);ta.addEventListener('click',emitCursor);
}
applyFont();

// ── Coding key bar ──
var PAIRS={'(':')','[':']','{':'}','"':'"',"'":"'"};
var KEYS=[['⇥','tab',1],['{'],['}'],['('],[')'],['['],[']'],[';'],['='],['"'],["'"],['<'],['>'],['+'],['-'],['*'],['/'],['%'],['!'],['&'],['|'],[':'],[','],['.'],['_'],['#'],['\\\\'],
  ['◀','left',1],['▶','right',1],['▲','up',1],['▼','down',1],['↶','undo',1],['↷','redo',1]];
function insertText(s){
  if(cm){
    var sel=cm.getSelection();
    if(PAIRS[s]&&s!==PAIRS[s]&&!sel){cm.replaceSelection(s+PAIRS[s]);var p=cm.getCursor();cm.setCursor({line:p.line,ch:p.ch-1});}
    else if(PAIRS[s]&&sel){cm.replaceSelection(s+sel+PAIRS[s]);}
    else cm.replaceSelection(s);
    cm.focus();
  }else if(ta){
    var a=ta.selectionStart,b=ta.selectionEnd,v=ta.value,ins=(PAIRS[s]&&s!==PAIRS[s])?s+PAIRS[s]:s;
    ta.value=v.slice(0,a)+ins+v.slice(b);var np=a+(ins.length>1&&PAIRS[s]?1:ins.length);ta.selectionStart=ta.selectionEnd=np;ta.focus();emitChange();
  }
}
function action(k){
  if(cm){
    if(k==='tab'){if(cm.somethingSelected())cm.indentSelection('add');else cm.replaceSelection('    ');}
    else if(k==='left')cm.execCommand('goCharLeft');else if(k==='right')cm.execCommand('goCharRight');
    else if(k==='up')cm.execCommand('goLineUp');else if(k==='down')cm.execCommand('goLineDown');
    else if(k==='undo')cm.undo();else if(k==='redo')cm.redo();
    cm.focus();
  }else if(ta){
    if(k==='tab')insertText('    ');
    else if(k==='left'){ta.selectionStart=ta.selectionEnd=Math.max(0,ta.selectionStart-1);}
    else if(k==='right'){ta.selectionStart=ta.selectionEnd=ta.selectionEnd+1;}
    ta.focus();
  }
}
var kb=document.getElementById('kb');
KEYS.forEach(function(k){
  var el=document.createElement('span');el.textContent=k[0];if(k[2])el.className='w';
  var sx=0,sy=0;
  // Act on touchend (not click) and prevent default so the editor keeps focus
  // and the on-screen keyboard stays open. Small moves still scroll the bar.
  el.addEventListener('touchstart',function(e){sx=e.touches[0].clientX;sy=e.touches[0].clientY;},{passive:true});
  el.addEventListener('touchend',function(e){var t=e.changedTouches[0];if(Math.abs(t.clientX-sx)>10||Math.abs(t.clientY-sy)>10)return;e.preventDefault();if(k[2])action(k[1]);else insertText(k[0]);});
  el.addEventListener('mousedown',function(e){e.preventDefault();});
  kb.appendChild(el);
});

// ── API for React Native ──
window.__ck={
  setCode:function(c){if(cm){cm.setValue(c);cm.clearHistory();}else if(ta){ta.value=c;}},
  setMode:function(m){if(cm)cm.setOption('mode',m);},
  setTheme:function(t){document.body.className=t==='light'?'light':'dark';if(cm)cm.refresh();},
  setFont:function(n){fs=n;applyFont();},
  focus:function(){if(cm)cm.focus();else if(ta)ta.focus();},
  // Next Step: add a line after the last non-blank line (keeps undo history).
  appendLine:function(t){
    if(cm){
      var last=0;for(var i=cm.lineCount()-1;i>=0;i--){if(cm.getLine(i).trim().length>0){last=i;break;}}
      var len=cm.getLine(last).length;
      cm.replaceRange('\\n'+t,{line:last,ch:len});
      var n=last+1;cm.setCursor({line:n,ch:t.length});cm.scrollIntoView({line:n,ch:0},60);
    }else if(ta){
      ta.value=ta.value.replace(/\\s+$/,'')+'\\n'+t+'\\n';emitChange();
    }
  },
  // Compile-check errors: tint the offending lines.
  setErrors:function(errs){
    if(!cm)return;
    errLines.forEach(function(h){cm.removeLineClass(h,'background','cm-errline');cm.removeLineClass(h,'background','cm-warnline');});
    errLines=[];
    (errs||[]).forEach(function(e){
      var ln=Math.max(0,Math.min(cm.lineCount()-1,(e.line||1)-1));
      cm.addLineClass(ln,'background',e.severity==='warning'?'cm-warnline':'cm-errline');errLines.push(ln);
    });
  }
};
window.addEventListener('resize',function(){if(cm)cm.refresh();});
post({t:'ready',fallback:!cm});
})();
</script></body></html>`;
}

export const CodeEditorWebView = forwardRef<CodeEditorHandle, Props>(function CodeEditorWebView(
  { initialCode, mode, theme, fontSize, onChange, onCursor, onReady, style },
  ref
) {
  const webRef = useRef<WebView>(null);
  // HTML is built ONCE from the initial values; later changes go through the
  // imperative API so the WebView never reloads (no lost edits / undo history).
  const html = useMemo(
    () => buildHtml({ code: initialCode, mode, theme, fontSize }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    []
  );

  const call = (fn: string, arg: unknown) =>
    webRef.current?.injectJavaScript(`window.__ck&&window.__ck.${fn}(${JSON.stringify(arg)});true;`);

  useImperativeHandle(ref, () => ({
    setCode: (c) => call('setCode', c),
    setMode: (m) => call('setMode', m),
    setTheme: (t) => call('setTheme', t),
    setFontSize: (n) => call('setFont', n),
    focus: () => call('focus', null),
    appendLine: (l) => call('appendLine', l),
    setErrors: (e) => call('setErrors', e),
  }));

  const onMessage = (e: WebViewMessageEvent) => {
    let m: { t: string; code?: string; line?: number; col?: number; fallback?: boolean };
    try { m = JSON.parse(e.nativeEvent.data); } catch { return; }
    if (m.t === 'change' && typeof m.code === 'string') onChange(m.code);
    else if (m.t === 'cursor' && m.line && m.col) onCursor?.(m.line, m.col);
    else if (m.t === 'ready') onReady?.(!!m.fallback);
  };

  return (
    <View style={[styles.wrap, style]}>
      <WebView
        ref={webRef}
        source={{ html }}
        originWhitelist={['*']}
        javaScriptEnabled
        domStorageEnabled
        onMessage={onMessage}
        // Cached CDN files → fast reopen, works offline after the first load.
        cacheEnabled
        cacheMode="LOAD_CACHE_ELSE_NETWORK"
        textZoom={100}
        overScrollMode="never"
        keyboardDisplayRequiresUserAction={false}
        hideKeyboardAccessoryView
        automaticallyAdjustContentInsets={false}
        setSupportMultipleWindows={false}
        style={styles.web}
      />
    </View>
  );
});

const styles = StyleSheet.create({
  wrap: { flex: 1, overflow: 'hidden' },
  web: { flex: 1, backgroundColor: 'transparent' },
});
