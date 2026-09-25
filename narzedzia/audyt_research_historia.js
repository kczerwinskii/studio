"use strict";
const {app}=require("electron"),fs=require("fs"),path=require("path");
app.on("window-all-closed",()=>{});
app.whenReady().then(async()=>{
 const m=require("../moduly/research-publiczne"),plik=path.join(__dirname,"../dane/audyt_research_historia.json"),wyniki=fs.existsSync(plik)?JSON.parse(fs.readFileSync(plik)):[];
 for(const autor of (process.argv.slice(2).length?process.argv.slice(2):["coach.krush","brenley.fit"])){
  try{
   const profil=await m.pobierzProfil(autor);const rolki=[];
   for(const p of profil.posty.slice(0,12)){
    const szczegoly=await m.pobierzSzczegoly(p.kod);
    rolki.push({id:p.kod,username:autor,data:szczegoly.data,wyswietlenia:m.licznik(p.licznik),typ:"rolka",zrodlo_historii:"profil",pobrano:new Date().toISOString()});
    console.log(JSON.stringify(rolki.at(-1)));
   }
   wyniki.push({autor,rolki});
  }catch(e){wyniki.push({autor,blad:e.message});if(e.blokada)break}
 }
 fs.writeFileSync(path.join(__dirname,"../dane/audyt_research_historia.json"),JSON.stringify(wyniki,null,2));app.exit(0);
}).catch(e=>{console.error(e.message);app.exit(1)});
