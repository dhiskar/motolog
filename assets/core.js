/* ===========================================================
   MotoLog — core: data, state, perhitungan
   Data disimpan 100% di localStorage perangkat.
   =========================================================== */
'use strict';

window.ML = (function () {
  const ML = {};

  const STORAGE_KEY = 'motolog.state.v1';
  const APP_VERSION = '1.0.2';

  const TYPE_META = {
    oil:    { label: 'Ganti oli',   short: 'Oli',    icon: 'droplet', tone: 'oil',    color: '#f97316' },
    repair: { label: 'Perbaikan',   short: 'Servis', icon: 'wrench',  tone: 'repair', color: '#3b82f6' },
    fuel:   { label: 'Isi BBM',     short: 'BBM',    icon: 'fuel',    tone: 'fuel',   color: '#22c55e' },
    other:  { label: 'Pengeluaran', short: 'Lain',   icon: 'tag',     tone: 'other',  color: '#8b5cf6' }
  };

  const REPAIR_CATS = ['Servis rutin', 'Ganti sparepart', 'Ban & velg', 'Rem', 'Kelistrikan', 'Mesin', 'Body & cat', 'Lainnya'];
  const OTHER_CATS  = ['Pajak & STNK', 'Asuransi', 'Parkir', 'Cuci motor', 'Aksesoris', 'Tilang', 'Lainnya'];

  /* ---------------- format & util ---------------- */
  const nf = new Intl.NumberFormat('id-ID', { maximumFractionDigits: 2 });
  const nf0 = new Intl.NumberFormat('id-ID', { maximumFractionDigits: 0 });

  const pad2 = (n) => String(n).padStart(2, '0');
  const isoOf = (d) => `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`;
  const todayISO = () => isoOf(new Date());

  function parseISO(s) {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(String(s || ''))) return null;
    const p = String(s).split('-').map(Number);
    const d = new Date(p[0], p[1] - 1, p[2]);
    return isNaN(d.getTime()) ? null : d;
  }
  const validISO = (s) => !!parseISO(s);

  function fmtDate(s, opts) {
    const d = parseISO(s);
    if (!d) return '—';
    return d.toLocaleDateString('id-ID', opts || { day: 'numeric', month: 'short', year: 'numeric' });
  }

  function addMonthsISO(iso, n) {
    const d = parseISO(iso);
    if (!d) return '';
    const day = d.getDate();
    const t = new Date(d.getFullYear(), d.getMonth() + n, 1);
    const dim = new Date(t.getFullYear(), t.getMonth() + 1, 0).getDate();
    t.setDate(Math.min(day, dim));
    return isoOf(t);
  }

  function addDaysISO(iso, n) {
    const d = parseISO(iso);
    if (!d) return '';
    d.setDate(d.getDate() + n);
    return isoOf(d);
  }

  function daysBetween(a, b) {
    const da = parseISO(a), db = parseISO(b);
    if (!da || !db) return null;
    return Math.round((db - da) / 86400000);
  }

  const monthKey = (iso) => String(iso || '').slice(0, 7);

  function monthTitle(key) {
    if (!/^\d{4}-\d{2}$/.test(key)) return 'Tanpa tanggal';
    return parseISO(key + '-01').toLocaleDateString('id-ID', { month: 'long', year: 'numeric' });
  }

  function fmtNum(n) {
    if (n === null || n === undefined || n === '' || isNaN(n)) return '—';
    return nf.format(Number(n));
  }

  function money(n) {
    if (n === null || n === undefined || isNaN(n)) return '—';
    return 'Rp ' + nf0.format(Math.round(Number(n)));
  }

  function shortMoney(n) {
    n = Number(n) || 0;
    if (n >= 1e9) return (n / 1e9).toFixed(1).replace('.', ',') + 'M';
    if (n >= 1e6) return (n / 1e6).toFixed(n >= 1e7 ? 0 : 1).replace('.', ',') + 'jt';
    if (n >= 1e3) return Math.round(n / 1e3) + 'rb';
    return String(Math.round(n));
  }

  function fmtBytes(n) {
    if (!n) return '0 KB';
    if (n >= 1048576) return (n / 1048576).toFixed(1).replace('.', ',') + ' MB';
    return Math.max(1, Math.round(n / 1024)) + ' KB';
  }

  function num(v) {
    if (typeof v === 'number') return isFinite(v) ? v : null;
    if (v === null || v === undefined) return null;
    const s = String(v).trim().replace(/\s/g, '').replace(',', '.');
    if (!s) return null;
    const n = Number(s);
    return isFinite(n) ? n : null;
  }

  const clean = (v, max) => String(v == null ? '' : v).trim().replace(/\s+/g, ' ').slice(0, max || 120);

  const ESC = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' };
  const esc = (v) => String(v == null ? '' : v).replace(/[&<>"']/g, (c) => ESC[c]);

  let uidCounter = 0;
  function uid(prefix) {
    uidCounter = (uidCounter + 1) % 1000;
    return (prefix || 'id') + Date.now().toString(36) + uidCounter.toString(36) + Math.random().toString(36).slice(2, 6);
  }

  function clamp(n, min, max) { return Math.min(max, Math.max(min, n)); }

  /* ---------------- state ---------------- */
  function defaultState() {
    return {
      v: 1,
      bikes: [],
      records: [],
      reminders: [],
      settings: {
        theme: 'auto',
        oilKm: 2500,
        oilMonths: 4,
        activeBike: null,
        installDismissed: false,
        lastBackupAt: null,
        backupNudgeAt: null
      }
    };
  }

  function normalize(input) {
    const st = defaultState();
    if (!input || typeof input !== 'object') return st;

    if (Array.isArray(input.bikes)) {
      st.bikes = input.bikes.filter((b) => b && b.id).map((b) => ({
        id: String(b.id),
        name: clean(b.name, 60) || 'Motor',
        brand: clean(b.brand, 40),
        model: clean(b.model, 40),
        year: num(b.year),
        plate: clean(b.plate, 20).toUpperCase(),
        color: clean(b.color, 30),
        odo: Math.max(0, num(b.odo) || 0),
        photo: typeof b.photo === 'string' ? b.photo : '',
        createdAt: num(b.createdAt) || Date.now()
      }));
    }

    if (Array.isArray(input.records)) {
      st.records = input.records.filter((r) => r && r.id && r.bikeId && TYPE_META[r.type]).map((r) => {
        const out = {
          id: String(r.id),
          bikeId: String(r.bikeId),
          type: r.type,
          date: validISO(r.date) ? r.date : todayISO(),
          odo: num(r.odo),
          amount: Math.max(0, num(r.amount) || 0),
          note: clean(r.note, 500),
          title: clean(r.title, 90),
          createdAt: num(r.createdAt) || Date.now(),
          updatedAt: num(r.updatedAt) || null
        };
        if (r.type === 'oil') {
          out.oilBrand = clean(r.oilBrand, 50);
          out.oilType = clean(r.oilType, 50);
          out.nextOdo = num(r.nextOdo);
          out.nextDate = validISO(r.nextDate) ? r.nextDate : '';
        } else if (r.type === 'fuel') {
          out.liters = num(r.liters);
          out.price = num(r.price);
          out.full = r.full !== false;
        } else if (r.type === 'repair') {
          out.shop = clean(r.shop, 70);
          out.category = clean(r.category, 40);
        } else {
          out.category = clean(r.category, 40);
        }
        return out;
      });
    }

    if (Array.isArray(input.reminders)) {
      st.reminders = input.reminders.filter((r) => r && r.id && r.bikeId).map((r) => ({
        id: String(r.id),
        bikeId: String(r.bikeId),
        title: clean(r.title, 90) || 'Pengingat',
        dueDate: validISO(r.dueDate) ? r.dueDate : '',
        dueOdo: num(r.dueOdo),
        note: clean(r.note, 400),
        done: !!r.done,
        createdAt: num(r.createdAt) || Date.now()
      }));
    }

    const s = input.settings || {};
    st.settings.theme = ['auto', 'light', 'dark'].indexOf(s.theme) >= 0 ? s.theme : 'auto';
    st.settings.oilKm = Math.max(200, num(s.oilKm) || 2500);
    st.settings.oilMonths = Math.max(1, Math.min(36, num(s.oilMonths) || 4));
    st.settings.installDismissed = !!s.installDismissed;
    st.settings.lastBackupAt = typeof s.lastBackupAt === 'string' && s.lastBackupAt ? s.lastBackupAt : null;
    st.settings.backupNudgeAt = typeof s.backupNudgeAt === 'string' && s.backupNudgeAt ? s.backupNudgeAt : null;
    if (st.bikes.some((b) => b.id === s.activeBike)) st.settings.activeBike = s.activeBike;
    else st.settings.activeBike = st.bikes[0] ? st.bikes[0].id : null;

    return st;
  }

  const state = normalize(null);
  ML.state = state;

  function loadState() {
    let raw = null;
    try { raw = localStorage.getItem(STORAGE_KEY); } catch (e) { raw = null; }
    let parsed = null;
    if (raw) {
      try { parsed = JSON.parse(raw); } catch (e) { parsed = null; }
    }
    replaceState(parsed || defaultState());
  }

  function replaceState(next) {
    const normalized = normalize(next);
    Object.keys(state).forEach((k) => { delete state[k]; });
    Object.assign(state, normalized);
  }

  function persist() {
    let ok = false;
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
      ok = true;
    } catch (e) {
      if (ML.toast) ML.toast('Penyimpanan browser penuh. Hapus foto atau aktifkan backup otomatis ke file.', 'bad');
      else console.warn('Gagal menyimpan', e);
    }
    // Backup otomatis tetap dijalankan walau localStorage penuh, supaya data
    // masih punya salinan di file.
    if (ML.onPersist) {
      try { ML.onPersist(); } catch (e) { /* backup otomatis tidak boleh mengganggu penyimpanan */ }
    }
    return ok;
  }

  function commit(opts) {
    persist();
    if (ML.render && !(opts && opts.render === false)) ML.render();
  }

  function resetState() {
    replaceState(defaultState());
    persist();
  }

  /* ---------------- selectors ---------------- */
  function activeBike() {
    return state.bikes.find((b) => b.id === state.settings.activeBike) || state.bikes[0] || null;
  }

  function bikeById(id) {
    return state.bikes.find((b) => b.id === id) || null;
  }

  function recordsOf(bikeId) {
    return state.records.filter((r) => r.bikeId === bikeId);
  }

  function sortedRecords(list) {
    return list.slice().sort((a, b) =>
      String(b.date || '').localeCompare(String(a.date || '')) ||
      (b.createdAt || 0) - (a.createdAt || 0)
    );
  }

  function currentOdo(bike) {
    if (!bike) return 0;
    let max = num(bike.odo) || 0;
    for (const r of state.records) {
      if (r.bikeId === bike.id) {
        const v = num(r.odo);
        if (v != null && v > max) max = v;
      }
    }
    return max;
  }

  function latestOil(bikeId) {
    const oils = state.records.filter((r) => r.bikeId === bikeId && r.type === 'oil');
    oils.sort((a, b) =>
      String(b.date || '').localeCompare(String(a.date || '')) ||
      (num(b.odo) || 0) - (num(a.odo) || 0)
    );
    return oils[0] || null;
  }

  /* ---------------- records ---------------- */
  function recordAmount(r) {
    const a = num(r.amount);
    if (a != null && a > 0) return a;
    if (r.type === 'fuel') {
      const l = num(r.liters), p = num(r.price);
      if (l != null && p != null) return l * p;
    }
    return a || 0;
  }

  function recordTitle(r) {
    if (r.type === 'oil') return r.oilBrand ? 'Ganti oli · ' + r.oilBrand : 'Ganti oli';
    if (r.type === 'fuel') return r.liters ? 'Isi BBM · ' + fmtNum(r.liters) + ' L' : 'Isi BBM';
    if (r.type === 'repair') return r.title || 'Perbaikan';
    return r.title || 'Pengeluaran';
  }

  function recordMeta(r) {
    const parts = [fmtDate(r.date)];
    if (r.odo != null) parts.push(fmtNum(r.odo) + ' km');
    if (r.type === 'fuel' && r.liters) parts.push(fmtNum(r.liters) + ' L');
    if (r.type === 'repair' && r.shop) parts.push(r.shop);
    if (r.type === 'other' && r.category) parts.push(r.category);
    return parts.join(' · ');
  }

  function spendSum(list) {
    return list.reduce((a, r) => a + recordAmount(r), 0);
  }

  function matchesQuery(r, q) {
    if (!q) return true;
    const hay = [recordTitle(r), r.note, r.oilBrand, r.oilType, r.shop, r.category, r.date, TYPE_META[r.type] && TYPE_META[r.type].label]
      .filter(Boolean).join(' ').toLowerCase();
    return hay.indexOf(String(q).toLowerCase()) >= 0;
  }

  function groupByMonth(list) {
    const map = new Map();
    for (const r of sortedRecords(list)) {
      const k = monthKey(r.date) || '0000-00';
      if (!map.has(k)) map.set(k, []);
      map.get(k).push(r);
    }
    return Array.from(map.entries()).sort((a, b) => b[0].localeCompare(a[0]));
  }

  /* ---------------- oil & reminders ---------------- */
  function oilStatus(bike) {
    if (!bike) return null;
    const oil = latestOil(bike.id);
    if (!oil) return { level: 'none', oil: null, odo: currentOdo(bike) };
    const odo = currentOdo(bike);
    const kmLeft = oil.nextOdo != null ? oil.nextOdo - odo : null;
    const daysLeft = oil.nextDate ? daysBetween(todayISO(), oil.nextDate) : null;

    let level = 'ok';
    if ((kmLeft != null && kmLeft <= 0) || (daysLeft != null && daysLeft < 0)) level = 'danger';
    else if ((kmLeft != null && kmLeft <= 400) || (daysLeft != null && daysLeft <= 14)) level = 'warn';

    const base = num(oil.odo);
    const total = oil.nextOdo != null && base != null ? oil.nextOdo - base : 0;
    const pct = total > 0 ? clamp(((odo - base) / total) * 100, 0, 100) : 0;

    return { level, oil, odo, kmLeft, daysLeft, pct, base };
  }

  function reminderStatus(r, bike) {
    const days = r.dueDate ? daysBetween(todayISO(), r.dueDate) : null;
    const km = (r.dueOdo != null && bike) ? r.dueOdo - currentOdo(bike) : null;
    let level = 'ok';
    if ((days != null && days < 0) || (km != null && km <= 0)) level = 'danger';
    else if ((days != null && days <= 14) || (km != null && km <= 300)) level = 'warn';
    return { days, km, level };
  }

  const levelRank = (level) => level === 'danger' ? 0 : level === 'warn' ? 1 : 2;

  function dueItems(bike) {
    if (!bike) return [];
    const items = [];
    const os = oilStatus(bike);
    if (os && os.oil && (os.level === 'danger' || os.level === 'warn')) {
      items.push({ kind: 'oil', level: os.level, title: 'Ganti oli', status: os });
    }
    for (const r of state.reminders) {
      if (r.bikeId !== bike.id || r.done) continue;
      const st = reminderStatus(r, bike);
      if (st.level === 'danger' || st.level === 'warn') {
        items.push({ kind: 'rem', level: st.level, title: r.title, reminder: r, status: st });
      }
    }
    return items.sort((a, b) => levelRank(a.level) - levelRank(b.level));
  }

  function reminderTag(st) {
    if (st.level === 'danger') return { text: 'Terlambat', cls: 'danger' };
    if (st.level === 'warn') {
      if (st.km != null && st.km <= 300 && st.km > 0) return { text: fmtNum(st.km) + ' km', cls: 'warn' };
      if (st.days != null && st.days >= 0) return { text: 'H-' + st.days, cls: 'warn' };
      return { text: 'Segera', cls: 'warn' };
    }
    return { text: 'Aktif', cls: 'ok' };
  }

  function reminderSub(r, st) {
    const bits = [];
    if (r.dueDate) bits.push('Jatuh tempo ' + fmtDate(r.dueDate));
    if (r.dueOdo != null) bits.push('Di ' + fmtNum(r.dueOdo) + ' km');
    if (st && st.days != null && st.days >= 0 && st.days <= 60) bits.push('H-' + st.days);
    return bits;
  }

  /* ---------------- statistics ---------------- */
  function fuelStats(list) {
    const f = list.filter((r) => r.type === 'fuel' && num(r.odo) != null && (num(r.liters) || 0) > 0);
    f.sort((a, b) => (num(a.odo) - num(b.odo)) || String(a.date || '').localeCompare(String(b.date || '')));

    let dist = 0, litersUsed = 0;
    for (let i = 1; i < f.length; i++) {
      const prev = f[i - 1], cur = f[i];
      const d = num(cur.odo) - num(prev.odo);
      if (d > 0 && cur.full !== false) {
        dist += d;
        litersUsed += num(cur.liters);
      }
    }
    const totalLiters = f.reduce((a, r) => a + (num(r.liters) || 0), 0);
    const totalCost = f.reduce((a, r) => a + recordAmount(r), 0);
    return {
      count: f.length,
      totalLiters,
      totalCost,
      dist,
      kmPerL: litersUsed > 0 ? dist / litersUsed : null,
      costPerKm: dist > 0 ? f.reduce((a, r) => a + recordAmount(r), 0) / dist : null,
      avgPrice: totalLiters > 0 ? totalCost / totalLiters : null
    };
  }

  function trackedKm(list) {
    const odos = list.map((r) => num(r.odo)).filter((v) => v != null && v > 0).sort((a, b) => a - b);
    return odos.length > 1 ? odos[odos.length - 1] - odos[0] : 0;
  }

  function periodStart(period) {
    const now = new Date();
    if (period === '1m') return isoOf(new Date(now.getFullYear(), now.getMonth(), 1));
    if (period === '3m') return isoOf(new Date(now.getFullYear(), now.getMonth() - 2, 1));
    if (period === '6m') return isoOf(new Date(now.getFullYear(), now.getMonth() - 5, 1));
    if (period === '1y') return isoOf(new Date(now.getFullYear(), 0, 1));
    return null;
  }

  function monthlySeries(list, count) {
    count = count || 6;
    const now = new Date();
    const out = [];
    for (let i = count - 1; i >= 0; i--) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
      const key = isoOf(d).slice(0, 7);
      const total = spendSum(list.filter((r) => monthKey(r.date) === key));
      out.push({
        key,
        label: d.toLocaleDateString('id-ID', { month: 'short' }),
        total,
        current: i === 0
      });
    }
    return out;
  }

  /* ---------------- export ---------------- */
  ML.STORAGE_KEY = STORAGE_KEY;
  ML.APP_VERSION = APP_VERSION;
  ML.TYPE_META = TYPE_META;
  ML.REPAIR_CATS = REPAIR_CATS;
  ML.OTHER_CATS = OTHER_CATS;

  ML.parseISO = parseISO;
  ML.validISO = validISO;
  ML.fmtDate = fmtDate;
  ML.fmtNum = fmtNum;
  ML.money = money;
  ML.shortMoney = shortMoney;
  ML.fmtBytes = fmtBytes;
  ML.num = num;
  ML.clean = clean;
  ML.esc = esc;
  ML.uid = uid;
  ML.clamp = clamp;
  ML.todayISO = todayISO;
  ML.isoOf = isoOf;
  ML.addMonthsISO = addMonthsISO;
  ML.addDaysISO = addDaysISO;
  ML.daysBetween = daysBetween;
  ML.monthKey = monthKey;
  ML.monthTitle = monthTitle;

  ML.loadState = loadState;
  ML.replaceState = replaceState;
  ML.resetState = resetState;
  ML.persist = persist;
  ML.commit = commit;
  ML.defaultState = defaultState;

  ML.activeBike = activeBike;
  ML.bikeById = bikeById;
  ML.recordsOf = recordsOf;
  ML.sortedRecords = sortedRecords;
  ML.currentOdo = currentOdo;
  ML.latestOil = latestOil;
  ML.recordAmount = recordAmount;
  ML.recordTitle = recordTitle;
  ML.recordMeta = recordMeta;
  ML.spendSum = spendSum;
  ML.matchesQuery = matchesQuery;
  ML.groupByMonth = groupByMonth;

  ML.oilStatus = oilStatus;
  ML.reminderStatus = reminderStatus;
  ML.reminderTag = reminderTag;
  ML.reminderSub = reminderSub;
  ML.dueItems = dueItems;
  ML.levelRank = levelRank;

  ML.fuelStats = fuelStats;
  ML.trackedKm = trackedKm;
  ML.periodStart = periodStart;
  ML.monthlySeries = monthlySeries;

  return ML;
})();
