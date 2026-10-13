# Tīkla sadaļas pārnesums uz Teikām

## Pareizais avots

`/Users/sanitareinsone/Documents/ChatGPT/norwegian legends/src/ml-index/`, pašreizējais **Data → Network** modulis. Pirmais pārnesums kļūdaini izmantoja novecojušo `legend journey/norwegian-folk-legends/js/network.js`; tas ir aizstāts.

Jaunais pārnesums atrodas `src/network/`, lapa — `src/pages/dati/tikls.astro`, izvēlnē **Dati → Tīkls**. Dati netiek kopēti no Norvēģijas projekta. Norvēģu avota projekts netiek mainīts.

## Dizains un funkcijas

Pārnesti oriģinālie `dashboard.ts`, `network.ts`, `network-data.js`, `network-layout.js`, `network-motion.js`, `network-palettes.js`, `statistics.js`, `select-menu.ts` un `style.css`.

Saglabāta oriģināla paneļu struktūra, izmēri, SVG mezgli, Canvas savienojumi lieliem tīkliem, rīkjosla, meklējamas izvēlnes, iestatījumu panelis un mobilās pārklājuma izvēlnes. Vietnes galvene ir Teiku galvene. Krāsas izmanto Teiku zilo, zaļo, pelēcīgo un zeltaino gammu. Četras paletes saglabā oriģināla atšķirīgos paletes režīmus.

Saglabātas funkcijas:

- Brīvs, hierarhisks un divdaļu izkārtojums; kategoriju un kolonnu izvēle.
- Atsevišķu mezglu un savienojumu atlase; vairāku mezglu atlase ar OR/AND loģiku.
- Filtri, atlases atiestatīšana un precīzs atlasīto teiku skaits.
- Pārvilkšana, skata pārvietošana, tālummaiņa, divu pirkstu žests, ietilpināšana un mezglu izkliedēšana.
- Pilnekrāna prezentācijas režīms ar tastatūras fokusu un Escape.
- Mezglu un teksta izmēri; nosaukumu redzamības režīmi.
- Dinamiska/statiska kustība; dreifs, orbīta, haoss un intensitāte.
- Animācijas: bez efekta, plūsma, atbalss, vilnis; saistību spilgtums.
- Krāsu paletes; gaismas/tumsas tēma; samazinātas kustības iestatījums.
- Atlasei sekojošs tekstu panelis, LV/DE/parallel teksti, papildu ierakstu ielāde un saites uz pilnām teikām.
- Atlases CSV eksports, saites kopēšana, URL stāvoklis un pārlūka Back/Forward.
- Oriģinālais pārskata skats līdzās tīkla skatam.

## Teiku datu adapteris

`src/network/data.ts` izmanto esošos Teiku JSON caur `src/lib/data.ts`. Personu un vietu identitātes saglabā ID; attēlošanai ir atsevišķa nosaukumu vārdnīca. Vienādi personu vārdi nesaplūst.

| Iekšējais avota lauks | Teiku dati |
| --- | --- |
| county | Teikas metadatos norādītā vieta |
| collector | Pierakstītājs |
| narrator | Teicējs |
| typeId | Nodaļa / tēma |
| topic | Sējums |
| place | Pirmais normalizētais primārais avots |

ML klasifikācija un Norvēģijas apgabali netiek izdomāti Teiku datos. Nodaļas kods ņemts no teikas ID sējuma un nodaļas daļas. Katra teika tīkla datu rindās parādās vienreiz. Nezināmais ir trūkstošu metadatu kategorija, nevis konkrēta persona vai vēsturiska saistība. Datējums izmanto esošo Teiku `legendYear` funkciju, ne tikai pierakstīšanas gadus.

Saskarnei ir LV/DE/EN tulkojumi; teiku saturam — esošie LV/DE teksti. Teiku JSON netiek modificēti.

## Pārbaude

No `teikas-main`:

```sh
npm run build
npm run check
node --test tests/network-*.test.js
```

Testi pārbauda visas 3586 teikas, identitāšu un vācu teksta saglabāšanu, saistību un vairāku mezglu precīzu atlasi, ierobežotas atlases pārstāvniecību, hierarhijas/kolonnu koordinātas, divu pirkstu žestu, izkliedēšanu un visus kustību režīmus. Izkārtojuma un kustības testi pārnesti no oriģināla.

Integrēts GitHub versijā, saglabājot esošo Dati pārskatu, kartes labojumus un kopīgos stilus. Dati izvēlnē pieejams Pārskats un Tīkls. Noklusējuma palete — Mežs; pārējās paletes — Purvs, Krustceles un Krēsla. Divdaļu un hierarhiskajā skatā atlasītās līnijas izzīmējas no mezgla 780 ms laikā.
