"use strict";
const {app}=require("electron"),fs=require("fs"),path=require("path");
app.on("window-all-closed",()=>{});
app.whenReady().then(async()=>{
 const modul=require("../moduly/research-publiczne"),dane=JSON.parse(fs.readFileSync(path.join(__dirname,"../dane/research_odkrywanie.json"))),wyniki=[];
 const posty=dane.ostatnie.map(id=>dane.posty[id]).filter(p=>p.jezyk!=="inne");
 for(const [i,p] of posty.entries()){
  try{const w=await modul.pobierzSzczegoly(p.id);wyniki.push({...w,username:p.username});console.log(JSON.stringify({nr:i+1,id:p.id,autor:p.username,data:w.data,polubienia:w.polubienia,komentarze:w.komentarze}));}
  catch(e){wyniki.push({kod:p.id,blad:e.message});console.log(JSON.stringify({nr:i+1,id:p.id,blad:e.message}));if(e.blokada)break}
  fs.writeFileSync(path.join(__dirname,"../dane/audyt_research_szczegoly.json"),JSON.stringify(wyniki,null,2));
 }
 app.exit(0);
}).catch(e=>{console.error(e.message);app.exit(1)});
