import fs from "node:fs";
import assert from "node:assert/strict";
import path from "node:path";
import { fileURLToPath } from "node:url";
import config from "../src/site.config.mjs";

process.chdir(path.resolve(path.dirname(fileURLToPath(import.meta.url)), ".."));
const readJSON = (p) => JSON.parse(fs.readFileSync(p, "utf8"));
const routes = readJSON(".build/routes.json");
const firebase = readJSON("firebase.json");
const migration = readJSON("src/content/migration.json");
const pages = new Map(
  routes.map((r) => [
    r.route,
    { ...r, html: fs.readFileSync(`dist/${r.file}`, "utf8") },
  ]),
);
const redirects = firebase.hosting.redirects.map((r) => ({
  ...r,
  matcher: new RegExp(r.regex),
}));
const decode = (s) =>
  s
    .replace(/&amp;/g, "&")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">");
const attrs = (tag) =>
  Object.fromEntries(
    [...tag.matchAll(/([\w-]+)="([^"]*)"/g)].map((m) => [m[1], decode(m[2])]),
  );
const ids = new Map(
  [...pages].map(([p, v]) => [
    p,
    new Set([...v.html.matchAll(/\bid="([^"]+)"/g)].map((m) => m[1])),
  ]),
);
let checkedLinks = 0;
let checkedAlternates = 0;

function targetOf(href, from, allowRedirect = false) {
  const u = new URL(href, config.origin + from);
  if (u.origin !== config.origin) return;
  let p = decodeURIComponent(u.pathname);
  if (allowRedirect) {
    const rule = redirects.find((r) => r.matcher.test(p));
    if (rule) {
      const final = new URL(rule.destination, config.origin);
      p = final.pathname;
      u.hash = final.hash;
    }
  }
  const target = pages.get(p);
  if (target) {
    if (u.hash)
      assert(
        ids.get(p).has(decodeURIComponent(u.hash.slice(1))),
        `Missing anchor ${href} from ${from}`,
      );
  } else
    assert(
      fs.existsSync(`dist/${p.replace(/^\//, "")}`) &&
        fs.statSync(`dist/${p.replace(/^\//, "")}`).isFile(),
      `Missing target ${href} from ${from}`,
    );
}

assert.equal(firebase.hosting.public, "dist");
assert.equal(firebase.hosting.trailingSlash, true);
assert.equal(firebase.hosting.cleanUrls, true);
assert.equal(
  firebase.hosting.rewrites,
  undefined,
  "Do not hide missing pages behind a SPA/function fallback",
);
assert.equal(config.languages.length, 6);
assert(
  routes.filter((r) => r.kind === "collection").length >= 258,
  "Preserve existing topic collections",
);

for (const [route, p] of pages) {
  const html = p.html;
  assert.equal(
    [...html.matchAll(/<h1(?:\s|>)/g)].length,
    1,
    `H1 count: ${route}`,
  );
  assert(html.startsWith("<!doctype html>"), `Doctype: ${route}`);
  assert(html.includes(`<html lang="${p.l}">`), `HTML language: ${route}`);
  assert(
    html.includes(`<link rel="canonical" href="${config.origin}${route}">`),
    `Canonical: ${route}`,
  );
  assert.equal(
    [...html.matchAll(/rel="canonical"/g)].length,
    1,
    `Multiple canonicals: ${route}`,
  );
  assert(
    html.includes(
      `<meta name="google-adsense-account" content="${config.publisherId}">`,
    ),
  );
  const idValues = [...html.matchAll(/\bid="([^"]+)"/g)].map((m) => m[1]);
  assert.equal(
    idValues.length,
    new Set(idValues).size,
    `Duplicate IDs: ${route}`,
  );
  for (const m of html.matchAll(
    /<script[^>]+type="application\/(?:ld\+)?json"[^>]*>([\s\S]*?)<\/script>/g,
  ))
    JSON.parse(m[1]);
  const alternates = [...html.matchAll(/<link rel="alternate"[^>]*>/g)].map(
    (m) => attrs(m[0]),
  );
  if (p.noindex) {
    assert(html.includes('content="noindex, follow"'));
    assert.equal(alternates.length, 0);
  } else {
    assert.equal(alternates.length, 7, `Alternates count: ${route}`);
    assert.equal(
      new Set(alternates.map((a) => a.hreflang)).size,
      7,
      `Duplicate languages: ${route}`,
    );
    for (const a of alternates) {
      targetOf(a.href, route);
      const target = pages.get(new URL(a.href).pathname);
      assert(!target.noindex, `Alternate to noindex: ${route}`);
      assert(
        target.alternates.some((back) => back.href === config.origin + route),
        `Non-reciprocal hreflang: ${route} -> ${a.href}`,
      );
      if (a.hreflang !== "x-default")
        assert.equal(
          target.l,
          a.hreflang,
          `Wrong alternate language: ${route}`,
        );
      checkedAlternates++;
    }
  }
  for (const match of html.matchAll(/<(?:a|link|img|script)\b[^>]*>/g)) {
    const a = attrs(match[0]);
    for (const href of [a.href, a.src].filter(Boolean)) {
      if (/^(mailto:|tel:)/.test(href)) continue;
      targetOf(href, route);
      checkedLinks++;
    }
  }
  if (p.kind === "collection") {
    assert(html.includes('class="moment-list"')); // content is in the response, not fetched after load
    assert(html.includes("CollectionPage"));
    assert(!html.includes("FAQPage") && !html.includes("aggregateRating"));
  }
  assert(
    !html.includes("firebasejs/") && !html.includes("countPageView"),
    "Rendering/analytics must not require Firebase SDK or Functions",
  );
}

const sitemap = fs.readFileSync("dist/sitemap.xml", "utf8");
const locs = [...sitemap.matchAll(/<loc>([^<]+)<\/loc>/g)].map((m) => m[1]);
assert.equal(locs.length, new Set(locs).size);
assert.equal(locs.length, routes.filter((r) => !r.noindex).length);
for (const loc of locs) {
  const p = pages.get(new URL(loc).pathname);
  assert(p && !p.noindex);
  assert.equal(config.origin + p.route, loc);
}
assert(!sitemap.includes("/tags/") && !sitemap.includes("/page2/"));

let preserved = 0;
for (const old of migration.pages) {
  if (!pages.has(old)) {
    const rule = redirects.find((r) => r.matcher.test(old));
    assert(rule && rule.type === 301, `Lost legacy URL: ${old}`);
    targetOf(rule.destination, old);
  }
  preserved++;
}
for (const r of migration.redirects) {
  for (const variant of [
    r.from,
    r.from.slice(0, -1),
    r.from.slice(0, -1) + ".html",
  ]) {
    const matches = redirects.filter((rule) => rule.matcher.test(variant));
    assert.equal(matches.length, 1, `Ambiguous/unmatched redirect: ${variant}`);
    assert.equal(matches[0].destination, r.to);
    const finalPath = new URL(r.to, config.origin).pathname;
    assert(
      !redirects.some((rule) => rule.matcher.test(finalPath)),
      `Redirect chain: ${variant}`,
    );
  }
}
let stories = 0;
for (const lang of config.languages) {
  const data = readJSON(`src/content/${lang}.json`);
  assert(data.topics.length >= 43, `Preserve existing topics in ${lang}`);
  for (const topic of data.topics) {
    const route = `/${lang}/categories/${topic.group}/${topic.slug}/`;
    for (const story of topic.stories) {
      assert(ids.get(route).has(story.id), `Lost story: ${route}#${story.id}`);
      assert(
        pages
          .get(route)
          .html.includes(
            story.body.replace(
              /[&<>"']/g,
              (c) =>
                ({
                  "&": "&amp;",
                  "<": "&lt;",
                  ">": "&gt;",
                  '"': "&quot;",
                  "'": "&#39;",
                })[c],
            ),
          ),
        `Lost text: ${route}#${story.id}`,
      );
      stories++;
    }
  }
}
assert(
  stories >= migration.baseline.stories,
  "Existing story count decreased; review the migration before publishing",
);
assert(!fs.existsSync("dist/backup_index.html"));
assert(!/Disallow:\s*\//i.test(fs.readFileSync("dist/robots.txt", "utf8")));
assert(
  fs
    .readFileSync("dist/ads.txt", "utf8")
    .includes(config.publisherId.replace("ca-", "")),
);
console.log(
  `PASS: ${pages.size} pages, ${checkedLinks} links/assets, ${checkedAlternates} reciprocal alternates, ${locs.length} sitemap URLs, ${preserved} legacy URLs and ${stories} preserved stories.`,
);
