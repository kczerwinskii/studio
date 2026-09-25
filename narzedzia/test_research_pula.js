"use strict";
const assert=require("assert/strict"),{obsluzOdkrywanie}=require("../moduly/research-odkrywanie"),meta=require("../moduly/research-meta");
const dzien=d=>new Date(Date.now()-d*86400000).toISOString();
const opisy={en:"Your muscle growth and training for you #hipertrofia",es:"Rutina de hipertrofia para piernas, guarda este video #hipertrofia",pl:"Trening na masę, który możesz zrobić w domu #hipertrofia",brak:"#hipertrofia 🔥"};
const rolka=(nr,wiek=1,views=400,opis="en")=>({id:String(nr),permalink:"https://www.instagram.com/reel/Target"+String(nr).padStart(4,"0")+"/",timestamp:dzien(wiek),caption:opisy[opis],view_count:views});
(async()=>{
  // Rzeczywisty ksztalt stronicowania Business Discovery: tylko paging.cursors.after.
  let wywolania=0;
  const paginowane=await meta.pobierzProfil({token:()=>"test",ustawienia:()=>({ig_id:"1"}),graph:async(_,p)=>{
    wywolania++;if(wywolania===1)return {business_discovery:{media:{data:[rolka(1)],paging:{cursors:{after:"DALSZA"}}}}};
    assert(p.fields.includes(".after(DALSZA)"));return {business_discovery:{media:{data:[rolka(2,2)]}}};
  }},"trener",{strony:5});assert.equal(paginowane.posty.length,2);assert.equal(wywolania,2);
  let proby=0;
  const czesc=await meta.pobierzProfil({token:()=>"test",ustawienia:()=>({ig_id:"1"}),graph:async()=>{
    if(proby++)throw Object.assign(new Error("prywatna tresc"),{kod:4});return {business_discovery:{media:{data:[rolka(3)],paging:{cursors:{after:"DALSZA"}}}}};
  }},"trener",{strony:5});assert.equal(czesc.posty.length,1);assert(czesc.ostrzezenie.blokada);assert(!JSON.stringify(czesc).includes("prywatna"));
  const pamiec=new Map(),zapytania=[],profile=[];let tryb="en";
  const n={sciezki:{dane:"test-pula"},token:()=>"test",ustawienia:()=>({ig_id:"1"}),czytajJson:(p,d)=>structuredClone(pamiec.get(p)??d),zapiszJson:(p,d)=>pamiec.set(p,structuredClone(d)),czytajCialo:async r=>r.cialo,odpowiedzJson:(r,k,d)=>{r.kod=k;r.dane=structuredClone(d)},pobierzSzczegoly:async id=>({username:"autor"+Number(id.slice(6))}),graph:async(sc,p)=>{
    if(sc==="/ig_hashtag_search")return {data:[{id:"2"}]};
    if(sc.endsWith("_media")){
      const strona=Number(p.after||0);zapytania.push(sc+":"+strona);
      // Tryb "obce": rolki bez rozpoznawalnego opisu; autorzy 900+ pisza po hiszpansku, 800+ po polsku.
      if(tryb==="obce")return {data:[...Array.from({length:5},(_,i)=>rolka(900+i,1,400,"brak")),...Array.from({length:5},(_,i)=>rolka(800+i,1,400,"brak"))]};
      return {data:Array.from({length:10},(_,i)=>rolka(strona*10+i)),...(strona<6?{paging:{next:"nie-uzywamy-url-z-tokenem",cursors:{after:String(strona+1)}}}:{})};
    }
    const nr=Number(p.fields.match(/username\(autor(\d+)\)/)[1]);profile.push(nr);
    const jezyk=nr>=900?"es":nr>=800?"pl":"en";
    return {business_discovery:{media:{data:[rolka(nr,1,400,nr>=800?"brak":"en"),...Array.from({length:9},(_,i)=>rolka(10000+nr*10+i,i+2,100,jezyk))]}}};
  }};
  async function api(trasa="",cialo){const r={};await obsluzOdkrywanie({method:cialo?"POST":"GET",cialo},r,new URL("http://localhost/api/research/odkrywanie"+trasa),n);return r}
  async function koniec(){for(let i=0;i<200;i++){const d=(await api()).dane;if(!d.postep.w_toku)return d;await new Promise(r=>setTimeout(r,1))}throw Error("Brak zakończenia")}
  const warunki={temat:"hipertrofia",frazy:["hipertrofia"],filtry:{jezyk:"en",okres:30,prog:3,min_wyswietlen:0}};
  assert.equal((await api("/szukaj",{...warunki,cel:30,filtry:{...warunki.filtry,min_wyswietlen:1234}})).kod,400,"Minimum wyświetleń tylko z listy");
  assert.equal((await api("/szukaj",{...warunki,cel:30,filtry:{...warunki.filtry,jezyk:"both"}})).kod,400,"Tylko polski albo angielski");
  assert.equal((await api("/szukaj",{...warunki,cel:3})).kod,400);
  await api("/szukaj",{...warunki,cel:30});let d=await koniec();
  assert.equal(d.wyszukiwanie.powod,"cel");assert.equal(d.wyszukiwanie.potwierdzone,30);assert.equal(profile.length,30);
  const pierwsze=[...zapytania];await api("/szukaj",{...warunki,cel:60});d=await koniec();
  assert.equal(d.wyszukiwanie.potwierdzone,60);assert.equal(profile.length,60,"Nie odczytujemy ponownie świeżych historii");assert.deepEqual(zapytania.slice(0,pierwsze.length),pierwsze);
  assert.equal(new Set(zapytania).size,zapytania.length,"Wznawiamy od kursora, nie od pierwszej strony");
  // Podwyzszony prog nie moze liczyc starych wynikow 4x jako potwierdzonych 5x.
  await api("/szukaj",{...warunki,cel:30,filtry:{...warunki.filtry,prog:5}});d=await koniec();
  assert.equal(d.wyszukiwanie.potwierdzone,0);assert.equal(d.wyszukiwanie.powod,"wyczerpano");
  // Opis bez jezyka dostaje jezyk z historii autora: hiszpanscy autorzy odpadaja, polscy sa potwierdzani przy filtrze PL.
  tryb="obce";const przedObcymi=profile.length;
  await api("/szukaj",{...warunki,frazy:["obce"],cel:30,filtry:{...warunki.filtry,jezyk:"pl"}});d=await koniec();
  assert.equal(d.wyszukiwanie.potwierdzone,5);assert.equal(d.wyszukiwanie.powod,"wyczerpano");
  const nrRolki=p=>Number(p.id.slice(6)),kandydaci=d.posty.filter(p=>d.ostatnie.includes(p.id));
  const obce=kandydaci.filter(p=>nrRolki(p)>=900&&nrRolki(p)<1000),polskie=kandydaci.filter(p=>nrRolki(p)>=800&&nrRolki(p)<900);
  assert.equal(obce.length,5);assert.equal(polskie.length,5);assert(obce.every(p=>p.jezyk==="inne"&&p.jezyk_zrodlo==="autor"),"Rolki hiszpańskiego autora bez opisu są oznaczone jako inny język");
  assert(polskie.every(p=>p.jezyk==="pl"&&p.jezyk_zrodlo==="autor"&&/historii autora/.test(p.jezyk_metoda)));
  assert.equal(profile.length-przedObcymi,10,"Każdy autor ma jedną historię, bez powtórzeń");
  // Wczesniejsze hiszpanskie rolki z historii nie staja sie kandydatami; polskie z tematem tak.
  assert(!d.ostatnie.some(id=>Number(id.slice(6))>=19000&&Number(id.slice(6))<19100));
  tryb="en";
  // Limit w polowie historii: kursor jest zapisany, a wznowienie kontynuuje od niego zamiast od pierwszej strony.
  {
    const staryGraph=n.graph;let faza=1;const zapytaniaHistorii=[];
    n.graph=async(sc,p)=>{
      if(sc==="/ig_hashtag_search")return {data:[{id:"3"}]};
      if(sc.endsWith("_media"))return {data:[rolka(700,1,400,"en")]};
      const after=(p.fields.match(/\.after\(([^)]+)\)/)||[])[1]||null;zapytaniaHistorii.push(after);
      if(faza===1){if(after)throw Object.assign(new Error("limit"),{kod:4});return {business_discovery:{media:{data:[rolka(700,1,400,"en"),rolka(17001,2,100,"en"),rolka(17002,3,100,"en")],paging:{cursors:{after:"KURSOR700"}}}}}}
      return {business_discovery:{media:{data:Array.from({length:8},(_,i)=>rolka(17010+i,i+4,100,"en"))}}};
    };
    await api("/szukaj",{...warunki,frazy:["kursor"],cel:30});d=await koniec();
    assert.equal(d.wyszukiwanie.powod,"limit");assert.deepEqual(zapytaniaHistorii,[null,"KURSOR700"]);
    const [plikK,stanK]=[...pamiec.entries()][0];assert.equal(stanK.historie.autor700.kursor,"KURSOR700");assert.equal(stanK.historie.autor700.posty.length,3);
    faza=2;stanK.meta_limit_do=new Date(Date.now()-1000).toISOString();stanK.wyszukiwanie.wznow_po=stanK.meta_limit_do;pamiec.set(plikK,stanK);
    await api();d=await koniec();
    assert.deepEqual(zapytaniaHistorii.slice(2),["KURSOR700"],"Wznowienie kontynuuje od kursora, bez powtarzania pierwszej strony");
    assert.equal(d.wyszukiwanie.potwierdzone,1);assert.equal(d.posty.find(p=>p.id==="Target0700").liczba_bazowych,10);
    n.graph=staryGraph;
  }
  // Zatrzymanie konczy sie po biezacym odczycie i zachowuje juz zebrane dane.
  let odblokuj;n.graph=()=>new Promise(ok=>odblokuj=ok);
  await api("/szukaj",{...warunki,frazy:["nowa"],cel:30});assert((await api()).dane.postep.w_toku);
  await api("/zatrzymaj",{});odblokuj({data:[]});d=await koniec();assert.equal(d.wyszukiwanie.powod,"zatrzymano");assert.equal(d.postep.w_toku,false);
  // Limit: bez natychmiastowych ponowien; wznowienie po terminie, takze po restarcie modulu.
  let limitProby=0;n.graph=async()=>{limitProby++;throw Object.assign(new Error("prywatna"),{kod:4})};
  await api("/szukaj",{...warunki,frazy:["limit"],cel:30});d=await koniec();
  assert.equal(d.wyszukiwanie.powod,"limit");assert(Date.parse(d.wyszukiwanie.wznow_po)>Date.now());assert.equal(limitProby,1);
  await api();await api();assert.equal(limitProby,1,"Odpytywanie postepu nie obchodzi przerwy API");
  const [plik,stan]=[...pamiec.entries()][0];stan.meta_limit_do=new Date(Date.now()-1000).toISOString();stan.wyszukiwanie.wznow_po=stan.meta_limit_do;pamiec.set(plik,stan);
  delete require.cache[require.resolve("../moduly/research-odkrywanie")];const poRestarcie=require("../moduly/research-odkrywanie");
  await poRestarcie.obsluzOdkrywanie({method:"GET"},{},new URL("http://localhost/api/research/odkrywanie"),n);
  await new Promise(r=>setTimeout(r,5));assert.equal(limitProby,2);assert.equal(pamiec.get(plik).wyszukiwanie.proba,1);
  await poRestarcie.obsluzOdkrywanie({method:"POST",cialo:{}},{},new URL("http://localhost/api/research/odkrywanie/zatrzymaj"),n);
  assert.equal(pamiec.get(plik).wyszukiwanie.wznow_po,null);assert.equal(pamiec.get(plik).wyszukiwanie.powod,"zatrzymano");
  console.log("OK: cel 30/60, zachowanie filtrów 5x, kontynuacja bez duplikatów, kursory profili, częściowe historie, zatrzymanie");
})().catch(e=>{console.error(e);process.exitCode=1});
