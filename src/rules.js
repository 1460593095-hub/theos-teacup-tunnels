(function (root, factory) {
  'use strict';
  var api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  else root.TTURules = api;
}(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  'use strict';
  // Port of the delivered ttu-rules-1 production rules. Cell shape and pin
  // indices stay identical to the authored level data and replay proofs.
  var OPP = { 1: 3, 2: 4, 3: 1, 4: 2 };
  var OPEN = { 5: [1, 3], 6: [2, 4], 7: [1, 2], 8: [3, 2], 9: [1, 4], 10: [3, 4], 11: [1, 2, 3, 4] };
  function step(cell, dir, n) {
    var row = Math.floor(cell / n), col = cell % n;
    if (dir === 1) return col > 0 ? cell - 1 : -1;
    if (dir === 2) return row > 0 ? cell - n : -1;
    if (dir === 3) return col < n - 1 ? cell + 1 : -1;
    if (dir === 4) return row < n - 1 ? cell + n : -1;
    return -1;
  }
  function load(level, prepulled) {
    if (!level || !Number.isInteger(level.n) || level.n < 2 || level.n > 5 || !Array.isArray(level.cells) || level.cells.length !== level.n * level.n) throw new Error('Invalid tunnel board');
    var pins = (level.pins || []).map(function (p) { return p.slice(); });
    if (pins.length > 30) throw new Error('Too many pins');
    var pinAt = {}, mask = Math.pow(2, pins.length) - 1;
    pins.forEach(function (p, i) { pinAt[p[0]] = i; });
    (prepulled || []).forEach(function (i) {
      if (Number.isInteger(i) && i >= 0 && i < pins.length) mask &= ~(1 << i);
    });
    return {
      n: level.n, pins: pins, pinAt: pinAt,
      order: Object.assign({}, level.order), rules: Object.assign({}, level.rules),
      cells: level.cells.map(function (c) { return c ? c.slice() : null; }), mask: mask
    };
  }
  function key(state) { return JSON.stringify([state.cells, state.mask]); }
  function free(state, index) {
    if (state.cells[index] !== null) return false;
    var pin = state.pinAt[index];
    return pin === undefined || !(state.mask & (1 << pin));
  }
  function mergeResult(state, source, target) {
    if (source[0] !== 4 || target[0] !== 4 || source[4] || target[4] || source[3]) return null;
    if (source[1] !== target[1] || source[2] !== target[2] || !OPEN[source[1]] || source[1] === 11) return null;
    if (source[2] === 1 && state.rules.merge) return [4, target[1], 2, target[3], 0];
    if (source[2] === 2 && state.rules.cross) return [4, 11, 3, target[3], 0];
    return null;
  }
  function walk(state) {
    var cells = state.cells, n = state.n, start = -1;
    for (var i = 0; i < cells.length; i++) if (cells[i] && cells[i][0] === 1) { start = i; break; }
    if (start < 0) return null;
    var path = [start], current = start, travel = cells[start][1];
    for (var count = 0; count < n * n + 1; count++) {
      var next = step(current, travel, n);
      if (next < 0 || cells[next] === null) return null;
      var pin = state.pinAt[next];
      if (pin !== undefined && (state.mask & (1 << pin))) return null;
      var cell = cells[next], entering = OPP[travel];
      if (cell[0] === 3) return cell[1] === entering ? path.concat([next]) : null;
      if (cell[0] === 1) return null;
      var openings = OPEN[cell[1]];
      if (!openings || openings.indexOf(entering) < 0) return null;
      path.push(next);
      if (cell[1] !== 11) travel = openings[0] === entering ? openings[1] : openings[0];
      current = next;
    }
    return null;
  }
  function orderCounts(state, path) {
    var counts = {};
    (path || []).forEach(function (i) {
      var snack = state.cells[i][3];
      if (snack) counts[snack] = (counts[snack] || 0) + 1;
    });
    return counts;
  }
  function orderOK(state, path) {
    var got = orderCounts(state, path);
    return Object.keys(state.order).every(function (kind) { return !state.order[kind] || (got[kind] || 0) >= state.order[kind]; });
  }
  function isWin(state) { var path = walk(state); return path !== null && orderOK(state, path); }
  function isLose(state) { var path = walk(state); return path !== null && !orderOK(state, path); }
  function legalMoves(state) {
    if (walk(state) !== null) return [];
    var out = [], n = state.n;
    state.cells.forEach(function (cell, i) {
      if (!cell || cell[0] !== 4) return;
      for (var d = 1; d <= 4; d++) {
        if (cell[4] && d !== cell[4]) continue;
        var to = step(i, d, n);
        if (to < 0) continue;
        if (free(state, to) || (state.cells[to] && mergeResult(state, cell, state.cells[to]))) out.push(['s', i, d]);
      }
    });
    state.pins.forEach(function (p, index) {
      if (!(state.mask & (1 << index))) return;
      (p[1] === 'H' ? [1, 3] : [2, 4]).forEach(function (d) {
        var next = step(p[0], d, n), ok = true;
        while (next >= 0) {
          if (!free(state, next)) { ok = false; break; }
          next = step(next, d, n);
        }
        if (ok) out.push(['p', index, d]);
      });
    });
    return out;
  }
  function chainOf(state, pin) {
    var out = [pin];
    if (!state.rules.chain) return out;
    var p = state.pins[pin], dirs = p[1] === 'H' ? [1, 3] : [2, 4], frontier = [p[0]];
    while (frontier.length && out.length < 3) {
      var next = [];
      frontier.forEach(function (cell) {
        dirs.forEach(function (d) {
          var index = step(cell, d, state.n), q = index >= 0 ? state.pinAt[index] : undefined;
          if (q !== undefined && out.indexOf(q) < 0 && (state.mask & (1 << q)) && state.pins[q][1] === p[1] && state.pins[q][2] === p[2] && out.length < 3) {
            out.push(q); next.push(index);
          }
        });
      });
      frontier = next;
    }
    return out;
  }
  function uncheckedApply(state, move) {
    var mask = state.mask, cells = state.cells;
    if (move[0] === 'p') chainOf(state, move[1]).forEach(function (q) { mask &= ~(1 << q); });
    else {
      cells = cells.slice();
      var from = move[1], to = step(from, move[2], state.n), cell = cells[from];
      if (cells[to] === null) cells[to] = cell[4] ? [cell[0], cell[1], cell[2], cell[3], OPP[cell[4]]] : cell;
      else cells[to] = mergeResult(state, cell, cells[to]);
      cells[from] = null;
    }
    return { n: state.n, pins: state.pins, pinAt: state.pinAt, order: state.order, rules: state.rules, cells: cells, mask: mask };
  }
  function sameMove(a, b) { return a[0] === b[0] && a[1] === b[1] && a[2] === b[2]; }
  function apply(state, move) {
    if (!Array.isArray(move) || move.length !== 3 || !legalMoves(state).some(function (m) { return sameMove(m, move); })) throw new Error('Illegal tunnel move');
    return uncheckedApply(state, move);
  }
  function prePull(level, points) {
    var goal = level.cells.findIndex(function (c) { return c && c[0] === 3; });
    var n = level.n, distance = function (cell) { return Math.abs(Math.floor(cell / n) - Math.floor(goal / n)) + Math.abs(cell % n - goal % n); };
    var ranked = (level.pins || []).map(function (p, i) { return { index: i, distance: distance(p[0]) }; });
    ranked.sort(function (a, b) { return a.distance - b.distance || a.index - b.index; });
    var count = Math.max(0, Math.min(5, Number.isFinite(points) ? Math.floor(points) : 0));
    var removed = ranked.slice(0, count).map(function (p) { return p.index; });
    // The delivered kettle proof compacts the pin list before loading. Keep
    // precisely that indexing so its variant solutions are directly replayable.
    return load(Object.assign({}, level, { pins: (level.pins || []).filter(function (p, i) { return removed.indexOf(i) < 0; }) }));
  }
  function solve(state, options) {
    options = options || {};
    var maxNodes = options.maxNodes || 40000, maxMs = options.maxMs || 200;
    if (isWin(state)) return { status: 'solved', moves: [], nodes: 0 };
    if (isLose(state)) return { status: 'unsolved', moves: [], nodes: 0 };
    var begin = Date.now(), seen = new Set([key(state)]), queue = [{ state: state, parent: -1, move: null }], head = 0;
    while (head < queue.length) {
      if (head >= maxNodes || (head % 64 === 0 && Date.now() - begin > maxMs)) return { status: 'unknown', moves: [], nodes: head };
      var entryIndex = head, entry = queue[head++], moves = legalMoves(entry.state);
      for (var i = 0; i < moves.length; i++) {
        var next = uncheckedApply(entry.state, moves[i]), k = key(next);
        if (seen.has(k)) continue;
        if (isWin(next)) {
          var trail = [moves[i]], cursor = entryIndex;
          while (queue[cursor].parent >= 0) { trail.push(queue[cursor].move); cursor = queue[cursor].parent; }
          return { status: 'solved', moves: trail.reverse(), nodes: head };
        }
        seen.add(k);
        if (!isLose(next)) queue.push({ state: next, parent: entryIndex, move: moves[i] });
      }
    }
    return { status: 'unsolved', moves: [], nodes: head };
  }
  function hint(state, options) {
    var result = solve(state, options);
    return { status: result.status, move: result.moves.length ? result.moves[0] : null, nodes: result.nodes };
  }
  return { id: 'ttu-rules-1-js', OPEN: OPEN, OPP: OPP, step: step, load: load, key: key, walk: walk, orderCounts: orderCounts, legalMoves: legalMoves, chainOf: chainOf, apply: apply, isWin: isWin, isLose: isLose, prePull: prePull, solve: solve, hint: hint };
}));
