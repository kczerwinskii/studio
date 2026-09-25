"use strict";
// Oficjalne API: hashtagi odkrywaja materialy, Business Discovery daje historie kont.
const {uprosc}=require("../app/research-silnik");
const hashtag=fraza=>uprosc(fraza).replace(/^#/,"").replace(/\s+/g,"");
// Hashtag wysylany do Mety zachowuje polskie litery: #łapa to nie #lapa (dzielnica Rio), #siłownia to nie #silownia.
const hashtagMeta=fraza=>String(fraza||"").toLowerCase().trim().replace(/^#/,"").replace(/\s+/g,"").replace(/[^\p{L}\p{N}_]/gu,"");
const poprawnyTag=tag=>/^[\p{L}\p{N}_]{1,100}$/u.test(tag);
const liczba=n=>typeof n==="number"&&Number.isFinite(n)&&n>=0?n:null;
function pasujeDoFraz(opis,frazy){
  const tekst=" "+uprosc(opis).replace(/[^a-z0-9_ ]/g," ").replace(/\s+/g," ")+" ";
  return frazy.some(f=>{const t=uprosc(f).replace(/^#/,"");return !!t&&(tekst.includes(" "+t+" ")||tekst.includes(" "+hashtag(t)+" "))});
}
function dostepne(n){return typeof n.token==="function"&&typeof n.ustawienia==="function"&&typeof n.graph==="function"&&!!n.token()&&/^\d+$/.test(n.ustawienia()?.ig_id||"")}
function bladMeta(e){
  if(e?.kod==="META_LIMIT"&&e.blokada)return e;
  if(e?.name==="TimeoutError"||e?.name==="AbortError"||/timeout|limit czasu/i.test(e?.message||""))return Object.assign(new Error("Meta nie odpowiedziała w limicie czasu. Spróbuj ponownie później."),{kod:"META_TIMEOUT"});
  const kod=Number(e.kod||e.code);
  const opis=kod===10?"Meta wymaga dodania Instagram Public Content Access w aplikacji lub zatwierdzenia dostępu.":kod===190?"Token Meta wygasł lub jest nieprawidłowy. Sprawdź Ustawienia.":[4,17,32,613].includes(kod)?"Osiągnięto limit zapytań Meta. Spróbuj później.":"Nie udało się pobrać danych z API Meta. Możliwy brak dostępu do profilu lub limit hashtagów.";
  return Object.assign(new Error(opis),{kod:[4,17,32,613].includes(kod)?"META_LIMIT":"META_API",blokada:[10,190,4,17,32,613].includes(kod)});
}
// Hamulec: gdy naglowek Mety mowi, ze zuzyto 95% limitu godzinowego, nie dobijamy do bledu 4.
function sprawdzBudzet(n){
  const u=typeof n.uzycieMeta==="function"?n.uzycieMeta():null;
  if(u&&Number.isFinite(u.procent)&&u.procent>=95)throw Object.assign(new Error("Meta: zużyto "+Math.round(u.procent)+"% limitu godzinowego. Przerwa, żeby nie zablokować aplikacji."),{kod:"META_LIMIT",blokada:true,odblokowanie_min:u.odblokowanie_min});
}
async function graph(n,sc,parametry){
  sprawdzBudzet(n);
  let zegar;
  try{const d=await Promise.race([n.graph(sc,parametry,n.token()),new Promise((_,blad)=>{zegar=setTimeout(()=>blad(Object.assign(new Error("timeout"),{name:"TimeoutError"})),25000)})]);if(d.error)throw Object.assign(new Error("Meta"),{kod:d.error.code});return d}catch(e){throw bladMeta(e)}finally{clearTimeout(zegar)}
}
function kodRolki(url){try{const u=new URL(url);return u.protocol==="https:"&&/(^|\.)instagram\.com$/.test(u.hostname)?u.pathname.match(/^\/(?:[A-Za-z0-9_.]+\/)?reel\/([A-Za-z0-9_-]{5,40})\/?$/)?.[1]||null:null}catch{return null}}
function karta(p,username=null){
  const kod=kodRolki(p.permalink);if(!kod)return null;
  return {kod,meta_id:String(p.id),username,opis:p.caption||"",data:p.timestamp,miniatura:p.thumbnail_url||"",film:"",licznik:null,
    wyswietlenia:liczba(p.view_count),polubienia:liczba(p.like_count),komentarze:liczba(p.comments_count),
    zrodlo_api:"meta",metryka_wyswietlen:"meta_view_count",tryb_odkrycia:p.tryb_odkrycia||null};
}
async function pobierzTemat(n,fraza){
  const tag=hashtagMeta(fraza);if(!poprawnyTag(tag))throw new Error("Meta: wpisz temat bez znaków specjalnych.");
  const ust=n.ustawienia(),szukane=await graph(n,"/ig_hashtag_search",{user_id:ust.ig_id,q:tag});
  const id=szukane.data?.[0]?.id;
  if(!/^\d+$/.test(id||""))return {posty:[],url:"https://www.instagram.com/explore/tags/"+encodeURIComponent(tag)+"/",zrodlo_api:"meta"};
  const posty=new Map(),ostrzezenia=[];
  for(const tryb of ["top_media","recent_media"]){
    try {
      let after;const kursory=new Set();
      for(let strona=0;strona<(tryb==="top_media"?3:1);strona++){
        const d=await graph(n,"/"+id+"/"+tryb,{user_id:ust.ig_id,fields:"id,caption,media_type,permalink,timestamp,like_count,comments_count",limit:25,...(after?{after}:{})});
        for(const p of d.data||[]){const k=karta({...p,tryb_odkrycia:tryb});if(k&&!posty.has(k.kod))posty.set(k.kod,k)}
        after=d.paging?.cursors?.after;
        if(!d.paging?.next||!after||kursory.has(after))break;
        kursory.add(after);
      }
    } catch(e){if(e.blokada)throw e;ostrzezenia.push(tryb+": "+e.message)}
  }
  if(!posty.size&&ostrzezenia.length)throw new Error(ostrzezenia.join(" "));
  return {posty:[...posty.values()],ostrzezenia,url:"https://www.instagram.com/explore/tags/"+encodeURIComponent(tag)+"/",zrodlo_api:"meta"};
}
// Jedna mala strona na raz. Przechowujemy kursory, nigdy URL z tokenem.
async function pobierzStrone(n,fraza,poprzednia={}){
  const tag=hashtagMeta(fraza);if(!poprawnyTag(tag))throw new Error("Meta: niepoprawny hashtag.");
  const stan=structuredClone(poprzednia),ust=n.ustawienia();
  if(!stan.id){const d=await graph(n,"/ig_hashtag_search",{user_id:ust.ig_id,q:tag});stan.id=d.data?.[0]?.id;if(!/^\d+$/.test(stan.id||""))return {posty:[],stan:{koniec:true},koniec:true}}
  stan.top_media??={};stan.recent_media??={};
  const tryb=[stan.nastepny||"recent_media",stan.nastepny==="top_media"?"recent_media":"top_media"].find(t=>!stan[t].koniec);
  if(!tryb)return {posty:[],stan,koniec:true};
  const tor=stan[tryb],d=await graph(n,"/"+stan.id+"/"+tryb,{user_id:ust.ig_id,fields:"id,caption,media_type,permalink,timestamp,like_count,comments_count",limit:25,...(tor.after?{after:tor.after}:{})});
  const after=d.paging?.cursors?.after;
  tor.kursory??=[];tor.koniec=!d.paging?.next||!after||tor.kursory.includes(after);
  if(!tor.koniec){tor.after=after;tor.kursory.push(after)}
  stan.nastepny=tryb==="recent_media"?"top_media":"recent_media";
  return {posty:(d.data||[]).map(p=>karta({...p,tryb_odkrycia:tryb})).filter(Boolean),stan,koniec:!!stan.top_media.koniec&&!!stan.recent_media.koniec,url:"https://www.instagram.com/explore/tags/"+encodeURIComponent(tag)+"/",zrodlo_api:"meta"};
}
async function pobierzProfil(n,username,opcje={}){
  if(!/^[A-Za-z0-9_.]{1,30}$/.test(username))throw new Error("Meta: niepoprawny profil.");
  const posty=new Map(),kursory=new Set();let after=opcje.after||undefined,koniec=false,ostrzezenie=null;
  const strony=opcje.strony||1,minRolek=opcje.minRolek||0;
  if(after&&!/^[A-Za-z0-9_=\-]+$/.test(after))after=undefined;
  if(after)kursory.add(after);
  for(let i=0;i<strony;i++){
    if(opcje.przerwij?.())break;
    let d;
    try{d=await graph(n,"/"+n.ustawienia().ig_id,{fields:`business_discovery.username(${username}){username,media.limit(20)${after?".after("+after+")":""}{id,caption,media_product_type,media_type,timestamp,like_count,comments_count,permalink,thumbnail_url,view_count}}`})}
    catch(e){if(!posty.size)throw e;ostrzezenie={blad:e.message,blokada:e.blokada,kod:e.kod};break}
    const media=d.business_discovery?.media;
    if(!Array.isArray(media?.data))throw new Error("Meta nie udostępnia historii tego profilu.");
    for(const p of media.data){const k=karta(p,username);if(k)posty.set(k.kod,k)}
    after=media.paging?.cursors?.after;
    // Zagniezdzone Business Discovery daje sam kursor, bez paging.next (sprawdzone live).
    if(!media.data.length||!after||kursory.has(after)){koniec=true;break}
    if(!/^[A-Za-z0-9_=\-]+$/.test(after))break;
    kursory.add(after);
    // Wystarczajaca baza do mediany: kolejna strona kosztuje kolejne zapytanie z limitu Meta.
    if(minRolek&&posty.size>=minRolek)break;
    // Mamy poprzednie 20 rolek nawet dla najstarszego kandydata w wybranym okresie.
    if(opcje.okres&&[...posty.values()].filter(p=>Date.now()-Date.parse(p.data)>opcje.okres*86400000).length>=20)break;
  }
  return {posty:[...posty.values()],koniec,ostrzezenie,kursor:koniec?null:after||null,url:"https://www.instagram.com/"+username+"/reels/",zrodlo_api:"meta"};
}
module.exports={dostepne,hashtag,hashtagMeta,pasujeDoFraz,kodRolki,karta,pobierzTemat,pobierzStrone,pobierzProfil};
