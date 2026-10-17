# Divisore conti

App web (PWA) per dividere lo scontrino tra amici. Funziona offline e si installa sulla Home dell'iPhone.

## Cosa fa
- Conti multipli salvati sul telefono (nessun server, nessun account)
- Nomi salvati in rubrica: li scegli con un tocco, non li riscrivi
- Foto dello scontrino: legge le voci sul telefono (OCR italiano incluso nell'app), poi le controlli e correggi prima di aggiungerle
- Quote condivise, chip "Tutti", voci divise tra tutti (acqua, coperto)
- "Copia riepilogo" per mandare i totali al gruppo

## Pubblicare su GitHub Pages
1. Carica il contenuto di questa cartella in un repository (o in una sottocartella del repository con le altre app).
2. Settings, Pages, Source: branch `main`, cartella `/ (root)`.
3. Apri l'indirizzo in Safari, poi Condividi, "Aggiungi a Home".
4. Apri l'app una volta con la rete: scarica anche il lettore di scontrini (circa 9 MB) e poi funziona offline.

## Aggiornare l'app
Dopo ogni modifica ai file cambia `VERSION` in `sw.js` (es. `conti-v2`), altrimenti il telefono continua a usare la copia vecchia.

## Note
- I dati stanno nel browser del telefono: Safari può cancellarli se non apri l'app per diverse settimane.
- La lettura dello scontrino sbaglia ogni tanto una cifra: per questo la schermata di controllo mostra la somma delle voci e, se trovato, il totale dello scontrino.
