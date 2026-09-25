"use strict";
const fs=require("fs"),path=require("path"),{scalSzczegoly}=require("../moduly/research-odkrywanie"),silnik=require("../app/research-silnik");
const katalog=path.join(__dirname,"../dane"),plik=path.join(katalog,"research_odkrywanie.json");
const oryginal=fs.readFileSync(plik,"utf8"),d=JSON.parse(oryginal);
const szczegoly=JSON.parse(fs.readFileSync(path.join(katalog,"audyt_research_szczegoly.json"))),historia=JSON.parse(fs.readFileSync(path.join(katalog,"audyt_research_historia.json")));
let poprawione=0;for(const w of szczegoly){if(!w.blad&&Object.hasOwn(d.posty,w.kod)&&d.posty[w.kod].username===w.username){d.posty[w.kod]=scalSzczegoly(d.posty[w.kod],w);poprawione++}}
d.historie=d.historie||{};for(const h of historia){if(!h.rolki||!d.ostatnie.some(id=>d.posty[id].username===h.autor))continue;Object.defineProperty(d.historie,h.autor,{value:{posty:h.rolki.map(p=>({...p,przyblizone:true})),pobrano:h.rolki.at(-1)?.pobrano},enumerable:true,configurable:true,writable:true})}
const posty=d.ostatnie.map(id=>({...d.posty[id],...silnik.porownaj(d.posty[id],d.historie[d.posty[id].username]?.posty||[])}));
const wynik=silnik.filtruj(posty,{jezyk:"both",okres:30,prog:3,niepelne:false});
console.log(JSON.stringify({poprawione,wyniki:wynik.posty.map(p=>({id:p.id,autor:p.username,data:p.data,wyswietlenia:p.wyswietlenia,mediana:p.mediana_wyswietlen,probka:p.liczba_bazowych,mnoznik:p.krotnosc_wyswietlen})),niepelne:wynik.niepelne,odrzucone:wynik.odrzucone},null,2));
if(process.argv.includes("--zapisz")){
 if(fs.readFileSync(plik,"utf8")!==oryginal)throw new Error("Dane zmienione w trakcie audytu. Nie zapisano.");
 fs.writeFileSync(path.join(katalog,"research_przed_audytem_"+Date.now()+".json"),oryginal);
 const tmp=plik+".audyt.tmp";fs.writeFileSync(tmp,JSON.stringify(d,null,2)+"\n");fs.renameSync(tmp,plik);console.log("Zapisano dane audytu; notatki, profil i zapisane zachowane.");
}
