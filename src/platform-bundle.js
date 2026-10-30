(function(){'use strict';var sources={"src/store.js":function(require,module,exports){
(function (root, factory) {
  'use strict';
  var singleton = factory(root);
  if (typeof module === 'object' && module.exports) module.exports = singleton;
  else root.TTUStore = singleton;
}(typeof globalThis !== 'undefined' ? globalThis : this, function (root) {
  'use strict';
  var KEY = 'ttu.save.v1';
  function clone(value) { return JSON.parse(JSON.stringify(value)); }
  function plain(value) { return !!value && typeof value === 'object' && !Array.isArray(value); }
  function decodeRaw(value) { return typeof value === 'string' ? JSON.parse(value) : plain(value) ? clone(value) : value; }
  function canonical(value) {
    if (Array.isArray(value)) return '[' + value.map(canonical).join(',') + ']';
    if (plain(value)) return '{' + Object.keys(value).sort().map(function (key) { return JSON.stringify(key) + ':' + canonical(value[key]); }).join(',') + '}';
    return JSON.stringify(value);
  }
  function integer(value, fallback, max) { return Number.isSafeInteger(value) && value >= 0 ? Math.min(max, value) : fallback; }
  function create(options) {
    options = options || {};
    var storage = options.storage || null, now = options.now || function () { return Date.now(); }, table = options.unlockTable || null;
    var current = null, lastError = null, lastLoad = null, kitStore=null;
    function standardStore(){if(!kitStore)kitStore=new (require('./platform-kit-bridge').SaveStore)(defaults(),{key:KEY,storage:backend(),now:now,login:false});return kitStore;}
    function backend() { if (storage) return storage; try { return root.localStorage; } catch (e) { throw new Error('Storage is unavailable'); } }
    function items() { return table && Array.isArray(table.items) ? table.items : Array.isArray(table) ? table : []; }
    function freeItems() { return items().filter(function (item) { return item.unlock === 'free'; }); }
    function defaults() {
      var free = freeItems(), hero = free.find(function (item) { return item.group === 'hero' || item.group === 'skin' || item.group === 'character'; }), bg = free.find(function (item) { return item.group === 'background' || item.group === 'bg'; });
      var heroID = hero ? hero.id : 'hero_free', bgID = bg ? bg.id : 'bg_free';
      return { version: 1, energy: 10, energyTs: now(), coins: 0, unlocked: 1, activeLevel: 0, stars: {}, owned: [heroID, bgID], equipped: { hero: heroID, background: bgID }, skin: heroID, bg: bgID,
        settings: { music: true, sfx: true, musicVolume: 7, sfxVolume: 7, vibration: true, reducedMotion: false },
        gift: { charges: 1 }, pendingResult: null, partyMenu: [], partyDay: null, partyStart: 1, partyUseDay: null, partyLevels: [], kettlePins: 0, kettleLevels: [], boosters: { spoon: 0, puller: 0 }, seenMechanics: {}, receipts: [], snacks: 0, tickets: 0, fittings: 0, stickers: 0, lifetimeSnacks: 0, platformClaims: {}, meta: {}, partyRuns: {} };
    }
    function normalize(raw) {
      var def = defaults(), state = def;
      if (!plain(raw)) return state;
      ['energy','coins','unlocked','kettlePins','snacks','tickets','fittings','stickers','lifetimeSnacks'].forEach(function (field) {
        var caps = { energy:10, coins:99999, unlocked:71, kettlePins:5, snacks:999, tickets:99, fittings:99, stickers:999, lifetimeSnacks:99999999 };
        state[field] = integer(raw[field], def[field], caps[field]);
      });
      state.unlocked = Math.max(1, state.unlocked);
      state.activeLevel = integer(raw.activeLevel,0,70);
      state.energyTs = integer(raw.energyTs, def.energyTs, now());
      if (state.energyTs === 0) state.energyTs = now();
      state.stars = {};
      if (plain(raw.stars)) Object.keys(raw.stars).forEach(function (id) { if (/^([1-9]|[1-6][0-9]|70)$/.test(id) && Number.isSafeInteger(raw.stars[id]) && raw.stars[id] >= 0 && raw.stars[id] <= 3) state.stars[id] = raw.stars[id]; });
      var validIDs = items().map(function (item) { return item.id; });
      if (Array.isArray(raw.owned)) state.owned = Array.from(new Set(def.owned.concat(raw.owned.filter(function (id) { return typeof id === 'string' && /^[a-zA-Z0-9_.-]{1,80}$/.test(id) && (!validIDs.length || validIDs.indexOf(id) >= 0); }))));
      var equipped = plain(raw.equipped) ? raw.equipped : {};
      function selectID(candidate, fallback, group) {
        if (state.owned.indexOf(candidate) < 0) return fallback;
        var item = items().find(function (entry) { return entry.id === candidate; });
        if (!item) return validIDs.length ? fallback : candidate;
        var bg = item.group === 'background' || item.group === 'bg';
        return (group === 'background') === bg ? candidate : fallback;
      }
      state.equipped = { hero: selectID(equipped.hero || raw.skin, def.equipped.hero, 'hero'), background: selectID(equipped.background || raw.bg, def.equipped.background, 'background') };
      state.skin = state.equipped.hero; state.bg = state.equipped.background;
      var settings = plain(raw.settings) ? raw.settings : {};
      ['music','sfx','vibration','reducedMotion'].forEach(function (key) { if (typeof settings[key] === 'boolean') state.settings[key] = settings[key]; });
      ['musicVolume','sfxVolume'].forEach(function (key) { state.settings[key] = integer(settings[key], def.settings[key], 10); });
      state.gift = { charges: plain(raw.gift) ? integer(raw.gift.charges, 1, 1) : 1 };
      if (plain(raw.boosters)) ['spoon','puller'].forEach(function (key) { state.boosters[key] = integer(raw.boosters[key], 0, 9); });
      state.partyMenu = Array.isArray(raw.partyMenu) ? Array.from(new Set(raw.partyMenu.filter(function (kind) { return Number.isInteger(kind) && kind >= 1 && kind <= 4; }))).slice(0,4) : [];
      state.partyDay = typeof raw.partyDay === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(raw.partyDay) ? raw.partyDay : Number.isInteger(raw.partyDay) && raw.partyDay >= 0 ? raw.partyDay : null;
      state.partyStart = Math.max(1,integer(raw.partyStart,1,71));
      state.partyUseDay = Number.isInteger(raw.partyUseDay) && raw.partyUseDay >= 0 ? raw.partyUseDay : null;
      state.partyLevels = Array.isArray(raw.partyLevels) ? Array.from(new Set(raw.partyLevels.filter(function (id) { return Number.isInteger(id) && id >= 1 && id <= 70; }))).slice(0,3) : [];
      state.kettleLevels = Array.isArray(raw.kettleLevels) ? Array.from(new Set(raw.kettleLevels.filter(function (id) { return Number.isInteger(id) && id >= 25 && id <= 70; }))).slice(0,70) : [];
      if (plain(raw.seenMechanics)) Object.keys(raw.seenMechanics).forEach(function (id) { if (/^[A-Za-z0-9_-]{1,40}$/.test(id) && raw.seenMechanics[id] === true) state.seenMechanics[id] = true; });
      state.receipts = Array.isArray(raw.receipts) ? Array.from(new Set(raw.receipts.filter(function (id) { return typeof id === 'string' && id.length > 0 && id.length <= 160; }))) : [];
      ['platformClaims','partyRuns'].forEach(function (field) { if (plain(raw[field])) Object.keys(raw[field]).forEach(function (id) { if (/^[A-Za-z0-9_.:-]{1,100}$/.test(id) && (raw[field][id] === true || Number.isSafeInteger(raw[field][id]))) state[field][id] = raw[field][id]; }); });
      if (plain(raw.pendingResult)) {
        var pending=raw.pendingResult,receipt=pending.id||pending.receipt,level=pending.L||pending.level;
        if(typeof receipt==='string'&&receipt.length>0&&receipt.length<=160&&Number.isSafeInteger(level)&&level>=1&&level<=70&&Number.isSafeInteger(pending.coins)&&pending.coins>=0&&pending.coins<=99999
          &&(pending.stars===undefined||(Number.isInteger(pending.stars)&&pending.stars>=1&&pending.stars<=3))
          &&(pending.party===undefined||typeof pending.party==='boolean')&&(pending.claimed===undefined||typeof pending.claimed==='boolean')
          &&(pending.day===undefined||(Number.isInteger(pending.day)&&pending.day>=0))
          &&(pending.menu===undefined||(Array.isArray(pending.menu)&&pending.menu.length<=4&&pending.menu.every(function(kind){return Number.isInteger(kind)&&kind>=1&&kind<=4;})))
          &&(pending.skinBonus===undefined||(Number.isInteger(pending.skinBonus)&&pending.skinBonus>=0&&pending.skinBonus<=pending.coins))
          &&(pending.pace===undefined||['wave','crunch','breather'].indexOf(pending.pace)>=0))state.pendingResult=clone(pending);
      }
      if(plain(raw.meta))state.meta=clone(raw.meta);
      if(Object.keys(state.platformClaims).some(function(k){return /^profile-/.test(k)&&state.platformClaims[k]===true;}))state.platformClaims.profile=true;
      return state;
    }
    function backup(raw, reason) {
      if (raw === null || raw === undefined || raw === '') return;
      try { backend().setItem(KEY + '.backup.' + now() + '.' + reason, raw); } catch (e) { /* Never erase the original on backup failure. */ }
    }
    function load() {
      try {var saved=standardStore().load();current=normalize(saved.data);lastLoad={status:saved.status};lastError=saved.ok?null:saved.error;return clone(current);}
      catch(e){current=current||defaults();lastError='read-failed';lastLoad={status:'read-failed'};return clone(current);}
    }
    function result(ok, status, error) { return { ok:ok, status:status, state:clone(current || defaults()), error:error || null }; }
    function transact(mutator) {
      if (!current) load();
      var disk;
      try {
        disk = backend().getItem(KEY);
        if (disk && disk !== '') {
          try { var parsed = decodeRaw(disk); if (plain(parsed)) current = normalize(parsed); } catch (ignored) { /* Keep the recovered current data; backup already occurred at load. */ }
        }
      } catch (e) { lastError = 'read-failed'; return result(false, 'read-failed', 'Could not read saved progress. Please try again.'); }
      var draft = clone(current), verdict;
      try { verdict = mutator(draft); } catch (e) { return result(false, 'rejected', e && e.message || 'Could not apply this change.'); }
      if (verdict === false) return result(false, 'rejected', 'This action is unavailable.');
      var normalized = normalize(draft);
      // Reject invalid transaction values instead of silently repairing rewards.
      if (JSON.stringify(normalized) !== JSON.stringify(draft)) return result(false, 'invalid', 'The saved change was invalid.');
      var standard=standardStore();standard.data=clone(current);standard.status='loaded';
      var written=standard.update(function(target){Object.keys(target).forEach(function(k){delete target[k];});Object.assign(target,draft);});
      if(!written.ok){lastError=written.error;return result(false,'write-failed','Could not save progress. Please retry.');}
      current = draft; lastError = null;
      return result(true, 'saved');
    }
    function claim(receipt, mutator) {
      if (typeof receipt !== 'string' || !receipt || receipt.length > 160) return result(false,'invalid','Invalid reward receipt.');
      var duplicate = false;
      var answer = transact(function (draft) {
        if (draft.receipts.indexOf(receipt) >= 0) { duplicate=true; return; }
        if (mutator(draft) === false) return false;
        draft.receipts.push(receipt);
      });
      if (answer.ok && duplicate) answer.status = 'duplicate';
      return answer;
    }
    function regenDraft(draft) {
      var time = now();
      if (draft.energyTs > time) draft.energyTs = time;
      if (draft.energy >= 10) return;
      var gained = Math.floor(Math.max(0,time-draft.energyTs)/180000);
      if (gained > 0) { draft.energy = Math.min(10,draft.energy+gained); draft.energyTs = draft.energy === 10 ? time : draft.energyTs+gained*180000; }
    }
    return {
      key:KEY, create:create,
      configure:function (config) { config=config||{}; if (config.storage) storage=config.storage; if (config.now) now=config.now; if (config.unlockTable) table=config.unlockTable; return this; },
      defaults:defaults, load:load, get:function () { if (!current) load(); return clone(current); },
      isClaimed:function(kind){var d=this.get();return !!(d.meta&&d.meta.recoveredFromCorrupt)||d.platformClaims[kind]===true;},
      update:function(mutator){var res=transact(mutator);res.data=res.state;return res;},
      diagnostics:function () { return {error:lastError,load:lastLoad}; }, transact:transact, claim:claim,
      regenerateEnergy:function () { if (!current) load(); var draft=clone(current);regenDraft(draft); if(draft.energy===current.energy&&draft.energyTs===current.energyTs) return result(true,'unchanged'); return transact(regenDraft); },
      startLevel:function (level,retry) {
        if (!Number.isInteger(level) || level < 1 || level > 70) return result(false,'invalid','This level is unavailable.');
        if (retry === true) { if(!current)load();return current.activeLevel===level?result(true,'retry'):result(false,'rejected','Only the current level can be retried for free.'); }
        return transact(function (draft) { regenDraft(draft); if(level>draft.unlocked) throw new Error('Clear the previous level first.'); if(draft.energy<1) throw new Error('Energy is empty. A new point arrives every 3 minutes.'); if(draft.energy===10) draft.energyTs=now(); draft.energy--;draft.activeLevel=level; });
      }
    };
  }
  return create();
}));

},"src/platform.js":function(require,module,exports){
'use strict';
var kit=require('./platform-kit-bridge');
function create(options){
 options=options||{};
 function sdk(method){var api=options.getSDK?options.getSDK():null;if(api&&typeof api[method]==='function')return api;var list=[typeof TTMinis!=='undefined'&&TTMinis.game,typeof tt!=='undefined'&&tt,typeof wx!=='undefined'&&wx];for(var i=0;i<list.length;i++)if(list[i]&&typeof list[i][method]==='function')return list[i];return null;}
 var ads=new kit.RewardedService({getSDK:sdk,now:options.now}),missions=new kit.Missions({getSDK:sdk,now:options.now});
 return {create:create,configure:function(){return this;},
 reward:function(role,owner){return ads.request({placementKey:role,ownerId:owner}).then(function(r){return{completed:r.rewarded,status:r.status==='unsupported'||r.status==='unconfigured'?'unavailable':r.status,message:r.message,receipt:r.rewarded?'ttu.ad.'+Date.now()+'.'+r.requestId:undefined};});},
 cancel:function(owner){if(owner===undefined){if(ads.pending)ads.cancelOwner(ads.pending.options.ownerId);}else ads.cancelOwner(owner);missions.cancel();},tick:function(){ads.tick();missions.tick();},exitAvailable:function(){return ads.exitAvailable();},exit:function(){ads.exit();},
 shortcut:function(){return missions.navigate('shortcut');},profile:function(){return missions.navigate('profile');},verifyShortcut:function(){return missions.query('shortcut');},verifyProfile:function(){return missions.query('profile');},
 resume:function(){ads.onShow();missions.onResume();},hide:function(){ads.onHide();},
 growth:function(store,options){options=options||{};options.store=store;options.missions=missions;options.native=!!sdk('canIUse');return new kit.HomeGrowthEntries.Controller(options);},
 canVibrate:function(){return!!sdk('vibrateShort');},vibrate:function(){var api=sdk('vibrateShort');if(!api)return false;try{var r=api.vibrateShort({type:'light',fail:function(){}});if(r&&r.catch)r.catch(function(){});return true;}catch(e){return false;}},
 diagnostics:function(){return{adPending:!!ads.pending,adSession:ads.isNativeBusy(),missions:Object.keys(missions.pending).length};}};
}
module.exports=create();

},"src/platform-kit-bridge.js":function(require,module,exports){
'use strict';
module.exports={RewardedService:require('../assets/tiktok-platform/RewardedService'),Missions:require('../assets/tiktok-platform/TikTokMissionService'),HomeGrowthEntries:require('../assets/tiktok-platform/HomeGrowthEntries'),SaveStore:require('../assets/tiktok-platform/SaveStore'),config:require('../assets/tiktok-platform/PlatformConfig')};

},"assets/tiktok-platform/HomeGrowthEntries.js":function(require,module,exports){
'use strict';
// TikTok Platform Kit 2.0 - fixed home entries: "Add to Home Screen" and "Profile Revisit". Copy unchanged.
// 待真机复测 (Node-tested only: tests/home-entries.test.js).
//
// Put two button nodes in the home bottom row (nothing else goes in that row, rule U3), add this
// component to their parent, drag the two nodes into shortcutNode / profileNode, then from the home scene:
//     this.getComponent('HomeGrowthEntries').init(saveStore, {onGranted: function (kind, data) { ...top bar... }});
// The reward is ALWAYS PlatformConfig.growthReward() (5B in this game's currency, Saul 2026-10-29);
// there is no option to change it. MissionFlow does the platform calls (TTMinis.game -> tt -> wx).
// Rules taken from earlier games:
//  - the entries are always shown, also in a browser (ThumbPinball / GimblesGem hid them, nobody saw them);
//  - without the TikTok runtime a tap shows "Available in TikTok" (never a fake success, TovesTulip/AdasAmber);
//  - an entry whose icon did not load shows its text instead of an empty box;
//  - taps during a request are merged and a reward is paid once per entry per save.
var MissionFlow = require('./MissionFlow');

var TEXT = {
  shortcut: 'Add to Home',
  profile: 'Profile Revisit',
  unsupported: 'Available in TikTok',
  collected: 'Collected'
};
var ICON_WAIT_MS = 2000;

function Controller(options) {
  options = options || {};
  if (!options.store) throw new Error('HomeGrowthEntries needs the game SaveStore');
  var self = this;
  this.config = options.config || require('./PlatformConfig');
  this.toast = typeof options.toast === 'function' ? options.toast : function () {};
  this.renderState = typeof options.render === 'function' ? options.render : function () {};
  this.iconFallback = {shortcut: false, profile: false};
  this.lastView = null;
  this.flow = new MissionFlow({
    store: options.store, config: this.config, missions: options.missions, native: options.native,
    missionTimeoutMs: options.missionTimeoutMs,
    render: function (view) { self.lastView = view; self._render(); },
    onGranted: options.onGranted
  });
  this._render();
}

Controller.TEXT = TEXT;

Controller.prototype.rewardAmount = function () {
  try { return this.config.growthReward(); } catch (_) { return 0; }
};

Controller.prototype.state = function () {
  var flow = this.flow, amount = this.rewardAmount(), self = this, view = this.lastView;
  function entry(kind) {
    var claimed = flow.isClaimed(kind);
    return {
      kind: kind, title: TEXT[kind], claimed: claimed,
      reward: claimed ? TEXT.collected : (amount > 0 ? '+' + amount : ''),
      busy: !!(view && view.kind === kind && view.busy),
      iconFallback: self.iconFallback[kind],
      text: self.iconFallback[kind] ? TEXT[kind] + (claimed ? '\n' + TEXT.collected : (amount > 0 ? '\n+' + amount : '')) : ''
    };
  }
  return {shortcut: entry('shortcut'), profile: entry('profile'), message: view ? view.message : '', native: flow.native};
};

Controller.prototype._render = function () { try { this.renderState(this.state()); } catch (_) {} };

// One tap on an entry. Returns what happened, for tests and logs.
Controller.prototype.press = function (kind) {
  if (kind !== 'shortcut' && kind !== 'profile') return 'ignored';
  var flow = this.flow;
  if (!flow.native) { this.toast(TEXT.unsupported); return 'unsupported'; }
  if (flow.isClaimed(kind)) { this.toast(MissionFlow.TEXT.claimed); return 'claimed'; }
  if (flow.kind !== kind) { flow.open(kind); return 'opened'; }   // open() checks first
  var view = flow.view();
  if (view.busy) return 'busy';                                    // merged
  if (view.action === 'check') { flow.check(); return 'check'; }
  flow.start();
  return 'start';
};

// The icon of this entry is missing or did not load: show its text instead.
Controller.prototype.iconFailed = function (kind) {
  if (this.iconFallback[kind] === false) { this.iconFallback[kind] = true; this._render(); }
};

Controller.prototype.onShow = function () { this.flow.onShow(); };
Controller.prototype.tick = function () { this.flow.tick(); };
Controller.prototype.dispose = function () { this.flow.dispose(); };

function platformToast(text) {
  var sdk = (typeof TTMinis !== 'undefined' && TTMinis && TTMinis.game) || (typeof tt !== 'undefined' && tt) || null;
  if (sdk && typeof sdk.showToast === 'function') {
    try { sdk.showToast({title: text, icon: 'none', duration: 2000}); return true; } catch (_) {}
  }
  return false;
}

function textureLoaded(sprite) {
  var frame = sprite && sprite.spriteFrame;
  var texture = frame && typeof frame.getTexture === 'function' ? frame.getTexture() : null;
  return !!(texture && texture.loaded);
}

var exported = {Controller: Controller, TEXT: TEXT};
if (typeof cc !== 'undefined' && cc && typeof cc.Class === 'function') {
  exported = cc.Class({
    extends: cc.Component,
    properties: {
      shortcutNode: {default: null, type: cc.Node},
      profileNode: {default: null, type: cc.Node},
      messageLabel: {default: null, type: cc.Label}
    },
    statics: {Controller: Controller, TEXT: TEXT},
    init: function (store, options) {
      options = options || {};
      var self = this;
      if (this.controller) this.controller.dispose();
      this.controller = new Controller({
        store: store, onGranted: options.onGranted, missions: options.missions, native: options.native,
        toast: function (text) { if (!platformToast(text)) self._message(text); },
        render: function (state) { self._paint(state); }
      });
      ['shortcut', 'profile'].forEach(function (kind) {
        var node = self[kind + 'Node'];
        if (!node) { cc.error('HomeGrowthEntries: ' + kind + 'Node is not set'); return; }
        node.active = true;
        node.off(cc.Node.EventType.TOUCH_END, self['_tap_' + kind], self);
        self['_tap_' + kind] = function () { self.controller.press(kind); };
        node.on(cc.Node.EventType.TOUCH_END, self['_tap_' + kind], self);
        var sprite = node.getComponent(cc.Sprite);
        if (!sprite || !sprite.spriteFrame) { self.controller.iconFailed(kind); return; }
        self.scheduleOnce(function () { if (!textureLoaded(sprite)) self.controller.iconFailed(kind); }, ICON_WAIT_MS / 1000);
      });
      if (!this._onShow) {
        this._onShow = function () { if (self.controller) self.controller.onShow(); };
        cc.game.on(cc.game.EVENT_SHOW, this._onShow);
      }
      this.controller._render();
      return this.controller;
    },
    _label: function (node) {
      var child = node.getChildByName('HomeEntryText');
      if (!child) {
        child = new cc.Node('HomeEntryText');
        child.parent = node;
        var label = child.addComponent(cc.Label);
        label.fontSize = 24; label.lineHeight = 28;
        label.horizontalAlign = cc.Label.HorizontalAlign.CENTER;
        label.overflow = cc.Label.Overflow.SHRINK;
        child.setContentSize(node.width || 160, node.height || 80);
        child.color = cc.Color.WHITE;
      }
      return child.getComponent(cc.Label);
    },
    _paint: function (state) {
      var self = this;
      ['shortcut', 'profile'].forEach(function (kind) {
        var node = self[kind + 'Node'];
        if (!node) return;
        var e = state[kind], label = self._label(node);
        // Icon missing or not loaded: the entry title is drawn as text, so the slot is never an empty box.
        label.string = e.iconFallback ? e.title + (e.reward ? '\n' + e.reward : '') : e.reward;
        label.node.active = label.string !== '';
        var button = node.getComponent(cc.Button);
        if (button) button.interactable = !e.busy;
      });
      if (state.message) this._message(state.message);
    },
    _message: function (text) {
      if (this.messageLabel) { this.messageLabel.string = text; this.messageLabel.node.active = true; }
    },
    update: function () { if (this.controller) this.controller.tick(); },
    onDestroy: function () {
      if (this._onShow) cc.game.off(cc.game.EVENT_SHOW, this._onShow);
      if (this.controller) this.controller.dispose();
      this.controller = null;
    }
  });
}
module.exports = exported;

},"assets/tiktok-platform/MissionFlow.js":function(require,module,exports){
'use strict';
// TikTok Platform Kit v1 - logic of the two home entries (Add to Home Screen, Profile Revisit). Copy unchanged.
// It draws nothing. The game owns the art and calls render(view) output into its own panel.
//
//   var flow = new MissionFlow({
//     store: save,                                   // SaveStore of this game (coins live in the same save)
//     reward: function (kind, draft) { draft.coins += 25; },   // edit the draft only; v7.7: omit it to pay
//                                                    // PlatformConfig.growthReward() (5B) into draft.coins
//     rewardText: {shortcut: '+25 Coins', profile: '+25 Coins'},
//     render: function (view) { ...update the panel from view... },
//     onGranted: function (kind, data) { ...refresh the top bar from data... }
//   });
//   home icon tap        -> flow.open('shortcut' | 'profile')
//   panel main button    -> view.action === 'start' ? flow.start() : flow.check()
//   panel close (X)      -> flow.close()
//   cc.game.EVENT_SHOW   -> flow.onShow()
//   every frame          -> flow.tick()
//   home scene destroyed -> flow.dispose()
//
// Guarantees (each one is a real bug from an earlier game):
//  - Leaving TikTok and coming back cancels the old check and starts a new one; a late old answer is dropped.
//  - Taps during one check are merged; a check always ends (10 s at most) with a visible message.
//  - Every result that is not a reward shows a message. No silent return.
//  - A navigation answer never overwrites a newer check result.
//  - Reward + "claimed" flag are saved in ONE write; a failed save pays nothing and can be retried.
//  - Only canReceiveReward === true pays, once per entry per save.
var TikTokMissionService = require('./TikTokMissionService');

var TEXT = {
  intro_shortcut: 'Add this game to your home screen, open it from the new icon, then come back for your reward.',
  intro_profile: 'Open your TikTok Profile, open this game from the sidebar, then come back for your reward.',
  opening: 'Opening TikTok...',
  navigated: 'Now open the game from that entry, then tap CHECK REWARD.',
  checking: 'Checking your reward...',
  wait: 'Please wait for the current request.',
  granted: 'Reward received: ',
  claimed: 'Reward already collected.',
  saveFailed: 'Could not save your reward. Please try again.',
  preview: 'LOCAL PREVIEW: open the game inside TikTok to use this.'
};
var KINDS = {shortcut: true, profile: true};

// Same lookup order as TikTokMissionService.js (TTMinis.game, then tt, then wx). v1.2: a runtime that
// only exposes tt (Mabel's Meadow r7/r8) used to show the LOCAL PREVIEW text inside TikTok.
function hasNativeSDK() {
  var candidates = [
    typeof TTMinis !== 'undefined' && TTMinis && TTMinis.game,
    typeof tt !== 'undefined' && tt,
    typeof wx !== 'undefined' && wx
  ];
  for (var i = 0; i < candidates.length; i++) {
    var c = candidates[i];
    if (c && (typeof c === 'object' || typeof c === 'function') && typeof c.canIUse === 'function') return true;
  }
  return false;
}

function MissionFlow(options) {
  options = options || {};
  var copy = {};
  for (var key in options) if (Object.prototype.hasOwnProperty.call(options, key)) copy[key] = options[key];
  options = copy;
  // v7.7 (kit 2.0): reward omitted = the fixed growth reward of PlatformConfig.js (5B in this game's
  // currency, Saul 2026-10-29), added to draft.coins; reward text '+N Coins'. growthReward() throws until
  // normalLevelCoins is set, so a forgotten B pays nothing (SaveStore.update refuses the write).
  if (options.store && options.reward === undefined && typeof options.render === 'function') {
    var growth = options.config || require('./PlatformConfig');
    options.reward = function (kind, draft) { draft.coins = (Number(draft.coins) || 0) + growth.growthReward(); };
    if (!options.rewardText) {
      var amount = '';
      try { amount = '+' + growth.growthReward() + ' Coins'; } catch (_) {}
      options.rewardText = {shortcut: amount, profile: amount};
    }
  }
  if (!options.store || typeof options.reward !== 'function' || typeof options.render !== 'function') {
    throw new Error('MissionFlow needs store, reward(kind, draft) and render(view)');
  }
  this.store = options.store;
  this.reward = options.reward;
  this.renderView = options.render;
  this.onGranted = options.onGranted || null;
  this.rewardText = options.rewardText || {shortcut: '', profile: ''};
  this.ownsMissions = !options.missions;
  // Own timer on by default, so a check still ends if the game forgets to call tick().
  this.missions = options.missions ||
    new TikTokMissionService(options.missionTimeoutMs ? {timeoutMs: options.missionTimeoutMs} : undefined);
  this.native = options.native !== undefined ? !!options.native : hasNativeSDK();
  this.kind = null;
  this.phase = 'closed';      // closed | idle | opening | checking | done
  this.message = '';
  this.version = 0;           // changes on open / close / return from background
  this.op = 0;                // changes on every new request; only the newest may update the panel
}

MissionFlow.prototype.isClaimed = function (kind) { return this.store.isClaimed(kind); };

MissionFlow.prototype.view = function () {
  var claimed = this.kind ? this.isClaimed(this.kind) : false;
  var busy = this.phase === 'opening' || this.phase === 'checking';
  return {
    open: this.kind !== null, kind: this.kind, phase: this.phase, busy: busy, claimed: claimed,
    message: this.message, native: this.native,
    rewardText: this.kind ? (this.rewardText[this.kind] || '') : '',
    // The single main button: go to TikTok first, check after coming back. Disabled while busy or claimed.
    action: claimed ? 'none' : (this.phase === 'idle' && this.navigatedOnce ? 'check' : 'start'),
    canStart: !busy && !claimed, canCheck: !busy && !claimed
  };
};

MissionFlow.prototype._render = function () { try { this.renderView(this.view()); } catch (_) {} };

MissionFlow.prototype._guard = function () {
  var self = this, version = this.version, kind = this.kind;
  return function () { return self.version === version && self.kind === kind; };
};

MissionFlow.prototype.open = function (kind) {
  if (!KINDS[kind]) return;
  this.missions.cancel();
  this.kind = kind;
  this.version++; this.op++;
  this.navigatedOnce = false;
  this.phase = 'idle';
  this.message = this.isClaimed(kind) ? TEXT.claimed : (this.native ? TEXT['intro_' + kind] : TEXT.preview);
  this._render();
  if (!this.isClaimed(kind) && this.native) this.check();
};

MissionFlow.prototype.start = function () {
  if (!this.kind) return;
  if (this.isClaimed(this.kind)) { this.message = TEXT.claimed; this._render(); return; }
  if (this.phase === 'opening' || this.phase === 'checking') { this.message = TEXT.wait; this._render(); return; }
  var self = this, op = ++this.op, isCurrent = this._guard();
  this.phase = 'opening'; this.message = TEXT.opening; this._render();
  return this.missions.navigate(this.kind, {isCurrent: isCurrent}).then(function (r) {
    if (!isCurrent() || op !== self.op) return;
    self.phase = 'idle';
    if (r.status === 'success') { self.navigatedOnce = true; self.message = TEXT.navigated; }
    else self.message = r.status === 'unsupported' && !self.native ? TEXT.preview : r.message;
    self._render();
  });
};

MissionFlow.prototype.check = function () {
  if (!this.kind) return;
  if (this.isClaimed(this.kind)) { this.message = TEXT.claimed; this._render(); return; }
  if (this.phase === 'checking') return this.pendingCheck;   // merge taps during one check
  if (this.phase === 'opening') { this.message = TEXT.wait; this._render(); return; }
  var self = this, op = ++this.op, isCurrent = this._guard(), kind = this.kind;
  this.phase = 'checking'; this.message = TEXT.checking; this._render();
  this.pendingCheck = this.missions.query(kind, {isCurrent: isCurrent}).then(function (r) {
    if (!isCurrent() || op !== self.op) return;
    self.pendingCheck = null;
    if (r.eligible) { self._grant(kind); return; }
    self.phase = 'idle';
    self.message = r.status === 'unsupported' && !self.native ? TEXT.preview : r.message;
    self._render();
  });
  return this.pendingCheck;
};

MissionFlow.prototype._grant = function (kind) {
  var self = this;
  var result = this.store.update(function (draft) {
    if (draft.platformClaims[kind] === true) return false;
    draft.platformClaims[kind] = true;
    return self.reward(kind, draft);
  });
  if (result.ok) {
    this.phase = 'done';
    this.message = TEXT.granted + (this.rewardText[kind] || '');
    this._render();
    if (this.onGranted) { try { this.onGranted(kind, result.data); } catch (_) {} }
    return;
  }
  this.phase = 'idle';
  this.message = this.isClaimed(kind) ? TEXT.claimed : TEXT.saveFailed;
  this._render();
};

MissionFlow.prototype.close = function () {
  this.missions.cancel();
  this.kind = null;
  this.version++; this.op++;
  this.phase = 'closed'; this.message = ''; this.pendingCheck = null;
  this._render();
};

// Call on cc.game.EVENT_SHOW: the player came back from TikTok (shortcut / profile).
MissionFlow.prototype.onShow = function () {
  this.missions.onResume();          // old query is cancelled and its lock released
  this.version++; this.op++;
  this.pendingCheck = null;
  if (!this.kind) return;
  this.phase = 'idle';
  if (this.isClaimed(this.kind)) { this.message = TEXT.claimed; this._render(); return; }
  this.navigatedOnce = true;
  this.check();                      // always a NEW request after coming back
};

MissionFlow.prototype.tick = function () { this.missions.tick(); };

MissionFlow.prototype.dispose = function () {
  this.close();
  if (this.ownsMissions) this.missions.dispose();
};

MissionFlow.TEXT = TEXT;
module.exports = MissionFlow;

},"assets/tiktok-platform/PlatformConfig.js":function(require,module,exports){
'use strict';
// TikTok Platform Kit 2.0 (Cocos 2.4.15) - the ONLY file each game edits.
// Every other file in assets/tiktok-platform/ and build-templates/bytedance/ is copied unchanged.
//
// gameId: lowercase English, unique per game. It prefixes the save key so games that share the
//         test App ID never share coins or reward claims.
// placementMap: placementKey -> index into rewardedPlacements. Add the keys this game uses;
//         a key that is missing (or null) returns '' and RewardedService answers 'unconfigured'.
// normalLevelCoins: B of this game (= unlock_table.json normal_level_coins). Add-to-home and profile
//         revisit each pay growthReward() = 5B once (Saul 2026-10-29, same as one home-gift base reward;
//         games without a home gift also use 5B). Use it in MissionFlow:
//         reward: function (kind, draft) { draft.coins += config.growthReward(); }
//         v7.7: MissionFlow without a reward option and HomeGrowthEntries.js pay growthReward() by
//         themselves; no game sets its own add-to-home / revisit amount.
var config = {
  kitVersion: 2.0,
  gameId: 'theos-teacup-tunnels',
  appId: '',
  clientKey: '',
  normalLevelCoins: 10,
  rewardedPlacements: [
    {name: 'Rewarded 2', id: ''},
    {name: 'Rewarded', id: ''},
    {name: 'Rewarded', id: ''}
  ],
  placementMap: {
    resources: 0, help: 1, revive: 2, double: 2, trial: 2, hint: 1, start_boost: 1,
    skin: 1, background: 1,
    double_coins: 2, gift: 2
  }
};
config.getAdUnitId = function (key) {
  var index = config.placementMap[key];
  return typeof index === 'number' && config.rewardedPlacements[index] ? config.rewardedPlacements[index].id : '';
};
config.saveKey = function () {
  return config.gameId + ':' + config.appId + ':save:v1';
};
config.GROWTH_REWARD_B = 5;
// One-time add-to-home / profile-revisit reward in this game's currency. Throws until normalLevelCoins
// is set, so a forgotten value pays nothing (SaveStore.update refuses the write) instead of paying 0.
config.growthReward = function () {
  var b = config.normalLevelCoins;
  if (typeof b !== 'number' || !(b > 0) || Math.floor(b) !== b) {
    throw new Error('PlatformConfig.js: set normalLevelCoins to B (unlock_table.json normal_level_coins)');
  }
  return config.GROWTH_REWARD_B * b;
};
module.exports = config;

},"assets/tiktok-platform/RewardedService.js":function(require,module,exports){
'use strict';
var config = require('./PlatformConfig');
// Rewarded-ad timeout rule (Basil rule, remake-ads/references/ad-timeout-and-regression.md):
// - request phase (until show() resolves) may time out: requestTimeoutMs, default 15 s;
//   time spent in the background does not count.
// - after show() resolves there is NO timeout: the reward depends only on onClose(isEnded) / onError.
// - if no callback arrives, exitAvailable() turns true exitAfterMs (default 30 s) after playback
//   started; the game shows an X that calls exit().
// - timeout, exit, cancel and dispose unbind the ad's callbacks and release the session at once,
//   so the next request can start immediately. No lock outlives a settled request.
// Shared by every service instance importing this module: one live ad session at a time.
var nativeSession = null;
var sequence = 0;
var messages = {
  completed: 'Reward ready.', cancelled: 'Video closed. No reward was claimed.',
  error: 'The video could not open. Please try again.', timeout: 'The video took too long to start. Please try again.',
  unsupported: 'Rewarded videos are available inside TikTok.', busy: 'A video is still active. Please finish or close it first.',
  stale: 'This session has ended. No reward was claimed.', unconfigured: 'This reward is not available.'
};
function rootSDK(method) {
  var candidates = [
    typeof TTMinis !== 'undefined' && TTMinis.game,
    typeof tt !== 'undefined' && tt,
    typeof wx !== 'undefined' && wx
  ];
  for (var i = 0; i < candidates.length; i++) {
    var candidate = candidates[i];
    if (!candidate || typeof candidate[method] !== 'function') continue;
    try {
      if (typeof candidate.canIUse === 'function' && !candidate.canIUse(method)) continue;
      return candidate; // Preserve the API receiver; never detach native methods.
    } catch (_) {}
  }
  return null;
}
function current(o) { try { return !o.isCurrent || o.isCurrent() === true; } catch (_) { return false; } }
function errorCode(e) { return e && (typeof e.errorCode === 'number' || typeof e.errorCode === 'string') ? e.errorCode : null; }
function safely(fn) { try { fn(); } catch (_) {} }
function makeResult(status, session, error, reason) {
  return {status: status, rewarded: status === 'completed', message: messages[status],
    phase: session ? session.phase : 'request', requestId: session ? session.id : null,
    placementKey: session ? session.options.placementKey : null, errorCode: errorCode(error),
    reason: reason || null};
}
function RewardedService(options) {
  options = options || {};
  this.getSDK = options.getSDK || rootSDK;
  this.now = options.now || Date.now;
  this.requestTimeoutMs = options.requestTimeoutMs || 15000;
  this.exitAfterMs = options.exitAfterMs || 30000;
  this.pending = null;
  var self = this;
  this.poll = options.autoPoll === false ? null : setInterval(function () { self.tick(); }, 100);
  if (this.poll && this.poll.unref) this.poll.unref();
}
RewardedService.prototype.tick = function () {
  var s = this.pending;
  if (!s || s.terminal) return;
  if (!current(s.options)) return s.finish('stale');
  if (s.phase === 'request') {
    // Background time does not count: the deadline is frozen while hidden.
    if (s.hiddenAt === null && this.now() >= s.deadline) s.finish('timeout');
  } else if (!s.exitNotified && this.exitAvailable()) {
    s.exitNotified = true;
    if (typeof s.options.onExitAvailable === 'function') safely(function () { s.options.onExitAvailable(); });
  }
};
// Lifecycle forwarding (cc.game EVENT_HIDE / EVENT_SHOW, or tt.onHide / tt.onShow).
RewardedService.prototype.onHide = function () {
  var s = this.pending;
  if (s && s.hiddenAt === null) s.hiddenAt = this.now();
};
RewardedService.prototype.onShow = function () {
  var s = this.pending;
  if (!s || s.hiddenAt === null) return;
  var away = Math.max(0, this.now() - s.hiddenAt);
  s.hiddenAt = null;
  if (s.phase === 'request') s.deadline += away;
};
// True once playback has run exitAfterMs with no callback: show the X now.
RewardedService.prototype.exitAvailable = function () {
  var s = this.pending;
  return !!(s && !s.terminal && s.phase === 'playing' && this.now() >= s.exitAt);
};
// The player pressed the X: no reward, callbacks unbound, next request may start at once.
RewardedService.prototype.exit = function () {
  if (this.pending) this.pending.finish('cancelled', null, 'exit');
};
RewardedService.prototype.request = function (options) {
  options = options || {};
  this.tick();
  if (nativeSession) return Promise.resolve(makeResult('busy', null));
  var sdk;
  try { sdk = this.getSDK('createRewardedVideoAd'); } catch (_) {}
  if (!sdk || typeof sdk.createRewardedVideoAd !== 'function') return Promise.resolve(makeResult('unsupported', null));
  try { if (typeof sdk.canIUse === 'function' && !sdk.canIUse('createRewardedVideoAd')) return Promise.resolve(makeResult('unsupported', null)); }
  catch (_) { return Promise.resolve(makeResult('unsupported', null)); }
  var adUnitId = config.getAdUnitId(options.placementKey);
  if (!adUnitId) return Promise.resolve(makeResult('unconfigured', null));
  if (!current(options)) return Promise.resolve(makeResult('stale', null));
  var self = this;
  return new Promise(function (resolve) {
    var s = {id: ++sequence, options: options, phase: 'request', ad: null, hiddenAt: null,
      deadline: self.now() + self.requestTimeoutMs, exitAt: Infinity, exitNotified: false, terminal: false};
    self.pending = s;
    nativeSession = s;
    function onClose(res) { s.finish(res && res.isEnded === true ? 'completed' : 'cancelled'); }
    function onError(e) { s.finish('error', e); }
    function onHide() { self.onHide(); }
    function onShow() { self.onShow(); }
    // Single terminal path: every outcome unbinds callbacks and releases the session together.
    s.finish = function (status, error, reason) {
      if (s.terminal) return;
      s.terminal = true;
      if (self.pending === s) self.pending = null;
      if (nativeSession === s) nativeSession = null;
      if (s.ad) {
        if (typeof s.ad.offClose === 'function') safely(function () { s.ad.offClose(onClose); });
        if (typeof s.ad.offError === 'function') safely(function () { s.ad.offError(onError); });
      }
      if (typeof sdk.offHide === 'function') safely(function () { sdk.offHide(onHide); });
      if (typeof sdk.offShow === 'function') safely(function () { sdk.offShow(onShow); });
      // No late success after timeout/exit/cancel/stale: the callbacks are already unbound.
      resolve(makeResult(current(options) ? status : 'stale', s, error, reason));
    };
    try {
      if (typeof sdk.onHide === 'function') sdk.onHide(onHide);
      if (typeof sdk.onShow === 'function') sdk.onShow(onShow);
      s.ad = sdk.createRewardedVideoAd({adUnitId: adUnitId});
      if (!s.ad || typeof s.ad.onClose !== 'function' || typeof s.ad.onError !== 'function' || typeof s.ad.show !== 'function') {
        s.finish('unsupported'); return;
      }
      s.ad.onClose(onClose);
      s.ad.onError(onError);
      if (s.terminal) return;
      var shown = s.ad.show();
      if (shown && typeof shown.then === 'function') {
        shown.then(function () {
          // Resolving show means playback started, never watched/completed. No timeout from here.
          if (s.terminal) return;
          s.phase = 'playing';
          s.exitAt = self.now() + self.exitAfterMs;
        }, function (e) { s.finish('error', e); });
      } else {
        s.phase = 'playing';
        s.exitAt = self.now() + self.exitAfterMs;
      }
    } catch (e) { s.finish('error', e); }
  });
};
RewardedService.prototype.cancelOwner = function (ownerId) {
  if (this.pending && this.pending.options.ownerId === ownerId) this.pending.finish('cancelled', null, 'owner');
};
RewardedService.prototype.isNativeBusy = function () { return nativeSession !== null; };
RewardedService.prototype.dispose = function () {
  if (this.pending) this.pending.finish('stale');
  if (this.poll !== null) clearInterval(this.poll);
  this.poll = null;
};
module.exports = RewardedService;

},"assets/tiktok-platform/SaveStore.js":function(require,module,exports){
'use strict';
// TikTok Platform Kit v1 - one save per game, one JSON string under one key. Copy unchanged.
//
// Why a string: TikTok/ByteDance storage can hand back an object whose key order differs from what
// was written, so comparing objects (JSON.stringify(readBack) === JSON.stringify(written)) fails at
// random. Here the game data is serialized ONCE to a string, that exact string is stored and the
// read-back is compared as a string.
//
// Rules this file enforces:
//  - update() works on a copy. Memory only changes after the write is read back identical.
//  - A failed write never reports success; the caller shows "Could not save" and keeps its state.
//  - A corrupt save is backed up and replaced by defaults with meta.recoveredFromCorrupt set, so
//    one-time rewards (platform claims) are treated as already claimed instead of paid twice.
//  - Everything that must change together (coins + "reward claimed" flag) goes in ONE update().
var config = require('./PlatformConfig');

function clone(value) { return JSON.parse(JSON.stringify(value)); }
function isRecord(value) { return !!value && typeof value === 'object' && !Array.isArray(value); }
function defaultStorage() {
  return typeof cc !== 'undefined' && cc.sys && cc.sys.localStorage ? cc.sys.localStorage : null;
}
// getStorageInfoSync().keys from the platform SDK (same lookup order as TikTokMissionService.js).
// Returns an array of keys, or null when the runtime cannot tell which keys exist.
function defaultStorageKeys() {
  var candidates = [
    typeof TTMinis !== 'undefined' && TTMinis && TTMinis.game,
    typeof tt !== 'undefined' && tt,
    typeof wx !== 'undefined' && wx
  ];
  for (var i = 0; i < candidates.length; i++) {
    var c = candidates[i];
    if (!c || typeof c.getStorageInfoSync !== 'function') continue;
    try {
      var info = c.getStorageInfoSync();
      if (info && Array.isArray(info.keys)) return info.keys;
    } catch (_) {}
  }
  return null;
}
function isUnreadable(raw) { return raw === undefined || raw === true || raw === false; }

// v1.2 (Mabel's Meadow r8, D4 problem 6): TikTok's publish scan asks for the Login API. The kit sends ONE
// login after the save has loaded and never waits for it: no flow, reward or save depends on the answer,
// and a missing API, a throw, fail or a rejected Promise are all ignored.
var loginSent = false;
function noop() {}
function defaultLogin() {
  if (loginSent) return false;
  var candidates = [
    typeof TTMinis !== 'undefined' && TTMinis && TTMinis.game,
    typeof tt !== 'undefined' && tt,
    typeof wx !== 'undefined' && wx
  ];
  for (var i = 0; i < candidates.length; i++) {
    var c = candidates[i];
    if (!c || typeof c.login !== 'function') continue;
    loginSent = true;
    try {
      var r = c.login({success: noop, fail: noop, complete: noop});
      if (r && typeof r.then === 'function') r.then(noop, noop);
    } catch (_) {}
    return true;
  }
  return false;
}

function SaveStore(defaults, options) {
  options = options || {};
  this.key = options.key || config.saveKey();
  this.storage = options.storage || defaultStorage();
  this.storageKeys = options.storageKeys || defaultStorageKeys;
  // login: false turns the fire-and-forget login off (tests); a function replaces the platform call.
  this.login = options.login === false ? noop : (typeof options.login === 'function' ? options.login : defaultLogin);
  this.loginTried = false;
  this.now = options.now || Date.now;
  this.defaults = clone(isRecord(defaults) ? defaults : {});
  if (!isRecord(this.defaults.platformClaims)) this.defaults.platformClaims = {shortcut: false, profile: false};
  if (!isRecord(this.defaults.meta)) this.defaults.meta = {};
  this.data = null;
  this.status = 'unloaded';
}

SaveStore.prototype._fill = function (data) {
  var self = this;
  Object.keys(this.defaults).forEach(function (k) {
    if (data[k] === undefined) data[k] = clone(self.defaults[k]);
  });
  if (!isRecord(data.platformClaims)) data.platformClaims = {shortcut: false, profile: false};
  if (!isRecord(data.meta)) data.meta = {};
  return data;
};

// Returns {ok, status: 'new'|'loaded'|'recovered'|'unavailable', data}.
// v1.2 (MergeShot2048 v81-v85 on a real iPhone): TikTok storage can read back true/false/undefined, or throw,
// for a key. Such a read is never treated as a save. getStorageInfoSync().keys decides whether the key exists:
// missing key = no save yet, defaults are written once; existing key with an unreadable value = corrupt save
// (backed up, defaults written once, one-time rewards treated as claimed). Nothing is logged per read.
SaveStore.prototype.load = function () {
  var result = this._load();
  this._loginOnce();
  return result;
};

// After the first load only; deferred so a slow or throwing SDK can never delay or break the load.
SaveStore.prototype._loginOnce = function () {
  if (this.loginTried) return;
  this.loginTried = true;
  var login = this.login;
  function send() { try { login(); } catch (_) {} }
  try { if (typeof setTimeout === 'function') setTimeout(send, 0); else send(); } catch (_) {}
};

SaveStore.prototype._load = function () {
  if (!this.storage) { this.data = clone(this.defaults); this.status = 'unavailable'; return this._result(false, 'storage_unavailable'); }
  var raw = null, threw = false;
  try { raw = this.storage.getItem(this.key); }
  catch (_) { threw = true; }
  if (threw || isUnreadable(raw)) {
    var keys = null;
    try { keys = this.storageKeys(); } catch (_) { keys = null; }
    var known = Array.isArray(keys);
    if (known && keys.indexOf(this.key) < 0) return this._fresh();
    if (threw) { this.data = clone(this.defaults); this.status = 'unavailable'; return this._result(false, 'read_failed'); }
    if (raw === undefined && !known) { this.data = clone(this.defaults); this.status = 'new'; return this._result(true); }
    return this._recover(raw);
  }
  if (raw === null || raw === '') {
    this.data = clone(this.defaults); this.status = 'new'; return this._result(true);
  }
  var parsed = null;
  try { parsed = typeof raw === 'string' ? JSON.parse(raw) : raw; } catch (_) { parsed = null; }
  if (!isRecord(parsed)) return this._recover(raw);
  this.data = this._fill(parsed);
  this.status = 'loaded';
  return this._result(true);
};

// No save under this key: start from defaults and write them once, so the next read returns a string.
SaveStore.prototype._fresh = function () {
  this.data = clone(this.defaults);
  this.status = 'new';
  var written = this._write(this.data);
  return this._result(true, written);
};

SaveStore.prototype._recover = function (raw) {
  try { this.storage.setItem(this.key + ':corrupt-backup', typeof raw === 'string' ? raw : String(raw)); } catch (_) {}
  var fresh = clone(this.defaults);
  fresh.meta.recoveredFromCorrupt = this.now();
  this.data = fresh;
  this.status = 'recovered';
  var written = this._write(fresh);
  return this._result(written === null, written);
};

SaveStore.prototype._write = function (draft) {
  var text;
  try { text = JSON.stringify(draft); } catch (_) { return 'serialize_failed'; }
  var previous = null;
  try { previous = this.storage.getItem(this.key); } catch (_) {}
  try { this.storage.setItem(this.key, text); } catch (_) { return 'write_failed'; }
  var back;
  try { back = this.storage.getItem(this.key); } catch (_) { back = null; }
  if (back === text) return null;
  // Read-back differs: put the previous text back so memory and storage still agree.
  try { if (typeof previous === 'string') this.storage.setItem(this.key, previous); } catch (_) {}
  return 'readback_mismatch';
};

SaveStore.prototype._result = function (ok, error) {
  return {ok: ok, status: this.status, error: error || null, data: this.data ? clone(this.data) : null};
};

// A copy of the current save. Change the save only through update().
SaveStore.prototype.get = function () {
  if (this.status === 'unloaded') this.load();
  return clone(this.data);
};

// mutator(draft) edits the copy; return false to cancel. Returns {ok, error, data}.
SaveStore.prototype.update = function (mutator) {
  if (this.status === 'unloaded') this.load();
  if (!this.storage) return this._result(false, 'storage_unavailable');
  var draft = clone(this.data);
  var answer;
  try { answer = mutator(draft); } catch (_) { return this._result(false, 'mutator_threw'); }
  if (answer === false) return this._result(false, 'cancelled');
  if (!isRecord(draft)) return this._result(false, 'invalid_draft');
  var error = this._write(draft);
  if (error) return this._result(false, error);
  this.data = draft;
  if (this.status === 'new' || this.status === 'unavailable') this.status = 'loaded';
  return this._result(true);
};

SaveStore.prototype.isClaimed = function (kind) {
  if (this.status === 'unloaded') this.load();
  if (this.data.meta && this.data.meta.recoveredFromCorrupt) return true;
  return this.data.platformClaims[kind] === true;
};

// Test hook only: lets a test send the one-per-process login again.
SaveStore._resetLoginForTests = function () { loginSent = false; };
module.exports = SaveStore;

},"assets/tiktok-platform/TikTokMissionService.js":function(require,module,exports){
'use strict';
var methods = {
  shortcut: {navigate: 'addShortcut', query: 'getShortcutMissionReward'},
  profile: {navigate: 'startEntranceMission', query: 'getEntranceMissionReward'}
};
var messages = {
  success: 'Return through this TikTok entry, then check your reward.',
  eligible: 'Your reward is ready to claim.', ineligible: 'Open this game from the TikTok entry, then check again.',
  unsupported: 'This feature is available inside a supported TikTok app.',
  error: 'The request failed. Please try again.', timeout: 'The check took too long. Please try again.',
  invalid: 'No reward information was returned. Please try again.', cancelled: 'The check ended. Please try again.',
  stale: 'This check has ended. Please check again.'
};
function sdk(method) {
  var candidates = [
    typeof TTMinis !== 'undefined' && TTMinis.game,
    typeof tt !== 'undefined' && tt,
    typeof wx !== 'undefined' && wx
  ];
  for (var i = 0; i < candidates.length; i++) {
    var candidate = candidates[i];
    if (!candidate || typeof candidate[method] !== 'function' || typeof candidate.canIUse !== 'function') continue;
    try {
      if (candidate.canIUse(method)) return candidate;
    } catch (_) {}
  }
  return null;
}
function isCurrent(options) { try { return !options.isCurrent || options.isCurrent() === true; } catch (_) { return false; } }
function result(status, request, e) {
  return {status: status, eligible: status === 'eligible', rewarded: false, message: messages[status],
    requestId: request ? request.id : null, kind: request ? request.kind : null,
    api: request ? request.method : null, errorCode: e && e.errorCode !== undefined ? e.errorCode : null};
}
function TikTokMissionService(options) {
  options = options || {};
  this.getSDK = options.getSDK || sdk;
  this.now = options.now || Date.now;
  this.timeoutMs = options.timeoutMs || 10000;
  this.pending = {};
  this.epoch = 0;
  this.sequence = 0;
  var self = this;
  this.poll = options.autoPoll === false ? null : setInterval(function () { self.tick(); }, 100);
  if (this.poll && this.poll.unref) this.poll.unref();
}
TikTokMissionService.prototype.tick = function () {
  var self = this;
  Object.keys(this.pending).forEach(function (key) {
    var r = self.pending[key];
    if (!isCurrent(r.options)) r.settle('stale');
    else if (self.now() >= r.deadline) r.settle('timeout');
    else if (r.emptyAt !== null && self.now() >= r.emptyAt) r.settle('invalid');
  });
};
TikTokMissionService.prototype._call = function (kind, action, options) {
  options = options || {};
  this.tick();
  var method = methods[kind] && methods[kind][action];
  if (!method) return Promise.resolve(result('unsupported', null));
  var key = kind + ':' + action;
  if (this.pending[key]) return this.pending[key].promise;
  var api;
  try { api = this.getSDK(method); } catch (_) {}
  try {
    if (!api || typeof api[method] !== 'function' || typeof api.canIUse !== 'function' || !api.canIUse(method))
      return Promise.resolve(result('unsupported', null));
  } catch (_) { return Promise.resolve(result('unsupported', null)); }
  if (!isCurrent(options)) return Promise.resolve(result('stale', null));
  var self = this;
  var resolve;
  var promise = new Promise(function (done) { resolve = done; });
  var r = {id: ++this.sequence, kind: kind, method: method, action: action, options: options,
    epoch: this.epoch, deadline: this.now() + this.timeoutMs, emptyAt: null, settled: false, promise: promise};
  r.settle = function (status, error) {
    if (r.settled) return;
    r.settled = true;
    if (self.pending[key] === r) delete self.pending[key];
    resolve(result(r.epoch === self.epoch && isCurrent(options) ? status : 'stale', r, error));
  };
  this.pending[key] = r;
  function empty() {
    if (r.settled) return;
    // Allow a valid same-turn Promise to follow complete/undefined success.
    // Longer or missing results still have a bounded visible exit.
    if (r.emptyAt === null) r.emptyAt = Math.min(r.deadline, self.now() + 100);
  }
  function success(value) {
    if (r.settled) return;
    if (action === 'navigate') return r.settle('success');
    if (value && value.canReceiveReward === true) r.settle('eligible');
    else if (value && value.canReceiveReward === false) r.settle('ineligible');
    else empty();
  }
  function fail(error) { r.settle('error', error); }
  try {
    var returned = api[method]({success: success, fail: fail, complete: empty});
    if (returned && typeof returned.then === 'function') returned.then(success, fail);
  } catch (error) { fail(error); }
  return promise;
};
TikTokMissionService.prototype.navigate = function (kind, options) { return this._call(kind, 'navigate', options); };
TikTokMissionService.prototype.query = function (kind, options) { return this._call(kind, 'query', options); };
TikTokMissionService.prototype.cancel = function () {
  this.epoch++;
  var self = this;
  Object.keys(this.pending).forEach(function (key) { self.pending[key].settle('cancelled'); });
};
TikTokMissionService.prototype.onResume = function () { this.cancel(); };
TikTokMissionService.prototype.dispose = function () {
  this.cancel();
  if (this.poll !== null) clearInterval(this.poll);
  this.poll = null;
};
module.exports = TikTokMissionService;

}},cache={};function load(name,parent){if(name[0]==='.'){var parts=(parent.slice(0,parent.lastIndexOf('/')+1)+name).split('/'),out=[];parts.forEach(function(p){if(p==='..')out.pop();else if(p&&p!=='.')out.push(p);});name=out.join('/');}if(!sources[name])name+='.js';if(cache[name])return cache[name].exports;if(!sources[name])throw Error('Module missing '+name);var m=cache[name]={exports:{}};sources[name](function(n){return load(n,name);},m,m.exports);return m.exports;}window.TTUStore=load('src/store.js','');window.TTUPlatform=load('src/platform.js','');})();