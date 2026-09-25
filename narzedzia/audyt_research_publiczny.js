"use strict";
// Jawny audyt tylko publicznych stron. Nie zapisuje sesji, nie pobiera multimediow.
const {app,BrowserWindow,session}=require("electron");
const fs=require("fs"),path=require("path");
app.on("window-all-closed",()=>{});
app.whenReady().then(async()=>{
 const sesja=session.fromPartition("audyt-research");
 sesja.webRequest.onBeforeRequest((d,cb)=>cb({cancel:["media","image","font"].includes(d.resourceType)||/\.(mp4|m4s)(\?|$)/.test(d.url)}));
 const wyniki=[];
 for(const url of ["https://www.instagram.com/reel/DZmDGcGx-OA/","https://www.instagram.com/sean_nalewanyj/reels/"]){
  const w=new BrowserWindow({show:false,width:1100,height:900,webPreferences:{session:sesja,sandbox:true,nodeIntegration:false,contextIsolation:true,backgroundThrottling:false}});
  const timer=setTimeout(()=>{if(!w.isDestroyed())w.destroy()},20000);
  try{
   await w.loadURL(url);await new Promise(r=>setTimeout(r,3500));
   const wynik=await w.webContents.executeJavaScript(`(()=>({url:location.href,tytul:document.title,tekst:(document.body?.innerText||'').slice(0,2200),daty:[...document.querySelectorAll('time')].map(t=>({datetime:t.dateTime,tekst:t.innerText})),meta:[...document.querySelectorAll('meta[property],meta[name]')].filter(m=>/description|published|date/.test(m.name||m.getAttribute('property'))).map(m=>({klucz:m.name||m.getAttribute('property'),tresc:m.content})),rolki:[...document.querySelectorAll('a[href*="/reel/"],a[href*="/p/"]')].slice(0,25).map(a=>({href:a.getAttribute('href'),tekst:a.innerText.slice(0,180)})),jsonld:[...document.querySelectorAll('script[type="application/ld+json"]')].map(s=>s.textContent.slice(0,3000))}))()`);
   wyniki.push(wynik);console.log(JSON.stringify(wynik,null,2));
   if(/\/accounts\/login|\/challenge\//.test(wynik.url)||/confirm you're human|verify you are human|try again later/i.test(wynik.tekst))break;
  }catch(e){wyniki.push({url,blad:"Nie udało się odczytać strony w limicie",adres:!w.isDestroyed()?w.webContents.getURL():"zamknięte"});console.log("Blad odczytu",e.message.slice(0,200));break}
  finally{clearTimeout(timer);if(!w.isDestroyed())w.destroy()}
 }
 fs.writeFileSync(path.join(__dirname,"../dane/audyt_research_publiczny.json"),JSON.stringify(wyniki,null,2));app.exit(0);
}).catch(()=>app.exit(1));
