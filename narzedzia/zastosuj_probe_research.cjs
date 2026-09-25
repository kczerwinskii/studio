"use strict";
// Wlacza zweryfikowane wyniki proby, zachowujac biezace notatki/profil/zapisane Kuby.
const fs=require("fs"),path=require("path"),silnik=require("../app/research-silnik"),{podlicz}=require("../moduly/research-pula");
(async()=>{
  if(!process.argv[2])throw Error("Podaj plik danych z proby.");
  const plik=path.join(__dirname,"../dane/research_odkrywanie.json"),oryginal=fs.readFileSync(plik,"utf8"),obecne=JSON.parse(oryginal),proba=JSON.parse(fs.readFileSync(process.argv[2],"utf8"));
  if(proba.zrodlo_api!=="meta"||proba.wyszukiwanie?.stan==="w_toku")throw Error("Proba musi byc zakonczona i pochodzic z Meta.");
  const d={...obecne,...proba,profil:obecne.profil,zapisane:obecne.zapisane,notatki:obecne.notatki,posty:{...obecne.posty,...proba.posty},historie:{...obecne.historie,...proba.historie},frazy:{...obecne.frazy,...proba.frazy}};
  for(const p of [...Object.values(d.posty),...Object.values(d.historie).flatMap(h=>h.posty||[])])p.jezyk=silnik.jezykOpisu(p.opis);
  d.wersja_jezyka=2;d.wyszukiwanie.potwierdzone=podlicz(d,d.wyszukiwanie.filtry);
  d.zakres_weryfikacji.potwierdzone=d.wyszukiwanie.potwierdzone;
  // Migracja konkretnego wyniku sprzed dodania obslugi odroczonych ponowien.
  if(d.wyszukiwanie.bledy.some(e=>/Osiągnięto limit zapytań Meta/.test(e.blad))){
    d.meta_limit_do=new Date(Date.parse(d.wyszukiwanie.zakonczono)+15*60000).toISOString();
    d.wyszukiwanie.powod="limit";d.wyszukiwanie.wznow_po=d.meta_limit_do;d.wyszukiwanie.proba=0;
  }
  console.log(JSON.stringify({temat:d.temat,cel:d.wyszukiwanie.cel,wyniki:d.wyszukiwanie.potwierdzone,kandydaci:d.ostatnie.length,ponowienie:d.wyszukiwanie.wznow_po,zapisane:d.zapisane.length,notatki:Object.keys(d.notatki).length}));
  if(!process.argv.includes("--zapisz"))return;
  // Nie nadpisuj danych aktywnego wyszukiwania. Brak odpowiedzi serwera tez zatrzymuje zapis.
  const r=await fetch("http://127.0.0.1:8767/api/research/odkrywanie",{signal:AbortSignal.timeout(5000)});
  if(!r.ok||(await r.json()).postep?.w_toku)throw Error("Serwer nie potwierdzil bezczynnego Research. Nie zapisano.");
  if(fs.readFileSync(plik,"utf8")!==oryginal)throw Error("Dane zmienily sie podczas sprawdzania. Nie zapisano.");
  const kopia=path.join(__dirname,"../dane/research_przed_meta_"+Date.now()+".json");fs.writeFileSync(kopia,oryginal);
  fs.writeFileSync(plik+".meta.tmp",JSON.stringify(d,null,2)+"\n");fs.renameSync(plik+".meta.tmp",plik);
  const zapisane=JSON.parse(fs.readFileSync(plik,"utf8"));
  if(JSON.stringify(zapisane.profil)!==JSON.stringify(obecne.profil)||JSON.stringify(zapisane.notatki)!==JSON.stringify(obecne.notatki)||JSON.stringify(zapisane.zapisane)!==JSON.stringify(obecne.zapisane))throw Error("Niezgodnosc danych osobistych po zapisie.");
  console.log("Zapisano. Profil, notatki i zapisane inspiracje zachowane. Kopia: "+kopia);
})().catch(e=>{console.error(e.message);process.exitCode=1});
