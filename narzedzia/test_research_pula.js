"use strict";
const assert=require("assert/strict"),{obsluzOdkrywanie}=require("../moduly/research-odkrywanie"),meta=require("../moduly/research-meta");
const dzien=d=>new Date(Date.now()-d*86400000).toISOString();
const rolka=(nr,wiek=1,views=400)=>({id:String(nr),permalink:"https://www.instagram.com/reel/Target"+String(nr).padStart(4,"0")+"/",timestamp:dzien(wiek),caption:"Your muscle growth and training for you #hipertrofia",view_count:views});
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
  const pamiec=new Map(),zapytania=[],profile=[];
  const n={sciezki:{dane:"test-pula"},token:()=>"test",ustawienia:()=>({ig_id:"1"}),czytajJson:(p,d)=>structuredClone(pamiec.get(p)??d),zapiszJson:(p,d)=>pamiec.set(p,structuredClone(d)),czytajCialo:async r=>r.cialo,odpowiedzJson:(r,k,d)=>{r.kod=k;r.dane=structuredClone(d)},pobierzSzczegoly:async id=>({username:"autor"+Number(id.slice(6))}),graph:async(sc,p)=>{
    if(sc==="/ig_hashtag_search")return {data:[{id:"2"}]};
    if(sc.endsWith("_media")){
      const strona=Number(p.after||0);zapytania.push(sc+":"+strona);
      return {data:Array.from({length:10},(_,i)=>rolka(strona*10+i)),...(strona<6?{paging:{next:"nie-uzywamy-url-z-tokenem",cursors:{after:String(strona+1)}}}:{})};
    }
    const nr=Number(p.fields.match(/username\(autor(\d+)\)/)[1]);profile.push(nr);
    return {business_discovery:{media:{data:[rolka(nr),...Array.from({length:6},(_,i)=>rolka(10000+nr*10+i,i+2,100))]}}};
  }};
  async function api(trasa="",cialo){const r={};await obsluzOdkrywanie({method:cialo?"POST":"GET",cialo},r,new URL("http://localhost/api/research/odkrywanie"+trasa),n);return r}
  async function koniec(){for(let i=0;i<200;i++){const d=(await api()).dane;if(!d.postep.w_toku)return d;await new Promise(r=>setTimeout(r,1))}throw Error("Brak zakończenia")}
  const warunki={temat:"hipertrofia",frazy:["hipertrofia"],filtry:{jezyk:"both",okres:30,prog:3}};
  assert.equal((await api("/szukaj",{...warunki,cel:3})).kod,400);
  await api("/szukaj",{...warunki,cel:30});let d=await koniec();
  assert.equal(d.wyszukiwanie.powod,"cel");assert.equal(d.wyszukiwanie.potwierdzone,30);assert.equal(profile.length,30);
  const pierwsze=[...zapytania];await api("/szukaj",{...warunki,cel:60});d=await koniec();
  assert.equal(d.wyszukiwanie.potwierdzone,60);assert.equal(profile.length,60,"Nie odczytujemy ponownie świeżych historii");assert.deepEqual(zapytania.slice(0,pierwsze.length),pierwsze);
  assert.equal(new Set(zapytania).size,zapytania.length,"Wznawiamy od kursora, nie od pierwszej strony");
  // Podwyzszony prog nie moze liczyc starych wynikow 4x jako potwierdzonych 5x.
  await api("/szukaj",{...warunki,cel:30,filtry:{...warunki.filtry,prog:5}});d=await koniec();
  assert.equal(d.wyszukiwanie.potwierdzone,0);assert.equal(d.wyszukiwanie.powod,"wyczerpano");
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
