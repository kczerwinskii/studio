"use strict";
const assert=require("node:assert/strict"),meta=require("../moduly/research-meta"),{porownaj}=require("../app/research-silnik"),{obsluzOdkrywanie}=require("../moduly/research-odkrywanie");
(async()=>{
 assert.equal(meta.hashtagMeta("Łapa"),"łapa","Polskie litery zostają w hashtagu wysyłanym do Mety");assert.equal(meta.hashtagMeta("trening siłowy"),"treningsiłowy");assert.equal(meta.hashtagMeta("#Muscle Growth!"),"musclegrowth");
 assert(meta.pasujeDoFraz("#MuscleGrowth and training",["muscle growth"]));assert(!meta.pasujeDoFraz("outfit",["fit"]));
 assert.equal(meta.hashtag("budowanie mięśni"),"budowaniemiesni");assert.equal(meta.hashtag("#HIPERTROFIA"),"hipertrofia");
 assert.equal(meta.kodRolki("https://www.instagram.com/reel/TestABCDE/"),"TestABCDE");assert.equal(meta.kodRolki("https://instagram.com.evil.test/reel/TestABCDE/"),null);
 assert.equal(meta.karta({id:"1",permalink:"https://www.instagram.com/p/PhotoABC/"}),null);
 const strony=[];
 const czesciowy=await meta.pobierzTemat({token:()=>"test",ustawienia:()=>({ig_id:"1"}),graph:async(sc,p)=>{
  if(sc==="/ig_hashtag_search")return {data:[{id:"9"}]};
  strony.push(p.after||"pierwsza");if(sc.endsWith("recent_media"))throw Object.assign(new Error("timeout"),{name:"TimeoutError"});
  return p.after?{data:[{id:"1",permalink:"https://www.instagram.com/reel/Paginacja1/"}]}:{data:[{id:"2",permalink:"https://www.instagram.com/p/Obrazek1/"}],paging:{next:"nie-otwieramy-tego-url",cursors:{after:"strona2"}}};
 }},"fitness");
 assert.equal(czesciowy.posty.length,1);assert.equal(czesciowy.ostrzezenia.length,1);assert(strony.includes("strona2"));
 const teraz=Date.now(),data=d=>new Date(teraz-d*86400000).toISOString();
 const biezacy={id:"100",permalink:"https://www.instagram.com/reel/MetaNow1/",timestamp:data(1),caption:"Your muscle growth and training: the workout for you",like_count:1234,comments_count:0};
 let historiaWywolania=0,zapytania=0,blad=false;
 // Budzet: jedna strona wystarcza, gdy ma minimum 8 rolek; druga tylko przy mniejszej bazie; kursor wraca przy przerwaniu.
 {
  const {pobierzProfil}=meta;
  const strona=(od,ile,typ="VIDEO",after)=>({business_discovery:{media:{data:Array.from({length:ile},(_,i)=>({id:String(od+i),permalink:"https://www.instagram.com/"+(typ==="VIDEO"?"reel":"p")+"/Prof"+String(od+i).padStart(5,"0")+"/",media_product_type:typ==="VIDEO"?"REELS":"FEED",media_type:typ,timestamp:data(i+1),view_count:100})),...(after?{paging:{cursors:{after}}}:{})}}});
  let wyw=0;const nn={token:()=>"t",ustawienia:()=>({ig_id:"1"}),graph:async(_,p)=>{wyw++;return strona(wyw*100,12,"VIDEO","K"+wyw)}};
  const w1=await pobierzProfil(nn,"trener",{strony:2,minRolek:8});assert.equal(wyw,1,"12 rolek na pierwszej stronie: bez drugiego zapytania");assert.equal(w1.kursor,"K1","Kursor do dalszej historii zostaje na później");
  wyw=0;const nz={...nn,graph:async(_,p)=>{wyw++;return wyw===1?strona(100,12,"IMAGE","K1"):strona(200,12,"VIDEO","K2")}};
  const w2=await pobierzProfil(nz,"trener",{strony:2,minRolek:8});assert.equal(wyw,2,"Same zdjęcia na pierwszej stronie: potrzebna druga");assert.equal(w2.posty.length,12,"Zdjęcia nie liczą się do bazy rolek");
  wyw=0;const np={...nn,graph:async(_,p)=>{wyw++;if(wyw===2)throw Object.assign(new Error("limit"),{kod:4});return strona(100,3,"VIDEO","KURSOR")}};
  const w3=await pobierzProfil(np,"trener",{strony:2,minRolek:8});assert.equal(w3.kursor,"KURSOR","Przerwana historia zwraca kursor do kontynuacji");assert(w3.ostrzezenie?.blokada);
  wyw=0;let uzyte=null;const nk={...nn,graph:async(_,p)=>{wyw++;uzyte=p.fields;return strona(300,12,"VIDEO")}};
  await pobierzProfil(nk,"trener",{strony:2,minRolek:8,after:"KURSOR"});assert(uzyte.includes(".after(KURSOR)"),"Kontynuacja zaczyna od zapisanego kursora");
  // Hamulec: 95% limitu z naglowka Mety zatrzymuje przed bledem 4, bez zapytania.
  let zapytan=0;const nh={...nn,uzycieMeta:()=>({procent:96,odblokowanie_min:7,zapytania:0}),graph:async()=>{zapytan++;return strona(1,1)}};
  await assert.rejects(pobierzProfil(nh,"trener",{strony:1}),e=>e.kod==="META_LIMIT"&&e.blokada&&e.odblokowanie_min===7);assert.equal(zapytan,0);
 }
 const pamiec=new Map(),n={sciezki:{dane:"test-meta"},token:()=>"testowy-nie-sekret",ustawienia:()=>({ig_id:"123"}),czytajJson:(p,d)=>structuredClone(pamiec.get(p)??d),zapiszJson:(p,d)=>pamiec.set(p,structuredClone(d)),czytajCialo:async r=>r.cialo,odpowiedzJson:(r,k,d)=>{r.kod=k;r.dane=structuredClone(d)},
 graph:async(sc,params)=>{
  if(blad)throw Object.assign(new Error("niewyswietlany sekret"),{kod:10});
  if(sc==="/ig_hashtag_search"){zapytania++;return {data:[{id:"999"}]}}
  if(sc.endsWith("_media"))return {data:[biezacy,{id:"2",permalink:"https://www.instagram.com/p/PhotoABC/",media_type:"IMAGE"}]};
  historiaWywolania++;return {business_discovery:{media:{data:[{...biezacy,view_count:50000},{id:"200",permalink:"https://www.instagram.com/reel/FoundOlder/",timestamp:data(2),caption:"Your muscle growth and training workout #hipertrofia",view_count:100000,like_count:1000,comments_count:25},...Array.from({length:10},(_,i)=>({id:String(i+10),permalink:"https://www.instagram.com/reel/MetaOld"+i+"/",timestamp:data(i+2),view_count:10000,like_count:100,comments_count:10}))]}}};
 },pobierzSzczegoly:async()=>({username:"trener",data:data(400),polubienia:1000,komentarze:99,polubienia_surowe:"1K",miniatura:"https://scontent.cdninstagram.com/test.jpg"})};
 // Angielskie atrapy opisow: filtr jezyka domyslnie EN (interfejs ma tylko PL albo EN).
 async function api(cialo){const r={};await obsluzOdkrywanie({method:cialo?"POST":"GET",cialo:cialo&&{filtry:{jezyk:"en",okres:30,prog:3,min_wyswietlen:0},...cialo}},r,new URL("http://localhost/api/research/odkrywanie"+(cialo?"/szukaj":"")),n);return r}
 async function koniec(){for(let i=0;i<80;i++){const d=(await api()).dane;if(!d.postep.w_toku)return d;await new Promise(r=>setTimeout(r,1))}throw Error("Wyszukiwanie nie zakończyło się")}
 assert.equal((await api({temat:"hipertrofia",frazy:["hipertrofia"]})).kod,202);let d=await koniec();
 assert.equal(d.zrodlo_api,"meta");assert.equal(d.ostatnie.length,2,"Rolka z hashtagu i pasujący starszy hit z historii");assert(d.ostatnie.includes("FoundOlder"));assert.equal(d.posty.find(p=>p.id==="FoundOlder").krotnosc_wyswietlen,10);
 let p=d.posty.find(p=>p.id==="MetaNow1");assert.equal(p.krotnosc_wyswietlen,5);assert.equal(p.liczba_bazowych,11);assert.equal(p.data,data(1));assert.equal(p.komentarze,0);assert.equal(p.polubienia,1234);assert.equal(p.przyblizone,false);
 assert.equal(p.username,"trener");assert.equal(p.metryka_wyswietlen,"meta_view_count");assert.equal(d.zakres_weryfikacji.sprawdzane,2);
 await api({temat:"hipertrofia",frazy:["hipertrofia"]});await koniec();assert.equal(zapytania,1);assert.equal(historiaWywolania,1,"Cache historii Meta");
 assert.equal(porownaj({...p,metryka_wyswietlen:"publiczne"},Array.from({length:9},(_,i)=>({id:String(i),typ:"rolka",username:"trener",data:data(i+2),wyswietlenia:1000,zrodlo_historii:"profil",metryka_wyswietlen:"meta_view_count"}))).krotnosc_wyswietlen,null,"Nie mieszamy liczników różnych źródeł");
 blad=true;await api({temat:"inny",frazy:["inny","jeszczeinny"]});d=await koniec();assert.equal(d.wyszukiwanie.stan,"blad");assert.equal(d.postep.bledy.length,1);assert(!JSON.stringify(d).includes("niewyswietlany sekret"));
 console.log("OK: Meta hashtagi, tylko rolki, historia 5×, dokładne dane i zero, cache, zgodność źródeł, błędy bez sekretów");
})().catch(e=>{console.error(e);process.exitCode=1});
