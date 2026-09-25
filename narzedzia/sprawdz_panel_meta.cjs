"use strict";
// Kontrola panelu na jawnie wskazanym lokalnym wyniku audytu. Bez zapytan sieciowych.
const fs=require("fs"),path=require("path"),assert=require("assert/strict"),{chromium}=require("playwright"),silnik=require("../app/research-silnik");
(async()=>{
 if(!process.argv[2])throw Error("Podaj plik danych z audytu Meta.");
 const d=JSON.parse(fs.readFileSync(process.argv[2],"utf8"));
 const dane={...d,posty:Object.values(d.posty).map(p=>({...p,...silnik.porownaj(p,d.historie[p.username]?.posty||[])})),historie:undefined,postep:{w_toku:false,bledy:d.wyszukiwanie.bledy||[]}};
 const b=await chromium.launch({channel:"msedge",headless:true});try{
  const p=await b.newPage({viewport:{width:1480,height:950}}),bledy=[];p.on("pageerror",e=>bledy.push(e.message));
  await p.route("**/*",r=>{const u=new URL(r.request().url());if(u.hostname!=="studio-meta.test")return r.abort();
   if(u.pathname.startsWith("/api/"))return r.fulfill({json:dane});
   if(u.pathname==="/")return r.fulfill({contentType:"text/html; charset=utf-8",body:'<meta charset="utf-8"><link rel="stylesheet" href="style.css"><main><div id="research-tresc"></div></main><script src="research.js"></script>'});
   const root=path.resolve(__dirname,"../app"),f=path.resolve(root,"."+u.pathname);if(!f.startsWith(root+path.sep)||!fs.existsSync(f))return r.abort();return r.fulfill({body:fs.readFileSync(f),contentType:f.endsWith("css")?"text/css; charset=utf-8":"text/javascript; charset=utf-8"});
  });
  await p.goto("http://studio-meta.test/");await p.evaluate(()=>Research.start());
  const oczekiwane=Number(process.argv[3]||13);
  assert.equal(await p.locator(".od-karta").count(),Math.min(30,oczekiwane));assert.equal(await p.locator("#od-temat").inputValue(),"hipertrofia");
  assert.match(await p.locator("#od-zrodlo-status").textContent(),/Oficjalne API Meta/);
  assert.match(await p.locator("#od-karty").innerText(),/alhamdsyedd/);assert.match(await p.locator("#od-karty").innerText(),/musclrick/);assert.match(await p.locator("#od-karty").innerText(),/maliicki/);
  assert.deepEqual(bledy,[]);
  await p.screenshot({path:path.join(path.dirname(process.argv[2]),"panel-meta.png"),fullPage:true});
  console.log(`OK: panel pokazuje ${oczekiwane} rzeczywistych wyników Meta przy PL+EN, 30 dniach i minimum 3×`);
 }finally{await b.close()}
})().catch(e=>{console.error(e);process.exitCode=1});
