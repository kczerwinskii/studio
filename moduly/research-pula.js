"use strict";
// Przyrostowe odkrywanie: kolejne strony hashtagow i chronologiczne historie autorow.
const meta=require("./research-meta"),silnik=require("../app/research-silnik");
const swieze=s=>Number.isFinite(Date.parse(s))&&Date.now()-Date.parse(s)<6*3600000;
const teraz=()=>new Date().toISOString();
function wOkresie(p,filtry){const wiek=Date.now()-Date.parse(p.data);return Number.isFinite(wiek)&&wiek>=0&&(!filtry.okres||wiek<=filtry.okres*86400000)}
function jezykPasuje(p,filtry){return p.jezyk!=="inne"&&(!p.jezyk||filtry.jezyk==="both"||p.jezyk===filtry.jezyk)}
// Rolka bez rozpoznawalnego opisu (same hashtagi, emoji) dostaje jezyk dominujacy w historii autora.
// To szacunek, oznaczony jezyk_zrodlo "autor"; opis z rozpoznanym jezykiem ma pierwszenstwo.
function uzupelnijJezykAutora(d,autor,historia){
  const jezyk=silnik.jezykAutora(historia?.posty||[]);
  if(historia)historia.jezyk_autora=jezyk;
  const przypisz=p=>{
    if(!p||p.username!==autor)return;
    if(p.jezyk_zrodlo==="autor"){p.jezyk=jezyk;if(!jezyk){delete p.jezyk_zrodlo;p.jezyk_metoda="Szacunek z opisu, nie z dźwięku filmu"}}
    else if(!p.jezyk&&jezyk){p.jezyk=jezyk;p.jezyk_zrodlo="autor";p.jezyk_metoda="Szacunek z historii autora, bo opis nie ma rozpoznawalnego języka"}
  };
  for(const p of Object.values(d.posty))przypisz(p);
  for(const p of historia?.posty||[])przypisz(p);
  return jezyk;
}
function podlicz(d,filtry){
  return silnik.filtruj(d.ostatnie.map(id=>d.posty[id]).filter(Boolean).map(p=>({...p,...silnik.porownaj(p,d.historie[p.username]?.posty||[])})),{...filtry,niepelne:false}).posty.length;
}
async function szukajPuli(n,{czytaj,zapisz,normalizuj,scalSzczegoly,szczegoly,postep,filtry,cel,frazy}){
  const odwiedzone=new Set(),autorzy=new Set(),zatrzymaneFrazy=new Set();
  let strony=0,probyAutora=0,powod="wyczerpano",przerwana=false;
  // Limit pracy jednego uruchomienia, nie limit wynikow. Kontynuacja uzywa zapisanych kursorow.
  const budzetStron=200,budzetAutorow=250;
  const odswiez=()=>{const d=czytaj();const z=zapytan();postep.zapytania=z!=null&&zapytaniaStart!=null?z-zapytaniaStart:null;postep.potwierdzone=podlicz(d,filtry);postep.autorzy=autorzy.size;postep.kandydaci=d.ostatnie.length;postep.strony=strony;d.zakres_weryfikacji={kandydaci:d.ostatnie.length,sprawdzane:odwiedzone.size,autorzy:autorzy.size,strony,cel,potwierdzone:postep.potwierdzone};zapisz(d);return postep.potwierdzone>=cel};
  const blad=(fraza,e)=>{postep.bledy.push({fraza,kod:e.kod|| (e.blokada?"BLOKADA":"ODCZYT"),blad:e.message});if(e.blokada){przerwana=true;powod=e.kod==="META_LIMIT"?"limit":"blokada";if(powod==="limit"){const d=czytaj();const minuty=Number.isFinite(e.odblokowanie_min)&&e.odblokowanie_min>0?Math.min(60,e.odblokowanie_min+1):15;d.meta_limit_do=new Date(Date.now()+minuty*60000).toISOString();zapisz(d)}}};
  const zapytan=()=>typeof n.uzycieMeta==="function"?n.uzycieMeta().zapytania:null;const zapytaniaStart=zapytan();
  function dodajHistorie(d,autor,historia){
    uzupelnijJezykAutora(d,autor,historia);
    for(const h of historia.posty){
      const stary=d.posty[h.id],pasuje=wOkresie(h,filtry)&&meta.pasujeDoFraz(h.opis,frazy)&&jezykPasuje(h,filtry);
      if(pasuje||stary&&d.ostatnie.includes(h.id)){
        d.posty[h.id]={...h,film:stary?.film||h.film,przyblizone:false,tryb_odkrycia:stary?.tryb_odkrycia||"historia_tematyczna"};
        if(pasuje&&!d.ostatnie.includes(h.id))d.ostatnie.push(h.id);
      }
    }
    Object.defineProperty(d.historie,autor,{value:historia,enumerable:true,writable:true,configurable:true});
  }
  async function autor(ustalony){
    if(autorzy.has(ustalony))return;autorzy.add(ustalony);
    let historia=czytaj().historie[ustalony];
    if(swieze(historia?.nieudana_proba)){postep.pominiete_profile=(postep.pominiete_profile||0)+1;return}
    postep.fraza="Historia @"+ustalony;
    try{
      const aktualna=swieze(historia?.pobrano)&&historia.zrodlo_api==="meta"&&historia.wersja_puli===3;
      if(!aktualna){
        // Przerwana historia (limit w polowie) ma zapisany kursor: kontynuujemy, nie zaczynamy od nowa.
        const kontynuacja=historia?.zrodlo_api==="meta"&&historia.wersja_puli===0&&historia.kursor&&swieze(historia.pobrano);
        const w=await meta.pobierzProfil(n,ustalony,{strony:2,minRolek:8,after:kontynuacja?historia.kursor:undefined,przerwij:()=>postep.anuluj});
        const nowe=w.posty.map(p=>({...normalizuj(p,"",w.url),zrodlo_historii:"profil"}));
        const posty=kontynuacja?[...new Map([...historia.posty,...nowe].map(p=>[p.id,p])).values()]:nowe;
        const niepelna=postep.anuluj||!!w.ostrzezenie;
        historia={posty,pobrano:teraz(),zrodlo_api:"meta",wersja_puli:niepelna?0:3,kursor:niepelna?w.kursor:null,okres:filtry.okres};
        if(w.ostrzezenie)blad(ustalony,{message:w.ostrzezenie.blad,blokada:w.ostrzezenie.blokada,kod:w.ostrzezenie.kod,odblokowanie_min:w.ostrzezenie.odblokowanie_min});
      }
      const d=czytaj();dodajHistorie(d,ustalony,historia);zapisz(d);
    }catch(e){
      const d=czytaj();if(!e.blokada){Object.defineProperty(d.historie,ustalony,{value:{...historia,posty:historia?.posty||[],nieudana_proba:teraz()},enumerable:true,writable:true,configurable:true});zapisz(d)}
      blad(ustalony,e);
    }
    postep.zrobione++;odswiez();
  }
  let d=czytaj();d.zrodlo_api="meta";
  // Zachowane inspiracje nie sa automatycznie wynikami nowego tematu.
  for(const fraza of frazy){const f=d.frazy[fraza];if(swieze(f?.pobrano)&&f.zrodlo_api==="meta")for(const id of f.ids||[])if(d.posty[id]&&!d.ostatnie.includes(id))d.ostatnie.push(id)}
  for(const [nazwa,h] of Object.entries(d.historie))if(swieze(h.pobrano)&&h.zrodlo_api==="meta"&&h.wersja_puli!==0)dodajHistorie(d,nazwa,h);
  zapisz(d);odswiez();
  // Najpierw rozwijamy znane, powiazane z tematem historie; nie trzeba ponownie czytac stron rolek.
  if(Date.parse(d.meta_limit_do)>Date.now()){postep.powod="limit";return {powod:"limit",cel,filtry,potwierdzone:postep.potwierdzone,kandydaci:postep.kandydaci,autorzy:0,strony:0}}
  const aktualne=czytaj();
  const znani=[...new Set(aktualne.ostatnie.map(id=>aktualne.posty[id]).filter(p=>p?.username&&wOkresie(p,filtry)&&jezykPasuje(p,filtry)).sort((a,b)=>Number(!!b.jezyk)-Number(!!a.jezyk)).map(p=>p.username))];
  for(const nazwa of znani){if(postep.anuluj||przerwana||postep.potwierdzone>=cel)break;await autor(nazwa)}
  while(!postep.anuluj&&!przerwana){
    if(odswiez()){powod="cel";break}
    d=czytaj();
    const nastepne=d.ostatnie.map(id=>d.posty[id]).filter(p=>p&&!odwiedzone.has(p.id)&&wOkresie(p,filtry)&&jezykPasuje(p,filtry)&&d.historie[p.username]?.jezyk_autora!=="inne").sort((a,b)=>Number(!!b.jezyk)-Number(!!a.jezyk)||(b.polubienia??-1)-(a.polubienia??-1));
    for(const p of nastepne){
      if(postep.anuluj||przerwana||postep.potwierdzone>=cel)break;
      if(probyAutora>=budzetAutorow){powod="budzet";break}
      odwiedzone.add(p.id);
      if(p.username){await autor(p.username);continue}
      if(swieze(p.sprawdzono_autora)&&p.wersja_odczytu_autora===2)continue;
      postep.fraza="Sprawdzam autora rolki "+p.id;probyAutora++;
      try{
        const w=await szczegoly(p.id),akt=czytaj();akt.posty[p.id]=scalSzczegoly(akt.posty[p.id],w);zapisz(akt);
        if(akt.posty[p.id].username)await autor(akt.posty[p.id].username);
      }catch(e){
        blad(p.id,{message:"Nie udało się potwierdzić autora rolki.",blokada:e.blokada});
        if(!e.blokada){const akt=czytaj();akt.posty[p.id].sprawdzono_autora=teraz();akt.posty[p.id].wersja_odczytu_autora=2;zapisz(akt)}
      }
      postep.zrobione++;odswiez();
    }
    if(postep.anuluj||przerwana)break;
    if(odswiez()){powod="cel";break}
    if(probyAutora>=budzetAutorow||strony>=budzetStron){powod="budzet";break}
    let dostepne=0;
    for(const fraza of frazy){
      if(postep.anuluj||przerwana)break;
      const stare=czytaj(),cache=stare.frazy[fraza];
      const wazne=swieze(cache?.pobrano)&&cache.zrodlo_api==="meta"&&cache.wersja_meta===3;
      if(zatrzymaneFrazy.has(fraza)||wazne&&cache.koniec)continue;
      dostepne++;postep.fraza="Kolejne rolki: "+fraza;
      try{
        const w=await meta.pobierzStrone(n,fraza,wazne?cache.paginacja:{});strony++;
        const akt=czytaj(),ids=new Set(wazne?cache.ids:[]);
        for(const s of w.posty){const p=normalizuj(s,fraza,w.url);if(!p)continue;ids.add(p.id);const stary=akt.posty[p.id];akt.posty[p.id]=stary?.zrodlo_api==="meta"?{...p,...stary}:p;if(!akt.ostatnie.includes(p.id))akt.ostatnie.push(p.id)}
        Object.defineProperty(akt.frazy,fraza,{value:{ids:[...ids],paginacja:w.stan,koniec:w.koniec,pobrano:wazne?cache.pobrano:teraz(),zrodlo_api:"meta",wersja_meta:3},enumerable:true,writable:true,configurable:true});zapisz(akt);
      }catch(e){blad(fraza,e);zatrzymaneFrazy.add(fraza)}
      postep.zrobione++;
    }
    if(!dostepne){powod=zatrzymaneFrazy.size?"zrodlo":"wyczerpano";break}
  }
  if(postep.anuluj)powod="zatrzymano";
  odswiez();postep.powod=powod;
  return {powod,cel,filtry,potwierdzone:postep.potwierdzone,kandydaci:postep.kandydaci,autorzy:postep.autorzy,strony,zapytania:postep.zapytania??null};
}
module.exports={szukajPuli,podlicz,uzupelnijJezykAutora};
