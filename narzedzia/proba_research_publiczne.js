"use strict";
// Uruchamiaj jawnie: electron narzedzia/proba_research_publiczne.js --online
// Bez konta uzytkownika, bez zapisywania wynikow, bez filmow i zdjec.
const {app}=require("electron");
if(!process.argv.includes("--online")){console.error("Wymagane --online");app.exit(1)}
else app.whenReady().then(async()=>{
 try{
  const {pobierzPubliczne}=require("../moduly/research-publiczne");
  const {normalizuj}=require("../moduly/research-odkrywanie");
  const wynik=await pobierzPubliczne("hypertrophy");
  const posty=wynik.posty.map(p=>normalizuj(p,"hypertrophy",wynik.url));
  console.log(JSON.stringify({ile:posty.length,miniatury:posty.filter(p=>p.miniatura).length,linki_wideo:posty.filter(p=>p.film).length,liczniki:posty.filter(p=>p.wyswietlenia!==null).length,jezyki:posty.map(p=>p.jezyk),przyklad:posty[0]&&{autor:posty[0].username,opis:posty[0].tytul,wyswietlenia:posty[0].wyswietlenia}},null,2));
  app.exit(posty.length?0:1);
 }catch(e){console.error(e.message);app.exit(1)}
});
