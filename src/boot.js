(function(){
 'use strict';
 var generation=0,started=false,deadline=0,pending=false,engineReady=null,appStarted=false;
 var order=['cocos/engine.js','src/rules.js','src/economy-config.js','src/ad-rewards.js','src/platform-bundle.js','src/art.js','src/audio.js?v=audio-20261029','src/app.js'];
 var loaded={};
 function status(text,fail){
  var label=document.getElementById('status');if(!label)return;
  label.textContent=text;label.setAttribute('aria-label',text);
  document.getElementById('retry').hidden=!fail;
  document.getElementById('loading-progress').hidden=!!fail;
  if(window.alignCocosLogo)window.alignCocosLogo();
 }
 function watchdog(){if(pending&&Date.now()>deadline){pending=false;generation++;status('Loading failed.',true);}requestAnimationFrame(watchdog);}
 async function attempt(){
  if(pending)return;var token=++generation;pending=true;deadline=Date.now()+15000;status('Loading...',false);
  try{
   for(var i=0;i<order.length;i++){
    if(loaded[order[i]])continue;
    await new Promise(function(resolve,reject){var script=document.createElement('script');script.src=order[i]+'?v=1';script.onload=resolve;script.onerror=reject;document.head.appendChild(script);});
    if(token!==generation)return;loaded[order[i]]=true;deadline=Date.now()+15000;
   }
   var response=await fetch('data/levels.json?attempt='+token,{cache:'no-store'});if(!response.ok)throw Error('levels-http-'+response.status);
   var data=await response.json();if(token!==generation)return;if(!Array.isArray(data)||data.length!==70)throw Error('levels-invalid');
   window.TTULevels=data;deadline=Date.now()+15000;
   if(!started){cc.assetManager.init({});
   await new Promise(function(resolve,reject){cc.assetManager.loadBundle('internal',function(err){err?reject(err):resolve();});});}
   if(token!==generation)return;
   if(!started){started=true;engineReady=new Promise(function(resolve){cc.game.run({id:'GameCanvas',debugMode:1,showFPS:false,frameRate:60,groupList:['default'],collisionMatrix:[[true]]},function(){
    cc.view.enableRetina(true);cc.view.resizeWithBrowserSize(true);cc.view.setDesignResolutionSize(720,1280,cc.ResolutionPolicy.SHOW_ALL);
    resolve();
   });});}
   await engineReady;if(token!==generation)return;
   deadline=Date.now()+15000;status('Loading resources...',false);
   await window.TTUArt.load('art/');if(token!==generation)return;
   if(!appStarted){appStarted=true;window.TTUApp.start();}pending=false;document.getElementById('boot').remove();
  }catch(err){if(token!==generation)return;pending=false;console.error('[TTU boot]',err);status('Loading failed.',true);}
 }
 document.getElementById('retry').onclick=attempt;requestAnimationFrame(watchdog);attempt();
})();
