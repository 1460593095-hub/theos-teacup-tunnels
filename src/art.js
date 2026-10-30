(function(root){
'use strict';
var manifest={images:{},glyphs:{}},textures={},frames={},pendingFiles={},fileAttempts={},loaded=false,loadGeneration=0,base='art/',missing={},labels=[],buttonViews=[],cardViews=[],giftViews=[],time=0,homePose=[],onAssetError=null,errorReported={};
function remember(id){if(id)missing[id]=true;return null;}
function imageInfo(id){var v=manifest.images&&manifest.images[id];return typeof v==='string'?{file:v}:v;}
function frame(id,customRect){var key=id+(customRect?':'+customRect.join(','):'');if(frames[key])return frames[key];var info=imageInfo(id);if(!info)return remember(id);var texture=textures[info.file];if(!texture)return null;var r=customRect||info.rect||[0,0,texture.width,texture.height];var f=new cc.SpriteFrame(texture,cc.rect(r[0],r[1],r[2],r[3]));f.name=id+(customRect?'@'+customRect.join(','):'');frames[key]=f;return f;}
function child(parent,name){var n=new cc.Node(name);parent.addChild(n);return n;}
function loadFile(file,token){if(textures[file])return Promise.resolve(textures[file]);if(pendingFiles[file])return pendingFiles[file];var attempt=(fileAttempts[file]||0)+1;fileAttempts[file]=attempt;var promise=new Promise(function(done,fail){cc.assetManager.loadRemote(base+file+(cc.sys.isBrowser&&(token>1||attempt>1)?'?art='+token+'&request='+attempt:''),{ext:'.'+file.split('.').pop()},function(err,asset){if(token!==loadGeneration)return fail(Error('art-superseded'));if(err)return fail(err);textures[file]=asset;done(asset);});});pendingFiles[file]=promise;promise.then(function(){if(pendingFiles[file]===promise)delete pendingFiles[file];},function(){if(pendingFiles[file]===promise)delete pendingFiles[file];});return promise;}
function restoreReadableFallback(parent,failed){
 var button=parent&&parent.parent&&parent.parent.getComponent(cc.Button),panel=parent&&parent.name==='Panel',host=panel?parent:button?parent.parent:null;
 if(!host)return;
 var g=host.getComponent(cc.Graphics);if(!g)g=host.addComponent(cc.Graphics);g.enabled=true;g.clear();g.fillColor=cc.Color.fromHEX(new cc.Color(),panel?'#fff9e9':'#c5deef');g.roundRect(-host.width/2,-host.height/2,host.width,host.height,panel?36:22);g.fill();g.lineWidth=3;g.strokeColor=cc.Color.fromHEX(new cc.Color(),'#dabd91');g.roundRect(-host.width/2+2,-host.height/2+2,host.width-4,host.height-4,panel?34:20);g.stroke();host._ttuReadableFallback=true;failed.active=false;
 if(button&&parent._ttuArtText){parent._ttuArtText.show=true;parent._ttuArtText.fallback=true;parent._ttuArtText.value=null;renderText(parent._ttuArtText);}
}
function sprite(parent,id,w,h,mode,rect){var info=imageInfo(id);if(!info)return remember(id);var n=child(parent,'Art_'+id),s=n.addComponent(cc.Sprite);n._ttuArtAsset=id;n._ttuArtSource=info.file;n._ttuArtReady=false;s.sizeMode=cc.Sprite.SizeMode.CUSTOM;function assign(){if(!cc.isValid(n))return;var f=frame(id,rect);if(!f)return;var r=f.getRect(),angle=info.rotation||0,quarter=Math.abs(angle)%180===90,fw=quarter?r.height:r.width,fh=quarter?r.width:r.height;if(mode==='cover'){var ratio=quarter?h/w:w/h,cw=r.width,ch=r.height;if(cw/ch>ratio)cw=ch*ratio;else ch=cw/ratio;var crop=cc.rect(r.x+(r.width-cw)/2,r.y+(r.height-ch)/2,cw,ch);s.spriteFrame=new cc.SpriteFrame(textures[info.file],crop);s.spriteFrame.name=id;n.setContentSize(quarter?h:w,quarter?w:h);}else{var scale=mode==='stretch'?null:Math.min(w/fw,h/fh);s.spriteFrame=f;n.setContentSize(scale?r.width*scale:w,scale?r.height*scale:h);}n.angle=angle;n._ttuArtReady=true;if((parent.name==='Panel'||parent.name==='StatusToast')&&(id==='panel'||id==='toast')){var backing=parent.getComponent(cc.Graphics);if(backing)backing.enabled=false;}if(n._ttuPhraseText!==undefined&&n.parent){n.parent.setContentSize(n.width,n.height);n.parent.__wholeText={value:n._ttuPhraseText,rendered:n._ttuPhraseText,complete:true,expectedParts:1};}}if(textures[info.file])assign();else{n.setContentSize(w,h);loadFile(info.file,loadGeneration).then(assign,function(err){if(cc.isValid(n)){n._ttuArtError=String(err);restoreReadableFallback(parent,n);remember('load:'+info.file);var key=loadGeneration+':'+info.file+':'+fileAttempts[info.file];if(n.activeInHierarchy&&!errorReported[key]){errorReported[key]=true;if(onAssetError)onAssetError(info.file);}}});}return n;}
function readyNode(n){if(!n||!cc.isValid(n)||!n.activeInHierarchy)return true;if(n._ttuArtAsset&&n._ttuArtReady!==true)return false;return n.children.every(readyNode);}
function ancestorSurfacesReady(n){for(var current=n;current;current=current.parent){var surface=current.getChildByName('ArtSurface');if(surface&&!readyNode(surface))return false;}return true;}
function guardButton(view){var control=view.n.getComponent(cc.Button),ready=readyNode(view.nodeLabel)&&(view.id==='Close'||ancestorSurfacesReady(view.n.parent));if(!ready){if(!view.waiting){view.waiting=true;view.previousEnabled=control.interactable;}control.interactable=false;}else if(view.waiting){view.waiting=false;control.interactable=view.previousEnabled;}}
function replaceSurface(n,id,mode){if(!imageInfo(id)){remember(id);return false;}var g=n.getComponent(cc.Graphics);if(g){if(n.name==='Panel'||n.name==='StatusToast')g.enabled=true;else{g.clear();g.enabled=false;}}var old=n.getChildByName('ArtSurface');if(old){old.active=false;old.destroy();}var art=sprite(n,id,n.width,n.height,/^(hud_|capsule_|card_)/.test(id)||id==='panel'||id==='toast'?'contain':mode||'stretch');art.name='ArtSurface';art.zIndex=-1;return true;}
function choose(){var wanted=null;for(var i=0;i<arguments.length;i++){if(!wanted&&arguments[i])wanted=arguments[i];if(imageInfo(arguments[i])){if(wanted&&!imageInfo(wanted))remember(wanted);return arguments[i];}}return remember(wanted);}
function surface(n,name,color){
 var id;
 if(name==='Panel')id=choose('panel','modal');else if(name==='StatusToast')id=choose('toast','panel');
 else if(name==='Coins'||name==='Progress')id=choose(name==='Coins'?'capsule_teacup_coin':'capsule_level_flag',name==='Coins'?'hud_coins':'hud_level','hud_capsule','panel');
 else if(/^Card_/.test(name))id=choose('card_common','panel');
 else if(/^Cell_/.test(name))id=choose(color==='#e5d7bf'?'tile_empty':color==='#dfd2bc'?'tile_fixed':color==='#c8e6cd'?'tile_start':color==='#f4c6bd'?'tile_goal':'tile_normal','tile_normal');
 else if(name==='TutorialTarget')id=choose('highlight');
 if(id)replaceSurface(n,id,'stretch');return n;
}
function glyphFor(ch){var entry=manifest.glyphs&&manifest.glyphs[ch];if(!entry&&ch!==' ')entry=manifest.glyphs&&manifest.glyphs[ch.toUpperCase()];if(!entry)return null;return Array.isArray(entry)?{image:manifest.font&&manifest.font.image||'font',rect:entry}:entry;}
var generatedBitmapFont=null;
function bitmapFont(){
 if(generatedBitmapFont)return generatedBitmapFont;
 var image=manifest.font&&manifest.font.image||'font',sheet=frame(image);if(!sheet)return null;
 var height=manifest.font&&manifest.font.lineHeight||175,defs={};
 Object.keys(manifest.glyphs||{}).forEach(function(ch){var g=glyphFor(ch);if(!g)return;var r=g.rect,advance=Math.max(g.advance||r[2],r[2]+(/[0-9:]/.test(ch)?26:8));defs[ch.charCodeAt(0)]={rect:{x:r[0],y:r[1],width:r[2],height:r[3]},xOffset:(advance-r[2])/2+(g.offsetX||0),yOffset:(height-r[3])/2-(g.offsetY||0),xAdvance:advance};});
 for(var code=97;code<=122;code++)if(!defs[code])defs[code]=defs[code-32];
 defs[32]={rect:{x:0,y:0,width:0,height:0},xOffset:0,yOffset:0,xAdvance:manifest.font&&manifest.font.spaceAdvance||height*.34};
 var font=new cc.BitmapFont();font.name='GeneratedPorcelainBitmap';font.fontSize=height;font.spriteFrame=sheet;
 font._fntConfig={fontSize:height,commonHeight:height,fontDefDictionary:defs,kerningDict:{},atlasName:image};font.onLoad();
 generatedBitmapFont=font;return font;
}
function renderText(view){
 var n=view.n,l=view.label;if(!cc.isValid(n))return false;
 var value=l.string===undefined?'':String(l.string);if(view.value===value&&view.ready===loaded&&view.lastName===n.name&&view.width===n.width&&view.height===n.height)return true;
 view.value=value;view.lastName=n.name;view.ready=loaded;view.width=n.width;view.height=n.height;
 var container=view.container;if(!container||!cc.isValid(container,true))container=child(n,'BitmapText');view.container=container;
 l.enabled=false;container.active=view.show!==false;if(view.show===false)return true;
 var phraseKey=value.replace(/’/g,"'").replace(/\s+/g,' ').trim().toLowerCase(),phrase=manifest.phrases&&manifest.phrases[phraseKey];
 if(phrase&&imageInfo(phrase)&&!view.fallback){
  var oldNative=container.getComponent(cc.Label);if(oldNative)oldNative.enabled=false;
  if(container._ttuPhrase!==phrase||container._ttuPhraseSize!==n.width+':'+n.height){container.removeAllChildren();var whole=sprite(container,phrase,n.width,n.height,'contain');whole._ttuPhraseText=value;container.__wholeText={value:value,rendered:value,complete:whole._ttuArtReady===true,expectedParts:1};container._ttuPhrase=phrase;container._ttuPhraseSize=n.width+':'+n.height;}
  var phraseSprite=container.children[0];container.setContentSize(phraseSprite.width,phraseSprite.height);container.setPosition(0,0);container.scale=1;return true;
 }
 if(container._ttuPhrase){container.removeAllChildren();container._ttuPhrase=null;delete container.__wholeText;}

 var font=bitmapFont();if(!font){l.enabled=true;container.active=false;remember('font');return true;}
 l.enabled=false;container.active=view.show!==false;if(view.show===false)return true;
 var isHud=n.name==='CoinsCount'||n.name==='ProgressCount'||n.name==='EnergyCount',isLevel=n.parent&&/^Level_/.test(n.parent.name);
 var size=isHud?30:isLevel?40:view.size||27;
 var backing=isLevel?n.getChildByName('ButtonImage'):isHud?n.name==='EnergyCount'?n.getChildByName('ButtonImage'):n.parent.getChildByName(n.name==='CoinsCount'?'Coins':'Progress'):null;
 if(backing&&isHud&&n.name!=='EnergyCount')backing=backing.getChildByName('ArtSurface');
 if(backing&&container.parent!==backing)container.parent=backing;
 var visual=isHud?(value.match(/\d+/)||['0'])[0]:isLevel?n.parent.name.slice(6):value;
 var raw=visual.replace(/\u2019/g,"'").replace(/\u2026/g,'...').replace(/\u00b7/g,'·').replace(/\u2212/g,'-').replace(/\u2161/g,'II').replace(/\u25ae/g,'I').replace(/\u25af/g,'-');
 var nativeLabel=container.getComponent(cc.Label);if(!nativeLabel)nativeLabel=container.addComponent(cc.Label);
 container.setContentSize(isHud?104:n.width,isHud?28:n.height);container.setPosition(n.name==='CoinsCount'?18:isHud?18:0,isLevel&&value.indexOf('★')>=0?18:0);container.color=cc.Color.WHITE;
 nativeLabel.enabled=true;nativeLabel.useSystemFont=false;nativeLabel.font=font;nativeLabel.fontSize=size;nativeLabel.lineHeight=font.fontSize*1.24;
 nativeLabel.horizontalAlign=cc.Label.HorizontalAlign.CENTER;nativeLabel.verticalAlign=cc.Label.VerticalAlign.CENTER;
 var available=isHud?104:n.width,advance=0;raw.split('\n').forEach(function(line){var total=0;for(var i=0;i<line.length;i++){var def=font._fntConfig.fontDefDictionary[line.charCodeAt(i)];total+=def?def.xAdvance:0;}advance=Math.max(advance,total);});
 var paragraph=(n.name==='ModalBody'||n.name==='StatusMessage')&&raw.length>20;
 if(!paragraph){nativeLabel.fontSize=Math.min(size,advance?available*font.fontSize/advance:size);nativeLabel.enableWrapText=false;nativeLabel.overflow=cc.Label.Overflow.NONE;}else{nativeLabel.enableWrapText=true;nativeLabel.overflow=cc.Label.Overflow.RESIZE_HEIGHT;container.width=available;}
 nativeLabel.lineHeight=nativeLabel.fontSize*1.24;nativeLabel.string=raw;
 return true;
}
function text(n,label,size){var v={n:n,label:label,size:size,value:null,ready:null,show:true};labels.push(v);n._ttuArtText=v;if(manifest.glyphs&&Object.keys(manifest.glyphs).length)label.enabled=false;else{label.enabled=true;remember('font');}return n;}
function buttonId(id,title){
 var t=String(title).toLowerCase();if(id==='Close'&&t==='home'||id==='Next'&&t==='home')return choose('icon_home','btn_home');if(id==='PauseRetry')return choose('icon_retry','btn_retry');
 var icons={Map:'map',Closet:'closet',Settings:'settings',TeaParty:'party',Shortcut:'shortcut',Revisit:'revisit',Close:'close',Pause:'pause',Spoon:'spoon',Puller:'puller',PrevChapter:'prev',ClosetPrev:'prev',NextChapter:'right',ClosetNext:'right',HelpPrev:'prev',HelpNext:'right',Home:'home',PauseHome:'home',FailHome:'home',ResultHome:'home',NextHome:'home',SaveResultHome:'home',Leave:'home',Heroes:'theo',Backgrounds:'tunnels'};
 if(icons[id])return choose('icon_'+icons[id],'btn_'+icons[id]);
 if(id==='Retry')return choose('icon_retry','btn_retry');
 if(id==='HowTo')return choose('btn_how_to_play','btn_howto');

 if(id==='Gift')return choose('icon_gift','btn_gift_frame','btn_gift');
 if(id==='Energy')return choose('capsule_energy_lightning','hud_energy_lightning','hud_energy','btn_energy','hud_capsule');
 if(id==='Play'&&t.indexOf('save')>=0)return choose('btn_retry_save');
 if(id==='Next'&&t==='home')return choose('btn_home');
 if(/^Level_/.test(id))return choose(t.indexOf('crown')>=0?'map_node_milestone':t.indexOf('coins')>=0?'map_node_bonus':t.indexOf('locked')>=0?'map_node_locked':t.indexOf('★')>=0?'map_node_complete':'map_node','map_node');
 if(/^Item_/.test(id))return choose(t==='equipped'?'btn_equipped':t==='equip'?'btn_equip':t.indexOf('clear level')===0?'btn_locked':'btn_buy');
 var direct={Play:'play',Map:'map',Closet:'closet',Settings:'settings',Gift:'gift',TeaParty:'party',Shortcut:'shortcut',Revisit:'revisit',Energy:'energy',Close:'close',Pause:'pause',Retry:'retry',PauseRetry:'retry',FailRetry:'retry',Resume:'resume',Claim:'claim',BtnDouble:'double',Next:'next',Revive:'rewind',Spoon:'spoon',Puller:'puller',PrevChapter:'prev',ClosetPrev:'prev',NextChapter:'right',ClosetNext:'right',HelpPrev:'prev',HelpNext:'right',Home:'home',PauseHome:'home',FailHome:'home',ResultHome:'home',NextHome:'home',SaveResultHome:'home',Leave:'home',Stay:'stay',GeneralTab:'general',SoundTab:'sound',HowTo:'howto',Heroes:'theo',Backgrounds:'tunnels',HelpDone:'got_it',DismissTutorial:'dismiss',RetryResultSave:'retry_save'};
 if(id==='musicToggle'||id==='sfxToggle')return choose('btn_'+(id==='musicToggle'?'music':'sfx'));
 if(id==='Vibration')return choose('btn_vibration');if(id==='Motion')return choose('btn_motion');
 if(/(Down|Up)$/.test(id))return choose(id.indexOf('Down')>=0?'btn_minus':'btn_plus');
 if(id==='PlatformAction')return choose(t.indexOf('add')>=0?'btn_add':'btn_visit');if(id==='PlatformCheck')return choose(t.indexOf('claimed')>=0?'btn_claimed':'btn_check_reward');
 if(/Ad$/.test(id))return choose(t.indexOf('retry save')>=0?'btn_retry_save':t.indexOf('opening')>=0?'btn_watch_ad':'btn_watch_ad');
 if(t.indexOf('opening')>=0)return choose('btn_watch_ad');if(t.indexOf('retry save')>=0)return choose('btn_retry_save');
 return choose('btn_'+(direct[id]||id.toLowerCase()));
}
function decorateButton(view){var n=view.n,label=view.label,nodeLabel=view.nodeLabel;if(!cc.isValid(n))return false;var title=String(label.string),id=buttonId(view.id,title);if(view.asset===id&&view.title===title)return true;if(view.id==='Energy'&&view.asset===id){view.title=title;if(nodeLabel._ttuArtText){nodeLabel._ttuArtText.show=true;nodeLabel._ttuArtText.value=null;renderText(nodeLabel._ttuArtText);}return true;}view.asset=id;view.title=title;var old=nodeLabel.getChildByName('ButtonImage');if(old){old.active=false;old.destroy();}var isLevel=/^Level_/.test(view.id),isDynamic=/^Item_/.test(view.id)||view.id==='Energy';
 if(!id)return true;var g=n.getComponent(cc.Graphics);if(g)g.enabled=false;var art=sprite(nodeLabel,id,n.width,n.height,'contain');if(!art)return true;art.name='ButtonImage';if(isLevel){var stars=(title.match(/★+/)||[''])[0].length;for(var si=0;si<stars;si++){var star=sprite(art,'icon_star',28,26,'contain');star.setPosition((si-(stars-1)/2)*31,-31);}}if(nodeLabel._ttuArtText){nodeLabel._ttuArtText.show=isLevel;nodeLabel._ttuArtText.value=null;renderText(nodeLabel._ttuArtText);}label.enabled=false;
 var badge=view.badge||n.getChildByName('ArtDynamic');if(badge){badge.active=false;badge.destroy();}
 var value='';if(/opening/i.test(title))value='';else if(view.id==='Play')value=title.indexOf('ALL CLEAR')>=0?'ALL CLEAR':title.match(/LEVEL\s+(\d+)/i)?'LEVEL '+title.match(/LEVEL\s+(\d+)/i)[1]:'';
 else if(view.id==='Energy')value=title;else if(/^(musicToggle|sfxToggle|Vibration|Motion)$/.test(view.id))value=title.split(':').slice(1).join(':').trim();else if(/^Item_/.test(view.id)&&/\d/.test(title))value=title.replace(/coins|Clear Level/gi,'').trim();else if(view.id==='Spoon'||view.id==='Puller')value=(title.match(/\d+/)||[''])[0];
 if(value&&view.id!=='Energy'){var item=/^Item_/.test(view.id),state=/^(musicToggle|sfxToggle|Vibration|Motion)$/.test(view.id),stock=view.id==='Spoon'||view.id==='Puller';badge=child(state||item||view.id==='Play'?n.parent:n,state?view.id+'_State':item?view.id+'_Price':view.id==='Play'?'PlayLevel':'ArtDynamic');view.badge=badge;badge.setPosition(item?80:state&&/^(Vibration|Motion)$/.test(view.id)?0:state?n.width/2+65:stock?40:/Ad$/.test(view.id)?130:0,item?50:state&&/^(Vibration|Motion)$/.test(view.id)?-80:state?0:stock?42:/Ad$/.test(view.id)?90:n.height/2+13);badge.setContentSize(stock?58:state&&/^(Vibration|Motion)$/.test(view.id)?180:item||state?130:Math.max(80,n.width*.65),40);if(state||item||view.id==='Play'){badge.x+=n.x;badge.y+=n.y;}var meta=badge.addComponent(cc.Label);meta.string=value;meta.fontSize=28;meta.overflow=cc.Label.Overflow.SHRINK;badge.setContentSize(stock?58:state&&/^(Vibration|Motion)$/.test(view.id)?180:item||state?130:Math.max(80,n.width*.65),40);text(badge,meta,28);}else if(view.id==='Energy'&&nodeLabel._ttuArtText){nodeLabel._ttuArtText.show=true;nodeLabel._ttuArtText.value=null;renderText(nodeLabel._ttuArtText);}return true;
}
function button(n,id,nodeLabel){var v={n:n,id:id,nodeLabel:nodeLabel,label:nodeLabel.getComponent(cc.Label),asset:null,title:null};buttonViews.push(v);decorateButton(v);return n;}
function background(parent,page,id){var source=choose(id,'bg_'+page,'bg_home');if(!source)return null;var n=child(parent,'ArtBackground');n.zIndex=-1000;var art=sprite(n,source,720,1560,'cover');return n;}
function hero(parent,id,w,h){var asset=choose('hero_'+id,'hero_theo_01');return asset?sprite(parent,asset,w,h,'contain'):null;}
function bindHome(heroNode,logoNode){homePose=[];[heroNode,logoNode].forEach(function(n,i){if(n)homePose.push({n:n,index:i,x:n.x,y:n.y,scaleX:n.scaleX,scaleY:n.scaleY,angle:n.angle});});}
function animateGift(parent){if(!imageInfo('gift_00'))return remember('gift_00');var n=sprite(parent,'gift_00',parent.width*.72,parent.height*.72,'contain');n.setPosition(0,15);giftViews.push({n:n});return n;}
function walk(board,state,path,heroID,done){if(!path||!path.length){done();return;}var pitch=660/state.n,actor=hero(board,heroID,pitch*.66,pitch*.80);if(!actor){done();return;}actor.zIndex=50;function position(index){return {x:-330+pitch/2+index%state.n*pitch,y:330-pitch/2-Math.floor(index/state.n)*pitch};}var origin=position(path[0]);actor.setPosition(origin.x,origin.y);var action=cc.tween(actor);path.slice(1).forEach(function(index){action=action.to(.085,position(index)).call(function(){if(root.TTUAudio&&state.cells[index]&&state.cells[index][3])root.TTUAudio.sfx('sfx_snack_pick');});});action.call(function(){if(cc.isValid(actor))actor.destroy();if(root.TTUAudio)root.TTUAudio.sfx('sfx_order_full');done();}).start();}
function update(dt,reduced,active){if(active!==false)time+=Math.min(.1,dt);labels=labels.filter(function(v){return renderText(v);});buttonViews=buttonViews.filter(decorateButton);buttonViews.forEach(guardButton);cardViews=cardViews.filter(function(v){if(!cc.isValid(v.n)||!cc.isValid(v.action))return false;v.n.getComponent(cc.Button).interactable=readyNode(v.n)&&v.action.getComponent(cc.Button).interactable;return true;});giftViews=giftViews.filter(function(v){if(!cc.isValid(v.n))return false;var i=reduced?0:Math.floor(time*10)%10,f=frame('gift_'+String(i).padStart(2,'0'));if(f)v.n.getComponent(cc.Sprite).spriteFrame=f;return true;});homePose=homePose.filter(function(p){if(!cc.isValid(p.n))return false;var phase=time*(p.index?.95:1.34)+p.index*1.8,offset=reduced?0:Math.sin(phase);p.n.setPosition(p.x,p.y+offset*(p.index?5:10));p.n.angle=p.angle+(reduced?0:Math.sin(phase*.8)*(p.index?1:1.6));p.n.scaleX=p.scaleX*(1+(reduced?0:offset*(p.index?.008:.014)));p.n.scaleY=p.scaleY*(1+(reduced?0:offset*(p.index?.008:.014)));return true;});}
function load(nextBase){base=nextBase||base;var token=++loadGeneration;pendingFiles={};missing={};return new Promise(function(resolve,reject){function loadManifest(value){if(token!==loadGeneration)return reject(Error('art-superseded'));if(!value||typeof value!=='object'||!value.images||!Object.keys(value.images).length||!value.font||!value.glyphs||!Object.keys(value.glyphs).length)return reject(Error('art-manifest-invalid'));manifest=value;var files=Array.from(new Set(Object.keys(manifest.images||{}).filter(function(id){var info=imageInfo(id);return info.preload!==false&&!/^hero_(?!theo_01$)/.test(id)&&!/^bg_bg_(?!01$)/.test(id);}).map(function(id){return imageInfo(id).file;})));Promise.all(files.map(function(file){return loadFile(file,token);})).then(function(){if(token!==loadGeneration)return reject(Error('art-superseded'));loaded=true;frames={};generatedBitmapFont=null;resolve();},reject);}
 if(typeof fetch==='function'&&cc.sys.isBrowser)fetch(base+'manifest.json?attempt='+token,{cache:'no-store'}).then(function(r){if(!r.ok)throw Error('art-manifest-http-'+r.status);return r.json();}).then(loadManifest,reject);else try{loadManifest(root.TTUArtManifest||require('../subpackages/resources/art/manifest.js'));}catch(err){reject(err);}});}
root.TTUArt={load:load,configure:function(value){if(value&&value.onAssetError)onAssetError=value.onAssetError;},has:function(id){return !!imageInfo(id);},sprite:sprite,surface:surface,text:text,button:button,card:function(n,action){cardViews.push({n:n,action:action});},readyNode:readyNode,background:background,hero:hero,bindHome:bindHome,animateGift:animateGift,walk:walk,update:update,frame:frame,choose:choose,replaceSurface:replaceSurface,diagnostics:function(){return {loaded:loaded,images:Object.keys(manifest.images||{}).length,glyphs:Object.keys(manifest.glyphs||{}).length,pendingFiles:Object.keys(pendingFiles),missing:Object.keys(missing)};}};
})(typeof window!=='undefined'?window:globalThis);

