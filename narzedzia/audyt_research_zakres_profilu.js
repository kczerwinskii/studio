"use strict";
const {app}=require("electron");app.on("window-all-closed",()=>{});
app.whenReady().then(async()=>{try{const w=await require("../moduly/research-publiczne").pobierzProfil("coach.krush");console.log(JSON.stringify({ile:w.posty.length,brama:w.brama,kody:w.posty.map(p=>p.kod)}));app.exit(0)}catch(e){console.log(e.message);app.exit(1)}});
