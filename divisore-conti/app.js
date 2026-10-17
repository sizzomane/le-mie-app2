(function () {
  'use strict';
  var C = window.Core;
  var KEY = 'divisore-conti:v1';

  // ---------- Utilità ----------
  function $(s) { return document.querySelector(s); }
  function uid() { return Math.random().toString(36).slice(2, 9) + Date.now().toString(36).slice(-3); }
  function esc(s) {
    return String(s).replace(/[&<>"']/g, function (ch) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[ch];
    });
  }
  function oggi() { return new Date().toISOString().slice(0, 10); }
  function dataIt(iso) {
    var p = String(iso).split('-');
    return p.length === 3 ? p[2] + '/' + p[1] + '/' + p[0] : iso;
  }
  function toast(msg) {
    var t = $('#toast');
    t.textContent = msg; t.hidden = false;
    clearTimeout(toast._t);
    toast._t = setTimeout(function () { t.hidden = true; }, 2600);
  }

  // ---------- Dati e salvataggio ----------
  function seed() {
    var nomi = ['Pi', 'Lollo', 'Nico', 'Giulia', 'Teo', 'Marti'];
    var v = function (nome, qty, eu, comune) {
      return { id: uid(), nome: nome, qty: qty, prezzo: Math.round(eu * 100), comune: !!comune };
    };
    return {
      rubrica: nomi.slice(),
      ultimoGruppo: nomi.slice(),
      conti: [{
        id: uid(), nome: 'La Braise', data: oggi(),
        persone: nomi.map(function (n) { return { id: uid(), nome: n }; }),
        voci: [
          v('Tartare de thon', 3, 19), v('Picola de la mer', 1, 65), v('Entrecôte', 2, 26),
          v('Saucisse du brouc', 1, 22), v('Bavette', 1, 25), v('Verre Canarelli R', 1, 7),
          v('Verre de Punta BL', 1, 7), v('Pression Paolina', 2, 8), v('Assiette de purée', 1, 6),
          v('Panacotta fruit', 3, 8), v('Coupe 2 boules', 1, 6), v('Coupe 1 boule', 1, 3),
          v('Acqua (minerale + gazzosa)', 1, 11, true)
        ],
        assegn: {}
      }]
    };
  }

  function load() {
    try {
      var raw = localStorage.getItem(KEY);
      if (raw) {
        var d = JSON.parse(raw);
        if (d && Array.isArray(d.conti) && Array.isArray(d.rubrica)) {
          if (!Array.isArray(d.ultimoGruppo)) d.ultimoGruppo = [];
          return d;
        }
      }
    } catch (e) { /* dati illeggibili: si riparte dall'esempio */ }
    return seed();
  }

  var db = load();
  var view = { name: 'home', id: null };

  function save() {
    try { localStorage.setItem(KEY, JSON.stringify(db)); }
    catch (e) { toast('Salvataggio non riuscito: spazio o permessi del browser'); }
  }
  function contoCorrente() {
    return db.conti.filter(function (c) { return c.id === view.id; })[0];
  }
  function aggiungiARubrica(nome) {
    nome = nome.trim();
    if (!nome) return;
    var gia = db.rubrica.some(function (n) { return n.toLowerCase() === nome.toLowerCase(); });
    if (!gia) db.rubrica.push(nome);
  }

  // ---------- Schermata elenco ----------
  function renderHome() {
    var conti = db.conti.slice().sort(function (a, b) { return String(b.data).localeCompare(String(a.data)); });
    var lista = conti.map(function (c) {
      var r = C.calcola(c);
      var stato = r.mancano === 0 && r.totale > 0 ? '✅ assegnato' : (r.totale === 0 ? 'vuoto' : '⚠️ da assegnare ' + C.formatEuro(r.mancano));
      return '<div class="item card-link" data-a="apri" data-id="' + c.id + '">' +
        '<div class="item-head"><div class="item-name">' + esc(c.nome) + '</div>' +
        '<div class="item-price">' + C.formatEuro(r.totale) + '</div></div>' +
        '<div class="card-meta"><span>' + dataIt(c.data) + ' · ' + c.persone.length + ' persone · ' + stato + '</span>' +
        '<button class="btn danger" data-a="elimina-conto" data-id="' + c.id + '">Elimina</button></div></div>';
    }).join('');
    return '<h1>Conti 🍷</h1><div class="sub">Dividi lo scontrino tra amici. I dati restano su questo telefono.</div>' +
      '<button class="btn primary big" data-a="nuovo">+ Nuovo conto</button>' +
      '<button class="btn big" data-a="rubrica">👥 Nomi salvati (' + db.rubrica.length + ')</button>' +
      (lista || '<p class="muted">Nessun conto salvato.</p>');
  }

  // ---------- Schermata conto ----------
  function renderConto(c) {
    var r = C.calcola(c);
    var persone = c.persone.map(function (p) {
      return '<div class="person"><input value="' + esc(p.nome) + '" data-a-change="rinomina" data-pid="' + p.id + '" maxlength="12">' +
        '<div class="tot">' + C.formatEuro(r.tot[p.id]) + '</div></div>';
    }).join('') + '<div class="person add" data-a="persone" title="Persone">＋</div>';

    var voci = c.voci.map(function (v) {
      if (v.comune) {
        return '<div class="fixed" data-a="voce-edit" data-vid="' + v.id + '"><span>💧 ' + esc(v.nome) +
          (v.qty > 1 ? ' ×' + v.qty : '') + ' = ' + C.formatEuro(v.prezzo * v.qty) +
          ' divisa tra tutti' + (c.persone.length ? ' → ' + C.formatEuro(Math.round(v.prezzo * v.qty / c.persone.length)) + ' a testa' : '') +
          '</span><span>✎</span></div>';
      }
      var out = '';
      for (var i = 1; i <= v.qty; i++) {
        var key = v.id + ':' + i;
        var sel = (c.assegn[key] || []);
        var tutti = c.persone.length > 0 && c.persone.every(function (p) { return sel.indexOf(p.id) >= 0; });
        var chips = '<div class="chip all' + (tutti ? ' active' : '') + '" data-a="tutti" data-key="' + key + '">Tutti</div>' +
          c.persone.map(function (p) {
            return '<div class="chip' + (sel.indexOf(p.id) >= 0 ? ' active' : '') + '" data-a="chip" data-key="' + key + '" data-pid="' + p.id + '">' + esc(p.nome) + '</div>';
          }).join('');
        out += '<div class="item"><div class="item-head">' +
          '<div class="item-name" data-a="voce-edit" data-vid="' + v.id + '">' + esc(v.nome) + (v.qty > 1 ? ' (' + i + '/' + v.qty + ')' : '') + '</div>' +
          '<div class="item-price" data-a="voce-edit" data-vid="' + v.id + '">' + C.formatEuro(v.prezzo) + ' ✎</div></div>' +
          '<div class="chips">' + chips + '</div></div>';
      }
      return out;
    }).join('');

    return '<div class="bar-top"><button class="back" data-a="home" aria-label="Indietro">‹</button>' +
      '<input class="title-input" value="' + esc(c.nome) + '" data-a-change="rinomina-conto" maxlength="40"></div>' +
      '<div class="sub">' + dataIt(c.data) + ' · Tocca uno o più nomi per ogni piatto: se in più persone hanno condiviso, tocca più chip e si divide da solo.</div>' +
      '<div class="people">' + persone + '</div>' +
      voci +
      '<div class="row"><button class="btn" data-a="voce-add">＋ Aggiungi voce</button></div>';
  }

  function renderFooter(c) {
    var r = C.calcola(c);
    return '<div class="footer-inner">' +
      '<div class="footer-row"><span>Totale conto</span><span>' + C.formatEuro(r.totale) + '</span></div>' +
      '<div class="footer-row total"><span>Assegnato finora</span><span>' + C.formatEuro(r.assegnato) + '</span></div>' +
      (r.totale === 0 ? '<div class="warn">Nessuna voce: aggiungila o scansiona lo scontrino</div>'
        : (r.mancano !== 0 ? '<div class="warn">⚠️ Mancano ancora ' + C.formatEuro(r.mancano) + ' da assegnare</div>'
          : '<div class="ok">✅ Tutto assegnato correttamente</div>')) +
      '<div class="row"><button class="btn" data-a="scan">📷 Scansiona scontrino</button>' +
      '<button class="btn primary" data-a="copia">Copia riepilogo</button></div></div>';
  }

  function render() {
    var app = $('#app');
    var old = $('#footer');
    if (old) old.remove();
    if (view.name === 'conto') {
      var c = contoCorrente();
      if (!c) { view = { name: 'home', id: null }; return render(); }
      app.innerHTML = renderConto(c);
      var f = document.createElement('div');
      f.className = 'footer'; f.id = 'footer'; f.innerHTML = renderFooter(c);
      document.body.appendChild(f);
      document.body.classList.add('has-footer');
    } else {
      app.innerHTML = renderHome();
      document.body.classList.remove('has-footer');
    }
  }

  // ---------- Finestre di dialogo ----------
  var dlg = $('#dlg');
  var dlgHandlers = {};
  function apriDlg(html, handlers) {
    dlg.innerHTML = html;
    dlgHandlers = handlers || {};
    if (!dlg.open) { if (dlg.showModal) dlg.showModal(); else dlg.setAttribute('open', ''); }
  }
  function chiudiDlg() {
    if (dlg.close) { try { dlg.close(); } catch (e) { dlg.removeAttribute('open'); } } else dlg.removeAttribute('open');
    dlg.innerHTML = ''; dlgHandlers = {};
  }
  dlg.addEventListener('click', function (e) {
    var el = e.target.closest('[data-d]');
    if (el && dlgHandlers[el.dataset.d]) dlgHandlers[el.dataset.d](el, e);
  });
  dlg.addEventListener('input', function (e) {
    if (dlgHandlers.input) dlgHandlers.input(e.target, e);
  });
  dlg.addEventListener('keydown', function (e) {
    if (e.key === 'Enter' && e.target.matches('input[data-enter]') && dlgHandlers[e.target.dataset.enter]) {
      e.preventDefault(); dlgHandlers[e.target.dataset.enter](e.target, e);
    }
  });

  // --- Nuovo conto
  function dlgNuovo() {
    var d = new Date();
    var nome = 'Conto del ' + String(d.getDate()).padStart(2, '0') + '/' + String(d.getMonth() + 1).padStart(2, '0');
    apriDlg('<h2>Nuovo conto</h2>' +
      '<label class="field">Nome<input type="text" id="n-nome" value="' + esc(nome) + '" maxlength="40" data-enter="crea"></label>' +
      '<div class="muted">Partono le persone dell\'ultimo conto' + (db.ultimoGruppo.length ? ': ' + esc(db.ultimoGruppo.join(', ')) : ' (nessuna ancora)') + '. Le cambi dopo.</div>' +
      '<div class="dlg-actions"><button class="btn" data-d="annulla">Annulla</button><button class="btn primary" data-d="crea">Crea</button></div>', {
        annulla: chiudiDlg,
        crea: function () {
          var n = $('#n-nome').value.trim() || nome;
          var c = {
            id: uid(), nome: n, data: oggi(), voci: [], assegn: {},
            persone: db.ultimoGruppo.map(function (x) { return { id: uid(), nome: x }; })
          };
          db.conti.push(c); save(); chiudiDlg();
          view = { name: 'conto', id: c.id }; render(); window.scrollTo(0, 0);
          if (!c.persone.length) dlgPersone();
        }
      });
  }

  // --- Nomi salvati (rubrica)
  function dlgRubrica() {
    function draw() {
      var chips = db.rubrica.map(function (n, i) {
        return '<div class="chip">' + esc(n) + '<span class="x" data-d="del" data-i="' + i + '">✕</span></div>';
      }).join('');
      apriDlg('<h2>Nomi salvati</h2><div class="chips">' + (chips || '<span class="muted">Nessun nome salvato.</span>') + '</div>' +
        '<div class="add-line"><input type="text" id="r-nuovo" placeholder="Nuovo nome" maxlength="12" data-enter="add"><button class="btn primary" data-d="add">Aggiungi</button></div>' +
        '<div class="dlg-actions"><button class="btn" data-d="chiudi">Chiudi</button></div>', handlers);
    }
    var handlers = {
      chiudi: function () { chiudiDlg(); render(); },
      del: function (el) { db.rubrica.splice(+el.dataset.i, 1); save(); draw(); },
      add: function () {
        var v = $('#r-nuovo').value; aggiungiARubrica(v); save(); draw();
        var inp = $('#r-nuovo'); if (inp) inp.focus();
      }
    };
    draw();
  }

  // --- Persone del conto
  function dlgPersone() {
    var c = contoCorrente();
    function nelConto(nome) {
      return c.persone.filter(function (p) { return p.nome.toLowerCase() === nome.toLowerCase(); })[0];
    }
    function draw() {
      var chips = db.rubrica.map(function (n, i) {
        return '<div class="chip' + (nelConto(n) ? ' active' : '') + '" data-d="toggle" data-i="' + i + '">' + esc(n) + '</div>';
      }).join('');
      var extra = c.persone.filter(function (p) {
        return !db.rubrica.some(function (n) { return n.toLowerCase() === p.nome.toLowerCase(); });
      }).map(function (p) {
        return '<div class="chip active" data-d="rimuovi" data-pid="' + p.id + '">' + esc(p.nome) + '</div>';
      }).join('');
      apriDlg('<h2>Chi c\'è nel conto</h2><div class="muted" style="margin-bottom:8px">Tocca un nome per aggiungerlo o toglierlo.</div>' +
        '<div class="chips">' + chips + extra + '</div>' +
        '<div class="add-line"><input type="text" id="p-nuovo" placeholder="Nuovo nome (si salva)" maxlength="12" data-enter="add"><button class="btn primary" data-d="add">Aggiungi</button></div>' +
        '<div class="dlg-actions"><button class="btn primary" data-d="chiudi">Fatto</button></div>', handlers);
    }
    function rimuovi(pid) {
      c.persone = c.persone.filter(function (p) { return p.id !== pid; });
      Object.keys(c.assegn).forEach(function (k) {
        c.assegn[k] = c.assegn[k].filter(function (id) { return id !== pid; });
        if (!c.assegn[k].length) delete c.assegn[k];
      });
    }
    var handlers = {
      toggle: function (el) {
        var nome = db.rubrica[+el.dataset.i];
        var p = nelConto(nome);
        if (p) rimuovi(p.id); else c.persone.push({ id: uid(), nome: nome });
        save(); draw();
      },
      rimuovi: function (el) { rimuovi(el.dataset.pid); save(); draw(); },
      add: function () {
        var nome = $('#p-nuovo').value.trim();
        if (nome && !nelConto(nome)) { aggiungiARubrica(nome); c.persone.push({ id: uid(), nome: nome }); }
        save(); draw();
        var inp = $('#p-nuovo'); if (inp) inp.focus();
      },
      chiudi: function () {
        db.ultimoGruppo = c.persone.map(function (p) { return p.nome; });
        c.persone.forEach(function (p) { aggiungiARubrica(p.nome); });
        save(); chiudiDlg(); render();
      }
    };
    draw();
  }

  // --- Aggiungi o modifica una voce
  function dlgVoce(vid) {
    var c = contoCorrente();
    var v = vid ? c.voci.filter(function (x) { return x.id === vid; })[0] : null;
    apriDlg('<h2>' + (v ? 'Modifica voce' : 'Nuova voce') + '</h2>' +
      '<label class="field">Nome<input type="text" id="v-nome" value="' + esc(v ? v.nome : '') + '" maxlength="60"></label>' +
      '<div class="field-row"><label class="field">Quantità<input type="number" id="v-qty" min="1" max="30" value="' + (v ? v.qty : 1) + '" inputmode="numeric"></label>' +
      '<label class="field">Prezzo unitario (€)<input type="text" id="v-prezzo" inputmode="decimal" value="' + (v ? (v.prezzo / 100).toFixed(2).replace('.', ',') : '') + '"></label></div>' +
      '<label class="check"><input type="checkbox" id="v-comune"' + (v && v.comune ? ' checked' : '') + '> Divisa tra tutti (acqua, coperto, servizio…)</label>' +
      '<div class="dlg-actions">' + (v ? '<button class="btn danger" data-d="elimina">Elimina</button>' : '') +
      '<button class="btn" data-d="annulla">Annulla</button><button class="btn primary" data-d="salva">Salva</button></div>', {
        annulla: chiudiDlg,
        elimina: function () {
          c.voci = c.voci.filter(function (x) { return x.id !== v.id; });
          Object.keys(c.assegn).forEach(function (k) { if (k.indexOf(v.id + ':') === 0) delete c.assegn[k]; });
          save(); chiudiDlg(); render();
        },
        salva: function () {
          var nome = $('#v-nome').value.trim();
          var qty = parseInt($('#v-qty').value, 10);
          var prezzo = C.parseEuro($('#v-prezzo').value);
          if (!nome) return toast('Scrivi il nome della voce');
          if (!(qty >= 1 && qty <= 30)) return toast('Quantità da 1 a 30');
          if (prezzo === null || prezzo <= 0) return toast('Prezzo non valido, esempio 12,50');
          var comune = $('#v-comune').checked;
          if (v) {
            v.nome = nome; v.qty = qty; v.prezzo = prezzo; v.comune = comune;
            Object.keys(c.assegn).forEach(function (k) {
              if (k.indexOf(v.id + ':') === 0 && (comune || +k.split(':')[1] > qty)) delete c.assegn[k];
            });
          } else {
            c.voci.push({ id: uid(), nome: nome, qty: qty, prezzo: prezzo, comune: comune });
          }
          save(); chiudiDlg(); render();
        }
      });
  }

  // ---------- Foto dello scontrino ----------
  function showBusy(txt, p) {
    $('#busy').hidden = false;
    $('#busy-text').textContent = txt;
    $('#busy-bar').style.width = Math.round((p || 0) * 100) + '%';
  }
  function hideBusy() { $('#busy').hidden = true; }

  function caricaScript(src) {
    return new Promise(function (ok, ko) {
      if (window.Tesseract) return ok();
      var s = document.createElement('script');
      s.src = src; s.onload = function () { ok(); };
      s.onerror = function () { ko(new Error('file del lettore non trovato')); };
      document.head.appendChild(s);
    });
  }

  // Ridimensiona, passa in grigio e allarga il contrasto: aiuta molto la lettura.
  function preparaImmagine(file) {
    return new Promise(function (ok, ko) {
      var url = URL.createObjectURL(file);
      var img = new Image();
      img.onload = function () {
        var max = 2200, w = img.naturalWidth, h = img.naturalHeight;
        var k = Math.min(1, max / Math.max(w, h));
        var cw = Math.round(w * k), ch = Math.round(h * k);
        var cv = document.createElement('canvas');
        cv.width = cw; cv.height = ch;
        var ctx = cv.getContext('2d', { willReadFrequently: true });
        ctx.drawImage(img, 0, 0, cw, ch);
        URL.revokeObjectURL(url);
        var id = ctx.getImageData(0, 0, cw, ch), d = id.data, hist = new Array(256).fill(0), i, g;
        for (i = 0; i < d.length; i += 4) {
          g = Math.round(0.299 * d[i] + 0.587 * d[i + 1] + 0.114 * d[i + 2]);
          d[i] = d[i + 1] = d[i + 2] = g; hist[g]++;
        }
        var n = cw * ch, acc = 0, lo = 0, hi = 255;
        for (i = 0; i < 256; i++) { acc += hist[i]; if (acc >= n * 0.02) { lo = i; break; } }
        acc = 0;
        for (i = 255; i >= 0; i--) { acc += hist[i]; if (acc >= n * 0.02) { hi = i; break; } }
        if (hi - lo < 30) { lo = 0; hi = 255; }
        var sc = 255 / (hi - lo);
        for (i = 0; i < d.length; i += 4) {
          g = Math.max(0, Math.min(255, (d[i] - lo) * sc));
          d[i] = d[i + 1] = d[i + 2] = g;
        }
        ctx.putImageData(id, 0, 0);
        ok(cv);
      };
      img.onerror = function () { URL.revokeObjectURL(url); ko(new Error('immagine non leggibile')); };
      img.src = url;
    });
  }

  function scansiona(file) {
    var abs = function (p) { return new URL(p, location.href).href; };
    showBusy('Preparo la foto…', 0.02);
    preparaImmagine(file).then(function (canvas) {
      showBusy('Carico il lettore…', 0.05);
      return caricaScript('vendor/tesseract/tesseract.min.js').then(function () {
        return window.Tesseract.createWorker('ita', 1, {
          workerPath: abs('vendor/tesseract/worker.min.js'),
          corePath: abs('vendor/tesseract/core'),
          langPath: abs('vendor/tesseract/lang'),
          cacheMethod: 'none',
          gzip: true,
          logger: function (m) {
            if (m.status === 'recognizing text') showBusy('Leggo lo scontrino…', 0.1 + 0.9 * m.progress);
          }
        });
      }).then(function (worker) {
        return worker.setParameters({ tessedit_pageseg_mode: '6', preserve_interword_spaces: '1' })
          .then(function () { return worker.recognize(canvas); })
          .then(function (res) { return worker.terminate().then(function () { return res; }); });
      });
    }).then(function (res) {
      hideBusy();
      var testo = res.data.text || '';
      dlgRevisione(C.parseReceipt(testo), testo);
    }).catch(function (e) {
      hideBusy();
      toast('Lettura non riuscita (' + (e && e.message ? e.message : 'errore') + '). Aggiungi le voci a mano.');
    });
  }

  function dlgRevisione(parsed, testo) {
    var c = contoCorrente();
    var rows = parsed.items.map(function (it) {
      return { nome: it.nome, qty: String(it.qty), prezzo: (it.prezzo / 100).toFixed(2).replace('.', ','), dubbio: it.dubbio };
    });
    function somma() {
      var s = 0;
      rows.forEach(function (r) {
        var q = parseInt(r.qty, 10), p = C.parseEuro(r.prezzo);
        if (q >= 1 && p !== null) s += q * p;
      });
      return s;
    }
    function sommaHtml() {
      var s = somma();
      var t = parsed.totale;
      var conf = t == null ? 'Totale non trovato sullo scontrino.'
        : (s === t ? '✅ Torna con il totale letto (' + C.formatEuro(t) + ').'
          : '⚠️ Totale letto ' + C.formatEuro(t) + ', differenza ' + C.formatEuro(t - s) + ': controlla le righe.');
      return '<b>Somma voci: ' + C.formatEuro(s) + '</b><br>' + conf;
    }
    function draw() {
      var righe = rows.map(function (r, i) {
        return '<div class="rev-row' + (r.dubbio ? ' dubbio' : '') + '">' +
          '<input class="q" type="text" inputmode="numeric" value="' + esc(r.qty) + '" data-i="' + i + '" data-f="qty">' +
          '<input type="text" value="' + esc(r.nome) + '" data-i="' + i + '" data-f="nome">' +
          '<input class="p" type="text" inputmode="decimal" value="' + esc(r.prezzo) + '" data-i="' + i + '" data-f="prezzo">' +
          '<button class="del" data-d="del" data-i="' + i + '" aria-label="Togli">✕</button></div>';
      }).join('');
      apriDlg('<h2>Controlla le voci lette</h2>' +
        '<div class="muted" style="margin-bottom:8px">Il prezzo è <b>unitario</b>. Correggi quello che serve; le righe evidenziate sono incerte.</div>' +
        '<div class="rev-head"><span>Qtà</span><span>Voce</span><span>Prezzo €</span><span></span></div>' +
        (righe || '<p class="muted">Nessuna voce riconosciuta. Prova con una foto più dritta e luminosa, oppure aggiungi le righe qui sotto.</p>') +
        '<button class="btn" data-d="riga" style="margin-top:4px">＋ Riga</button>' +
        '<div class="rev-sum" id="rev-sum">' + sommaHtml() + '</div>' +
        '<div class="dlg-actions"><button class="btn" data-d="annulla">Annulla</button><button class="btn primary" data-d="ok">Aggiungi al conto</button></div>' +
        '<details><summary>Testo letto dalla foto</summary><pre>' + esc(testo) + '</pre></details>', handlers);
      // niente tastiera che si apre da sola sul primo campo
      if (document.activeElement && document.activeElement.blur) document.activeElement.blur();
    }
    var handlers = {
      input: function (el) {
        if (!el.dataset.f) return;
        rows[+el.dataset.i][el.dataset.f] = el.value;
        var s = $('#rev-sum'); if (s) s.innerHTML = sommaHtml();
      },
      del: function (el) { rows.splice(+el.dataset.i, 1); draw(); },
      riga: function () { rows.push({ nome: '', qty: '1', prezzo: '', dubbio: false }); draw(); },
      annulla: chiudiDlg,
      ok: function () {
        var nuove = [], errore = false;
        rows.forEach(function (r) {
          if (!r.nome.trim() && !r.prezzo.trim()) return;
          var q = parseInt(r.qty, 10), p = C.parseEuro(r.prezzo);
          if (!r.nome.trim() || !(q >= 1 && q <= 30) || p === null || p <= 0) { errore = true; return; }
          nuove.push({ id: uid(), nome: r.nome.trim(), qty: q, prezzo: p, comune: false });
        });
        if (errore) return toast('Alcune righe sono incomplete: correggile o toglile');
        if (!nuove.length) return toast('Nessuna voce da aggiungere');
        nuove.forEach(function (v) { c.voci.push(v); });
        save(); chiudiDlg(); render();
        toast(nuove.length + (nuove.length === 1 ? ' voce aggiunta' : ' voci aggiunte'));
      }
    };
    draw();
  }

  // ---------- Copia riepilogo ----------
  function copia(testo) {
    function fallback() {
      var ta = document.createElement('textarea');
      ta.value = testo; ta.style.position = 'fixed'; ta.style.opacity = '0';
      document.body.appendChild(ta); ta.select();
      var ok = false;
      try { ok = document.execCommand('copy'); } catch (e) { ok = false; }
      ta.remove();
      toast(ok ? 'Riepilogo copiato' : 'Copia non riuscita');
    }
    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(testo).then(function () { toast('Riepilogo copiato'); }, fallback);
    } else fallback();
  }

  // ---------- Eventi ----------
  document.addEventListener('click', function (e) {
    var el = e.target.closest('[data-a]');
    if (!el) return;
    var a = el.dataset.a, c;
    if (a === 'elimina-conto') {
      e.stopPropagation();
      if (confirm('Eliminare questo conto?')) {
        db.conti = db.conti.filter(function (x) { return x.id !== el.dataset.id; });
        save(); render();
      }
    } else if (a === 'apri') { view = { name: 'conto', id: el.dataset.id }; render(); window.scrollTo(0, 0); }
    else if (a === 'home') { view = { name: 'home', id: null }; render(); }
    else if (a === 'nuovo') dlgNuovo();
    else if (a === 'rubrica') dlgRubrica();
    else if (a === 'persone') dlgPersone();
    else if (a === 'voce-add') dlgVoce(null);
    else if (a === 'voce-edit') dlgVoce(el.dataset.vid);
    else if (a === 'scan') { var f = $('#foto'); f.value = ''; f.click(); }
    else if (a === 'copia') { c = contoCorrente(); copia(C.riepilogoTesto(c, dataIt(c.data))); }
    else if (a === 'chip' || a === 'tutti') {
      c = contoCorrente();
      var key = el.dataset.key, sel = (c.assegn[key] || []).slice();
      if (a === 'chip') {
        var i = sel.indexOf(el.dataset.pid);
        if (i >= 0) sel.splice(i, 1); else sel.push(el.dataset.pid);
      } else {
        var tutti = c.persone.length > 0 && c.persone.every(function (p) { return sel.indexOf(p.id) >= 0; });
        sel = tutti ? [] : c.persone.map(function (p) { return p.id; });
      }
      if (sel.length) c.assegn[key] = sel; else delete c.assegn[key];
      save();
      var scrollY = window.scrollY;
      render(); window.scrollTo(0, scrollY);
    }
  });

  document.addEventListener('change', function (e) {
    var el = e.target.closest('[data-a-change]');
    if (!el) return;
    var c = contoCorrente();
    if (el.dataset.aChange === 'rinomina-conto') {
      c.nome = el.value.trim() || c.nome; save(); render();
    } else if (el.dataset.aChange === 'rinomina') {
      var p = c.persone.filter(function (x) { return x.id === el.dataset.pid; })[0];
      if (p) { p.nome = el.value.trim() || p.nome; save(); }
      render();
    }
  });

  $('#foto').addEventListener('change', function (e) {
    var file = e.target.files && e.target.files[0];
    if (file) scansiona(file);
  });

  // ---------- Avvio e uso offline ----------
  render();
  if ('serviceWorker' in navigator && /^https?:$/.test(location.protocol)) {
    navigator.serviceWorker.register('sw.js').catch(function () { /* l'app funziona anche senza */ });
  }
})();
