// Минимальный статический сервер для Render Web Services.
// Раздаёт index.html и ассеты, отдаёт index.html при 404 (SPA-fallback)
// и аккуратно кэширует статику через ETag (express.static это делает из коробки).
const express = require("express");
const path = require("path");

const app = express();
const PORT = process.env.PORT || 3000;
const ROOT = __dirname;

// Статика с разумным кэшем:
//   index.html, manifest, sw.js — no-cache (чтобы обновления доезжали сразу)
//   остальное (иконки, sw, json) — короткий кэш 10 мин
app.use((req, res, next)=>{
  if(req.path==="/" || req.path==="/index.html" || req.path==="/sw.js" || req.path==="/manifest.webmanifest"){
    res.setHeader("Cache-Control","no-cache, must-revalidate");
  }
  next();
});
app.use(express.static(ROOT, {
  extensions: ["html"],
  maxAge: "10m",
  etag: true
}));

// SPA-fallback: всё, что не файл, отдаём index.html
app.get("*", (req, res)=>{
  res.sendFile(path.join(ROOT, "index.html"));
});

app.listen(PORT, ()=>console.log(`Tracker running on :${PORT}`));