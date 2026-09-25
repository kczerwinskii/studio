"use strict";
// Playwright tylko z dostepnego runtime testowego, bez instalacji w aplikacji.
const {chromium}=require("playwright"), fs=require("fs"), path=require("path"), assert=require("assert/strict");
(async()=>{
 const browser=await chromium.launch({channel:"msedge",headless:true});
 try{
  const page=await browser.newPage({viewport:{width:1480,height:950}}),bledy=[],media=[],wyslane=[];
  page.setDefaultTimeout(6000);page.on("pageerror",e=>bledy.push(e.message));
  const dane={profil:{kim:"Trener",odbiorcy:"Plateau",tematy:"Hipertrofia"},zapisane:[],notatki:{},temat:"Test",ostatnie:[],postep:{w_toku:false,bledy:[]},posty:[]};
  for(let i=0;i<35;i++){const p={id:"test_"+i,typ:"rolka",username:"test_trener",tytul:i===0?'<img src=x onerror="window.XSS=1">':'Test rolki '+i,opis:"Your muscle growth and training: save this workout",permalink:"https://www.instagram.com/reel/test_"+i+"/",zrodlo:"https://www.instagram.com/popular/hypertrophy/",miniatura:"",film:"https://scontent.cdninstagram.com/test.mp4",data:i===34?null:new Date().toISOString(),pobrano:new Date().toISOString(),jezyk:"en",wyswietlenia:50000,polubienia:null,komentarze:null,udostepnienia:null,krotnosc_wyswietlen:i===34?null:5,mediana_wyswietlen:10000,liczba_bazowych:10};dane.posty.push(p);dane.ostatnie.push(p.id)}
  await page.route("**/*",async route=>{
   const url=new URL(route.request().url());
   if(url.host!=="studio.test"){media.push(url.href);return route.abort()}
   if(url.pathname.startsWith("/api/research/odkrywanie")){
    const c=route.request().postDataJSON();let wynik=dane;
    if(url.pathname.endsWith("/szukaj")){wyslane.push(c);dane.temat=c.temat;dane.posty=[];dane.ostatnie=[];dane.postep={w_toku:false,bledy:[{fraza:c.frazy[0],blad:"Instagram nie udostępnia tej strony."}]};dane.wyszukiwanie={temat:c.temat,frazy:c.frazy,stan:"blad",bledy:dane.postep.bledy};wynik={ok:true}}
    if(url.pathname.endsWith("/zapisz")){dane.zapisane=c.zapisana?[...new Set([...dane.zapisane,c.id])]:dane.zapisane.filter(id=>id!==c.id);wynik={ok:true}}
    if(url.pathname.endsWith("/notatka")){dane.notatki[c.id]=c.tekst;wynik={ok:true}}
    if(url.pathname.endsWith("/analiza"))wynik=require("../moduly/research-odkrywanie").analiza(dane.posty.find(p=>p.id===c.id),dane.profil);
    return route.fulfill({json:wynik});
   }
   if(url.pathname==="/")return route.fulfill({contentType:"text/html; charset=utf-8",body:'<meta charset="utf-8"><link rel="stylesheet" href="style.css"><main><div id="research-tresc"></div></main><script src="research.js"></script>'});
   const plik=path.join(__dirname,"../app",path.basename(url.pathname));
   return fs.existsSync(plik)?route.fulfill({body:fs.readFileSync(plik),contentType:plik.endsWith("css")?"text/css; charset=utf-8":"text/javascript; charset=utf-8"}):route.abort();
  });
  await page.goto("http://studio.test/");await page.evaluate(()=>Research.start());
  assert.equal(await page.locator(".od-karta").count(),30);
  assert.equal(await page.locator("#od-cel").inputValue(),"30");
  await page.locator("#od-limit").selectOption("12");assert.equal(await page.locator(".od-karta").count(),12);
  assert.equal(await page.locator("#od-niepelne").isChecked(),false);
  assert.equal(await page.evaluate(()=>window.XSS),undefined);
  await page.locator("#od-limit").selectOption("30");assert.equal(await page.locator(".od-karta").count(),30);
  await page.locator("#od-next").click();assert.equal(await page.locator(".od-karta").count(),4);
  await page.locator("#od-niepelne").check();assert.equal(await page.locator(".od-karta").count(),30);
  await page.locator('[data-akcja="analiza"]').first().click();assert.match(await page.locator("#od-raport").innerText(),/Bez oglądania/);
  assert.equal(media.length,0,"Nie pobieramy wideo przed kliknięciem");
  await page.locator("#od-notatka").fill("Mój pomysł");await page.locator("#od-notatka-zapisz").click();await page.getByText("Zapisano",{exact:true}).waitFor();assert.equal(dane.notatki.test_0,"Mój pomysł");
  await page.locator("#od-zapisz-rolke").click();await page.getByText("✓ Zapisano inspirację",{exact:true}).waitFor();assert.equal(dane.zapisane.length,1);
  await page.locator("#od-wroc").click();await page.locator('[data-od-tab="zapisane"]').click();assert.equal(await page.locator(".od-karta").count(),1);
  for(const width of [980,1480,1920]){await page.setViewportSize({width,height:950});assert(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),"Przepełnienie przy "+width)}
  await page.locator('#od-temat').fill('budowanie sylwetki');await page.locator('#od-temat').dispatchEvent('change');
  assert.equal((await page.locator('#od-frazy').inputValue()).split('\n').length,6);
  await page.locator('#od-temat').fill('nieznany temat xyz');await page.locator('#od-temat').dispatchEvent('change');
  assert(await page.locator('#od-frazy-status').isVisible());assert.match(await page.locator('#od-frazy-status').innerText(),/Brak automatycznych rozszerzeń/);
  dane.posty=[];dane.ostatnie=['brak'];dane.postep={w_toku:true,bledy:[],zrobione:0,razem:1,fraza:'Test'};
  await page.reload();await page.evaluate(()=>Research.start());
  assert.match(await page.locator('#od-karty').innerText(),/Sprawdzam daty/);
  dane.postep.w_toku=false;
  await page.waitForFunction(()=>document.querySelector('#od-karty').textContent.includes('W sprawdzonej puli'));
  await page.locator('#od-temat').fill('fitness');await page.locator('#od-temat').press('Enter');
  await page.waitForFunction(()=>document.querySelector('#od-karty').textContent.includes('Nie udało się pobrać kandydatów'));
  assert.equal(wyslane.at(-1).temat,'fitness');assert(wyslane.at(-1).frazy.includes('workout'));
  assert.equal(wyslane.at(-1).cel,30);assert.deepEqual(wyslane.at(-1).filtry,{jezyk:'pl',okres:30,prog:3,min_wyswietlen:50000});
  assert(!wyslane.at(-1).frazy.includes('nieznany temat xyz'));
  assert.doesNotMatch(await page.locator('#od-karty').innerText(),/Wpisz temat/);
  await page.reload();await page.evaluate(()=>Research.start());assert.equal(await page.locator('#od-temat').inputValue(),'fitness');
  assert.match(await page.locator('#od-karty').innerText(),/Filtry nie są przyczyną/);
  await page.locator('.od-zapytania summary').click();await page.locator('#od-frazy').fill('hypertrophy');
  await page.locator('#od-szukaj').click();await page.waitForFunction(()=>document.querySelector('#od-komunikat').textContent.startsWith('hypertrophy:'));
  assert.deepEqual(wyslane.at(-1).frazy,['hypertrophy'],'Zachowujemy ręcznie wpisane frazy');
  dane.postep.bledy=[];dane.wyszukiwanie.stan='pusty';await page.reload();await page.evaluate(()=>Research.start());
  assert.equal(await page.locator('#od-komunikat').innerText(),'');assert.match(await page.locator('#od-karty').innerText(),/Źródło nie zwróciło/);
  await page.locator('[data-od-tab="zapisane"]').click();dane.zapisane=[];
  await page.reload();await page.evaluate(()=>Research.start());await page.locator('[data-od-tab="zapisane"]').click();
  assert.match(await page.locator('#od-karty').innerText(),/Nie masz jeszcze zapisanych/);
  assert.deepEqual(bledy,[]);console.log("OK: panel, 12/30, filtry, strict default, XSS, raport, notatki, zapisane, brak wideo, szerokości 980/1480/1920");
 }finally{await browser.close()}
})().catch(e=>{console.error(e);process.exitCode=1});
