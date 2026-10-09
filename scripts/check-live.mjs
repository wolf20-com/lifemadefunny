import fs from "node:fs";
import { resolve4, resolve6 } from "node:dns/promises";
import config from "../src/site.config.mjs";

const base = (process.env.CHECK_ORIGIN || config.origin).replace(/\/$/, "");
const legacyMode = process.argv.includes("--before");
const checks = [];
const failures = [];
const agents = [
  "Mozilla/5.0 LifeMadeFunnyAvailabilityCheck/1.0",
  "Mediapartners-Google",
  "Google-Display-Ads-Bot",
  "Googlebot",
];
const paths = [
  "/",
  "/ja/",
  "/en/",
  "/fr/",
  "/pt/",
  "/es/",
  "/de/",
  "/ja/categories/jobs/office-worker/",
  "/robots.txt",
  "/ads.txt",
  "/sitemap.xml",
];
for (const agent of agents) {
  for (const pathname of agent === agents[0]
    ? paths
    : ["/", "/robots.txt", "/ja/categories/jobs/office-worker/"]) {
    const start = Date.now();
    try {
      const response = await fetch(base + pathname, {
        headers: { "User-Agent": agent },
        redirect: "manual",
        signal: AbortSignal.timeout(15000),
      });
      const body = await response.text();
      const row = {
        url: base + pathname,
        agent,
        status: response.status,
        ms: Date.now() - start,
        type: response.headers.get("content-type"),
        location: response.headers.get("location"),
        robots: response.headers.get("x-robots-tag"),
      };
      checks.push(row);
      if (response.status !== 200 || /noindex/i.test(row.robots || ""))
        failures.push(row);
      if (
        pathname.endsWith("/") &&
        (!/<h1(?:\s|>)/i.test(body) || /name="robots"[^>]*noindex/i.test(body))
      )
        failures.push({ ...row, error: "Missing content or noindex" });
      if (!legacyMode && pathname.endsWith("/")) {
        if (
          !body.includes(
            `<meta name="google-adsense-account" content="${config.publisherId}">`,
          )
        )
          failures.push({
            ...row,
            error: "Expected rebuilt page / AdSense verification not found",
          });
        if (
          !body.includes(
            `<link rel="canonical" href="${config.origin}${pathname}">`,
          )
        )
          failures.push({ ...row, error: "Unexpected canonical URL" });
      }
      if (pathname === "/robots.txt" && /Disallow:\s*\//i.test(body))
        failures.push({ ...row, error: "Crawler blocked" });
      if (
        pathname === "/ads.txt" &&
        !body.includes(config.publisherId.replace("ca-", ""))
      )
        failures.push({ ...row, error: "Wrong publisher ID" });
    } catch (error) {
      const row = { url: base + pathname, agent, error: error.message };
      checks.push(row);
      failures.push(row);
    }
  }
}
for (const [pathname, expected] of [
  ["/not-a-real-page-lmf-check/", 404],
  ...(!legacyMode
    ? [
        ["/ja/categories/jobs/office-worker/page2/", 301],
        ["/ja/categories/jobs/office-worker/page2.html", 301],
      ]
    : []),
]) {
  try {
    const r = await fetch(base + pathname, {
      redirect: "manual",
      signal: AbortSignal.timeout(15000),
    });
    const row = {
      url: base + pathname,
      status: r.status,
      expected,
      location: r.headers.get("location"),
    };
    checks.push(row);
    if (r.status !== expected) failures.push(row);
  } catch (error) {
    const row = { url: base + pathname, error: error.message };
    checks.push(row);
    failures.push(row);
  }
}
const infrastructure = [];
if (base === config.origin) {
  for (const host of ["lifemadefunny.com", "www.lifemadefunny.com"]) {
    const dns = await Promise.allSettled([resolve4(host), resolve6(host)]);
    infrastructure.push({
      host,
      A: dns[0].status === "fulfilled" ? dns[0].value : dns[0].reason.code,
      AAAA: dns[1].status === "fulfilled" ? dns[1].value : dns[1].reason.code,
    });
  }
  for (const address of [
    "http://lifemadefunny.com/",
    "https://www.lifemadefunny.com/",
  ]) {
    try {
      const r = await fetch(address, { signal: AbortSignal.timeout(15000) });
      infrastructure.push({ url: address, final: r.url, status: r.status });
    } catch (error) {
      infrastructure.push({ url: address, error: error.message });
    }
  }
}
fs.mkdirSync(".build", { recursive: true });
const report = {
  checkedAt: new Date().toISOString(),
  base,
  note: "User-Agent checks do not prove access from real Google crawler IPs. DNS/TLS and AdSense crawl logs must also be checked.",
  checks,
  infrastructure,
  failures,
};
fs.writeFileSync(
  ".build/live-check.json",
  JSON.stringify(report, null, 2) + "\n",
);
for (const check of checks)
  console.log(
    `${check.status || "ERROR"} ${check.url}${check.error ? " " + check.error : ""}`,
  );
console.log(
  JSON.stringify({ failures: failures.length, infrastructure }, null, 2),
);
if (failures.length) process.exitCode = 1;
