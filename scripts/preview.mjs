// Local static preview, including the redirect rules and real 404s.
// For the release gate use the Firebase Hosting emulator/live health check too.
import http from "node:http";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
process.chdir(path.resolve(path.dirname(fileURLToPath(import.meta.url)), ".."));
const config = JSON.parse(fs.readFileSync("firebase.json", "utf8")).hosting;
const base = path.resolve(config.public);
const redirects = (config.redirects || []).map((rule) => ({
  ...rule,
  test: new RegExp(rule.regex),
}));
const types = {
  ".html": "text/html; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".json": "application/json",
  ".webp": "image/webp",
  ".png": "image/png",
  ".ico": "image/x-icon",
  ".txt": "text/plain; charset=utf-8",
  ".xml": "application/xml",
};
const server = http.createServer((req, res) => {
  if (!["GET", "HEAD"].includes(req.method)) {
    res.writeHead(405);
    res.end();
    return;
  }
  let requested;
  const url = new URL(req.url, "http://localhost");
  try {
    requested = decodeURIComponent(url.pathname);
  } catch {
    res.writeHead(400);
    res.end();
    return;
  }
  const rule = redirects.find((rule) => rule.test.test(requested));
  if (rule) {
    res.writeHead(rule.type, { Location: rule.destination });
    res.end();
    return;
  }
  if (requested.endsWith("/index.html")) {
    res.writeHead(301, { Location: requested.slice(0, -10) + url.search });
    res.end();
    return;
  }
  if (requested.endsWith(".html") && requested !== "/404.html") {
    res.writeHead(301, { Location: requested.slice(0, -5) + "/" + url.search });
    res.end();
    return;
  }
  let file = path.resolve(base, "." + requested);
  if (!file.startsWith(base + path.sep) && file !== base) {
    res.writeHead(403);
    res.end();
    return;
  }
  let status = 200;
  if (fs.existsSync(file) && fs.statSync(file).isDirectory()) {
    if (!requested.endsWith("/")) {
      res.writeHead(301, { Location: requested + "/" + url.search });
      res.end();
      return;
    }
    file = path.join(file, "index.html");
  }
  if (!fs.existsSync(file) || !fs.statSync(file).isFile()) {
    file = path.join(base, "404.html");
    status = 404;
  }
  res.writeHead(status, {
    "Content-Type": types[path.extname(file)] || "application/octet-stream",
    "Cache-Control": "no-store",
    "X-Content-Type-Options": "nosniff",
  });
  if (req.method === "HEAD") res.end();
  else fs.createReadStream(file).pipe(res);
});
server.listen(Number(process.env.PORT || 4173), "0.0.0.0", () =>
  console.log(`Preview: http://localhost:${server.address().port}`),
);
