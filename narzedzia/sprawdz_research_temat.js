"use strict";
// Proba online pelnego procesu w osobnym katalogu danych. Bez zamykania okna Kuby.
const {app}=require("electron"),fs=require("fs"),path=require("path");
app.on("window-all-closed",()=>{});
app.whenReady().then(async()=>{
 const temat=process.argv[2]||"budowanie sylwetki",silnik=require("../app/research-silnik"),{obsluzOdkrywanie}=require("../moduly/research-odkrywanie");
 const glowny=path.join(__dirname,"../dane/research_odkrywanie.json"),oryginal=fs.readFileSync(process.argv.includes("--baza")?process.argv[process.argv.indexOf("--baza")+1]:glowny,"utf8"),kat=path.join(__dirname,"../dane/proba-temat-"+Date.now());fs.mkdirSync(kat);
 const plik=path.join(kat,"research_odkrywanie.json");fs.writeFileSync(plik,oryginal);
 const n={sciezki:{dane:kat},czytajJson:(p,d)=>{try{return JSON.parse(fs.readFileSync(p))}catch{return d}},zapiszJson:(p,d)=>{fs.writeFileSync(p+".tmp",JSON.stringify(d,null,2));fs.renameSync(p+".tmp",p)},czytajCialo:async r=>r.cialo,odpowiedzJson:(r,k,d)=>{r.kod=k;r.dane=d}};
 if(process.argv.includes("--meta")){
  n.token=()=>fs.readFileSync(path.join(__dirname,"../config/meta_user_token.txt"),"utf8").trim();
  n.ustawienia=()=>JSON.parse(fs.readFileSync(path.join(__dirname,"../config/ustawienia.json"),"utf8"));
  n.graph=(sc,parametry,token)=>new Promise((ok,blad)=>{const u=new URL("https://graph.facebook.com/v25.0"+sc);u.search=new URLSearchParams(parametry);const r=require("https").get(u,{headers:{Authorization:"Bearer "+token}},res=>{let tekst="";res.setEncoding("utf8");res.on("data",k=>tekst+=k);res.on("end",()=>{try{const d=JSON.parse(tekst);if(d.error){console.log(JSON.stringify({api:sc,kod:d.error.code}));return blad(Object.assign(new Error("Meta"),{kod:d.error.code}))}ok(d)}catch{blad(new Error("Niepoprawna odpowiedź Meta"))}})});r.setTimeout(20000,()=>r.destroy(new Error("Limit czasu Meta")));r.on("error",e=>{console.log(JSON.stringify({api:sc,blad_transportu:e.code||e.name}));blad(e)})});
 }
 const api=async(cialo)=>{const r={};await obsluzOdkrywanie({method:cialo?"POST":"GET",cialo},r,new URL("http://localhost/api/research/odkrywanie"+(cialo?"/szukaj":"")),n);return r};
 const frazy=silnik.rozszerz(temat,"both").frazy;console.log(JSON.stringify({temat,frazy}));
 const cel=process.argv.includes("--cel")?Number(process.argv[process.argv.indexOf("--cel")+1]):30;
 const start=await api({temat,frazy,cel});if(start.kod!==202)throw new Error("Nie uruchomiono wyszukiwania");
 let ostatni="";while(true){const d=(await api()).dane,p=d.postep;const tekst=`${p.potwierdzone||0}/${cel} wyników, ${p.kandydaci||0} kandydatów, ${p.autorzy||0} twórców: ${p.fraza}`;if(tekst!==ostatni){console.log(tekst);ostatni=tekst}if(!p.w_toku){
   const wybrane=d.posty.filter(p=>d.ostatnie.includes(p.id)),w=silnik.filtruj(wybrane,{jezyk:"both",okres:30,prog:3,niepelne:false});
   const raport={temat,frazy,zrodlo_api:d.zrodlo_api,cel,powod:d.wyszukiwanie.powod,zakres:d.zakres_weryfikacji,kandydaci:wybrane.length,daty:wybrane.filter(p=>p.data).length,wyniki:w.posty.map(p=>({id:p.id,autor:p.username,data:p.data,mnoznik:p.krotnosc_wyswietlen,probka:p.liczba_bazowych})),niepelne:w.niepelne,powody:w.powody,bledy:p.bledy};
   const zgodne=process.argv.includes("--zapisz") && fs.readFileSync(glowny,"utf8")===oryginal;
   if(zgodne){fs.writeFileSync(path.join(kat,"przed.json"),oryginal);fs.copyFileSync(plik,glowny+".proba.tmp");fs.renameSync(glowny+".proba.tmp",glowny)}
   raport.zapisano=zgodne;fs.writeFileSync(path.join(kat,"raport.json"),JSON.stringify(raport,null,2));console.log(JSON.stringify(raport,null,2));app.exit(0);break;
  }await new Promise(r=>setTimeout(r,2000))}
}).catch(e=>{console.error(e.message);app.exit(1)});
