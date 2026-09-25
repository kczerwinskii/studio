"use strict";
const fs=require("fs"),path=require("path"),https=require("https");
const config=path.join(__dirname,"../config");
const token=()=>fs.readFileSync(path.join(config,"meta_user_token.txt"),"utf8").trim();
const ustawienia=()=>JSON.parse(fs.readFileSync(path.join(config,"ustawienia.json"),"utf8"));
function graph(sc,parametry,t){return new Promise((ok,blad)=>{
  const u=new URL("https://graph.facebook.com/v25.0"+sc);u.search=new URLSearchParams(parametry);
  const r=https.get(u,{headers:{Authorization:"Bearer "+t}},res=>{
    let tekst="";res.setEncoding("utf8");res.on("data",k=>tekst+=k);res.on("end",()=>{
      try{const d=JSON.parse(tekst);if(d.error)return blad(Object.assign(new Error("Meta"),{kod:d.error.code}));ok(d)}catch{blad(new Error("Niepoprawna odpowiedź Meta"))}
    });
  });
  r.setTimeout(20000,()=>r.destroy(new Error("Limit czasu Meta")));r.on("error",blad);
})}
module.exports={token,ustawienia,graph};
