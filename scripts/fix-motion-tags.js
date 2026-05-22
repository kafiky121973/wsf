const fs = require("fs");
const path = require("path");

function walk(dir) {
  for (const name of fs.readdirSync(dir)) {
    const p = path.join(dir, name);
    if (fs.statSync(p).isDirectory()) walk(p);
    else if (p.endsWith(".html")) {
      let c = fs.readFileSync(p, "utf8");
      const n = c.replace(/<motion\b/gi, "<div").replace(/<\/motion>/gi, "</div>");
      if (n !== c) {
        fs.writeFileSync(p, n, "utf8");
        console.log("fixed:", p);
      }
    }
  }
}

walk(path.join(__dirname, "..", "templates"));
