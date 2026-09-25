"use strict";
const {chromium}=require("playwright"),assert=require("assert/strict"),{odczytajDOM,odczytajSzczegoly,licznik}=require("../moduly/research-publiczne");
(async()=>{const b=await chromium.launch({headless:true,channel:"msedge"});try{
 const p=await b.newPage();await p.route("**/*",r=>r.fulfill({contentType:"text/html; charset=utf-8",body:'<meta charset="utf-8"><link rel="canonical" href="https://www.instagram.com/reel/TestABCDE/"><meta property="og:description" content="30K likes, 139 comments - autor: opis"><a href="/p/TestABCDE/c/123/"><time datetime="2026-09-23T00:00:00Z">Komentarz</time></a><a href="/autor/reel/TestABCDE/"><time datetime="2026-09-04T09:02:39Z">4 września</time></a>'}));await p.goto("https://www.instagram.com/reel/TestABCDE/");
 const odczyt=()=>p.evaluate("("+odczytajSzczegoly.toString()+")('TestABCDE')");
 let w=await odczyt();assert.equal(w.data,"2026-09-04T09:02:39Z");assert.equal(w.username,"autor");assert.equal(licznik(w.polubienia_surowe),30000);assert.equal(licznik(w.komentarze_surowe),139);
 await p.locator('a[href="/autor/reel/TestABCDE/"]').evaluate(e=>e.remove());w=await odczyt();assert.equal(w.data,null);assert.equal(w.gotowe,false,"Data komentarza nie zastępuje daty rolki");assert.equal(w.username,null,"Autor komentarza nie zastępuje autora rolki");
 await p.locator('link[rel="canonical"]').evaluate(e=>e.href="https://www.instagram.com/reel/OTHER123/");w=await odczyt();assert.equal(w.polubienia_surowe,null);assert.equal(w.zgodny,false);
 await p.evaluate(()=>{document.title='Strona Page nie jest dostępna • Instagram';document.body.innerHTML='<p>Strona Page nie jest dostępna</p>'});assert.equal((await p.evaluate(odczytajDOM)).niedostepna,true);
 await p.evaluate(()=>{document.title='Fitness • Instagram';document.body.innerHTML='<p>Fitness</p>'});assert.equal((await p.evaluate(odczytajDOM)).niedostepna,false);
 console.log("OK: data dokładnego permalinku, odrzucenie dat komentarzy i obcej rolki, liczniki skrócone");
}finally{await b.close()}})().catch(e=>{console.error(e);process.exitCode=1});
