/* ===========================================================
   MotoLog — sheets: dialog, form, dan aksi simpan
   =========================================================== */
'use strict';

(function () {
  const ML = window.ML;
  const S = ML.state;
  const { esc, icon } = ML;

  let toastTimer = null;
  let sheetOpen = false;
  let sheetPushed = false;
  let confirmResolver = null;

  /* ---------------- toast ---------------- */
  function toast(msg, kind) {
    const el = document.getElementById('toast');
    if (!el) return;
    el.textContent = msg;
    el.className = 'toast show' + (kind ? ' ' + kind : '');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => { el.className = 'toast'; }, 2800);
  }

  /* ---------------- sheet dasar ---------------- */
  function showSheet(opts) {
    opts = opts || {};
    resolveConfirm(false);
    const root = document.getElementById('sheet-root');
    const title = opts.title || '';
    root.innerHTML = `<div class="sheet-cover" data-cover="1">
      <div class="sheet" role="dialog" aria-modal="true" aria-label="${esc(title)}">
        <div class="sheet-grab"></div>
        <div class="sheet-head">
          <h2>${esc(title)}</h2>
          <button class="sheet-close" data-act="close-sheet" aria-label="Tutup">${icon('x')}</button>
        </div>
        <div class="sheet-scroll">${opts.body || ''}</div>
        ${opts.foot ? `<div class="sheet-foot">${opts.foot}</div>` : ''}
      </div>
    </div>`;

    const cover = root.querySelector('.sheet-cover');
    cover.dataset.sheetId = String(Date.now()) + Math.random();
    requestAnimationFrame(() => {
      // Jangan buka kembali jika sheet sudah ditutup sebelum frame berikutnya.
      if (cover.isConnected && !cover.dataset.closed) cover.classList.add('open');
    });
    document.body.classList.add('sheet-lock');
    sheetOpen = true;
    if (!sheetPushed) {
      try { history.pushState({ motologSheet: true }, ''); sheetPushed = true; } catch (e) { /* ignore */ }
    }
    if (opts.onMount) opts.onMount(cover);
  }

  function hideSheet() {
    const root = document.getElementById('sheet-root');
    const cover = root ? root.querySelector('.sheet-cover') : null;
    document.body.classList.remove('sheet-lock');
    sheetOpen = false;
    resolveConfirm(false);
    if (!cover) return;
    cover.dataset.closed = '1';
    cover.classList.remove('open');
    setTimeout(() => {
      if (cover.isConnected) cover.remove();
    }, 240);
  }

  function closeSheet() {
    if (!sheetOpen) {
      // Bersihkan sisa cover yang tertinggal (mis. ditutup sebelum animasi jalan).
      const root = document.getElementById('sheet-root');
      const cover = root ? root.querySelector('.sheet-cover') : null;
      if (cover) cover.remove();
      return;
    }
    hideSheet();
    if (sheetPushed) {
      sheetPushed = false;
      try { history.back(); } catch (e) { /* ignore */ }
    }
  }

  function handlePopState() {
    if (sheetOpen) {
      sheetPushed = false;
      hideSheet();
    }
  }

  function resolveConfirm(v) {
    if (!confirmResolver) return;
    const fn = confirmResolver;
    confirmResolver = null;
    fn(v);
  }

  function askConfirm(opts) {
    return new Promise((resolve) => {
      showSheet({
        title: opts.title || 'Konfirmasi',
        body: `<p class="confirm-msg">${esc(opts.message || '')}</p>`,
        foot: `<div class="grid2">
          <button class="btn ghost" type="button" data-act="close-sheet">Batal</button>
          <button class="btn ${opts.danger === false ? 'primary' : 'danger'}" type="button" id="cf-ok">${esc(opts.okText || 'Hapus')}</button>
        </div>`,
        onMount(cover) {
          const ok = cover.querySelector('#cf-ok');
          if (ok) ok.onclick = () => { resolveConfirm(true); closeSheet(); };
        }
      });
      confirmResolver = resolve;
    });
  }

  /* ---------------- helper ---------------- */
  function setVal(form, name, value) {
    const el = form.elements[name];
    if (!el) return;
    if (el.type === 'checkbox') el.checked = !!value;
    else el.value = value == null ? '' : value;
  }

  function avatarHTML(bike, size) {
    const initials = (bike.name || 'M').trim().split(/\s+/).map((w) => w[0]).slice(0, 2).join('').toUpperCase();
    if (bike.photo) return `<span class="avatar"><img src="${esc(bike.photo)}" alt=""></span>`;
    return `<span class="avatar">${esc(initials)}</span>`;
  }

  /* ---------------- pilih motor ---------------- */
  function openBikeSwitcher() {
    if (!S.bikes.length) { openBikeSheet(); return; }
    const rows = S.bikes.map((b) => {
      const active = b.id === S.settings.activeBike;
      return `<button class="row" data-act="set-bike" data-id="${b.id}">
        ${avatarHTML(b)}
        <span class="row-main">
          <span class="row-title">${esc(b.name)}</span>
          <span class="row-sub">${esc([b.plate, b.year].filter(Boolean).join(' · ') || 'Motor')}</span>
        </span>
        ${active ? `<span class="badge-active">${icon('check')}Aktif</span>` : icon('chevron-right')}
      </button>`;
    }).join('');

    showSheet({
      title: 'Pilih motor',
      body: `<div class="card"><div class="list">${rows}</div></div>`,
      foot: `<button class="btn primary block" type="button" data-act="add-bike">${icon('plus')} Tambah motor</button>`
    });
  }

  /* ---------------- catatan ---------------- */
  function applyTypeUI(form) {
    const type = form.dataset.type;
    form.querySelectorAll('[data-when]').forEach((el) => {
      el.hidden = el.dataset.when.split(',').indexOf(type) < 0;
    });
    form.querySelectorAll('.type-pick button').forEach((b) => {
      b.classList.toggle('active', b.dataset.type === type);
    });
    const label = form.querySelector('[data-amount-label]');
    if (label) label.textContent = type === 'fuel' ? 'Total bayar' : 'Biaya';
  }

  function openRecordSheet(opts) {
    opts = opts || {};
    const rec = opts.id ? S.records.find((r) => r.id === opts.id) : null;
    const bike = rec ? ML.bikeById(rec.bikeId) : (opts.bikeId ? ML.bikeById(opts.bikeId) : ML.activeBike());
    if (!bike) {
      toast('Tambahkan motor dulu ya', 'bad');
      openBikeSheet();
      return;
    }
    if (opts.id && !rec) { toast('Catatan tidak ditemukan', 'bad'); return; }

    const type = rec ? rec.type : (ML.TYPE_META[opts.type] ? opts.type : 'oil');
    const odoNow = ML.currentOdo(bike);
    const date = rec ? rec.date : ML.todayISO();

    const typeBtns = Object.keys(ML.TYPE_META).map((k) => {
      const m = ML.TYPE_META[k];
      return `<button type="button" data-act="pick-type" data-type="${k}" class="${k === type ? 'active' : ''}">
        ${icon(m.icon)}${m.short}
      </button>`;
    }).join('');

    const repairCats = ML.REPAIR_CATS.map((c) => `<option value="${esc(c)}">${esc(c)}</option>`).join('');
    const otherCats = ML.OTHER_CATS.map((c) => `<option value="${esc(c)}">${esc(c)}</option>`).join('');

    const body = `<form id="record-form" data-form="record" data-id="${rec ? rec.id : ''}" data-bike="${bike.id}" data-type="${type}">
      <div class="type-pick">${typeBtns}</div>

      <div class="grid2">
        <label class="field"><span>Tanggal <em>*</em></span>
          <input type="date" name="date" required value="${date}">
        </label>
        <label class="field"><span>Odometer</span>
          <div class="input-wrap suffix"><input type="number" name="odo" inputmode="numeric" min="0" step="1" placeholder="0" value=""><span class="suffix">km</span></div>
        </label>
      </div>

      <div data-when="oil">
        <div class="grid2">
          <label class="field"><span>Merek oli</span><input type="text" name="oilBrand" maxlength="50" placeholder="Yamalube" value=""></label>
          <label class="field"><span>Tipe / SAE</span><input type="text" name="oilType" maxlength="50" placeholder="MPX2 10W-30" value=""></label>
        </div>
        <div class="grid2">
          <label class="field"><span>Ganti berikutnya</span>
            <div class="input-wrap suffix"><input type="number" name="nextOdo" inputmode="numeric" min="0" step="1" placeholder="0" value=""><span class="suffix">km</span></div>
          </label>
          <label class="field"><span>Tanggal berikutnya</span><input type="date" name="nextDate" value=""></label>
        </div>
        <p class="field hint">Terisi otomatis dari interval ${ML.fmtNum(S.settings.oilKm)} km / ${S.settings.oilMonths} bulan. Bisa diubah.</p>
      </div>

      <div data-when="fuel" hidden>
        <div class="grid2">
          <label class="field"><span>Jumlah bensin</span>
            <div class="input-wrap suffix"><input type="number" name="liters" inputmode="decimal" min="0" step="0.01" placeholder="0"><span class="suffix">L</span></div>
          </label>
          <label class="field"><span>Harga / liter</span>
            <div class="input-wrap"><span class="prefix">Rp</span><input type="number" name="price" inputmode="numeric" min="0" step="50" placeholder="0"></div>
          </label>
        </div>
        <label class="check"><input type="checkbox" name="full" checked> Tangki penuh (untuk hitung konsumsi)</label>
      </div>

      <div data-when="repair" hidden>
        <label class="field"><span>Jenis perbaikan</span><input type="text" name="repairTitle" maxlength="80" placeholder="Servis rutin, ganti kampas rem…"></label>
        <div class="grid2">
          <label class="field"><span>Bengkel</span><input type="text" name="shop" maxlength="70" placeholder="Nama bengkel"></label>
          <label class="field"><span>Kategori</span><select name="repairCat">${repairCats}</select></label>
        </div>
      </div>

      <div data-when="other" hidden>
        <label class="field"><span>Keterangan</span><input type="text" name="otherTitle" maxlength="80" placeholder="Pajak, parkir, aksesoris…"></label>
        <label class="field"><span>Kategori</span><select name="otherCat">${otherCats}</select></label>
      </div>

      <label class="field"><span data-amount-label>Biaya</span>
        <div class="input-wrap"><span class="prefix">Rp</span><input type="number" name="amount" inputmode="numeric" min="0" step="500" placeholder="0"></div>
      </label>

      <label class="field"><span>Catatan</span><textarea name="note" rows="2" maxlength="500" placeholder="Opsional…"></textarea></label>
    </form>`;

    const foot = `<button class="btn primary block" type="submit" form="record-form">${rec ? 'Simpan perubahan' : 'Simpan catatan'}</button>
      ${rec ? `<button class="btn danger block" type="button" data-act="del-record" data-id="${rec.id}">${icon('trash')} Hapus catatan</button>` : ''}`;

    showSheet({
      title: rec ? 'Edit catatan' : 'Tambah catatan',
      body,
      foot,
      onMount(cover) {
        const f = cover.querySelector('#record-form');
        if (!f) return;
        applyTypeUI(f);

        if (rec) {
          setVal(f, 'date', rec.date);
          setVal(f, 'odo', rec.odo);
          setVal(f, 'amount', rec.amount);
          setVal(f, 'note', rec.note);
          if (rec.type === 'oil') {
            setVal(f, 'oilBrand', rec.oilBrand);
            setVal(f, 'oilType', rec.oilType);
            setVal(f, 'nextOdo', rec.nextOdo);
            setVal(f, 'nextDate', rec.nextDate);
            f.dataset.touchedNext = '1';
          } else if (rec.type === 'fuel') {
            setVal(f, 'liters', rec.liters);
            setVal(f, 'price', rec.price);
            setVal(f, 'full', rec.full !== false);
          } else if (rec.type === 'repair') {
            setVal(f, 'repairTitle', rec.title);
            setVal(f, 'shop', rec.shop);
            setVal(f, 'repairCat', rec.category || ML.REPAIR_CATS[0]);
          } else {
            setVal(f, 'otherTitle', rec.title);
            setVal(f, 'otherCat', rec.category || ML.OTHER_CATS[0]);
          }
        } else {
          setVal(f, 'odo', odoNow || '');
          setVal(f, 'repairCat', ML.REPAIR_CATS[0]);
          setVal(f, 'otherCat', ML.OTHER_CATS[0]);
          if (type === 'oil' && odoNow) {
            setVal(f, 'nextOdo', odoNow + (ML.num(S.settings.oilKm) || 2500));
            setVal(f, 'nextDate', ML.addMonthsISO(date, ML.num(S.settings.oilMonths) || 4));
          }
        }
      }
    });
  }

  function saveRecord(form) {
    const bike = ML.bikeById(form.dataset.bike) || ML.activeBike();
    if (!bike) { toast('Motor tidak ditemukan', 'bad'); return; }

    const fd = new FormData(form);
    const type = form.dataset.type;
    const date = String(fd.get('date') || '');
    if (!ML.validISO(date)) { toast('Tanggal belum diisi', 'bad'); return; }

    const odo = ML.num(fd.get('odo'));
    let amount = Math.max(0, ML.num(fd.get('amount')) || 0);
    const note = ML.clean(fd.get('note'), 500);
    const existing = form.dataset.id ? S.records.find((r) => r.id === form.dataset.id) : null;

    const rec = {
      id: existing ? existing.id : ML.uid('r'),
      bikeId: bike.id,
      type,
      date,
      odo,
      amount,
      note,
      createdAt: existing ? existing.createdAt : Date.now(),
      updatedAt: Date.now()
    };

    if (type === 'oil') {
      rec.oilBrand = ML.clean(fd.get('oilBrand'), 50);
      rec.oilType = ML.clean(fd.get('oilType'), 50);
      rec.nextOdo = ML.num(fd.get('nextOdo'));
      rec.nextDate = ML.validISO(fd.get('nextDate')) ? String(fd.get('nextDate')) : '';
      if (rec.nextOdo == null && odo != null) rec.nextOdo = odo + (ML.num(S.settings.oilKm) || 2500);
      if (!rec.nextDate) rec.nextDate = ML.addMonthsISO(date, ML.num(S.settings.oilMonths) || 4);
      rec.title = rec.oilBrand ? 'Ganti oli ' + rec.oilBrand : 'Ganti oli';
    } else if (type === 'fuel') {
      rec.liters = ML.num(fd.get('liters'));
      rec.price = ML.num(fd.get('price'));
      rec.full = fd.get('full') === 'on';
      if (rec.liters != null && rec.price != null && !amount) amount = Math.round(rec.liters * rec.price);
      if (rec.price == null && rec.liters && amount) rec.price = amount / rec.liters;
      if (!rec.liters && !amount) { toast('Isi jumlah liter atau biaya', 'bad'); return; }
      rec.amount = amount;
      rec.title = 'Isi BBM';
    } else if (type === 'repair') {
      rec.title = ML.clean(fd.get('repairTitle'), 80) || 'Perbaikan';
      rec.shop = ML.clean(fd.get('shop'), 70);
      rec.category = ML.clean(fd.get('repairCat'), 40) || 'Lainnya';
    } else {
      rec.title = ML.clean(fd.get('otherTitle'), 80) || 'Pengeluaran';
      rec.category = ML.clean(fd.get('otherCat'), 40) || 'Lainnya';
    }

    if (existing) Object.assign(existing, rec);
    else S.records.push(rec);

    if (odo != null && odo > (ML.num(bike.odo) || 0)) bike.odo = odo;

    ML.persist();
    closeSheet();
    ML.render();
    toast(existing ? 'Catatan diperbarui' : 'Catatan tersimpan', 'good');
  }

  /* ---------------- motor ---------------- */
  function openBikeSheet(id) {
    const bike = id ? ML.bikeById(id) : null;
    const isNew = !bike;

    const photoHTML = bike && bike.photo
      ? `<img src="${esc(bike.photo)}" alt="">`
      : icon('camera');

    const body = `<form id="bike-form" data-form="bike" data-id="${bike ? bike.id : ''}">
      <div class="photo-pick">
        <div class="photo-prev" id="photo-prev">${photoHTML}</div>
        <div class="pp-main">
          <b>Foto motor</b>
          <small>Opsional. Foto disimpan di HP kamu.</small>
          <div style="display:flex;gap:6px;margin-top:7px">
            <button type="button" class="btn soft sm" data-act="pick-photo">${icon('camera')} Pilih foto</button>
            <button type="button" class="btn ghost sm" data-act="clear-photo">Hapus</button>
          </div>
        </div>
        <input type="file" accept="image/*" data-photo id="bike-photo-input">
        <input type="hidden" name="photo" value="${bike ? esc(bike.photo) : ''}">
      </div>

      <label class="field"><span>Nama motor <em>*</em></span>
        <input type="text" name="name" required maxlength="60" placeholder="Vario 160" value="${bike ? esc(bike.name) : ''}">
      </label>

      <div class="grid2">
        <label class="field"><span>Merek</span><input type="text" name="brand" maxlength="40" placeholder="Honda" value="${bike ? esc(bike.brand) : ''}"></label>
        <label class="field"><span>Model</span><input type="text" name="model" maxlength="40" placeholder="Vario 160" value="${bike ? esc(bike.model) : ''}"></label>
      </div>

      <div class="grid2">
        <label class="field"><span>Tahun</span><input type="number" name="year" inputmode="numeric" min="1950" max="2100" placeholder="2024" value="${bike && bike.year ? bike.year : ''}"></label>
        <label class="field"><span>Nomor polisi</span><input type="text" name="plate" maxlength="20" placeholder="B 1234 XYZ" style="text-transform:uppercase" value="${bike ? esc(bike.plate) : ''}"></label>
      </div>

      <div class="grid2">
        <label class="field"><span>Warna</span><input type="text" name="color" maxlength="30" placeholder="Hitam" value="${bike ? esc(bike.color) : ''}"></label>
        <label class="field"><span>Odometer</span>
          <div class="input-wrap suffix"><input type="number" name="odo" inputmode="numeric" min="0" step="1" placeholder="0" value="${bike ? bike.odo : ''}"><span class="suffix">km</span></div>
        </label>
      </div>
    </form>`;

    showSheet({
      title: isNew ? 'Tambah motor' : 'Edit motor',
      body,
      foot: `<button class="btn primary block" type="submit" form="bike-form">${isNew ? 'Simpan motor' : 'Simpan perubahan'}</button>`,
      onMount(cover) {
        const file = cover.querySelector('#bike-photo-input');
        if (file) file.dataset.photo = '1';
      }
    });
  }

  function saveBike(form) {
    const fd = new FormData(form);
    const name = ML.clean(fd.get('name'), 60);
    if (!name) { toast('Nama motor wajib diisi', 'bad'); return; }

    const existing = form.dataset.id ? ML.bikeById(form.dataset.id) : null;
    const bike = existing || { id: ML.uid('b'), createdAt: Date.now() };

    Object.assign(bike, {
      name,
      brand: ML.clean(fd.get('brand'), 40),
      model: ML.clean(fd.get('model'), 40),
      year: ML.num(fd.get('year')),
      plate: ML.clean(fd.get('plate'), 20).toUpperCase(),
      color: ML.clean(fd.get('color'), 30),
      odo: Math.max(0, ML.num(fd.get('odo')) || 0),
      photo: String(fd.get('photo') || '')
    });

    if (!existing) {
      S.bikes.push(bike);
      if (!S.settings.activeBike) S.settings.activeBike = bike.id;
    }

    ML.persist();
    closeSheet();
    ML.render();
    toast(existing ? 'Motor diperbarui' : 'Motor ditambahkan', 'good');
  }

  /* ---------------- odometer ---------------- */
  function openOdoSheet() {
    const bike = ML.activeBike();
    if (!bike) { openBikeSheet(); return; }
    const odo = ML.currentOdo(bike);

    showSheet({
      title: 'Update odometer',
      body: `<form id="odo-form" data-form="odo">
        <label class="field"><span>Odometer ${esc(bike.name)}</span>
          <div class="input-wrap suffix" style="margin-top:2px">
            <input type="number" name="odo" required inputmode="numeric" min="0" step="1" value="${odo}">
            <span class="suffix">km</span>
          </div>
        </label>
        <p class="field hint">Odometer juga otomatis mengikuti catatan ganti oli dan servis dengan KM lebih tinggi.</p>
      </form>`,
      foot: `<button class="btn primary block" type="submit" form="odo-form">Simpan KM</button>`
    });
  }

  function saveOdo(form) {
    const bike = ML.activeBike();
    if (!bike) return;
    const odo = ML.num(form.elements.odo.value);
    if (odo == null || odo < 0) { toast('Isi odometer dengan benar', 'bad'); return; }
    bike.odo = odo;
    ML.persist();
    closeSheet();
    ML.render();
    toast('Odometer diperbarui', 'good');
  }

  /* ---------------- pengingat ---------------- */
  function openReminderSheet(id) {
    const bike = ML.activeBike();
    if (!bike) { openBikeSheet(); return; }
    const r = id ? S.reminders.find((x) => x.id === id) : null;

    const body = `<form id="rem-form" data-form="reminder" data-id="${r ? r.id : ''}">
      <label class="field"><span>Judul <em>*</em></span>
        <input type="text" name="title" required maxlength="90" placeholder="Perpanjang STNK" value="${r ? esc(r.title) : ''}">
      </label>
      <div class="grid2">
        <label class="field"><span>Tanggal</span><input type="date" name="dueDate" value="${r ? r.dueDate : ''}"></label>
        <label class="field"><span>Atau di KM</span>
          <div class="input-wrap suffix"><input type="number" name="dueOdo" inputmode="numeric" min="0" step="1" placeholder="0" value="${r && r.dueOdo != null ? r.dueOdo : ''}"><span class="suffix">km</span></div>
        </label>
      </div>
      <label class="field"><span>Catatan</span><textarea name="note" rows="2" maxlength="400" placeholder="Opsional…">${r ? esc(r.note) : ''}</textarea></label>
      <p class="field hint">Isi tanggal, KM, atau keduanya. Pengingat akan muncul di dasbor saat mendekati jatuh tempo.</p>
    </form>`;

    showSheet({
      title: r ? 'Edit pengingat' : 'Pengingat baru',
      body,
      foot: `<button class="btn primary block" type="submit" form="rem-form">${r ? 'Simpan perubahan' : 'Simpan pengingat'}</button>
        ${r ? `<button class="btn danger block" type="button" data-act="del-reminder" data-id="${r.id}">${icon('trash')} Hapus pengingat</button>` : ''}`
    });
  }

  function saveReminder(form) {
    const bike = ML.activeBike();
    if (!bike) return;
    const fd = new FormData(form);
    const title = ML.clean(fd.get('title'), 90);
    if (!title) { toast('Judul pengingat wajib diisi', 'bad'); return; }

    const existing = form.dataset.id ? S.reminders.find((x) => x.id === form.dataset.id) : null;
    const r = existing || { id: ML.uid('rem'), bikeId: bike.id, done: false, createdAt: Date.now() };

    Object.assign(r, {
      title,
      dueDate: ML.validISO(fd.get('dueDate')) ? String(fd.get('dueDate')) : '',
      dueOdo: ML.num(fd.get('dueOdo')),
      note: ML.clean(fd.get('note'), 400)
    });

    if (!existing) S.reminders.push(r);
    ML.persist();
    closeSheet();
    ML.render();
    toast(existing ? 'Pengingat diperbarui' : 'Pengingat dibuat', 'good');
  }

  /* ---------------- foto ---------------- */
  function compressImage(file) {
    return new Promise((resolve, reject) => {
      const url = URL.createObjectURL(file);
      const img = new Image();
      img.onload = () => {
        try {
          const max = 720;
          const scale = Math.min(1, max / Math.max(img.width, img.height));
          const w = Math.max(1, Math.round(img.width * scale));
          const h = Math.max(1, Math.round(img.height * scale));
          const canvas = document.createElement('canvas');
          canvas.width = w;
          canvas.height = h;
          const ctx = canvas.getContext('2d');
          ctx.drawImage(img, 0, 0, w, h);
          URL.revokeObjectURL(url);
          resolve(canvas.toDataURL('image/jpeg', 0.66));
        } catch (err) {
          try { URL.revokeObjectURL(url); } catch (e) { /* ignore */ }
          reject(err);
        }
      };
      img.onerror = () => {
        try { URL.revokeObjectURL(url); } catch (e) { /* ignore */ }
        reject(new Error('Gagal membaca gambar'));
      };
      img.src = url;
    });
  }

  /* ---------------- export ---------------- */
  ML.toast = toast;
  ML.showSheet = showSheet;
  ML.hideSheet = hideSheet;
  ML.closeSheet = closeSheet;
  ML.handlePopState = handlePopState;
  ML.askConfirm = askConfirm;
  ML.openBikeSwitcher = openBikeSwitcher;
  ML.openRecordSheet = openRecordSheet;
  ML.applyTypeUI = applyTypeUI;
  ML.saveRecord = saveRecord;
  ML.openBikeSheet = openBikeSheet;
  ML.saveBike = saveBike;
  ML.openOdoSheet = openOdoSheet;
  ML.saveOdo = saveOdo;
  ML.openReminderSheet = openReminderSheet;
  ML.saveReminder = saveReminder;
  ML.compressImage = compressImage;
})();
