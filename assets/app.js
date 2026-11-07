/* ===========================================================
   MotoLog — app: event, aksi, ekspor/impor, PWA
   =========================================================== */
'use strict';

(function () {
  const ML = window.ML;
  const S = ML.state;

  let deferredPrompt = null;

  /* ---------------- navigasi ---------------- */
  function navigate(to) {
    if (ML.currentRoute() === to && !ML.isStandalone()) {
      window.scrollTo(0, 0);
      return;
    }
    location.hash = '#/' + to;
  }

  /* ---------------- tema ---------------- */
  function resolveTheme() {
    const t = S.settings.theme;
    if (t === 'light' || t === 'dark') return t;
    return window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
  }

  function applyTheme() {
    const r = resolveTheme();
    const root = document.documentElement;
    root.dataset.theme = r;
    root.style.colorScheme = r;
    document.querySelectorAll('meta[name="theme-color"]').forEach((m) => {
      m.removeAttribute('media');
      m.setAttribute('content', r === 'dark' ? '#090d12' : '#f2f5f9');
    });
  }

  function setTheme(v) {
    S.settings.theme = v;
    ML.persist();
    applyTheme();
    ML.render();
    ML.toast('Tema diubah');
  }

  /* ---------------- unduh / ekspor ---------------- */
  function downloadBlob(filename, blob) {
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    a.style.display = 'none';
    document.body.appendChild(a);
    a.click();
    setTimeout(() => {
      URL.revokeObjectURL(url);
      if (a.parentNode) a.parentNode.removeChild(a);
    }, 1200);
  }

  // Chrome Android 132+ mendukung File System Access API. Pakai picker
  // "Simpan sebagai" agar file bisa langsung disimpan ke folder pilihan HP.
  async function saveFile(filename, content, opts) {
    opts = opts || {};
    const mime = opts.mime || 'text/plain;charset=utf-8';
    const blob = new Blob([content], { type: mime });

    if (window.showSaveFilePicker && window.isSecureContext) {
      try {
        const ext = '.' + filename.split('.').pop();
        const baseMime = mime.split(';')[0];
        const handle = await window.showSaveFilePicker({
          suggestedName: filename,
          types: [{
            description: opts.label || 'File MotoLog',
            accept: { [baseMime]: [ext] }
          }]
        });
        const writable = await handle.createWritable();
        await writable.write(blob);
        await writable.close();
        return 'saved';
      } catch (e) {
        if (e && e.name === 'AbortError') return 'cancelled';
        // Jika picker gagal, jatuh ke unduhan biasa.
      }
    }

    downloadBlob(filename, blob);
    return 'downloaded';
  }

  function buildPayload() {
    return {
      app: 'MotoLog',
      version: ML.APP_VERSION,
      exportedAt: new Date().toISOString(),
      data: S
    };
  }

  async function exportJSON() {
    const payload = buildPayload();
    const result = await saveFile(
      'motolog-backup-' + ML.todayISO() + '.json',
      JSON.stringify(payload, null, 2),
      { mime: 'application/json', label: 'Backup MotoLog (.json)' }
    );
    if (result === 'cancelled') return;

    S.settings.lastBackupAt = new Date().toISOString();
    ML.persist();
    if (ML.currentRoute() === 'settings') ML.render();
    ML.toast(result === 'saved' ? 'Backup disimpan ke file' : 'Backup diunduh ke folder Download', 'good');
  }

  async function exportCSV() {
    const rows = [[
      'Tanggal', 'Motor', 'Jenis', 'Keterangan', 'Odometer (km)', 'Biaya (Rp)',
      'Liter', 'Harga/liter', 'Bengkel', 'Kategori', 'Catatan'
    ]];
    ML.sortedRecords(S.records).forEach((r) => {
      const bike = ML.bikeById(r.bikeId);
      rows.push([
        r.date,
        bike ? bike.name : '',
        ML.TYPE_META[r.type] ? ML.TYPE_META[r.type].label : r.type,
        ML.recordTitle(r),
        r.odo == null ? '' : Math.round(r.odo),
        Math.round(ML.recordAmount(r)),
        r.liters == null ? '' : r.liters,
        r.price == null ? '' : Math.round(r.price),
        r.shop || '',
        r.category || '',
        r.note || ''
      ]);
    });
    const csv = rows.map((row) => row.map((cell) => {
      const s = String(cell == null ? '' : cell);
      return /[",;\n\r]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s;
    }).join(';')).join('\r\n');
    const result = await saveFile(
      'motolog-catatan-' + ML.todayISO() + '.csv',
      '\ufeff' + csv,
      { mime: 'text/csv;charset=utf-8', label: 'Data MotoLog (.csv)' }
    );
    if (result === 'cancelled') return;
    ML.toast(result === 'saved' ? 'CSV disimpan ke file' : 'CSV diunduh ke folder Download', 'good');
  }

  /* ---------------- backup otomatis ke file ---------------- */
  // Menyimpan salinan data ke file JSON pilihan pengguna setiap kali ada
  // perubahan. Butuh File System Access API + izin akses file. Tanpa API
  // tersebut, pengguna tetap bisa memakai ekspor manual.
  const AB_KEY = 'motolog.autobackup.v1';
  const AB_DB_NAME = 'motolog-fs';
  const AB_DB_STORE = 'handles';
  const AB_HANDLE_KEY = 'autobackup';

  function abSupported() {
    return !!(window.showSaveFilePicker && window.isSecureContext);
  }

  function abStatus() {
    let parsed = null;
    try { parsed = JSON.parse(localStorage.getItem(AB_KEY) || 'null'); } catch (e) { parsed = null; }
    const st = parsed && typeof parsed === 'object' ? parsed : {};
    return {
      enabled: !!st.enabled,
      fileName: typeof st.fileName === 'string' ? st.fileName : '',
      lastAt: typeof st.lastAt === 'string' ? st.lastAt : null,
      needsPermission: !!st.needsPermission,
      error: typeof st.error === 'string' ? st.error : ''
    };
  }

  function abSave(next) {
    try { localStorage.setItem(AB_KEY, JSON.stringify(next)); } catch (e) { /* diabaikan */ }
  }

  let abDbPromise = null;
  let abMemoryHandle = null;
  function abDb() {
    if (abDbPromise) return abDbPromise;
    abDbPromise = new Promise(function (resolve, reject) {
      if (!window.indexedDB) { reject(new Error('indexeddb-tidak-tersedia')); return; }
      const req = indexedDB.open(AB_DB_NAME, 1);
      req.onupgradeneeded = function () {
        const db = req.result;
        if (!db.objectStoreNames.contains(AB_DB_STORE)) db.createObjectStore(AB_DB_STORE);
      };
      req.onsuccess = function () { resolve(req.result); };
      req.onerror = function () { reject(req.error || new Error('gagal-membuka-indexeddb')); };
    });
    return abDbPromise;
  }

  function abGetHandle() {
    if (abMemoryHandle) return Promise.resolve(abMemoryHandle);
    return abDb().then(function (db) {
      return new Promise(function (resolve, reject) {
        const tx = db.transaction(AB_DB_STORE, 'readonly');
        const req = tx.objectStore(AB_DB_STORE).get(AB_HANDLE_KEY);
        req.onsuccess = function () { resolve(req.result || null); };
        req.onerror = function () { reject(req.error || new Error('gagal-membaca-handle')); };
      });
    });
  }

  function abStoreHandle(handle, deleting) {
    if (deleting) abMemoryHandle = null;
    else abMemoryHandle = handle;

    return abDb().then(function (db) {
      return new Promise(function (resolve, reject) {
        const tx = db.transaction(AB_DB_STORE, 'readwrite');
        const store = tx.objectStore(AB_DB_STORE);
        if (deleting) store.delete(AB_HANDLE_KEY);
        else store.put(handle, AB_HANDLE_KEY);
        tx.oncomplete = function () { resolve('saved'); };
        tx.onerror = function () { reject(tx.error || new Error('gagal-menulis-handle')); };
      });
    }).catch(function () {
      // IndexedDB tidak tersedia: izin file tetap dipakai selama sesi ini.
      return 'memory';
    });
  }

  function abCheckPermission(handle) {
    if (!handle || !handle.queryPermission) return Promise.resolve('granted');
    return handle.queryPermission({ mode: 'readwrite' }).catch(function () { return 'prompt'; });
  }

  let abTimer = null;
  let abWriting = false;
  let abAgain = false;
  let abErrorShown = false;

  function abSchedule() {
    if (!abStatus().enabled) return;
    if (abTimer) clearTimeout(abTimer);
    abTimer = setTimeout(function () { abTimer = null; abFlush(); }, 800);
  }

  async function abFlush() {
    const st = abStatus();
    if (!st.enabled) return;
    if (abWriting) { abAgain = true; return; }
    abWriting = true;

    try {
      const handle = await abGetHandle();
      if (!handle) {
        abSave(Object.assign({}, st, { enabled: false, error: 'File backup tidak ditemukan' }));
        return;
      }

      const perm = await abCheckPermission(handle);
      if (perm !== 'granted') {
        abSave(Object.assign({}, st, { needsPermission: true }));
        return;
      }

      const payload = buildPayload();
      const writable = await handle.createWritable();
      await writable.write(new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' }));
      await writable.close();

      abSave({
        enabled: true,
        fileName: st.fileName || handle.name || 'motolog-autobackup.json',
        lastAt: payload.exportedAt,
        needsPermission: false,
        error: ''
      });
      abErrorShown = false;
    } catch (e) {
      const name = e && e.name ? e.name : '';
      const needsPermission = name === 'NotAllowedError' || name === 'SecurityError';
      abSave(Object.assign({}, st, {
        needsPermission: needsPermission || st.needsPermission,
        error: name || 'Gagal menulis file backup'
      }));
      if (!abErrorShown && !needsPermission) {
        abErrorShown = true;
        ML.toast('Backup otomatis gagal. Cek izin file di Pengaturan.', 'bad');
      }
      if (ML.currentRoute() === 'settings') ML.render();
    } finally {
      abWriting = false;
      if (abAgain) { abAgain = false; abSchedule(); }
    }
  }

  async function enableAutoBackup() {
    if (!abSupported()) {
      ML.toast('Browser ini belum mendukung backup otomatis. Gunakan ekspor manual.', 'bad');
      return;
    }

    let handle;
    try {
      handle = await window.showSaveFilePicker({
        suggestedName: 'motolog-autobackup.json',
        types: [{
          description: 'Backup otomatis MotoLog (.json)',
          accept: { 'application/json': ['.json'] }
        }]
      });
    } catch (e) {
      if (e && e.name === 'AbortError') return;
      ML.toast('Gagal memilih file backup', 'bad');
      return;
    }

    try {
      await abStoreHandle(handle, false);
    } catch (e) {
      ML.toast('Browser ini tidak bisa menyimpan izin file', 'bad');
      return;
    }

    abSave({
      enabled: true,
      fileName: handle.name || 'motolog-autobackup.json',
      lastAt: null,
      needsPermission: false,
      error: ''
    });
    if (ML.currentRoute() === 'settings') ML.render();

    await abFlush();
    const st = abStatus();
    ML.render();
    if (st.lastAt) ML.toast('Backup otomatis aktif. Setiap perubahan langsung ditulis ke file.', 'good');
    else ML.toast('File dipilih. Izinkan akses agar backup bisa ditulis.', 'bad');
  }

  async function disableAutoBackup() {
    const ok = await ML.askConfirm({
      title: 'Matikan backup otomatis?',
      message: 'Data tetap tersimpan di browser, tetapi tidak lagi ditulis otomatis ke file.',
      okText: 'Matikan'
    });
    if (!ok) return;

    abSave({ enabled: false, fileName: abStatus().fileName, lastAt: abStatus().lastAt, needsPermission: false, error: '' });
    try { await abStoreHandle(null, true); } catch (e) { /* diabaikan */ }
    if (abTimer) { clearTimeout(abTimer); abTimer = null; }
    ML.render();
    ML.toast('Backup otomatis dimatikan');
  }

  async function requestAutoBackupPermission() {
    try {
      const handle = await abGetHandle();
      if (!handle) {
        ML.toast('File backup tidak ditemukan. Aktifkan ulang backup otomatis.', 'bad');
        return;
      }
      const perm = await handle.requestPermission({ mode: 'readwrite' });
      if (perm !== 'granted') {
        ML.toast('Izin akses file belum diberikan', 'bad');
        return;
      }
      abSave(Object.assign({}, abStatus(), { needsPermission: false, error: '' }));
      await abFlush();
      ML.render();
      ML.toast(abStatus().lastAt ? 'Izin diberikan, backup sudah diperbarui' : 'Izin diberikan', 'good');
    } catch (e) {
      ML.toast('Gagal meminta izin file', 'bad');
    }
  }

  async function initAutoBackup() {
    const st = abStatus();
    if (!st.enabled) return;
    if (!abSupported()) {
      abSave(Object.assign({}, st, { enabled: false, error: 'Browser tidak mendukung' }));
      if (ML.currentRoute() === 'settings') ML.render();
      return;
    }

    try {
      const handle = await abGetHandle();
      if (!handle) {
        abSave(Object.assign({}, st, { enabled: false, error: 'File backup tidak ditemukan' }));
        ML.render();
        ML.toast('Backup otomatis berhenti. Aktifkan ulang di Pengaturan.', 'bad');
        return;
      }
      const perm = await abCheckPermission(handle);
      abSave(Object.assign({}, st, { needsPermission: perm !== 'granted', error: '' }));
      if (perm === 'granted') abFlush();
      else if (ML.currentRoute() === 'settings' || ML.currentRoute() === 'dash') ML.render();
    } catch (e) {
      /* IndexedDB tidak tersedia; biarkan data tetap di localStorage */
    }
  }

  ML.autoBackup = {
    supported: abSupported,
    status: abStatus,
    enable: enableAutoBackup,
    disable: disableAutoBackup,
    requestPermission: requestAutoBackupPermission,
    schedule: abSchedule,
    flush: abFlush
  };
  ML.onPersist = abSchedule;

  async function importFile(file) {
    if (!file) return;
    let parsed;
    try {
      parsed = JSON.parse(await file.text());
    } catch (e) {
      ML.toast('File backup tidak valid', 'bad');
      return;
    }
    const data = parsed && parsed.data ? parsed.data : parsed;
    if (!data || !Array.isArray(data.bikes) || !Array.isArray(data.records)) {
      ML.toast('Struktur backup tidak dikenali', 'bad');
      return;
    }

    const ok = await ML.askConfirm({
      title: 'Impor backup?',
      message: `Data saat ini (${S.bikes.length} motor, ${S.records.length} catatan) akan diganti dengan isi file backup.`,
      okText: 'Impor',
      danger: false
    });
    if (!ok) return;

    ML.replaceState(data);
    ML.persist();
    ML.render();
    ML.toast('Backup berhasil dipulihkan', 'good');
  }

  async function resetAll() {
    const ok = await ML.askConfirm({
      title: 'Hapus semua data?',
      message: 'Semua motor, catatan, dan pengingat di HP ini akan dihapus permanen. Sebaiknya ekspor backup terlebih dahulu.',
      okText: 'Hapus semua'
    });
    if (!ok) return;
    ML.resetState();
    ML.render();
    ML.toast('Semua data dihapus');
  }

  /* ---------------- motor ---------------- */
  function setBike(id) {
    const bike = ML.bikeById(id);
    if (!bike) return;
    S.settings.activeBike = id;
    ML.persist();
    ML.closeSheet();
    ML.render();
    ML.toast(bike.name + ' dijadikan motor aktif');
  }

  async function deleteBike(id) {
    const bike = ML.bikeById(id);
    if (!bike) return;
    const count = S.records.filter((r) => r.bikeId === id).length;
    const ok = await ML.askConfirm({
      title: 'Hapus motor?',
      message: `"${bike.name}" beserta ${count} catatan dan seluruh pengingatnya akan dihapus permanen.`,
      okText: 'Hapus motor'
    });
    if (!ok) return;

    S.bikes = S.bikes.filter((b) => b.id !== id);
    S.records = S.records.filter((r) => r.bikeId !== id);
    S.reminders = S.reminders.filter((r) => r.bikeId !== id);
    if (S.settings.activeBike === id) S.settings.activeBike = S.bikes[0] ? S.bikes[0].id : null;

    ML.persist();
    ML.render();
    ML.toast('Motor dihapus');
  }

  /* ---------------- catatan & pengingat ---------------- */
  function deleteRecord(id) {
    const rec = S.records.find((r) => r.id === id);
    if (!rec) return;
    if (!window.confirm('Hapus catatan "' + ML.recordTitle(rec) + '"? Tindakan ini tidak bisa dibatalkan.')) return;
    S.records = S.records.filter((r) => r.id !== id);
    ML.persist();
    ML.closeSheet();
    ML.render();
    ML.toast('Catatan dihapus');
  }

  function toggleReminder(id) {
    const r = S.reminders.find((x) => x.id === id);
    if (!r) return;
    r.done = !r.done;
    ML.persist();
    ML.render();
    ML.toast(r.done ? 'Pengingat diselesaikan' : 'Pengingat diaktifkan kembali');
  }

  function deleteReminder(id) {
    const r = S.reminders.find((x) => x.id === id);
    if (!r) return;
    if (!window.confirm('Hapus pengingat "' + r.title + '"?')) return;
    S.reminders = S.reminders.filter((x) => x.id !== id);
    ML.persist();
    ML.closeSheet();
    ML.render();
    ML.toast('Pengingat dihapus');
  }

  /* ---------------- install ---------------- */
  function doInstall() {
    if (ML.isStandalone()) {
      ML.toast('MotoLog sudah terpasang di HP ini');
      return;
    }
    if (deferredPrompt) {
      const prompt = deferredPrompt;
      deferredPrompt = null;
      prompt.prompt();
      prompt.userChoice.then((choice) => {
        if (choice && choice.outcome === 'accepted') ML.toast('MotoLog dipasang. Cek layar utama HP kamu.', 'good');
      }).catch(() => { /* ignore */ });
      return;
    }
    showInstallHelp();
  }

  function showInstallHelp() {
    const ua = navigator.userAgent || '';
    const samsung = /SamsungBrowser/i.test(ua);
    const chrome = /Chrome/i.test(ua) && !/Edg|OPR|SamsungBrowser/i.test(ua);
    let steps;
    if (samsung) {
      steps = ['Buka menu ⋮ di kanan bawah browser.', 'Pilih “Tambahkan halaman ke” lalu “Layar utama”.', 'Ketuk “Tambah”, lalu buka MotoLog dari layar utama.'];
    } else if (chrome) {
      steps = ['Ketuk menu ⋮ di kanan atas browser.', 'Pilih “Instal aplikasi” atau “Tambahkan ke layar utama”.', 'Ketuk “Instal” dan buka MotoLog dari layar utama.'];
    } else {
      steps = ['Buka menu browser (⋮ atau tombol bagikan).', 'Pilih “Instal aplikasi” atau “Tambahkan ke layar utama”.', 'Konfirmasi, lalu buka MotoLog dari layar utama.'];
    }

    ML.showSheet({
      title: 'Instal MotoLog',
      body: `<p class="confirm-msg">Supaya bisa dibuka seperti aplikasi dan tetap jalan tanpa internet:</p>
        <ol class="steps">${steps.map((s) => `<li>${ML.esc(s)}</li>`).join('')}</ol>
        <p class="field hint">Aplikasi harus dibuka lewat alamat HTTPS, misalnya GitHub Pages. Data tetap tersimpan di HP kamu.</p>`,
      foot: `<button class="btn primary block" type="button" data-act="close-sheet">Mengerti</button>`
    });
  }

  /* ---------------- foto ---------------- */
  async function handlePhoto(input) {
    const file = input.files && input.files[0];
    if (!file) return;
    if (!/^image\//.test(file.type)) {
      ML.toast('Pilih file gambar (JPG/PNG)', 'bad');
      input.value = '';
      return;
    }
    try {
      const data = await ML.compressImage(file);
      const form = input.closest('form');
      if (!form) return;
      form.elements.photo.value = data;
      const prev = form.querySelector('#photo-prev');
      if (prev) prev.innerHTML = `<img src="${data}" alt="">`;
      ML.toast('Foto siap disimpan', 'good');
    } catch (e) {
      ML.toast('Gagal memproses foto', 'bad');
    }
    input.value = '';
  }

  /* ---------------- event klik ---------------- */
  document.addEventListener('click', function (e) {
    const cover = e.target.closest ? e.target.closest('.sheet-cover') : null;
    if (cover && !e.target.closest('.sheet')) {
      ML.closeSheet();
      return;
    }

    const el = e.target.closest ? e.target.closest('[data-act]') : null;
    if (!el) return;

    const act = el.dataset.act;
    switch (act) {
      case 'go':
        ML.closeSheet();
        navigate(el.dataset.to || 'dash');
        break;
      case 'add':
        ML.openRecordSheet({ type: el.dataset.type || 'oil' });
        break;
      case 'add-bike':
        ML.openBikeSheet();
        break;
      case 'edit-bike':
        ML.openBikeSheet(el.dataset.id);
        break;
      case 'del-bike':
        deleteBike(el.dataset.id);
        break;
      case 'set-bike':
        setBike(el.dataset.id);
        break;
      case 'bike-switch':
        ML.openBikeSwitcher();
        break;
      case 'update-odo':
        ML.openOdoSheet();
        break;
      case 'open-record':
        ML.openRecordSheet({ id: el.dataset.id });
        break;
      case 'del-record':
        deleteRecord(el.dataset.id);
        break;
      case 'add-reminder':
        ML.openReminderSheet();
        break;
      case 'edit-reminder':
        ML.openReminderSheet(el.dataset.id);
        break;
      case 'del-reminder':
        deleteReminder(el.dataset.id);
        break;
      case 'toggle-reminder':
        toggleReminder(el.dataset.id);
        break;
      case 'pick-type': {
        const form = el.closest('form');
        if (form) {
          form.dataset.type = el.dataset.type;
          ML.applyTypeUI(form);
        }
        break;
      }
      case 'close-sheet':
        ML.closeSheet();
        break;
      case 'filter-history':
        ML.ui.historyFilter = el.dataset.filter;
        ML.render();
        break;
      case 'period':
        ML.ui.statsPeriod = el.dataset.value;
        ML.render();
        break;
      case 'theme':
        setTheme(el.dataset.value);
        break;
      case 'install':
        doInstall();
        break;
      case 'dismiss-install':
        S.settings.installDismissed = true;
        ML.persist();
        ML.render();
        break;
      case 'export-json':
        exportJSON();
        break;
      case 'auto-backup': {
        const ab = ML.autoBackup.status();
        if (ab.enabled && ab.needsPermission) requestAutoBackupPermission();
        else if (ab.enabled) disableAutoBackup();
        else enableAutoBackup();
        break;
      }
      case 'auto-backup-perm':
        requestAutoBackupPermission();
        break;
      case 'dismiss-backup':
        S.settings.backupNudgeAt = new Date().toISOString();
        ML.persist();
        ML.render();
        break;
      case 'export-csv':
        exportCSV();
        break;
      case 'import-json': {
        const input = document.getElementById('import-file');
        if (input) input.click();
        break;
      }
      case 'reset':
        resetAll();
        break;
      case 'pick-photo': {
        const form = el.closest('form');
        if (form) {
          const input = form.querySelector('#bike-photo-input');
          if (input) input.click();
        }
        break;
      }
      case 'clear-photo': {
        const form = el.closest('form');
        if (!form) break;
        form.elements.photo.value = '';
        const prev = form.querySelector('#photo-prev');
        if (prev) prev.innerHTML = ML.icon('camera');
        break;
      }
    }
  });

  /* ---------------- submit ---------------- */
  document.addEventListener('submit', function (e) {
    const form = e.target.closest ? e.target.closest('form[data-form]') : null;
    if (!form) return;
    e.preventDefault();
    const kind = form.dataset.form;
    if (kind === 'record') ML.saveRecord(form);
    else if (kind === 'bike') ML.saveBike(form);
    else if (kind === 'odo') ML.saveOdo(form);
    else if (kind === 'reminder') ML.saveReminder(form);
  });

  /* ---------------- input ---------------- */
  document.addEventListener('input', function (e) {
    const t = e.target;

    if (t.id === 'history-search') {
      ML.ui.historyQuery = t.value;
      ML.refreshHistory();
      return;
    }

    const form = t.closest ? t.closest('#record-form') : null;
    if (!form) return;

    if (t.name === 'liters' || t.name === 'price') {
      const l = ML.num(form.elements.liters.value);
      const p = ML.num(form.elements.price.value);
      if (l != null && p != null) form.elements.amount.value = Math.round(l * p);
    }

    if (form.dataset.type === 'oil') {
      if (t.name === 'nextOdo') form.dataset.touchedNext = '1';
      if (t.name === 'nextDate') form.dataset.touchedNextDate = '1';

      if (t.name === 'odo' && !form.dataset.touchedNext) {
        const odo = ML.num(t.value);
        if (odo != null) form.elements.nextOdo.value = odo + (ML.num(S.settings.oilKm) || 2500);
      }
      if (t.name === 'date' && !form.dataset.touchedNextDate && ML.validISO(t.value)) {
        form.elements.nextDate.value = ML.addMonthsISO(t.value, ML.num(S.settings.oilMonths) || 4);
      }
    }
  });

  /* ---------------- change ---------------- */
  document.addEventListener('change', function (e) {
    const t = e.target;

    if (t.matches && t.matches('input[data-photo]')) {
      handlePhoto(t);
      return;
    }

    if (t.id === 'import-file') {
      const file = t.files && t.files[0];
      t.value = '';
      importFile(file);
      return;
    }

    if (t.matches && t.matches('[data-setting]')) {
      const key = t.dataset.setting;
      let value = ML.num(t.value);
      if (key === 'oilKm') {
        value = Math.max(200, Math.min(20000, Math.round(value || 2500)));
      } else if (key === 'oilMonths') {
        value = Math.max(1, Math.min(36, Math.round(value || 4)));
      }
      if (value == null) return;
      S.settings[key] = value;
      ML.persist();
      t.value = value;
    }
  });

  /* ---------------- keyboard ---------------- */
  document.addEventListener('keydown', function (e) {
    if (e.key === 'Escape') {
      ML.closeSheet();
      return;
    }
    if ((e.key === 'Enter' || e.key === ' ') && e.target.matches && e.target.matches('[role="button"][data-act]')) {
      e.preventDefault();
      e.target.click();
    }
  });

  /* ---------------- install prompt ---------------- */
  window.addEventListener('beforeinstallprompt', function (e) {
    e.preventDefault();
    deferredPrompt = e;
  });
  window.addEventListener('appinstalled', function () {
    deferredPrompt = null;
    ML.toast('MotoLog berhasil dipasang', 'good');
    ML.render();
  });

  /* ---------------- route & scroll ---------------- */
  window.addEventListener('hashchange', function () {
    ML.render();
    window.scrollTo(0, 0);
  });

  window.addEventListener('popstate', function () {
    ML.handlePopState();
  });

  window.addEventListener('scroll', function () {
    const topbar = document.getElementById('topbar');
    if (topbar) topbar.classList.toggle('scrolled', window.scrollY > 4);
  }, { passive: true });

  window.addEventListener('online', function () { ML.updateSettingsInfo(); });
  window.addEventListener('offline', function () { ML.updateSettingsInfo(); });

  // Tulis backup terakhir saat aplikasi ditinggalkan (best-effort).
  document.addEventListener('visibilitychange', function () {
    if (document.visibilityState === 'hidden') abFlush();
  });
  window.addEventListener('pagehide', function () { abFlush(); });

  if (window.matchMedia) {
    const mq = window.matchMedia('(prefers-color-scheme: dark)');
    const onChange = function () {
      if (S.settings.theme === 'auto') {
        applyTheme();
        if (ML.currentRoute() === 'settings') ML.render();
      }
    };
    if (mq.addEventListener) mq.addEventListener('change', onChange);
    else if (mq.addListener) mq.addListener(onChange);
  }

  /* ---------------- init ---------------- */
  function requestPersistentStorage() {
    if (!navigator.storage || !navigator.storage.persist) return;
    navigator.storage.persisted()
      .then(function (persisted) {
        if (!persisted) navigator.storage.persist().catch(function () { /* diabaikan */ });
      })
      .catch(function () { /* diabaikan */ });
  }

  function init() {
    ML.loadState();
    requestPersistentStorage();
    applyTheme();
    ML.render();
    initAutoBackup();
    if (window.scrollY > 4) {
      const topbar = document.getElementById('topbar');
      if (topbar) topbar.classList.add('scrolled');
    }
  }

  if ('serviceWorker' in navigator && /^https?:$/.test(location.protocol)) {
    window.addEventListener('load', function () {
      navigator.serviceWorker.register('./sw.js').catch(function () { /* offline mode unavailable */ });
    });
  }

  init();
})();
