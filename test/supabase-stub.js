'use strict';
/* Test uchun minimal Supabase (PostgREST) stubi.
   Haqiqiy jadval bo'lmagani uchun jsdom'da bulut rejimini sinash imkonini beradi:
   holatli in-memory jadvallar + ilova ishlatadigan builder metodlari
   (select/insert/update/delete/upsert, eq/neq/in/ilike/gte/is, order/limit). */

function createStub(seed) {
  const db = {};
  const seq = {};

  function table(name) {
    if (!db[name]) { db[name] = []; seq[name] = 0; }
    return db[name];
  }

  Object.keys(seed || {}).forEach(function (name) {
    const rows = (seed[name] || []).map(function (r) { return Object.assign({}, r); });
    db[name] = rows;
    seq[name] = rows.reduce(function (m, r) { return Math.max(m, Number(r.id) || 0); }, 0);
  });

  function match(row, filters) {
    return filters.every(function (f) {
      const v = row[f.col];
      if (f.op === 'eq') return String(v) === String(f.val);
      if (f.op === 'neq') return String(v) !== String(f.val);
      if (f.op === 'in') return (f.val || []).map(String).indexOf(String(v)) >= 0;
      if (f.op === 'ilike') {
        const hay = String(v == null ? '' : v).toLowerCase();
        const pat = String(f.val == null ? '' : f.val).toLowerCase();
        if (pat.indexOf('%') < 0) return hay === pat;
        const rx = new RegExp('^' + pat.split('%').map(function (part) {
          return part.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
        }).join('.*') + '$');
        return rx.test(hay);
      }
      if (f.op === 'gte') return Number(v) >= Number(f.val);
      if (f.op === 'is') return f.val === null ? v == null : String(v) === String(f.val);
      return true;
    });
  }

  function run(q) {
    const rows = table(q.table);
    if (q.op === 'insert') {
      const list = Array.isArray(q.payload) ? q.payload : [q.payload];
      const inserted = list.filter(Boolean).map(function (r) {
        const row = Object.assign({}, r);
        if (row.id == null) row.id = ++seq[q.table];
        else seq[q.table] = Math.max(seq[q.table], Number(row.id) || 0);
        rows.push(row);
        return Object.assign({}, row);
      });
      return { data: inserted, error: null };
    }
    if (q.op === 'upsert') {
      const list = Array.isArray(q.payload) ? q.payload : [q.payload];
      const out = list.filter(Boolean).map(function (r) {
        const row = Object.assign({}, r);
        const i = row.id == null ? -1 : rows.findIndex(function (x) { return String(x.id) === String(row.id); });
        if (i >= 0) { rows[i] = Object.assign({}, rows[i], row); return Object.assign({}, rows[i]); }
        if (row.id == null) row.id = ++seq[q.table];
        rows.push(row);
        return Object.assign({}, row);
      });
      return { data: out, error: null };
    }
    if (q.op === 'delete') {
      const kept = rows.filter(function (r) { return !match(r, q.filters); });
      const removed = rows.filter(function (r) { return match(r, q.filters); });
      db[q.table] = kept;
      return { data: removed, error: null };
    }
    if (q.op === 'update') {
      const touched = rows.filter(function (r) { return match(r, q.filters); });
      touched.forEach(function (r) { Object.assign(r, q.payload); });
      return { data: touched.map(function (r) { return Object.assign({}, r); }), error: null };
    }
    /* select */
    let out = rows.filter(function (r) { return match(r, q.filters); });
    q.orders.forEach(function (o) {
      out = out.slice().sort(function (a, b) {
        const av = a[o.col], bv = b[o.col];
        let c = 0;
        if (av == null && bv != null) c = -1;
        else if (bv == null && av != null) c = 1;
        else if (typeof av === 'number' && typeof bv === 'number') c = av - bv;
        else c = String(av).localeCompare(String(bv));
        return o.asc ? c : -c;
      });
    });
    if (q.lim != null) out = out.slice(0, q.lim);
    return { data: out.map(function (r) { return Object.assign({}, r); }), error: null };
  }

  function from(name) {
    const q = { table: name, op: 'select', payload: null, filters: [], orders: [], lim: null };
    const builder = {
      select: function () { return builder; },
      insert: function (p) { q.op = 'insert'; q.payload = p; return builder; },
      update: function (p) { q.op = 'update'; q.payload = p; return builder; },
      delete: function () { q.op = 'delete'; return builder; },
      upsert: function (p) { q.op = 'upsert'; q.payload = p; return builder; },
      eq: function (c, v) { q.filters.push({ op: 'eq', col: c, val: v }); return builder; },
      neq: function (c, v) { q.filters.push({ op: 'neq', col: c, val: v }); return builder; },
      in: function (c, v) { q.filters.push({ op: 'in', col: c, val: v }); return builder; },
      ilike: function (c, v) { q.filters.push({ op: 'ilike', col: c, val: v }); return builder; },
      gte: function (c, v) { q.filters.push({ op: 'gte', col: c, val: v }); return builder; },
      lte: function (c, v) { q.filters.push({ op: 'lte', col: c, val: v }); return builder; },
      is: function (c, v) { q.filters.push({ op: 'is', col: c, val: v }); return builder; },
      order: function (c, o) { q.orders.push({ col: c, asc: !(o && o.ascending === false) }); return builder; },
      limit: function (n) { q.lim = n; return builder; },
      single: function () { return builder; },
      maybeSingle: function () { return builder; },
      then: function (onOk, onErr) {
        try { return Promise.resolve(run(q)).then(onOk, onErr); }
        catch (e) { return Promise.reject(e); }
      }
    };
    /* awaitable — `.then` mavjud bo'lsa yetarli */
    builder.catch = function (fn) { return builder.then(undefined, fn); };
    return builder;
  }

  const channel = {
    on: function () { return channel; },
    subscribe: function (cb) {
      try { if (typeof cb === 'function') cb('SUBSCRIBED'); } catch (e) { /* jim */ }
      return channel;
    },
    unsubscribe: function () { return Promise.resolve('ok'); }
  };

  const bucket = {
    upload: function (path) { return Promise.resolve({ data: { path: path }, error: null }); },
    remove: function () { return Promise.resolve({ data: [], error: null }); },
    getPublicUrl: function (path) { return { data: { publicUrl: 'https://stub.supabase.local/storage/v1/object/public/homework_media/' + path } }; }
  };

  const client = {
    from: from,
    channel: function () { return channel; },
    removeChannel: function () { return Promise.resolve('ok'); },
    storage: { from: function () { return bucket; } },
    auth: {
      getSession: function () { return Promise.resolve({ data: { session: null }, error: null }); },
      signOut: function () { return Promise.resolve({ error: null }); }
    }
  };

  return {
    client: client,
    db: db,
    rows: table,
    reset: function (name) { db[name] = []; seq[name] = 0; }
  };
}

module.exports = { createStub: createStub };
