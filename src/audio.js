(function (root, factory) {
  'use strict';
  var api = factory(root);
  if (typeof module === 'object' && module.exports) module.exports = api;
  else root.TTUAudio = api;
}(typeof window !== 'undefined' ? window : globalThis, function (root) {
  'use strict';
  // Audio files and this generated table are copied by the canonical build.
  // No synthesizer, data URL or hidden simulated-success path is present.
  var manifest = {"bgm_home":{"path":"bgm/bgm_home","volume":0.65,"kind":"bgm"},"bgm_level":{"path":"bgm/bgm_level","volume":0.58,"kind":"bgm"},"jingle_win":{"path":"bgm/jingle_win","volume":0.75,"kind":"jingle"},"jingle_lose":{"path":"bgm/jingle_lose","volume":0.6,"kind":"jingle"},"sfx_button_tap":{"path":"sfx/sfx_button_tap","variants":3,"volume":0.75,"kind":"sfx"},"sfx_tile_slide":{"path":"sfx/sfx_tile_slide","variants":3,"volume":0.8,"kind":"sfx"},"sfx_tile_bump":{"path":"sfx/sfx_tile_bump","volume":0.65,"kind":"sfx"},"sfx_pin_pull":{"path":"sfx/sfx_pin_pull","variants":3,"volume":0.75,"kind":"sfx"},"sfx_pin_chain":{"path":"sfx/sfx_pin_chain","volume":0.7,"kind":"sfx"},"sfx_pipe_merge":{"path":"sfx/sfx_pipe_merge","volume":0.75,"kind":"sfx"},"sfx_cross_flash":{"path":"sfx/sfx_cross_flash","volume":0.65,"kind":"sfx"},"sfx_valve_hiss":{"path":"sfx/sfx_valve_hiss","volume":0.65,"kind":"sfx"},"sfx_path_link":{"path":"sfx/sfx_path_link","volume":0.65,"kind":"sfx"},"sfx_snack_pick":{"path":"sfx/sfx_snack_pick","volume":0.7,"kind":"sfx"},"sfx_order_full":{"path":"sfx/sfx_order_full","volume":0.7,"kind":"sfx"},"sfx_coin_fly":{"path":"sfx/sfx_coin_fly","volume":0.7,"kind":"sfx"}};
  var baseUrl = 'assets/resources/audio/', getSettings = function () { return root.TTUStore ? root.TTUStore.get().settings : {}; };
  var unlocked = false, selected = 'bgm_home', music = null, musicId = null, reasons = Object.create(null), ducks = Object.create(null), liveEffects = [], lastAt = {}, recentVariant = {};
  var log = [], pending = 0, sequence = 0, listening = false;
  function record(type, id, extra) { log.push({ at: Date.now(), type: type, id: id, detail: extra || '' }); if (log.length > 120) log.shift(); }
  function settings() { var s; try { s=getSettings() || {}; } catch (e) { s={}; } return { music:s.music !== false, sfx:s.sfx !== false, musicVolume:Math.max(0,Math.min(10,Number.isFinite(s.musicVolume)?s.musicVolume:7)), sfxVolume:Math.max(0,Math.min(10,Number.isFinite(s.sfxVolume)?s.sfxVolume:7)) }; }
  function hardPaused() { return Object.keys(reasons).some(function (r) { return r !== 'menu' && r !== 'settings'; }); }
  function settingGain(kind) { var s=settings(), gain=kind==='bgm'?(s.music?s.musicVolume/10:0):(s.sfx?s.sfxVolume/10:0); if(kind==='bgm'){if(reasons.menu||reasons.settings)gain*=.3;Object.keys(ducks).forEach(function(r){gain*=ducks[r];});} return hardPaused()?0:gain; }
  function resolve(id) {
    var item=manifest[id];
    if(!item)return null;
    var count=item.variants||1,index=0;
    if(count>1){index=Math.floor(Math.random()*count);if(index===recentVariant[id])index=(index+1)%count;recentVariant[id]=index;}
    return { url:baseUrl+item.path+(count>1?'_'+(index+1):'')+'.mp3', gain:item.volume===undefined?1:item.volume, kind:item.kind };
  }
  function make(id, loop) {
    var item=resolve(id);if(!item){record('missing-config',id);return null;}
    if(typeof root.Audio!=='function'){record('unsupported',id);return null;}
    var a;try{a=new root.Audio();a.src=item.url+(typeof root.HTMLMediaElement==='function'&&a instanceof root.HTMLMediaElement?'?v=audio-20261029':'');a.loop=!!loop;a.preload='auto';}catch(e){record('create-failed',id,String(e&&e.message||e));return null;}
    var entry={id:id,audio:a,gain:item.gain,kind:item.kind||'sfx',token:++sequence,playing:false};
    function onError(){record('media-error',id);entry.playing=false;entry.failed=true;}
    function onPlaying(){if(hardPaused()||entry.retired){entry.audio.volume=0;entry.audio.pause();return;}entry.playing=true;record('playing',id,{currentTime:Number(a.currentTime)||0,volume:a.volume,loop:a.loop});}
    if(typeof a.addEventListener==='function'){a.addEventListener('error',onError);a.addEventListener('playing',onPlaying);}
    else {a.onerror=onError;try{a.onPlay(onPlaying);}catch(e){}}
    return entry;
  }
  function start(entry) {
    if(!entry||!unlocked||hardPaused())return;
    var gain=settingGain(entry.kind==='bgm'?'bgm':'sfx')*entry.gain;
    entry.audio.volume=Math.max(0,Math.min(1,gain));if(gain<=0)return;
    pending++;var token=entry.token;
    try{
      var result=entry.audio.play();
      if(result&&typeof result.then==='function')result.then(function(){pending--;if(entry.token===token){entry.playing=!entry.audio.paused;record('play-resolved',entry.id,{paused:entry.audio.paused,readyState:entry.audio.readyState});}},function(e){pending--;entry.playing=false;record('play-rejected',entry.id,String(e&&e.name||e));});
      else {pending--;record('play-requested',entry.id);}
    }catch(e){pending--;entry.playing=false;record('play-failed',entry.id,String(e&&e.message||e));}
  }
  function stop(entry, discard) { if(!entry)return;try{entry.audio.volume=0;entry.audio.pause();}catch(e){}entry.playing=false;if(discard){entry.retired=true;entry.token++;try{entry.audio.src='';}catch(e){}} }
  function updateMusic() {
    var s=settings();
    if(!unlocked||hardPaused()||!s.music||s.musicVolume===0){stop(music,false);return;}
    if(musicId!==selected||!music||music.failed){stop(music,true);music=make(selected,true);musicId=selected;}
    if(!music)return;
    music.audio.volume=Math.max(0,Math.min(1,settingGain('bgm')*music.gain));
    if(music.audio.paused||!music.playing)start(music);
  }
  function sync() {
    updateMusic();
    liveEffects=liveEffects.filter(function(e){return !e.audio.ended;});
    liveEffects.forEach(function(e){e.audio.volume=Math.max(0,Math.min(1,settingGain('sfx')*e.gain));if(!settings().sfx||hardPaused())stop(e,false);});
  }
  function sfx(id) {
    if(!unlocked||hardPaused()||!settings().sfx||settings().sfxVolume===0)return false;
    var now=Date.now();if(now-(lastAt[id]||0)<50)return false;lastAt[id]=now;
    liveEffects=liveEffects.filter(function(e){return !e.audio.ended&&!e.failed&&!e.retired;});
    while(liveEffects.length>=6)stop(liveEffects.shift(),true);
    var entry=make(id,false);if(!entry)return false;liveEffects.push(entry);start(entry);return true;
  }
  function pause(reason) { reasons[reason||'manual']=true;if(hardPaused()){stop(music,false);liveEffects.forEach(function(e){stop(e,true);});liveEffects=[];}sync(); }
  function resume(reason) { delete reasons[reason||'manual'];sync(); }
  function unlock() { if(!unlocked){unlocked=true;record('unlocked','');}sync(); }
  return {
    init:function(options){options=options||{};if(options.baseUrl)baseUrl=String(options.baseUrl).replace(/\/?$/,'/');if(typeof options.getSettings==='function')getSettings=options.getSettings;if(options.manifest)manifest=options.manifest;else if(root.TTUAudioManifest)manifest=root.TTUAudioManifest;if(!listening&&root.addEventListener){listening=true;['pointerdown','touchstart','mousedown','keydown'].forEach(function(name){root.addEventListener(name,unlock,{passive:true});});}record('configured','',{entries:Object.keys(manifest).length});sync();return this;},
    unlock:unlock,page:function(name){selected=(name==='game'||name==='tea-party'||name==='party')?'bgm_level':'bgm_home';sync();},sfx:sfx,
    pause:pause,resume:resume,sync:sync,duck:function(reason,factor){ducks[reason||'modal']=Math.max(0,Math.min(1,Number.isFinite(factor)?factor:.3));sync();},unduck:function(reason){delete ducks[reason||'modal'];sync();},
    diagnostics:function(){return {unlocked:unlocked,selected:selected,configured:Object.keys(manifest).length,pending:pending,reasons:Object.keys(reasons),settings:settings(),music:music?{id:music.id,url:music.audio.src,paused:music.audio.paused,ended:music.audio.ended,currentTime:Number(music.audio.currentTime)||0,readyState:music.audio.readyState,volume:music.audio.volume,playing:music.playing}:null,effects:liveEffects.map(function(e){return {id:e.id,paused:e.audio.paused,ended:e.audio.ended,currentTime:Number(e.audio.currentTime)||0,volume:e.audio.volume};}),events:log.slice()};}
  };
}));
