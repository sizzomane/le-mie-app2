/* Logica pura: calcolo quote, importi, lettura testo scontrino.
   Nessun accesso al DOM, così si può testare da terminale. */
(function (root) {
  'use strict';

  // ---------- Importi (sempre in centesimi interi) ----------
  function formatEuro(cents) {
    var neg = cents < 0;
    var n = Math.abs(cents);
    var intero = Math.floor(n / 100);
    var dec = String(n % 100).padStart(2, '0');
    var s = String(intero).replace(/\B(?=(\d{3})+(?!\d))/g, '.');
    return (neg ? '-' : '') + s + ',' + dec + ' €';
  }

  function parseEuro(str) {
    if (str == null) return null;
    var s = String(str).replace(/[€\s]/g, '').replace(',', '.');
    if (!/^\d+(\.\d{1,2})?$/.test(s)) return null;
    return Math.round(parseFloat(s) * 100);
  }

  // Divide un importo tra n persone senza perdere centesimi.
  function splitCents(amount, ids) {
    if (!ids.length) return [];
    var base = Math.floor(amount / ids.length);
    var rem = amount - base * ids.length;
    return ids.map(function (id) {
      var x = base + (rem > 0 ? 1 : 0);
      if (rem > 0) rem--;
      return [id, x];
    });
  }

  // ---------- Calcolo del conto ----------
  // conto: {persone:[{id,nome}], voci:[{id,nome,qty,prezzo,comune}], assegn:{"voceId:n":[personId]}}
  function calcola(c) {
    var tot = {};
    c.persone.forEach(function (p) { tot[p.id] = 0; });
    var totale = 0, assegnato = 0;
    var tutti = c.persone.map(function (p) { return p.id; });

    c.voci.forEach(function (v) {
      if (v.comune) {
        var amt = v.prezzo * v.qty;
        totale += amt;
        if (tutti.length) {
          assegnato += amt;
          splitCents(amt, tutti).forEach(function (pair) { tot[pair[0]] += pair[1]; });
        }
        return;
      }
      for (var i = 1; i <= v.qty; i++) {
        totale += v.prezzo;
        var ids = (c.assegn[v.id + ':' + i] || []).filter(function (id) { return tot[id] !== undefined; });
        if (ids.length) {
          assegnato += v.prezzo;
          splitCents(v.prezzo, ids).forEach(function (pair) { tot[pair[0]] += pair[1]; });
        }
      }
    });
    return { tot: tot, totale: totale, assegnato: assegnato, mancano: totale - assegnato };
  }

  function riepilogoTesto(c, dataStr) {
    var r = calcola(c);
    var righe = ['Conto ' + c.nome + (dataStr ? ' · ' + dataStr : ''), 'Totale ' + formatEuro(r.totale)];
    c.persone.forEach(function (p) { righe.push(p.nome + ': ' + formatEuro(r.tot[p.id])); });
    if (r.mancano !== 0) righe.push('(da assegnare ancora ' + formatEuro(r.mancano) + ')');
    return righe.join('\n');
  }

  // ---------- Lettura del testo di uno scontrino ----------
  var RE_END_PRICE = /(\d{1,4})\s*[.,]\s*(\d{2})\s*(?:€|eur|euro|e)?\s*[*]?\s*$/i;
  var RE_TOTAL = /\b(total[ei]?(?:\s*(?:ttc|eur|euro|dovuto|complessivo))?|à\s*payer|a\s*payer|da\s*pagare|importo\s*dovuto)\b/i;
  var RE_SUBTOTAL = /\b(sous[\s-]*total|sub[\s-]*total[ei]?|parziale)\b/i;
  var RE_SKIP = /\b(tva|iva|tax|resto|rendu|monnaie|contant[ei]|esp[eè]ces|cart[ae]|cr[eé]dit[o]?|cb|visa|mastercard|bancomat|pagamento|paiement|merci|grazie|table|tavolo|data|date|heure|ora|scontrino|ticket|facture|t[eé]l|siret|siren|p\.?\s?iva|arrondi|cassa|caisse|serveur|cameriere|arrotondamento|sconto|remise)\b/i;

  function pulisciNome(s) {
    s = s.replace(/[|_~=]+/g, ' ')
         .replace(/[€*]+/g, ' ')
         .replace(/\s+/g, ' ')
         .replace(/^[^A-Za-zÀ-ÿ0-9(]+/, '')
         .replace(/[^A-Za-zÀ-ÿ0-9)]+$/, '')
         .trim();
    if (!s) return s;
    return s.charAt(0).toUpperCase() + s.slice(1);
  }

  // Ritorna {items:[{nome,qty,prezzo,dubbio}], totale: centesimi|null}
  function parseReceipt(text) {
    var items = [];
    var totale = null;
    String(text || '').split(/\r?\n/).forEach(function (raw) {
      var line = raw.replace(/\s+/g, ' ').trim();
      if (line.length < 3) return;
      var m = RE_END_PRICE.exec(line);
      if (!m) return;
      var cents = parseInt(m[1], 10) * 100 + parseInt(m[2], 10);
      if (RE_SUBTOTAL.test(line)) return;
      if (RE_TOTAL.test(line)) { totale = cents; return; }
      var rest = line.slice(0, m.index).trim();
      if (RE_SKIP.test(rest)) return;
      if (cents <= 0 || cents > 100000) return;

      var qty = 1, unit = cents, dubbio = false;
      var mx = /(\d{1,2})\s*[xX×]\s*(\d{1,4})\s*[.,]\s*(\d{2})/.exec(rest);
      var ml = /^(\d{1,2})\s*[xX×*]?\s+(?=[A-Za-zÀ-ÿ])/.exec(rest);
      if (mx) {
        qty = parseInt(mx[1], 10);
        unit = parseInt(mx[2], 10) * 100 + parseInt(mx[3], 10);
        rest = rest.replace(mx[0], ' ');
        if (qty * unit !== cents) dubbio = true;
      } else if (ml && parseInt(ml[1], 10) >= 1 && parseInt(ml[1], 10) <= 20) {
        qty = parseInt(ml[1], 10);
        rest = rest.slice(ml[0].length);
        if (qty > 1) {
          unit = Math.round(cents / qty);
          if (unit * qty !== cents) dubbio = true;
        }
      }
      var nome = pulisciNome(rest);
      if (!/[A-Za-zÀ-ÿ]{2,}/.test(nome)) return;
      if (qty < 1) qty = 1;
      items.push({ nome: nome, qty: qty, prezzo: unit, dubbio: dubbio });
    });
    return { items: items, totale: totale };
  }

  var api = {
    formatEuro: formatEuro,
    parseEuro: parseEuro,
    splitCents: splitCents,
    calcola: calcola,
    riepilogoTesto: riepilogoTesto,
    parseReceipt: parseReceipt
  };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.Core = api;
})(typeof window !== 'undefined' ? window : this);
