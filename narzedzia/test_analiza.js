'use strict';

const sprawdz = require('node:assert/strict');
const { spawnSync: uruchom } = require('node:child_process');
const pliki = require('node:fs');
const sciezki = require('node:path');
const maszyna = require('node:vm');
const system = require('node:os');
const analiza = require('../app/analiza.js');

const rolki = [
  { dlugosc: 15, czas_ogl: 15, zapisania: 30, obserwujacy: 20 },
  { dlugosc: 30, czas_ogl: 9.45, data: '2026-09-02T10:00:00+0000' },
  { dlugosc: 30, czas_ogl: 9.45, data: '2026-09-02T10:05:00+0000' },
  { dlugosc: 60, czas_ogl: 2, wyswietlenia: 10000, zasieg: 9000 },
  { dlugosc: null, czas_ogl: 5, obserwujacy: null },
  { dlugosc: 90, czas_ogl: null, obserwujacy: null },
  { dlugosc: 45.4, czas_ogl: 10.0334, obserwujacy: null },
  { dlugosc: 12, czas_ogl: 3, wyswietlenia: 0, zasieg: 0 }
].map((rolka, i) => ({
  id: String(i + 1), data: `2026-09-${String(i + 1).padStart(2, '0')}T10:00:00+0000`,
  tytul: `Trening ${i + 1}`, wyswietlenia: 1000, zasieg: 800,
  zapisania: 0, udostepnienia: 2, obserwujacy: 0, ...rolka
}));

// Adapter kontraktu API: Python nie obsługuje brakującej długości ani null liczników.
// Wzory i klasyfikacja pozostają w importowanym pliku, bez ich kopiowania do testu.
const skrypt = String.raw`
import sys, json
from datetime import datetime
sys.path.insert(0, r'C:\Users\pc\Desktop\Obsidian\Kuba\.agents\skills\analiza-rolek')
import analiza
rolki = json.loads(sys.argv[1])
wyniki = []
for rolka in rolki:
    wejscie = dict(rolka)
    wejscie['dlugosc'] = rolka['dlugosc'] or 1
    wejscie['obserwujacy'] = rolka['obserwujacy'] or 0
    wynik = analiza.przelicz(wejscie, rolka['czas_ogl'] if rolka['dlugosc'] else None)
    wynik['dlugosc'] = rolka['dlugosc']
    wynik['obserwujacy'] = rolka['obserwujacy']
    if rolka['obserwujacy'] is None:
        wynik['obs_1k'] = wynik['wysw_na_obs'] = None
    wyniki.append(wynik)
def mediany(zbior):
    return dict(n=len(zbior), med_ret=analiza.mediana([r['retencja'] for r in zbior]),
                med_indeks=analiza.mediana([r['indeks'] for r in zbior]))
pula = sum(r['wyswietlenia'] for r in rolki) or 1
podsumowanie = mediany(wyniki)
podsumowanie.update(wsk_zapisy=sum(r['zapisania'] for r in rolki)*1000/pula,
    wsk_obs=sum(r['obserwujacy'] or 0 for r in rolki)*1000/pula if any(r['obserwujacy'] is not None for r in rolki) else None,
    przedzialy={nazwa: mediany([r for r in wyniki if r['dlugosc'] and analiza.przedzial(r['dlugosc']) == nazwa]) for _, _, nazwa in analiza.PRZEDZIALY})
prefiksy = [('BRAK', 'brak_czasu'), ('PĘTLA', 'petla'), ('RETENCJA PONIŻEJ', 'ponizej'),
    ('RETENCJA POWYŻEJ', 'powyzej'), ('ZERO ZAPISAŃ', 'zero_zapisan'), ('ZASIĘG', 'zero_obs'), ('w normie', 'norma')]
uwagi = [[next(kod for prefiks, kod in prefiksy if tekst.startswith(prefiks))
    for tekst in analiza.klasyfikuj(r, podsumowanie['med_indeks'], podsumowanie['wsk_zapisy'], podsumowanie['wsk_obs'] or 0)] for r in wyniki]
do_par = [dict(r, publikacja=datetime.fromisoformat(r['data']).strftime('%Y-%m-%d %H:%M')) for r in rolki if r['dlugosc']]
pary = {klucz: dict(rola=wartosc[0], para=wartosc[1]) for klucz, wartosc in analiza.pary(do_par).items()}
print(json.dumps(dict(wyniki=wyniki, podsumowanie=podsumowanie, uwagi=uwagi, pary=pary,
    granice=[dict(benchmark=analiza.benchmark(d), przedzial=analiza.przedzial(d)) for d in [0,15,15.01,30,30.01,60,60.01,10**9+1]])))
`;

function porownaj(otrzymane, oczekiwane, miejsce) {
  if (typeof oczekiwane === 'number') {
    sprawdz.ok(typeof otrzymane === 'number' && Math.abs(otrzymane - oczekiwane) <= 1e-10 * Math.max(1, Math.abs(oczekiwane)),
      `${miejsce}: JS=${otrzymane}, Python=${oczekiwane}`);
  } else if (oczekiwane && typeof oczekiwane === 'object') {
    sprawdz.deepEqual(Object.keys(otrzymane).sort(), Object.keys(oczekiwane).sort(), miejsce);
    for (const klucz of Object.keys(oczekiwane)) porownaj(otrzymane[klucz], oczekiwane[klucz], `${miejsce}.${klucz}`);
  } else sprawdz.equal(otrzymane, oczekiwane, miejsce);
}

try {
  // Pliki tymczasowe zamiast potoków, których sandbox Windows nie udostępnia Node.
  const katalog = pliki.mkdtempSync(sciezki.join(system.tmpdir(), 'studio-analiza-'));
  const wyjscie = sciezki.join(katalog, 'wynik.json');
  const bledy = sciezki.join(katalog, 'bledy.txt');
  const uchwyty = [];
  let wzorzec;
  try {
    uchwyty.push(pliki.openSync(wyjscie, 'w'), pliki.openSync(bledy, 'w'));
    const proces = uruchom('C:\\Users\\pc\\Desktop\\montaz\\.venv\\Scripts\\python.exe', ['-B', '-c', skrypt, JSON.stringify(rolki)], {
      stdio: ['ignore', ...uchwyty], windowsHide: true,
      env: { ...process.env, PYTHONIOENCODING: 'utf-8' }
    });
    if (proces.error) throw proces.error;
    sprawdz.equal(proces.status, 0, pliki.readFileSync(bledy, 'utf8'));
    wzorzec = JSON.parse(pliki.readFileSync(wyjscie, 'utf8'));
  } finally {
    for (const uchwyt of uchwyty) pliki.closeSync(uchwyt);
    for (const plik of [wyjscie, bledy]) if (pliki.existsSync(plik)) pliki.unlinkSync(plik);
    pliki.rmdirSync(katalog);
  }
  const przed = JSON.stringify(rolki);
  const wyniki = rolki.map(analiza.przelicz);
  const podsumowanie = analiza.podsumuj(rolki);
  const pola = ['retencja', 'indeks', 'zapisy_1k', 'udost_1k', 'obs_1k', 'powtorki', 'wysw_na_obs'];
  wyniki.forEach((rolka, i) => {
    for (const pole of pola) porownaj(rolka[pole], wzorzec.wyniki[i][pole], `rolka ${rolka.id}.${pole}`);
  });
  porownaj(podsumowanie, wzorzec.podsumowanie, 'podsumowanie');
  const kody = wyniki.map(rolka => analiza.sygnaly(rolka, podsumowanie).map(sygnal => sygnal.kod));
  porownaj(kody, wzorzec.uwagi, 'sygnaly');
  sprawdz.equal(new Set(kody.flat()).size, 7, 'Pokrycie wszystkich kodów sygnałów');
  porownaj(analiza.pary(rolki), wzorzec.pary, 'pary');
  porownaj([0, 15, 15.01, 30, 30.01, 60, 60.01, 10 ** 9 + 1].map(dlugosc => ({
    benchmark: analiza.benchmark(dlugosc), przedzial: analiza.przedzial(dlugosc)
  })), wzorzec.granice, 'granice');
  sprawdz.equal(JSON.stringify(rolki), przed, 'Bez mutowania wejścia');
  sprawdz.equal(analiza.mediana([null, 9, 1, 3, 5]), 4);
  sprawdz.equal(analiza.mediana([null, 9, 1, 3]), 3);
  sprawdz.equal(analiza.mediana([]), null);
  sprawdz.equal(analiza.podsumuj([]).med_ret, null);
  sprawdz.equal(analiza.podsumuj([]).wsk_obs, null);
  const bez_obs = rolki.map(rolka => ({ ...rolka, obserwujacy: null }));
  sprawdz.equal(analiza.podsumuj(bez_obs).wsk_obs, null);
  sprawdz.ok(!analiza.sygnaly(wyniki[3], { ...podsumowanie, wsk_obs: null }).some(s => s.kod === 'zero_obs'));
  const braki = analiza.przelicz({ dlugosc: null, czas_ogl: null, wyswietlenia: null, zasieg: null, zapisania: null, udostepnienia: null, obserwujacy: null });
  for (const pole of pola) sprawdz.equal(braki[pole], null, pole);
  sprawdz.equal(analiza.przelicz({ ...rolki[0], czas_ogl: 0 }).retencja, null);
  sprawdz.equal(analiza.przelicz({ ...rolki[0], dlugosc: 0 }).retencja, null);
  const para = [rolki[1], { ...rolki[2], dlugosc: 30.5 }];
  sprawdz.equal(analiza.pary(para)['2'].para, '3');
  sprawdz.deepEqual(analiza.pary([...para].reverse()), analiza.pary(para));
  sprawdz.deepEqual(analiza.pary([para[0], { ...para[1], dlugosc: 30.5001 }]), {});
  sprawdz.deepEqual(analiza.pary([para[0], { ...para[1], data: '2026-09-02T10:05:01+0000' }]), {});
  sprawdz.deepEqual(analiza.pary([para[0], { ...para[1], data: 'brak' }]), {});
  const kontekst = { window: {} };
  maszyna.runInNewContext(pliki.readFileSync(sciezki.join(__dirname, '../app/analiza.js'), 'utf8'), kontekst);
  porownaj(kontekst.window.Analiza.podsumuj(rolki), podsumowanie, 'przegladarka');
  for (const rolka of wyniki) for (const sygnal of analiza.sygnaly(rolka, podsumowanie)) sprawdz.ok(!sygnal.tekst.includes('\u2014'));
  console.log('OK');
} catch (blad) {
  console.error(blad.message);
  process.exitCode = 1;
}
