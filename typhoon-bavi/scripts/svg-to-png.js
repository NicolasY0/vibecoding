// 把 share.svg 转成 1200x630 PNG
const sharp = require("sharp");
const fs = require("fs");
const path = require("path");

(async () => {
  const svg = fs.readFileSync(path.join(__dirname, "..", "public", "share.svg"));
  const out = path.join(__dirname, "..", "public", "share.png");
  await sharp(svg, { density: 96 })
    .resize(1200, 630, { fit: "cover" })
    .png()
    .toFile(out);
  console.log("OK", out);
})();
