"use strict";
const assert=require("node:assert/strict"),meta=require("../moduly/research-meta"),{porownaj}=require("../app/research-silnik"),{obsluzOdkrywanie}=require("../moduly/research-odkrywanie");
(async()=>{
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
 const pamiec=new Map(),n={sciezki:{dane:"test-meta"},token:()=>"testowy-nie-sekret",ustawienia:()=>({ig_id:"123"}),czytajJson:(p,d)=>structuredClone(pamiec.get(p)??d),zapiszJson:(p,d)=>pamiec.set(p,structuredClone(d)),czytajCialo:async r=>r.cialo,odpowiedzJson:(r,k,d)=>{r.kod=k;r.dane=structuredClone(d)},
 graph:async(sc,params)=>{
  if(blad)throw Object.assign(new Error("niewyswietlany sekret"),{kod:10});
  if(sc==="/ig_hashtag_search"){zapytania++;return {data:[{id:"999"}]}}
  if(sc.endsWith("_media"))return {data:[biezacy,{id:"2",permalink:"https://www.instagram.com/p/PhotoABC/",media_type:"IMAGE"}]};
  historiaWywolania++;return {business_discovery:{media:{data:[{...biezacy,view_count:50000},{id:"200",permalink:"https://www.instagram.com/reel/FoundOlder/",timestamp:data(2),caption:"Your muscle growth and training workout #hipertrofia",view_count:100000,like_count:1000,comments_count:25},...Array.from({length:6},(_,i)=>({id:String(i+10),permalink:"https://www.instagram.com/reel/MetaOld"+i+"/",timestamp:data(i+2),view_count:10000,like_count:100,comments_count:10}))]}}};
 },pobierzSzczegoly:async()=>({username:"trener",data:data(400),polubienia:1000,komentarze:99,polubienia_surowe:"1K",miniatura:"https://scontent.cdninstagram.com/test.jpg"})};
 // Angielskie atrapy opisow: filtr jezyka domyslnie EN (interfejs ma tylko PL albo EN).
 async function api(cialo){const r={};await obsluzOdkrywanie({method:cialo?"POST":"GET",cialo:cialo&&{filtry:{jezyk:"en",okres:30,prog:3},...cialo}},r,new URL("http://localhost/api/research/odkrywanie"+(cialo?"/szukaj":"")),n);return r}
 async function koniec(){for(let i=0;i<80;i++){const d=(await api()).dane;if(!d.postep.w_toku)return d;await new Promise(r=>setTimeout(r,1))}throw Error("Wyszukiwanie nie zakończyło się")}
 assert.equal((await api({temat:"hipertrofia",frazy:["hipertrofia"]})).kod,202);let d=await koniec();
 assert.equal(d.zrodlo_api,"meta");assert.equal(d.ostatnie.length,2,"Rolka z hashtagu i pasujący starszy hit z historii");assert(d.ostatnie.includes("FoundOlder"));assert.equal(d.posty.find(p=>p.id==="FoundOlder").krotnosc_wyswietlen,10);
 let p=d.posty.find(p=>p.id==="MetaNow1");assert.equal(p.krotnosc_wyswietlen,5);assert.equal(p.liczba_bazowych,7);assert.equal(p.data,data(1));assert.equal(p.komentarze,0);assert.equal(p.polubienia,1234);assert.equal(p.przyblizone,false);
 assert.equal(p.username,"trener");assert.equal(p.metryka_wyswietlen,"meta_view_count");assert.equal(d.zakres_weryfikacji.sprawdzane,2);
 await api({temat:"hipertrofia",frazy:["hipertrofia"]});await koniec();assert.equal(zapytania,1);assert.equal(historiaWywolania,1,"Cache historii Meta");
 assert.equal(porownaj({...p,metryka_wyswietlen:"publiczne"},Array.from({length:6},(_,i)=>({id:String(i),typ:"rolka",username:"trener",data:data(i+2),wyswietlenia:1000,zrodlo_historii:"profil",metryka_wyswietlen:"meta_view_count"}))).krotnosc_wyswietlen,null,"Nie mieszamy liczników różnych źródeł");
 blad=true;await api({temat:"inny",frazy:["inny","jeszczeinny"]});d=await koniec();assert.equal(d.wyszukiwanie.stan,"blad");assert.equal(d.postep.bledy.length,1);assert(!JSON.stringify(d).includes("niewyswietlany sekret"));
 console.log("OK: Meta hashtagi, tylko rolki, historia 5×, dokładne dane i zero, cache, zgodność źródeł, błędy bez sekretów");
})().catch(e=>{console.error(e);process.exitCode=1});
