"use strict";
const path = require("path");
const silnik = require("../app/research-silnik");
const publiczne = require("./research-publiczne");
const meta = require("./research-meta");
const {szukajPuli}=require("./research-pula");
const postep = { w_toku:false, zrobione:0, razem:0, bledy:[], fraza:"" };
const domyslnyProfil = { kim:"Trener od kształtowania sylwetki, prowadzenie online", odbiorcy:"Osoby, które ćwiczą od lat i utknęły", tematy:"hipertrofia, sylwetka, trening dopasowany do życia" };
const plik = n => path.join(n.sciezki.dane,"research_odkrywanie.json");
function wczytaj(n) {
  const d={ profil:domyslnyProfil, posty:{}, historie:{}, zapisane:[], notatki:{}, frazy:{}, ostatnie:[], temat:"", wyszukiwanie:null, ...n.czytajJson(plik(n),{}) };
  if(d.wersja_jezyka!==4){
    // Wersja 4: mocniejszy detektor, rdzenie hashtagow (alfabety, polskie znaki, slowa funkcyjne 10 jezykow) i jezyk autora z historii.
    for(const p of [...Object.values(d.posty),...Object.values(d.historie).flatMap(h=>h.posty||[])]){p.jezyk=silnik.jezykOpisu(p.opis);delete p.jezyk_zrodlo;p.jezyk_metoda="Szacunek z opisu, nie z dźwięku filmu"}
    const {uzupelnijJezykAutora}=require("./research-pula");
    for(const [autor,h] of Object.entries(d.historie))uzupelnijJezykAutora(d,autor,h);
    d.wersja_jezyka=4;
    if(d.wyszukiwanie?.filtry)d.wyszukiwanie.potwierdzone=require("./research-pula").podlicz(d,d.wyszukiwanie.filtry);
    n.zapiszJson(plik(n),d);
  }
  return d;
}
function porownanie(post,dane){return silnik.porownaj(post,dane.historie[post.username]?.posty||[])}
function scalSzczegoly(post,w){
  return {...post,username:post.username||w.username||null,miniatura:post.miniatura||publiczne.adresCDN(w.miniatura),data:post.zrodlo_api==="meta"?post.data:w.data||post.data,polubienia:post.zrodlo_api==="meta"?post.polubienia:w.polubienia,komentarze:post.zrodlo_api==="meta"?post.komentarze:w.komentarze,
    polubienia_przyblizone:post.zrodlo_api==="meta"?false:/[kmb]/i.test(w.polubienia_surowe||""),komentarze_przyblizone:post.zrodlo_api==="meta"?false:/[kmb]/i.test(w.komentarze_surowe||""),sprawdzono_autora:new Date().toISOString(),wersja_odczytu_autora:2,
    sprawdzono_szczegoly:new Date().toISOString(),zrodlo_szczegolow:w.zrodlo_szczegolow};
}
async function uzupelnij(n,ids,przezMeta=false){
  const szczegoly=n.pobierzSzczegoly||publiczne.pobierzSzczegoly;
  const profil=n.pobierzProfil||publiczne.pobierzProfil;
  const swieze=s=>Number.isFinite(Date.parse(s))&&Date.now()-Date.parse(s)<6*3600000;
  let kandydaci=ids.map(id=>wczytaj(n).posty[id]).filter(p=>p&&p.jezyk!=="inne");
  if(przezMeta){
    kandydaci=kandydaci.filter(p=>Date.now()-Date.parse(p.data)>=0&&Date.now()-Date.parse(p.data)<=30*86400000).sort((a,b)=>Number(!!b.jezyk)-Number(!!a.jezyk)||(b.polubienia??-1)-(a.polubienia??-1)).slice(0,32);
    const d=wczytaj(n);d.zakres_weryfikacji={kandydaci:ids.length,sprawdzane:kandydaci.length,limit:32};n.zapiszJson(plik(n),d);
  }
  postep.razem+=kandydaci.length;
  for(const p of kandydaci){
    postep.fraza=p.username?"Data i statystyki @"+p.username:"Sprawdzam autora rolki "+p.id;
    try{if(przezMeta?!p.username&&(!swieze(p.sprawdzono_autora)||p.wersja_odczytu_autora!==2):!swieze(p.sprawdzono_szczegoly)){const w=await szczegoly(p.id),d=wczytaj(n);if(d.posty[p.id])d.posty[p.id]=scalSzczegoly(d.posty[p.id],w);n.zapiszJson(plik(n),d)}}
    catch(e){postep.bledy.push({fraza:p.id,blad:"Nie udało się potwierdzić szczegółów rolki."});if(e.blokada){postep.bledy.push({fraza:"",blad:"Instagram zatrzymał odczyt. Przerwano dalsze sprawdzanie."});return}}
    postep.zrobione++;
  }
  const d=wczytaj(n),autorzy=[...new Set((przezMeta?kandydaci.map(p=>p.id):ids).map(id=>d.posty[id]).filter(p=>p?.username&&p.jezyk!=="inne"&&Date.now()-Date.parse(p.data)>=0&&Date.now()-Date.parse(p.data)<=30*86400000).map(p=>p.username))];
  // Publiczny profil zwykle pokazuje jedynie 12 rolek. Nie uzupelniamy starszych domyslami.
  for(const autor of autorzy){
    const zapisana=wczytaj(n).historie[autor];
    if(przezMeta){
      postep.razem++;postep.fraza="Historia z Meta @"+autor;
      try{
        let historia=zapisana;
        if(!swieze(historia?.pobrano)||historia.zrodlo_api!=="meta"){
          const w=await meta.pobierzProfil(n,autor);
          historia={posty:w.posty.map(p=>({...normalizuj(p,"",w.url),zrodlo_historii:"profil"})),pobrano:new Date().toISOString(),zrodlo_api:"meta"};
        }
        const aktualne=wczytaj(n);Object.defineProperty(aktualne.historie,autor,{value:historia,enumerable:true,writable:true,configurable:true});
        // Wczesniejsze rolki tego samego autora sa dodatkowymi kandydatami tylko po zgodnosci tematu.
        for(const h of historia.posty){
          const wiek=Date.now()-Date.parse(h.data);
          if(wiek>=0&&wiek<=30*86400000&&meta.pasujeDoFraz(h.opis,aktualne.wyszukiwanie?.frazy||[])){
            const stary=aktualne.posty[h.id];
            aktualne.posty[h.id]={...h,film:stary?.film||h.film,tryb_odkrycia:stary?.tryb_odkrycia||"historia_tematyczna"};
            if(!aktualne.ostatnie.includes(h.id))aktualne.ostatnie.push(h.id);
          }
        }
        for(const h of historia.posty){const p=aktualne.posty[h.id];if(p&&p.username===autor){aktualne.posty[h.id]={...p,wyswietlenia:h.wyswietlenia,metryka_wyswietlen:h.metryka_wyswietlen,przyblizone:false,miniatura:h.miniatura||p.miniatura,polubienia:h.polubienia,komentarze:h.komentarze,polubienia_przyblizone:false,komentarze_przyblizone:false}}}
        n.zapiszJson(plik(n),aktualne);
      }catch(e){postep.bledy.push({fraza:autor,blad:e.message.startsWith("Meta")?e.message:"Meta nie udostępniła historii profilu."});if(e.blokada)return}
      postep.zrobione++;continue;
    }
    if(swieze(zapisana?.pobrano))continue;
    postep.razem++;postep.fraza="Historia @"+autor;
    try{
      const w=await profil(autor),posty=[];postep.razem+=Math.min(20,w.posty.length);
      for(const surowy of w.posty.slice(0,20)){
        postep.fraza="Daty historii @"+autor;
        const p=normalizuj(surowy,"",w.url);if(!p){postep.zrobione++;continue}
        const znany=wczytaj(n).posty[p.id];
        const s=swieze(znany?.sprawdzono_szczegoly)?znany:await szczegoly(p.id);
        posty.push({...p,data:s.data,zrodlo_historii:"profil"});postep.zrobione++;
      }
      const aktualne=wczytaj(n);Object.defineProperty(aktualne.historie,autor,{value:{posty,pobrano:new Date().toISOString()},enumerable:true,writable:true,configurable:true});n.zapiszJson(plik(n),aktualne);
    }catch(e){postep.bledy.push({fraza:autor,blad:"Nie udało się potwierdzić historii profilu."});if(e.blokada)return}
    postep.zrobione++;
  }
}
function normalizuj(s, fraza, url) {
  if (!/^[A-Za-z0-9_-]{5,40}$/.test(s.kod||"") || ["__proto__","constructor","prototype"].includes(s.kod)) return null;
  const opis=String(s.opis||"").slice(0,12000);
  return { id:s.kod, typ:"rolka", username:/^[A-Za-z0-9_.]{1,30}$/.test(s.username||"")?s.username:null,
    opis, tytul:opis.split("\n")[0].slice(0,160), permalink:"https://www.instagram.com/reel/"+s.kod+"/",
    miniatura:publiczne.adresCDN(s.miniatura), film:publiczne.adresCDN(s.film), wyswietlenia:s.zrodlo_api==="meta"?s.wyswietlenia:publiczne.licznik(s.licznik), przyblizone:s.zrodlo_api!=="meta",
    zrodlo_api:s.zrodlo_api||"publiczne",meta_id:s.meta_id||null,metryka_wyswietlen:s.metryka_wyswietlen||"publiczne",tryb_odkrycia:s.tryb_odkrycia||null,
    polubienia:s.zrodlo_api==="meta"?s.polubienia:null, komentarze:s.zrodlo_api==="meta"?s.komentarze:null, udostepnienia:null, data:Number.isFinite(Date.parse(s.data))?new Date(s.data).toISOString():null,
    jezyk:silnik.jezykOpisu(opis), jezyk_metoda:"Szacunek z opisu, nie z dźwięku filmu", fraza, zrodlo:url, pobrano:new Date().toISOString() };
}
function analiza(post, profil) {
  const opis=post.opis||"", poczatek=opis.split(/\n/).find(s=>s.trim())||"";
  const sygnaly=[];
  if(poczatek.includes("?"))sygnaly.push({etykieta:"Pytanie w otwarciu opisu", dowod:poczatek.slice(0,300), hipoteza:"Może ułatwiać odbiorcy odniesienie tematu do własnej sytuacji. Nie potwierdza hooka w filmie."});
  if(/(?:^|\n)\s*(?:\d+[.)]|[✓✔•])/u.test(opis))sygnaly.push({etykieta:"Lista w opisie", dowod:"Opis zawiera numerowane punkty lub wypunktowanie.", hipoteza:"Uporządkowana lista może ułatwiać zapamiętanie treści. Nie wiemy, jak pokazano ją w filmie."});
  if(/zapisz|udostępnij|komentarz|save|share|comment/i.test(opis))sygnaly.push({etykieta:"Wezwanie do reakcji w opisie",dowod:(opis.match(/[^\n.!?]*(?:zapisz|udostępnij|komentarz|save|share|comment)[^\n.!?]*/i)||[])[0]?.slice(0,300)||"",hipoteza:"Sprawdź związek wezwania z tematem. Sama obecność CTA nie dowodzi, że spowodowało reakcje."});
  return { zakres:"Analiza częściowa: opis i dostępne statystyki. Bez oglądania filmu i słuchania dźwięku.", otwarcie_opisu:poczatek.slice(0,400), sygnaly,
    porownanie:post.krotnosc_wyswietlen==null?"Brak historii wyświetleń. Nie można potwierdzić wybicia ponad typowy wynik autora.":`Wynik ${post.krotnosc_wyswietlen.toFixed(1)}× mediany z ${post.liczba_bazowych} wcześniejszych rolek. To porównanie liczników, nie dowód przyczyny sukcesu.`,
    profil, pytania:["Czy ten problem dotyczy osób, które ćwiczą od lat i utknęły?", "Jaki własny przykład możesz pokazać zamiast kopiować wypowiedź twórcy?", "Które twierdzenia treningowe wymagają sprawdzenia przed wykorzystaniem?"],
    brakujace:["Hook w obrazie i dźwięku", "Tempo, cięcia i konstrukcja filmu", "Treść komentarzy i przyczyny udostępnień", "Potwierdzenie aktualnego trendu z pomiarów w czasie"] };
}
async function szukaj(n, frazy, temat) {
  const znalezione=new Set(),przezMeta=!n.pobierzPubliczne&&meta.dostepne(n);
  if(przezMeta){
    let wynik;
    try{
      const ustawienia=wczytaj(n).wyszukiwanie;
      wynik=await szukajPuli(n,{czytaj:()=>wczytaj(n),zapisz:d=>n.zapiszJson(plik(n),d),normalizuj,scalSzczegoly,szczegoly:n.pobierzSzczegoly||publiczne.pobierzSzczegoly,postep,filtry:ustawienia.filtry,cel:ustawienia.cel,frazy});
    }catch{postep.bledy.push({fraza:"",blad:"Wyszukiwanie zostało przerwane. Zebrane wyniki zachowano."})}
    finally{
      postep.w_toku=false;postep.fraza="";
      const d=wczytaj(n),proba=d.wyszukiwanie?.proba||0;
      d.wyszukiwanie={...d.wyszukiwanie,...wynik,stan:d.ostatnie.length?(postep.bledy.length?"czesciowy":"gotowe"):(postep.bledy.length?"blad":"pusty"),wznow_po:wynik?.powod==="limit"&&proba<3?d.meta_limit_do:null,zakonczono:new Date().toISOString(),bledy:[...postep.bledy]};n.zapiszJson(plik(n),d);
    }
    return;
  }
  let blokada=false;
  try {
    for(const fraza of frazy) {
      postep.fraza=fraza;
      try {
        const stare=wczytaj(n), cache=stare.frazy[fraza];
        if(cache && (!przezMeta||cache.wersja_meta===2) && (cache.zrodlo_api||"publiczne")===(przezMeta?"meta":"publiczne") && Date.now()-Date.parse(cache.pobrano)<6*3600000 && cache.ids.every(id=>Object.hasOwn(stare.posty,id))) {cache.ids.forEach(id=>znalezione.add(id));for(const blad of cache.ostrzezenia||[])postep.bledy.push({fraza,blad})}
        else {
          const wynik=await (przezMeta?meta.pobierzTemat(n,fraza):(n.pobierzPubliczne || publiczne.pobierzPubliczne)(fraza));
          for(const blad of wynik.ostrzezenia||[])postep.bledy.push({fraza,blad});
          const dane=wczytaj(n), ids=[];
          for(const surowy of wynik.posty) {
            const post=normalizuj(surowy,fraza,wynik.url);if(!post)continue;
            const poprzedni=dane.posty[post.id];
            dane.posty[post.id]=poprzedni&&przezMeta?{...post,username:post.username||poprzedni.username,miniatura:post.miniatura||poprzedni.miniatura,film:poprzedni.film,sprawdzono_autora:poprzedni.sprawdzono_autora,wersja_odczytu_autora:poprzedni.wersja_odczytu_autora}:poprzedni?{...post,data:poprzedni.data,polubienia:poprzedni.polubienia,komentarze:poprzedni.komentarze,sprawdzono_szczegoly:poprzedni.sprawdzono_szczegoly,polubienia_przyblizone:poprzedni.polubienia_przyblizone,komentarze_przyblizone:poprzedni.komentarze_przyblizone,zrodlo_szczegolow:poprzedni.zrodlo_szczegolow}:post;
            ids.push(post.id);znalezione.add(post.id);
          }
          Object.defineProperty(dane.frazy,fraza,{value:{ids,pobrano:new Date().toISOString(),zrodlo_api:przezMeta?"meta":"publiczne",ostrzezenia:wynik.ostrzezenia||[],wersja_meta:przezMeta?2:undefined},enumerable:true,writable:true,configurable:true});
          n.zapiszJson(plik(n),dane);
        }
      } catch(blad) { postep.bledy.push({fraza,kod:blad.kod==="STRONA_NIEDOSTEPNA"?blad.kod:blad.blokada?"BLOKADA":"ODCZYT",blad:/Instagram|Publiczna|Electron|Meta/.test(blad.message)?blad.message:"Nie udało się pobrać tej frazy."}); if(blad.blokada){blokada=true;break;} }
      postep.zrobione++;
    }
    const dane=wczytaj(n);dane.ostatnie=[...znalezione];dane.temat=temat;dane.zrodlo_api=przezMeta?"meta":"publiczne";
    for(const id of dane.ostatnie)dane.posty[id].jezyk=silnik.jezykOpisu(dane.posty[id].opis);
    // Zachowaj zapisane inspiracje; ogranicz cache pozostalymi najnowszymi wynikami.
    const zostaw=new Set([...dane.zapisane,...dane.ostatnie,...Object.values(dane.posty).sort((a,b)=>Date.parse(b.pobrano)-Date.parse(a.pobrano)).slice(0,600).map(p=>p.id)]);
    dane.posty=Object.fromEntries(Object.entries(dane.posty).filter(([id])=>zostaw.has(id)));
    dane.frazy=Object.fromEntries(Object.entries(dane.frazy).slice(-100));
    n.zapiszJson(plik(n),dane);
    if(!blokada)await uzupelnij(n,[...znalezione],przezMeta);
  } catch { postep.bledy.push({fraza:"",blad:"Nie udało się zapisać wyników Research."}); }
  finally {
    postep.w_toku=false;postep.fraza="";
    try {
      const dane=wczytaj(n);
      dane.wyszukiwanie={temat,frazy,stan:znalezione.size?(postep.bledy.length?"czesciowy":"gotowe"):(postep.bledy.length?"blad":"pusty"),zakonczono:new Date().toISOString(),bledy:[...postep.bledy]};
      n.zapiszJson(plik(n),dane);
    } catch { postep.bledy.push({fraza:"",blad:"Nie udało się zapisać stanu wyszukiwania."}); }
  }
}
async function obsluzOdkrywanie(req,res,url,n) {
  if(!url.pathname.startsWith("/api/research/odkrywanie"))return false;
  const wyslij=(kod,dane)=>{n.odpowiedzJson(res,kod,dane);return true};
  try {
    const trasa=url.pathname.slice("/api/research/odkrywanie".length);
    if(req.method==="GET" && trasa==="") {
      let dane=wczytaj(n);
      // Otwarte Studio wznowi kolejke po przerwie. Restart nie gubi celu ani kursorow.
      if(!postep.w_toku&&dane.wyszukiwanie?.wznow_po&&Date.parse(dane.wyszukiwanie.wznow_po)<=Date.now()&&meta.dostepne(n)){
        const w=dane.wyszukiwanie;w.wznow_po=null;w.stan="w_toku";w.proba=(w.proba||0)+1;n.zapiszJson(plik(n),dane);
        Object.assign(postep,{w_toku:true,zrobione:0,razem:0,bledy:[],fraza:"Wznawiam wyszukiwanie",anuluj:false,cel:w.cel,potwierdzone:w.potwierdzone||0,autorzy:0,kandydaci:dane.ostatnie.length,strony:0,powod:null});
        void szukaj(n,w.frazy,w.temat);dane=wczytaj(n);
      }
      const p={...postep};
      if(!p.w_toku && !p.razem && dane.wyszukiwanie){
        p.bledy=dane.wyszukiwanie.bledy||[];
        if(dane.wyszukiwanie.stan==="w_toku")dane.wyszukiwanie={...dane.wyszukiwanie,stan:"przerwane"};
      }
      return wyslij(200,{...dane,historie:undefined,posty:Object.values(dane.posty).map(p=>({...p,...porownanie(p,dane)})),postep:p});
    }
    if(req.method!=="POST")return wyslij(404,{blad:"Nie ma takiego adresu."});
    const c=await n.czytajCialo(req);
    if(trasa==="/zatrzymaj"){
      postep.anuluj=true;const dane=wczytaj(n);
      if(dane.wyszukiwanie?.wznow_po){dane.wyszukiwanie.wznow_po=null;dane.wyszukiwanie.powod="zatrzymano";n.zapiszJson(plik(n),dane)}
      return wyslij(200,{ok:true});
    }
    if(trasa==="/szukaj") {
      if(postep.w_toku)return wyslij(409,{blad:"Wyszukiwanie już trwa."});
      if(typeof c?.temat!=="string"||!c.temat.trim()||c.temat.length>100||!Array.isArray(c.frazy)||!c.frazy.length||c.frazy.length>6||c.frazy.some(f=>typeof f!=="string"||!f.trim()||f.length>100||/[\u0000-\u001f]/.test(f)))return wyslij(400,{blad:"Podaj temat i od 1 do 6 fraz, do 100 znaków każda."});
      const cel=Number(c.cel??30),filtry={jezyk:c.filtry?.jezyk??"both",okres:Number(c.filtry?.okres??30),prog:Number(c.filtry?.prog??3)};
      if(![30,60,100].includes(cel)||!["both","pl","en"].includes(filtry.jezyk)||![0,7,30].includes(filtry.okres)||![0,3,4,5].includes(filtry.prog))return wyslij(400,{blad:"Wybierz cel 30, 60 lub 100 i dostępne filtry."});
      const dane=wczytaj(n);dane.temat=c.temat.trim();dane.ostatnie=[];dane.zakres_weryfikacji=null;
      dane.wyszukiwanie={temat:dane.temat,frazy:[...new Set(c.frazy.map(f=>f.trim()))],cel,filtry,stan:"w_toku",rozpoczeto:new Date().toISOString(),bledy:[]};
      n.zapiszJson(plik(n),dane);
      Object.assign(postep,{w_toku:true,zrobione:0,razem:new Set(c.frazy.map(f=>f.trim())).size,bledy:[],fraza:"",anuluj:false,cel,potwierdzone:0,autorzy:0,kandydaci:0,strony:0,pominiete_profile:0,powod:null});
      void szukaj(n,[...new Set(c.frazy.map(f=>f.trim()))],c.temat.trim());
      return wyslij(202,{ok:true});
    }
    if(trasa==="/profil") {
      if(!c || ["kim","odbiorcy","tematy"].some(k=>typeof c[k]!=="string"||c[k].length>2000))return wyslij(400,{blad:"Pola profilu mogą mieć do 2000 znaków."});
      const dane=wczytaj(n);dane.profil=Object.fromEntries(["kim","odbiorcy","tematy"].map(k=>[k,c[k].trim()]));n.zapiszJson(plik(n),dane);return wyslij(200,{ok:true});
    }
    const dane=wczytaj(n);
    if(typeof c?.id!=="string"||!Object.hasOwn(dane.posty,c.id))return wyslij(404,{blad:"Nie znaleziono rolki."});
    if(trasa==="/zapisz") {
      if(typeof c.zapisana!=="boolean")return wyslij(400,{blad:"Niepoprawny stan zapisu."});
      dane.zapisane=c.zapisana?[...new Set([...dane.zapisane,c.id])]:dane.zapisane.filter(id=>id!==c.id);
      n.zapiszJson(plik(n),dane);return wyslij(200,{ok:true});
    }
    if(trasa==="/notatka") {
      if(typeof c.tekst!=="string"||c.tekst.length>15000)return wyslij(400,{blad:"Notatka może mieć do 15000 znaków."});
      dane.notatki[c.id]=c.tekst;n.zapiszJson(plik(n),dane);return wyslij(200,{ok:true});
    }
    if(trasa==="/analiza")return wyslij(200,analiza({...dane.posty[c.id],...porownanie(dane.posty[c.id],dane)},dane.profil));
    return wyslij(404,{blad:"Nie ma takiego adresu."});
  } catch(blad) { return wyslij(blad instanceof SyntaxError?400:500,{blad:blad instanceof SyntaxError?"Niepoprawny JSON.":"Nie udało się obsłużyć Research."}); }
}
module.exports={obsluzOdkrywanie,normalizuj,analiza,scalSzczegoly};
