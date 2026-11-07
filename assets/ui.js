/* ===========================================================
   MotoLog — ui: render tampilan
   =========================================================== */
'use strict';

(function () {
  const ML = window.ML;
  const S = ML.state;

  const {
    esc, money, fmtNum, fmtDate, shortMoney, spendSum,
    recordAmount, recordTitle, recordMeta, activeBike, recordsOf, sortedRecords,
    currentOdo, oilStatus, dueItems, reminderStatus, reminderTag, reminderSub,
    groupByMonth, monthTitle
  } = ML;

  /* ---------------- dasar ---------------- */
  const icon = (name, cls) =>
    `<svg class="ic${cls ? ' ' + cls : ''}" aria-hidden="true"><use href="#i-${name}"></use></svg>`;

  function isStandalone() {
    return (window.matchMedia && window.matchMedia('(display-mode: standalone)').matches) ||
      window.navigator.standalone === true;
  }

  function emptyHTML(iconName, title, text, action) {
    return `<div class="empty">
      <span class="e-ico">${icon(iconName)}</span>
      <b>${esc(title)}</b>
      <p>${esc(text)}</p>
      ${action || ''}
    </div>`;
  }

  function pageHead(title, sub, action) {
    return `<div class="page-head page-head-row">
      <div><h1>${esc(title)}</h1><p>${esc(sub)}</p></div>
      ${action || ''}
    </div>`;
  }

  function bikebarHTML() {
    const bike = activeBike();
    if (!bike) return '';
    const initials = (bike.name || 'M').trim().split(/\s+/).map((w) => w[0]).slice(0, 2).join('').toUpperCase();
    const av = bike.photo
      ? `<span class="avatar"><img src="${esc(bike.photo)}" alt=""></span>`
      : `<span class="avatar">${esc(initials)}</span>`;
    return `<button class="bikebar" data-act="bike-switch" aria-label="Ganti motor aktif">
      ${av}
      <span class="bikebar-main">
        <b>${esc(bike.name)}</b>
        <small>${esc([bike.plate, bike.year].filter(Boolean).join(' · ') || 'Motor aktif')}</small>
      </span>
      ${S.bikes.length > 1 ? `<span class="pill-count">${S.bikes.length} motor</span>` : ''}
      ${icon('chevron-down')}
    </button>`;
  }

  function oilLeftText(os) {
    if (!os || os.kmLeft == null) return '';
    if (os.kmLeft < 0) return `Lewat ${fmtNum(Math.abs(os.kmLeft))} km`;
    if (os.kmLeft === 0) return 'Saatnya ganti';
    return `Sisa ${fmtNum(os.kmLeft)} km`;
  }

  function oilDayText(os) {
    if (!os || os.daysLeft == null) return '';
    if (os.daysLeft < 0) return `Lewat ${Math.abs(os.daysLeft)} hari`;
    if (os.daysLeft === 0) return 'Jatuh tempo hari ini';
    return `H-${os.daysLeft}`;
  }

  function checkColor(level) {
    return level === 'danger' ? 'danger' : level === 'warn' ? 'warn' : 'ok';
  }

  /* ---------------- record row ---------------- */
  function recordRowHTML(r) {
    const meta = ML.TYPE_META[r.type] || ML.TYPE_META.other;
    const amt = recordAmount(r);
    const note = r.note || (r.type === 'fuel' && r.price ? money(r.price) + '/L' : '');
    return `<button class="row" data-act="open-record" data-id="${r.id}">
      <span class="row-ico tone-${meta.tone}">${icon(meta.icon)}</span>
      <span class="row-main">
        <span class="row-title">${esc(recordTitle(r))}</span>
        <span class="row-sub">${esc(recordMeta(r))}</span>
      </span>
      <span class="row-end">
        <b>${money(amt)}</b>
        ${note ? `<i>${esc(note)}</i>` : ''}
      </span>
    </button>`;
  }

  /* ---------------- dashboard ---------------- */
  function viewDash() {
    const bike = activeBike();
    if (!bike) return onboardingHTML();

    const recs = recordsOf(bike.id);
    const odo = currentOdo(bike);
    const os = oilStatus(bike);
    const f = ML.fuelStats(recs);
    const km = ML.trackedKm(recs);
    const totalSpend = spendSum(recs);

    const nowKey = ML.monthKey(ML.todayISO());
    const prevDate = new Date();
    prevDate.setDate(1);
    prevDate.setMonth(prevDate.getMonth() - 1);
    const prevKey = ML.isoOf(prevDate).slice(0, 7);
    const thisMonth = spendSum(recs.filter((r) => ML.monthKey(r.date) === nowKey));
    const prevMonth = spendSum(recs.filter((r) => ML.monthKey(r.date) === prevKey));

    let deltaHTML = '<span class="stat-sub">' + (thisMonth ? 'Bulan berjalan' : 'Belum ada pengeluaran') + '</span>';
    if (prevMonth > 0 && thisMonth > 0) {
      const d = Math.round(((thisMonth - prevMonth) / prevMonth) * 100);
      if (d === 0) deltaHTML = '<span class="stat-sub">Sama dengan bulan lalu</span>';
      else if (d > 0) deltaHTML = `<span class="stat-sub"><span class="up">▲ ${d}%</span> vs bulan lalu</span>`;
      else deltaHTML = `<span class="stat-sub"><span class="down">▼ ${Math.abs(d)}%</span> vs bulan lalu</span>`;
    } else if (thisMonth > 0 && prevMonth === 0) {
      deltaHTML = '<span class="stat-sub">Bulan berjalan</span>';
    }

    const costPerKm = km > 1 ? totalSpend / km : null;

    let html = bikebarHTML();

    /* hero */
    html += `<section class="hero${bike.photo ? ' has-photo' : ''}">
      ${bike.photo ? `<div class="hero-bg" style="background-image:url('${esc(bike.photo)}')"></div>` : ''}
      <div class="hero-top">
        <div>
          <div class="hero-label">Odometer saat ini</div>
          <div class="odo-big">${fmtNum(odo)}<span>km</span></div>
          <div class="hero-meta">${[bike.plate, [bike.brand, bike.model].filter(Boolean).join(' '), bike.year]
            .filter(Boolean).map(esc).join(' <span class="dot">·</span> ')}</div>
        </div>
      </div>
      <div class="hero-actions">
        <button class="btn light sm" data-act="update-odo">${icon('gauge')} Update KM</button>
        <button class="btn light sm" data-act="add" data-type="fuel">${icon('fuel')} Isi BBM</button>
      </div>
    </section>`;

    /* peringatan */
    const alerts = [];
    if (os && os.oil && os.level !== 'ok') {
      const bits = [oilLeftText(os), oilDayText(os)].filter(Boolean).join(' · ');
      alerts.push(`<button class="alert ${checkColor(os.level)}" data-act="go" data-to="reminders">
        ${icon('alert')}
        <span>
          <b>${os.level === 'danger' ? 'Ganti oli sudah terlambat' : 'Waktunya ganti oli'}</b>
          <small>${esc(bits || 'Cek jadwal perawatan')}</small>
        </span>
        ${icon('chevron-right')}
      </button>`);
    }
    const dueRem = S.reminders
      .filter((r) => r.bikeId === bike.id && !r.done)
      .map((r) => ({ r, st: reminderStatus(r, bike) }))
      .filter((x) => x.st.level === 'danger' || x.st.level === 'warn')
      .sort((a, b) => ML.levelRank(a.st.level) - ML.levelRank(b.st.level))[0];
    if (dueRem) {
      const tag = reminderTag(dueRem.st);
      alerts.push(`<button class="alert ${checkColor(dueRem.st.level)}" data-act="edit-reminder" data-id="${dueRem.r.id}">
        ${icon('bell')}
        <span>
          <b>${esc(dueRem.r.title)}</b>
          <small>${esc(ML.reminderSub(dueRem.r, dueRem.st).join(' · ') || tag.text)}</small>
        </span>
        ${icon('chevron-right')}
      </button>`);
    }
    html += alerts.join('');

    /* pengingat backup */
    const ab = ML.autoBackup ? ML.autoBackup.status() : null;
    if (ab && ab.enabled && ab.needsPermission) {
      html += `<div class="install-banner backup-banner">
        <span class="ib-ico">${icon('shield')}</span>
        <span class="ib-txt"><b>Izinkan backup otomatis</b><small>Perubahan belum bisa ditulis ke file backup.</small></span>
        <button class="btn primary sm" data-act="auto-backup-perm">Izinkan</button>
      </div>`;
    } else if (ab && !ab.enabled && ML.autoBackup.supported()) {
      const lastBackupDay = S.settings.lastBackupAt ? String(S.settings.lastBackupAt).slice(0, 10) : '';
      const backupAge = lastBackupDay ? ML.daysBetween(lastBackupDay, ML.todayISO()) : null;
      const nudgeDay = S.settings.backupNudgeAt ? String(S.settings.backupNudgeAt).slice(0, 10) : '';
      const nudgeAge = nudgeDay ? ML.daysBetween(nudgeDay, ML.todayISO()) : null;
      if ((backupAge == null || backupAge >= 7) && (nudgeAge == null || nudgeAge >= 7)) {
        html += `<div class="install-banner backup-banner">
          <span class="ib-ico">${icon('shield')}</span>
          <span class="ib-txt"><b>Amankan data kamu</b><small>Aktifkan backup otomatis agar setiap catatan ikut tersimpan ke file di HP.</small></span>
          <button class="btn primary sm" data-act="auto-backup">Aktifkan</button>
          <button class="icon-btn" data-act="dismiss-backup" aria-label="Tutup">${icon('x')}</button>
        </div>`;
      }
    }

    /* install */
    if (!isStandalone() && !S.settings.installDismissed) {
      html += `<div class="install-banner">
        <span class="ib-ico">${icon('install')}</span>
        <span class="ib-txt"><b>Instal MotoLog di HP</b><small>Buka cepat dari layar utama, tetap jalan tanpa internet.</small></span>
        <button class="btn primary sm" data-act="install">Pasang</button>
        <button class="icon-btn" data-act="dismiss-install" aria-label="Tutup">${icon('x')}</button>
      </div>`;
    }

    /* quick actions */
    html += `<div class="quick-grid">
      <button class="quick" data-act="add" data-type="oil"><span class="q-ico tone-oil">${icon('droplet')}</span>Ganti oli</button>
      <button class="quick" data-act="add" data-type="repair"><span class="q-ico tone-repair">${icon('wrench')}</span>Servis</button>
      <button class="quick" data-act="add" data-type="fuel"><span class="q-ico tone-fuel">${icon('fuel')}</span>Isi BBM</button>
      <button class="quick" data-act="add" data-type="other"><span class="q-ico tone-other">${icon('tag')}</span>Pengeluaran</button>
    </div>`;

    /* statistik ringkas */
    html += `<div class="stat-grid">
      <div class="stat">
        <div class="stat-label">${icon('calendar')} Bulan ini</div>
        <div class="stat-value">${money(thisMonth)}</div>
        ${deltaHTML}
      </div>
      <div class="stat">
        <div class="stat-label">${icon('wallet')} Total biaya</div>
        <div class="stat-value">${money(totalSpend)}</div>
        <div class="stat-sub">${recs.length} catatan</div>
      </div>
      <div class="stat">
        <div class="stat-label">${icon('fuel')} Konsumsi BBM</div>
        <div class="stat-value">${f.kmPerL ? fmtNum(f.kmPerL.toFixed(1)) : '—'}<small>${f.kmPerL ? 'km/l' : ''}</small></div>
        <div class="stat-sub">${f.totalLiters ? fmtNum(f.totalLiters) + ' liter tercatat' : 'Belum ada data'}</div>
      </div>
      <div class="stat">
        <div class="stat-label">${icon('road')} Biaya per km</div>
        <div class="stat-value">${costPerKm != null ? money(Math.round(costPerKm)) : '—'}</div>
        <div class="stat-sub">${km > 1 ? 'dari ' + fmtNum(km) + ' km' : 'Butuh 2 catatan KM'}</div>
      </div>
    </div>`;

    /* jadwal oli */
    html += oilCardHTML(os, bike);

    /* aktivitas terakhir */
    const recent = sortedRecords(recs).slice(0, 5);
    html += `<section class="card">
      <div class="card-head">
        <h2>${icon('clock')} Aktivitas terakhir</h2>
        <button class="link" data-act="go" data-to="history">Lihat semua ${icon('chevron-right')}</button>
      </div>
      <div class="list" style="margin-top:9px">
        ${recent.length ? recent.map(recordRowHTML).join('') : emptyHTML('list', 'Belum ada catatan', 'Mulai catat ganti oli, servis, atau isi BBM pertama kamu.')}
      </div>
    </section>`;

    return html;
  }

  function oilCardHTML(os, bike) {
    if (!os || !os.oil) {
      return `<section class="card">
        <div class="card-head"><h2>${icon('droplet')} Jadwal ganti oli</h2></div>
        <div class="card-body" style="padding-top:4px">
          ${emptyHTML('droplet', 'Belum ada catatan oli', 'Catat ganti oli agar pengingat berikutnya otomatis dihitung dari KM dan tanggal.',
            `<button class="btn primary sm" data-act="add" data-type="oil">${icon('plus')} Catat ganti oli</button>`)}
        </div>
      </section>`;
    }

    const oil = os.oil;
    const level = os.level;
    const big = os.kmLeft != null && os.kmLeft > 0 ? fmtNum(os.kmLeft) + '<small> km lagi</small>'
      : os.kmLeft != null && os.kmLeft <= 0 ? '<span style="font-size:20px">Terlambat</span><small> ' + fmtNum(Math.abs(os.kmLeft)) + ' km</small>'
      : fmtDate(oil.nextDate, { day: 'numeric', month: 'short' });

    return `<section class="card">
      <div class="card-head">
        <h2>${icon('droplet')} Jadwal ganti oli</h2>
        <button class="link" data-act="add" data-type="oil">${icon('plus')} Catat</button>
      </div>
      <div class="card-body">
        <div class="oil-now">
          <div class="big">${big}</div>
          <div class="oil-side">
            ${oil.nextDate ? 'Target<br><b style="color:var(--text)">' + fmtDate(oil.nextDate) + '</b>' : ''}
          </div>
        </div>
        <div class="progress ${level}"><i style="width:${Math.round(os.pct)}%"></i></div>
        <div class="oil-meta">
          <span>Terakhir <b>${fmtDate(oil.date)}</b></span>
          <span>${oil.nextOdo != null ? 'Target <b>' + fmtNum(oil.nextOdo) + ' km</b>' : (oil.oilBrand ? esc(oil.oilBrand) : '')}</span>
        </div>
      </div>
    </section>`;
  }

  function onboardingHTML() {
    return `<section class="onboard">
      <div class="onboard-art">${icon('bike')}</div>
      <h1>Semua perawatan motor, rapi di satu tempat</h1>
      <p>Catat ganti oli, servis, bensin, dan pengeluaran. Data tersimpan di HP kamu dan tetap bisa dibuka tanpa internet.</p>
      <button class="btn primary block" data-act="add-bike">${icon('plus')} Tambah motor pertama</button>
      <ul class="onboard-list">
        <li><span class="o-ico">${icon('droplet')}</span><span><b>Pengingat oli</b> otomatis dari KM dan tanggal</span></li>
        <li><span class="o-ico">${icon('chart')}</span><span><b>Statistik biaya</b> bulanan dan konsumsi BBM</span></li>
        <li><span class="o-ico">${icon('shield')}</span><span><b>Data lokal</b> — tidak dikirim ke server mana pun</span></li>
      </ul>
    </section>`;
  }

  /* ---------------- riwayat ---------------- */
  function viewHistory() {
    const bike = activeBike();
    if (!bike) return noBikeHTML();

    const filters = [
      ['all', 'Semua', 'list'],
      ['oil', 'Oli', 'droplet'],
      ['repair', 'Servis', 'wrench'],
      ['fuel', 'BBM', 'fuel'],
      ['other', 'Lain', 'tag']
    ];

    return `${bikebarHTML()}
      ${pageHead('Riwayat', 'Semua catatan motor ' + bike.name)}
      <div class="chips">
        ${filters.map((f) => `<button class="chip${ML.ui && ML.ui.historyFilter === f[0] ? ' active' : ''}" data-act="filter-history" data-filter="${f[0]}">
          ${icon(f[2])}${f[1]}
        </button>`).join('')}
      </div>
      <div class="search">
        ${icon('search')}
        <input type="search" id="history-search" placeholder="Cari catatan, oli, bengkel…" enterkeyhint="search" value="${esc(ML.ui ? ML.ui.historyQuery : '')}">
      </div>
      <div id="history-count" class="section-title" style="margin:0"><small id="history-count-txt"></small></div>
      <div id="history-list" class="stack">${historyListHTML()}</div>`;
  }

  function historyListHTML() {
    const bike = activeBike();
    if (!bike) return '';
    const filter = ML.ui ? ML.ui.historyFilter : 'all';
    const q = ML.ui ? ML.ui.historyQuery : '';

    let recs = sortedRecords(recordsOf(bike.id));
    if (filter !== 'all') recs = recs.filter((r) => r.type === filter);
    if (q) recs = recs.filter((r) => ML.matchesQuery(r, q));

    if (!recs.length) {
      return `<div class="card">${emptyHTML('search', 'Tidak ada catatan',
        q ? 'Coba kata kunci lain.' : 'Belum ada catatan untuk filter ini.',
        `<button class="btn soft sm" data-act="add" data-type="${filter === 'all' ? 'oil' : filter}">${icon('plus')} Tambah catatan</button>`)}</div>`;
    }

    return groupByMonth(recs).map(([key, list]) =>
      `<div class="month-group">
        <div class="month-head"><b>${monthTitle(key)}</b><span>${money(spendSum(list))} · ${list.length} catatan</span></div>
        <div class="card"><div class="list">${list.map(recordRowHTML).join('')}</div></div>
      </div>`
    ).join('');
  }

  function historyCountText() {
    const bike = activeBike();
    if (!bike) return '';
    const filter = ML.ui ? ML.ui.historyFilter : 'all';
    const q = ML.ui ? ML.ui.historyQuery : '';
    let recs = recordsOf(bike.id);
    if (filter !== 'all') recs = recs.filter((r) => r.type === filter);
    if (q) recs = recs.filter((r) => ML.matchesQuery(r, q));
    return `${recs.length} catatan · ${money(spendSum(recs))}`;
  }

  function refreshHistory() {
    const list = document.getElementById('history-list');
    if (list) list.innerHTML = historyListHTML();
    const count = document.getElementById('history-count-txt');
    if (count) count.textContent = historyCountText();
  }

  function noBikeHTML() {
    return `<div class="card" style="margin-top:8px">
      ${emptyHTML('bike', 'Belum ada motor', 'Tambahkan motor dulu supaya catatan dan statistik bisa disimpan.',
        `<button class="btn primary sm" data-act="add-bike">${icon('plus')} Tambah motor</button>`)}
    </div>`;
  }

  /* ---------------- statistik ---------------- */
  ML.ui = ML.ui || { historyFilter: 'all', historyQuery: '', statsPeriod: '6m' };

  function chartHTML(series) {
    const max = Math.max.apply(null, series.map((s) => s.total).concat([1]));
    return `<div class="chart">${series.map((s) => {
      const pct = s.total > 0 ? Math.max(3, (s.total / max) * 100) : 0;
      return `<div class="chart-col ${s.total ? '' : 'zero'} ${s.current ? 'current' : ''}">
        <div class="chart-track">
          <div class="chart-bar" style="height:${pct}%">
            ${s.total ? `<span class="chart-val">${shortMoney(s.total)}</span>` : ''}
          </div>
        </div>
        <div class="chart-lab">${esc(s.label)}</div>
      </div>`;
    }).join('')}</div>`;
  }

  function viewStats() {
    const bike = activeBike();
    if (!bike) return noBikeHTML();

    const period = (ML.ui && ML.ui.statsPeriod) || '6m';
    const periods = [['1m', 'Bulan'], ['3m', '3 bln'], ['6m', '6 bln'], ['1y', 'Tahun'], ['all', 'Semua']];
    const periodLabel = { '1m': 'bulan ini', '3m': '3 bulan terakhir', '6m': '6 bulan terakhir', '1y': 'tahun ini', 'all': 'semua waktu' }[period];

    const all = recordsOf(bike.id);
    const from = ML.periodStart(period);
    const recs = from ? all.filter((r) => String(r.date || '') >= from) : all;

    const total = spendSum(recs);
    const monthsSet = new Set(recs.map((r) => ML.monthKey(r.date)));
    const monthsCount = Math.max(1, monthsSet.size);
    const avg = total / monthsCount;
    const series = ML.monthlySeries(all, 6);

    const cats = ['oil', 'repair', 'fuel', 'other']
      .map((t) => ({ type: t, total: spendSum(recs.filter((r) => r.type === t)), meta: ML.TYPE_META[t] }))
      .filter((c) => c.total > 0);

    const f = ML.fuelStats(recs);
    const km = ML.trackedKm(recs);
    const costPerKm = km > 1 ? total / km : null;

    let html = `${bikebarHTML()}
      ${pageHead('Statistik', 'Rekap biaya & konsumsi ' + bike.name)}
      <div class="seg">${periods.map((p) => `<button class="${p[0] === period ? 'active' : ''}" data-act="period" data-value="${p[0]}">${p[1]}</button>`).join('')}</div>

      <div class="card"><div class="card-body">
        <div class="stat-label">${icon('wallet')} Total pengeluaran · ${esc(periodLabel)}</div>
        <div style="font-size:31px;font-weight:850;letter-spacing:-1.3px;margin-top:2px;font-variant-numeric:tabular-nums">${money(total)}</div>
        <div class="stat-sub" style="margin-top:5px">${recs.length} catatan · rata-rata ${money(avg)} / bulan</div>
      </div></div>

      <section class="card">
        <div class="card-head"><h2>${icon('chart')} 6 bulan terakhir</h2><span style="font-size:10.5px;color:var(--muted)">total/bulan</span></div>
        <div class="card-body" style="padding-top:4px">${chartHTML(series)}</div>
      </section>

      <section class="card">
        <div class="card-head"><h2>${icon('wallet')} Komposisi biaya</h2></div>
        <div class="card-body">
          ${cats.length ? `<div class="cat-list">${cats.map((c) => {
            const pct = total > 0 ? (c.total / total) * 100 : 0;
            return `<div class="cat-item">
              <div class="cat-top">
                <span class="cat-dot" style="background:${c.meta.color}"></span>
                <b>${esc(c.meta.label)}</b>
                <span class="cat-amt">${money(c.total)}</span>
                <span class="cat-pct">${Math.round(pct)}%</span>
              </div>
              <div class="cat-bar"><i style="width:${pct}%;background:${c.meta.color}"></i></div>
            </div>`;
          }).join('')}</div>` : emptyHTML('chart', 'Belum ada data', 'Catat pengeluaran pertamamu untuk melihat komposisi biaya.')}
        </div>
      </section>

      <section class="card">
        <div class="card-head"><h2>${icon('fuel')} Konsumsi & efisiensi</h2></div>
        <div class="card-body">
          <div class="mini-grid">
            <div class="mini"><div class="k">Konsumsi rata-rata</div><div class="v">${f.kmPerL ? fmtNum(f.kmPerL.toFixed(1)) : '—'}<small>km/l</small></div></div>
            <div class="mini"><div class="k">Total bensin</div><div class="v">${fmtNum(f.totalLiters)}<small>liter</small></div></div>
            <div class="mini"><div class="k">Biaya BBM</div><div class="v" style="font-size:14px">${money(f.totalCost)}</div></div>
            <div class="mini"><div class="k">Harga rata-rata</div><div class="v" style="font-size:14px">${f.avgPrice ? money(f.avgPrice) : '—'}<small>/L</small></div></div>
          </div>
          <p class="field hint" style="margin-top:10px">Konsumsi dihitung dari jarak antar-isi BBM bertanda tangki penuh. Biaya per km: <b style="color:var(--text)">${costPerKm != null ? money(Math.round(costPerKm)) + '/km' : '—'}</b>.</p>
        </div>
      </section>`;

    if (S.bikes.length > 1) {
      const rows = S.bikes.map((b) => {
        const r = recordsOf(b.id);
        return { b, total: spendSum(r), count: r.length };
      }).sort((a, b) => b.total - a.total);
      html += `<section class="card">
        <div class="card-head"><h2>${icon('bike')} Per motor</h2></div>
        <div class="list" style="margin-top:9px">
          ${rows.map(({ b, total: t, count }) => `<button class="row" data-act="set-bike" data-id="${b.id}">
            <span class="row-ico">${b.photo ? `<img src="${esc(b.photo)}" alt="" style="width:100%;height:100%;object-fit:cover;border-radius:inherit">` : icon('bike')}</span>
            <span class="row-main"><span class="row-title">${esc(b.name)}</span><span class="row-sub">${count} catatan · ${fmtNum(currentOdo(b))} km</span></span>
            <span class="row-end"><b>${money(t)}</b></span>
          </button>`).join('')}
        </div>
      </section>`;
    }

    return html;
  }

  /* ---------------- motor ---------------- */
  function viewBikes() {
    let html = pageHead('Motor saya', S.bikes.length ? S.bikes.length + ' motor terdaftar' : 'Belum ada motor',
      `<button class="btn soft sm" data-act="add-bike">${icon('plus')} Tambah</button>`);

    if (!S.bikes.length) {
      return html + `<div class="card">${emptyHTML('bike', 'Belum ada motor', 'Tambahkan motor untuk mulai mencatat perawatan dan biaya.',
        `<button class="btn primary sm" data-act="add-bike">${icon('plus')} Tambah motor</button>`)}</div>`;
    }

    html += `<div class="stack">${S.bikes.map(bikeCardHTML).join('')}</div>`;
    return html;
  }

  function bikeCardHTML(b) {
    const active = b.id === S.settings.activeBike;
    const recs = recordsOf(b.id);
    const odo = currentOdo(b);
    const initials = (b.name || 'M').trim().split(/\s+/).map((w) => w[0]).slice(0, 2).join('').toUpperCase();
    const av = b.photo
      ? `<span class="avatar"><img src="${esc(b.photo)}" alt=""></span>`
      : `<span class="avatar">${esc(initials)}</span>`;
    const desc = [b.plate, [b.brand, b.model].filter(Boolean).join(' '), b.year, b.color].filter(Boolean).join(' · ');

    return `<article class="bike-card card">
      <div class="bike-card-head" ${active ? '' : `data-act="set-bike" data-id="${b.id}" role="button" tabindex="0"`}>
        ${av}
        <div class="bc-main">
          <b>${esc(b.name)}</b>
          <small>${esc(desc || 'Motor')}</small>
        </div>
        ${active ? `<span class="badge-active">${icon('check')}Aktif</span>` : `<span class="link">${icon('chevron-right')}</span>`}
      </div>
      <div class="bike-card-stats">
        <div><div class="k">Odometer</div><div class="v">${fmtNum(odo)} km</div></div>
        <div><div class="k">Catatan</div><div class="v">${recs.length}</div></div>
        <div><div class="k">Total biaya</div><div class="v">Rp ${shortMoney(spendSum(recs))}</div></div>
      </div>
      <div class="bike-card-actions">
        <button class="btn outline sm" data-act="edit-bike" data-id="${b.id}">${icon('edit')} Edit motor</button>
        <button class="btn danger sm" data-act="del-bike" data-id="${b.id}">${icon('trash')} Hapus</button>
      </div>
    </article>`;
  }

  /* ---------------- pengingat ---------------- */
  function remItemHTML(r, bike) {
    const st = reminderStatus(r, bike);
    const tag = reminderTag(st);
    const subs = reminderSub(r, st);
    return `<div class="rem-item${r.done ? ' done' : ''}">
      <button class="rem-check" data-act="toggle-reminder" data-id="${r.id}" aria-label="${r.done ? 'Tandai belum selesai' : 'Tandai selesai'}">${icon('check')}</button>
      <div class="rem-main" data-act="edit-reminder" data-id="${r.id}" role="button" tabindex="0">
        <div class="rem-title">${esc(r.title)}</div>
        <div class="rem-sub">${(subs.length ? subs : ['Tanpa tanggal']).map((s) => `<span>${icon('calendar')}${esc(s)}</span>`).join('')}</div>
        ${r.note ? `<div class="rem-sub" style="margin-top:2px"><span>${esc(r.note)}</span></div>` : ''}
      </div>
      <span class="rem-tag ${r.done ? 'muted' : tag.cls}">${r.done ? 'Selesai' : tag.text}</span>
    </div>`;
  }

  function viewReminders() {
    const bike = activeBike();
    if (!bike) return noBikeHTML();

    const os = oilStatus(bike);
    const list = S.reminders.filter((r) => r.bikeId === bike.id);
    const active = list.filter((r) => !r.done).sort((a, b) => {
      const sa = reminderStatus(a, bike), sb = reminderStatus(b, bike);
      return ML.levelRank(sa.level) - ML.levelRank(sb.level) ||
        String(a.dueDate || '9999-99-99').localeCompare(String(b.dueDate || '9999-99-99'));
    });
    const done = list.filter((r) => r.done).sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0));

    let html = `${bikebarHTML()}
      ${pageHead('Pengingat', 'Jadwal perawatan ' + bike.name,
        `<button class="btn soft sm" data-act="add-reminder">${icon('plus')} Tambah</button>`)}`;

    /* otomatis dari oli */
    html += `<section class="card">
      <div class="card-head">
        <h2>${icon('droplet')} Ganti oli berikutnya</h2>
        ${os && os.oil ? `<span class="rem-tag ${os.level}">${os.level === 'danger' ? 'Terlambat' : os.level === 'warn' ? 'Segera' : 'Aman'}</span>` : ''}
      </div>
      <div class="card-body">
        ${os && os.oil ? `
          <div class="oil-now">
            <div class="big">${os.kmLeft != null && os.kmLeft < 0 ? 'Lewat ' + fmtNum(Math.abs(os.kmLeft)) : fmtNum(os.kmLeft != null ? os.kmLeft : 0)}<small> km</small></div>
            <div class="oil-side">${os.oil.nextDate ? 'Target<br><b style="color:var(--text)">' + fmtDate(os.oil.nextDate) + '</b>' : ''}</div>
          </div>
          <div class="progress ${os.level}"><i style="width:${Math.round(os.pct)}%"></i></div>
          <div class="oil-meta">
            <span>Odometer <b>${fmtNum(os.odo)} km</b></span>
            <span>${os.oil.oilBrand ? 'Oli <b>' + esc(os.oil.oilBrand) + '</b>' : 'Target <b>' + fmtNum(os.oil.nextOdo) + ' km</b>'}</span>
          </div>
          <button class="btn soft block sm" style="margin-top:12px" data-act="add" data-type="oil">${icon('plus')} Catat ganti oli</button>
        ` : emptyHTML('droplet', 'Belum ada data oli', 'Catat ganti oli, jadwal berikutnya akan dihitung otomatis.',
          `<button class="btn primary sm" data-act="add" data-type="oil">${icon('plus')} Catat ganti oli</button>`)}
      </div>
    </section>`;

    /* pengingat manual */
    html += `<section class="card">
      <div class="card-head"><h2>${icon('bell')} Pengingat saya</h2><span style="font-size:10.5px;color:var(--muted)">${active.length} aktif</span></div>
      <div class="list" style="margin-top:9px">
        ${active.length ? active.map((r) => remItemHTML(r, bike)).join('') :
          emptyHTML('bell', 'Belum ada pengingat', 'Contoh: perpanjang STNK, ganti ban, atau servis besar.',
            `<button class="btn soft sm" data-act="add-reminder">${icon('plus')} Buat pengingat</button>`)}
      </div>
    </section>`;

    if (done.length) {
      html += `<section class="card">
        <div class="card-head"><h2>${icon('check')} Selesai</h2></div>
        <div class="list" style="margin-top:9px">${done.map((r) => remItemHTML(r, bike)).join('')}</div>
      </section>`;
    }

    return html;
  }

  /* ---------------- pengaturan ---------------- */
  function viewSettings() {
    const installed = isStandalone();
    const themes = [['auto', 'Otomatis', 'monitor'], ['light', 'Terang', 'sun'], ['dark', 'Gelap', 'moon']];
    const currentTheme = S.settings.theme || 'auto';
    const lastBackup = S.settings.lastBackupAt ? new Date(S.settings.lastBackupAt) : null;
    const backupLabel = lastBackup && !isNaN(lastBackup.getTime())
      ? 'terakhir ' + lastBackup.toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric' })
      : 'belum pernah backup';

    const ab = ML.autoBackup ? ML.autoBackup.status() : { enabled: false, needsPermission: false };
    const abSupported = ML.autoBackup ? ML.autoBackup.supported() : false;
    let abLabel;
    if (!abSupported) {
      abLabel = 'Belum didukung browser ini · gunakan ekspor manual';
    } else if (!ab.enabled) {
      abLabel = 'Tulis file otomatis setiap ada perubahan';
    } else if (ab.needsPermission) {
      abLabel = 'Butuh izin akses file · ketuk untuk mengizinkan';
    } else {
      const when = ab.lastAt ? new Date(ab.lastAt) : null;
      const whenText = when && !isNaN(when.getTime())
        ? when.toLocaleString('id-ID', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })
        : 'menunggu perubahan';
      abLabel = 'Aktif · ' + (ab.fileName || 'file backup') + ' · ' + whenText + ' · ketuk untuk mematikan';
    }

    return `${pageHead('Pengaturan', 'Preferensi, data, dan aplikasi')}

      <section class="card">
        <div class="card-head" style="padding-bottom:12px"><h2>${icon('sun')} Tampilan</h2></div>
        <div class="setting-block">
          <div class="sb-label">Tema aplikasi</div>
          <div class="theme-seg">
            ${themes.map((t) => `<button class="theme-opt${currentTheme === t[0] ? ' active' : ''}" data-act="theme" data-value="${t[0]}">
              ${icon(t[2])}${t[1]}
            </button>`).join('')}
          </div>
        </div>
        <button class="settings-row" data-act="install" style="border-top:1px solid var(--line)">
          <span class="sr-ico">${icon('install')}</span>
          <span class="sr-main"><b>${installed ? 'Aplikasi sudah terpasang' : 'Instal aplikasi'}</b>
            <small>${installed ? 'MotoLog berjalan seperti aplikasi biasa' : 'Tambahkan ke layar utama HP kamu'}</small></span>
          ${icon('chevron-right', 'chev')}
        </button>
      </section>

      <section class="card">
        <div class="card-head" style="padding-bottom:12px"><h2>${icon('droplet')} Preferensi oli</h2></div>
        <div class="setting-block">
          <div class="grid2">
            <label class="field" style="margin-bottom:0"><span>Interval jarak (km)</span>
              <input type="number" inputmode="numeric" min="200" step="100" data-setting="oilKm" value="${S.settings.oilKm}">
            </label>
            <label class="field" style="margin-bottom:0"><span>Interval waktu (bulan)</span>
              <input type="number" inputmode="numeric" min="1" max="36" step="1" data-setting="oilMonths" value="${S.settings.oilMonths}">
            </label>
          </div>
          <p class="sb-hint">Dipakai untuk mengisi otomatis jadwal ganti oli berikutnya saat mencatat oli baru.</p>
        </div>
      </section>

      <section class="card">
        <div class="card-head" style="padding-bottom:4px"><h2>${icon('shield')} Data & cadangan</h2></div>
        <button class="settings-row" data-act="export-json">
          <span class="sr-ico">${icon('download')}</span>
          <span class="sr-main"><b>Ekspor backup (JSON)</b><small>Simpan ke file HP · ${backupLabel}</small></span>
          ${icon('chevron-right', 'chev')}
        </button>
        <button class="settings-row" data-act="auto-backup"${abSupported ? '' : ' disabled'}>
          <span class="sr-ico">${icon('shield')}</span>
          <span class="sr-main"><b>Backup otomatis ke file</b><small>${esc(abLabel)}</small></span>
          ${ab.enabled ? '<span class="sr-badge">Aktif</span>' : icon('chevron-right', 'chev')}
        </button>
        ${ab.enabled && ab.needsPermission ? `<button class="settings-row" data-act="auto-backup-perm">
          <span class="sr-ico">${icon('check')}</span>
          <span class="sr-main"><b>Izinkan akses file backup</b><small>Diperlukan agar backup bisa ditulis lagi</small></span>
          ${icon('chevron-right', 'chev')}
        </button>` : ''}
        <button class="settings-row" data-act="import-json">
          <span class="sr-ico">${icon('upload')}</span>
          <span class="sr-main"><b>Impor backup</b><small>Pulihkan data dari file backup</small></span>
          ${icon('chevron-right', 'chev')}
        </button>
        <button class="settings-row" data-act="export-csv">
          <span class="sr-ico">${icon('list')}</span>
          <span class="sr-main"><b>Ekspor CSV</b><small>Buka di Excel / Google Sheets</small></span>
          ${icon('chevron-right', 'chev')}
        </button>
        <button class="settings-row danger" data-act="reset" style="border-top:1px solid var(--line)">
          <span class="sr-ico">${icon('trash')}</span>
          <span class="sr-main"><b>Hapus semua data</b><small>Motor, catatan, dan pengingat di HP ini</small></span>
          ${icon('chevron-right', 'chev')}
        </button>
        <input type="file" id="import-file" accept=".json,application/json" hidden>
      </section>

      <section class="card">
        <div class="settings-row" style="cursor:default">
          <span class="sr-ico">${icon('shield')}</span>
          <span class="sr-main"><b>Penyimpanan lokal</b><small>Data tidak dikirim ke server mana pun</small></span>
          <span id="storage-info" style="font-size:11px;color:var(--muted);font-weight:650">—</span>
        </div>
        <div class="settings-row" style="cursor:default;border-top:1px solid var(--line)">
          <span class="sr-ico">${icon('smartphone')}</span>
          <span class="sr-main"><b>Status koneksi</b><small>Aplikasi tetap jalan tanpa internet</small></span>
          <span id="net-info" style="font-size:11px;color:var(--muted);font-weight:650">—</span>
        </div>
        <div class="settings-row" style="cursor:default;border-top:1px solid var(--line)">
          <span class="sr-ico">${icon('info')}</span>
          <span class="sr-main"><b>Versi aplikasi</b><small>MotoLog</small></span>
          <span style="font-size:11px;color:var(--muted);font-weight:650">v${ML.APP_VERSION}</span>
        </div>
      </section>

      <p style="text-align:center;font-size:10.5px;color:var(--muted-2);line-height:1.6;padding:4px 24px 10px">
        MotoLog menyimpan data di browser HP kamu. Lakukan ekspor backup secara berkala, terutama sebelum menghapus data browser atau mengganti HP.
      </p>`;
  }

  function updateSettingsInfo() {
    const st = document.getElementById('storage-info');
    if (st) {
      if (navigator.storage && navigator.storage.estimate) {
        navigator.storage.estimate().then((est) => {
          st.textContent = est && est.usage ? ML.fmtBytes(est.usage) : '0 KB';
        }).catch(() => { st.textContent = '—'; });
      } else {
        st.textContent = '—';
      }
    }
    const net = document.getElementById('net-info');
    if (net) net.textContent = navigator.onLine ? 'Online' : 'Offline';
  }

  /* ---------------- shell ---------------- */
  const ROUTES = ['dash', 'history', 'stats', 'bikes', 'reminders', 'settings'];

  function currentRoute() {
    const h = location.hash.replace(/^#\/?/, '').split('?')[0];
    return ROUTES.indexOf(h) >= 0 ? h : 'dash';
  }

  function renderTopbar() {
    const bike = activeBike();
    const due = bike ? dueItems(bike).length : 0;
    document.getElementById('topbar').innerHTML = `
      <a class="brand" href="#/dash">
        <span class="brand-mark">${icon('bike')}</span>
        <span>Moto<b>Log</b></span>
      </a>
      <div class="top-actions">
        <button class="icon-btn" data-act="go" data-to="reminders" aria-label="Pengingat">
          ${icon('bell')}
          ${due ? `<span class="dot-badge">${due > 9 ? '9+' : due}</span>` : ''}
        </button>
        <button class="icon-btn" data-act="go" data-to="settings" aria-label="Pengaturan">${icon('settings')}</button>
      </div>`;
  }

  function renderTabs(route) {
    document.getElementById('tabbar').innerHTML = `
      <a class="tab${route === 'dash' ? ' active' : ''}" href="#/dash">${icon('home')}<span>Dasbor</span></a>
      <a class="tab${route === 'history' ? ' active' : ''}" href="#/history">${icon('list')}<span>Riwayat</span></a>
      <span class="tab-fab-wrap"><button class="tab-fab" data-act="add" data-type="oil" aria-label="Tambah catatan">${icon('plus')}</button></span>
      <a class="tab${route === 'stats' ? ' active' : ''}" href="#/stats">${icon('chart')}<span>Statistik</span></a>
      <a class="tab${route === 'bikes' ? ' active' : ''}" href="#/bikes">${icon('bike')}<span>Motor</span></a>`;
  }

  function renderView(route) {
    const map = {
      dash: viewDash,
      history: viewHistory,
      stats: viewStats,
      bikes: viewBikes,
      reminders: viewReminders,
      settings: viewSettings
    };
    const view = document.getElementById('view');
    view.innerHTML = (map[route] || viewDash)();
    if (route === 'history') {
      const c = document.getElementById('history-count-txt');
      if (c) c.textContent = historyCountText();
    }
    if (route === 'settings') updateSettingsInfo();
  }

  function render() {
    const route = currentRoute();
    document.body.dataset.route = route;
    renderTopbar();
    renderView(route);
    renderTabs(route);
  }

  ML.icon = icon;
  ML.isStandalone = isStandalone;
  ML.render = render;
  ML.renderTopbar = renderTopbar;
  ML.currentRoute = currentRoute;
  ML.ROUTES = ROUTES;
  ML.refreshHistory = refreshHistory;
  ML.historyListHTML = historyListHTML;
  ML.recordRowHTML = recordRowHTML;
  ML.emptyHTML = emptyHTML;
  ML.pageHead = pageHead;
  ML.updateSettingsInfo = updateSettingsInfo;
})();
