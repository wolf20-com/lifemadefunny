import fs from "node:fs";
import path from "node:path";
import { createHash } from "node:crypto";
import { fileURLToPath } from "node:url";
import config from "../src/site.config.mjs";
import { labels, format } from "../src/i18n.mjs";
import { editorial } from "../src/editorial.mjs";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
process.chdir(root);
const readJSON = (p) => JSON.parse(fs.readFileSync(p, "utf8"));
const data = Object.fromEntries(
  config.languages.map((l) => [l, readJSON(`src/content/${l}.json`)]),
);
const migration = readJSON("src/content/migration.json");
export const escape = (value) =>
  String(value).replace(
    /[&<>"']/g,
    (ch) =>
      ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[
        ch
      ],
  );
const e = escape;
const json = (value) => JSON.stringify(value).replace(/</g, "\\u003c");
const url = (p) => config.origin + p;
const topicPath = (l, t) => `/${l}/categories/${t.group}/${t.slug}/`;
const titleFor = (l, t) =>
  editorial[l]?.[`${t.group}/${t.slug}`]?.title ||
  `${t.title} · ${format(labels[l].count, { n: t.stories.length })}`;
const cardsTitle = (l, t) => t.title;
const text = (paragraphs) => paragraphs.map((p) => `<p>${e(p)}</p>`).join("\n");
const imageSizes = new Map();
function image(src, alt, hero = false) {
  // Read the canvas dimensions of the existing WebP assets so the browser can
  // reserve the correct space before the image arrives (no external dependency).
  if (!imageSizes.has(src)) {
    const bytes = fs.readFileSync(`public${src}`);
    assertWebP(bytes, src);
    const kind = bytes.toString("ascii", 12, 16);
    let width, height;
    if (kind === "VP8 ") {
      width = bytes.readUInt16LE(26) & 0x3fff;
      height = bytes.readUInt16LE(28) & 0x3fff;
    } else if (kind === "VP8L") {
      const bits = bytes.readUInt32LE(21);
      width = (bits & 0x3fff) + 1;
      height = ((bits >>> 14) & 0x3fff) + 1;
    } else if (kind === "VP8X") {
      width = bytes.readUIntLE(24, 3) + 1;
      height = bytes.readUIntLE(27, 3) + 1;
    }
    if (!width || !height)
      throw new Error(`Cannot read image dimensions: ${src}`);
    imageSizes.set(src, { width, height });
  }
  const { width, height } = imageSizes.get(src);
  return `<img src="${e(src)}" alt="${e(alt)}" width="${width}" height="${height}" ${hero ? 'fetchpriority="high"' : 'loading="lazy"'} decoding="async">`;
}
function assertWebP(bytes, src) {
  if (
    bytes.length < 30 ||
    bytes.toString("ascii", 0, 4) !== "RIFF" ||
    bytes.toString("ascii", 8, 12) !== "WEBP"
  )
    throw new Error(`Expected a WebP asset: ${src}`);
}
const output = new Map();
const routes = [];

fs.rmSync("dist", { recursive: true, force: true });
fs.mkdirSync("dist/assets", { recursive: true });
fs.cpSync("public/assets/img", "dist/assets/img", { recursive: true });
const fingerprint = (source) => {
  const bytes = fs.readFileSync(source);
  const hash = createHash("sha256").update(bytes).digest("hex").slice(0, 12);
  const name = `site.${hash}${path.extname(source)}`;
  fs.writeFileSync(`dist/assets/${name}`, bytes);
  return `/assets/${name}`;
};
const css = fingerprint("src/assets/site.css");
const js = fingerprint("src/assets/site.js");

function languageLinks(l, suffix = "", tag = false) {
  return config.languages
    .map((other) => {
      let target = `/${other}/${suffix}`;
      if (tag && suffix !== "tags/" && !data[other].tags[suffix.split("/")[1]])
        target = `/${other}/tags/`;
      return `<a href="${e(target)}" lang="${other}" hreflang="${other}" ${other === l ? 'aria-current="true"' : ""}>${labels[other].name}</a>`;
    })
    .join("");
}

function page({
  l,
  route,
  title,
  description,
  body,
  suffix = "",
  noindex = false,
  imageUrl = "/assets/img/main.webp",
  crumbs = [],
  schemas = [],
  kind = "page",
  updated,
}) {
  const t = labels[l];
  const alternates = !noindex
    ? [
        ...config.languages.map((lang) => ({
          lang,
          href: url(`/${lang}/${suffix}`),
        })),
        { lang: "x-default", href: suffix ? url(`/en/${suffix}`) : url("/") },
      ]
    : [];
  const breadcrumbs = crumbs.length
    ? [
        {
          "@context": "https://schema.org",
          "@type": "BreadcrumbList",
          itemListElement: [{ label: t.home, href: `/${l}/` }, ...crumbs].map(
            (item, i) => ({
              "@type": "ListItem",
              position: i + 1,
              name: item.label,
              item: url(item.href),
            }),
          ),
        },
      ]
    : [];
  const documentTitle = `${title} | ${config.name}`;
  const html = `<!doctype html>
<html lang="${l}">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${e(documentTitle)}</title>
<meta name="description" content="${e(description)}">
<meta name="robots" content="${noindex ? "noindex, follow" : "index, follow, max-image-preview:large"}">
<meta name="google-adsense-account" content="${e(config.publisherId)}">
<link rel="canonical" href="${url(route)}">
${alternates.map((a) => `<link rel="alternate" hreflang="${a.lang}" href="${a.href}">`).join("\n")}
<meta property="og:title" content="${e(documentTitle)}">
<meta property="og:description" content="${e(description)}">
<meta property="og:type" content="${kind === "collection" ? "article" : "website"}">
<meta property="og:url" content="${url(route)}">
<meta property="og:image" content="${url(imageUrl)}">
<meta property="og:locale" content="${t.locale}">
<meta property="og:site_name" content="${config.name}">
<meta name="twitter:card" content="summary_large_image">
<link rel="icon" href="/assets/img/favicon.ico">
<link rel="stylesheet" href="${css}">
<script type="application/ld+json">${json([{ "@context": "https://schema.org", "@type": "WebSite", "@id": url("/#website"), name: config.name, url: url("/"), inLanguage: config.languages }, ...breadcrumbs, ...schemas])}</script>
${config.autoAds && !noindex && kind === "collection" ? `<script async src="https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=${config.publisherId}" crossorigin="anonymous"></script>` : ""}
<script id="site-config" type="application/json">${json({ lang: l, measurementId: config.measurementId, save: t.save, saved: t.saved, copied: t.copied, shareFallback: t.shareFallback, results: t.results, savedEmpty: t.savedEmpty, removeSaved: t.removeSaved })}</script>
<script defer src="${js}"></script>
</head>
<body id="top">
<a class="skip" href="#main">${l === "ja" ? "本文へ移動" : { en: "Skip to content", fr: "Aller au contenu", pt: "Ir para o conteúdo", es: "Ir al contenido", de: "Zum Inhalt" }[l]}</a>
<header class="site-header"><div class="header-inner">
<a class="brand" href="/${l}/" aria-label="Life Made Funny — ${e(t.home)}"><span class="brand-mark" aria-hidden="true">☺</span><span>life made <b>funny.</b></span></a>
<nav class="desktop-nav" aria-label="${e(t.topics)}"><a href="/${l}/categories/jobs/">${t.jobs}</a><a href="/${l}/categories/sports/">${t.sports}</a><a href="/${l}/categories/">${t.topics}</a></nav>
<details class="language-menu"><summary>${t.name}<span aria-hidden="true">⌄</span></summary><nav aria-label="${e(t.language)}">${languageLinks(l, suffix, suffix.startsWith("tags/"))}</nav></details>
</div><nav class="mobile-nav" aria-label="${e(t.topics)}"><a href="/${l}/categories/jobs/">${t.jobs}</a><a href="/${l}/categories/sports/">${t.sports}</a><a href="/${l}/categories/">${t.topics}</a></nav></header>
<main id="main">${crumbs.length ? `<nav class="breadcrumbs wrap" aria-label="${l === "ja" ? "現在の位置" : "Breadcrumb"}"><a href="/${l}/">${t.home}</a>${crumbs.map((c, i) => `<span aria-hidden="true">/</span>${i === crumbs.length - 1 ? `<span aria-current="page">${e(c.label)}</span>` : `<a href="${e(c.href)}">${e(c.label)}</a>`}`).join("")}</nav>` : ""}${body}</main>
<footer class="site-footer"><div class="wrap footer-grid"><div><a class="brand" href="/${l}/">life made <b>funny.</b></a><p>${e(t.aboutShort)}</p></div><nav aria-label="${e(t.about)}">${["about", "editorial", "contact", "privacy", "terms"].map((key) => `<a href="/${l}/static/${key}/">${t[key]}</a>`).join("")}<button class="text-button" data-preferences hidden>${t.preferences}</button></nav><nav aria-label="${e(t.topics)}"><a href="/${l}/categories/">${t.topics}</a><a href="/${l}/tags/">${t.tags}</a><a href="/${l}/saved/">${t.savedMoments}</a><a href="#top">${t.top}</a><a href="/">Language / 言語</a></nav></div><div class="wrap footer-bottom">© Life Made Funny<span>${config.email}</span></div></footer>
<aside class="consent" id="consent" aria-label="${e(t.preferences)}" hidden><p>${e(t.consentText)} <a href="/${l}/static/privacy/">${t.privacy}</a></p><div><button data-consent="granted">${t.accept}</button><button data-consent="denied">${t.reject}</button></div></aside>
<p class="toast" role="status" aria-live="polite" id="toast"></p>
</body></html>\n`;
  const file =
    route === "/"
      ? "index.html"
      : route === "/404.html"
        ? "404.html"
        : `${route.slice(1)}index.html`;
  if (output.has(file)) throw new Error(`Duplicate output: ${file}`);
  output.set(file, html);
  routes.push({ route, file, l, title, noindex, alternates, kind, updated });
}

function card(l, topic) {
  const t = labels[l];
  return `<article class="topic-card" data-filter-item data-keywords="${e([topic.title, ...topic.stories.map((s) => s.title)].join(" "))}"><a href="${topicPath(l, topic)}"><div class="card-art ${topic.group}">${image(topic.image, "")}<span>${e(t[topic.group])}</span></div><div class="card-copy"><p class="eyebrow">${format(t.count, { n: topic.stories.length })}</p><h3>${e(cardsTitle(l, topic))}</h3><span class="card-link">${t.read}<span aria-hidden="true">↗</span></span></div></a></article>`;
}

function filter(t) {
  return `<div class="filter" data-filter hidden><label for="topic-filter">${t.search}</label><div><input id="topic-filter" type="search" placeholder="${e(t.placeholder)}" autocomplete="off"><button type="button" data-filter-clear>${t.clear}</button></div><p role="status" data-filter-count></p></div>`;
}

function home(l) {
  const t = labels[l];
  const featured = config.featured
    .map((key) =>
      data[l].topics.find((topic) => `${topic.group}/${topic.slug}` === key),
    )
    .filter(Boolean);
  const body = `<section class="hero wrap"><div class="hero-copy"><p class="eyebrow"><span class="dot"></span>${t.eyebrow}</p><h1>${e(t.hero).replace("\n", "<br>")}</h1><p class="lead">${e(t.intro)}</p><a class="button" href="#collections">${t.start}<span aria-hidden="true">→</span></a><div class="hero-meta"><span>${data[l].topics.length} ${t.results}</span><span>日本語 / EN / FR / PT / ES / DE</span></div></div><div class="hero-art">${image("/assets/img/main.webp", "", true)}<span class="hero-stamp" aria-hidden="true">a little<br>more ☺<br><b>everyday</b></span></div></section>
  <section class="section wrap" id="collections"><div class="section-heading"><div><p class="eyebrow">${t.topics}</p><h2>${t.featured}</h2></div><a class="underlink" href="/${l}/categories/">${t.all} →</a></div><div class="card-grid">${featured.map((topic) => card(l, topic)).join("")}</div></section>
  <section class="section browse-band"><div class="wrap"><h2>${t.browse}</h2><div class="group-grid">${["jobs", "sports"].map((group) => `<a class="group-card ${group}" href="/${l}/categories/${group}/"><div><p class="eyebrow">${data[l].topics.filter((x) => x.group === group).length} ${t.results}</p><h3>${t[group]} <span aria-hidden="true">↗</span></h3><p>${t[group + "Intro"]}</p></div>${image(`/assets/img/${group}/${group}.webp`, "")}</a>`).join("")}</div></div></section>
  <section class="section wrap about-strip"><span class="big-smile" aria-hidden="true">☺</span><div><h2>${t.aboutTitle}</h2><p>${t.aboutShort}</p><a class="underlink" href="/${l}/static/about/">${t.about} →</a></div></section>`;
  page({
    l,
    route: `/${l}/`,
    title:
      l === "ja" ? "仕事・スポーツのあるあるネタ集" : t.hero.replace("\n", " "),
    description: t.aboutShort,
    body,
  });
}

function collection(l, topic) {
  const t = labels[l];
  const route = topicPath(l, topic);
  const ed = editorial[l]?.[`${topic.group}/${topic.slug}`];
  const paragraphs = ed?.intro || [
    format(t.collectionIntro, {
      a: topic.stories[0].title,
      b: topic.stories.at(-1).title,
      n: topic.stories.length,
    }),
  ];
  const description = `${titleFor(l, topic)}. ${t.aboutShort}`;
  const related = data[l].topics
    .filter((x) => x.group === topic.group && x.slug !== topic.slug)
    .map((x) => ({
      topic: x,
      score: x.stories
        .flatMap((s) => s.tags)
        .filter((tag) => topic.stories.some((s) => s.tags.includes(tag)))
        .length,
    }))
    .sort(
      (a, b) => b.score - a.score || a.topic.slug.localeCompare(b.topic.slug),
    )
    .slice(0, 3);
  const body = `<article class="wrap collection"><header class="collection-hero"><div><p class="eyebrow">${t[topic.group]} · ${format(t.count, { n: topic.stories.length })}</p><h1>${e(titleFor(l, topic))}</h1><p class="byline">${t.by}</p>${text(paragraphs)}</div><div class="collection-art ${topic.group}">${image(topic.image, "", true)}</div></header>
  <div class="reading-grid"><div class="moments"><h2 id="moments">${t.moments}</h2><ol class="moment-list">${topic.stories.map((s, i) => `<li id="${s.id}" class="moment"><span class="moment-number" aria-hidden="true">${String(i + 1).padStart(2, "0")}</span><div><h3>${e(s.title)}</h3><p>${e(s.body)}</p><div class="story-tags">${s.tags.map((tag) => `<a href="/${l}/tags/${e(tag)}/">#${e(data[l].tags[tag])}</a>`).join("")}</div><div class="moment-actions"><button hidden data-save="${l}:${s.id}" data-title="${e(s.title)}" data-href="${route}#${s.id}" aria-pressed="false">${t.save}</button><button hidden data-share="${e(s.title)}" data-url="${url(route)}#${s.id}">${t.share}</button><a href="#${s.id}" aria-label="${e(t.permalink)}">#${String(i + 1).padStart(2, "0")}</a></div></div></li>`).join("")}</ol>${ed?.after ? `<section class="editorial-note"><h2>${e(ed.after[0])}</h2><p>${e(ed.after[1])}</p></section>` : ""}<aside class="content-note"><p>${e(t.note)}</p><a href="/${l}/static/editorial/">${t.editorial} →</a></aside></div>
  <aside class="toc"><details open><summary>${t.toc}</summary><ol>${topic.stories.map((s) => `<li><a href="#${s.id}">${e(s.title)}</a></li>`).join("")}</ol></details></aside></div></article>
  <section class="section wrap"><h2>${t.related}</h2><div class="card-grid">${related.map((x) => card(l, x.topic)).join("")}</div></section>`;
  page({
    l,
    route,
    title: titleFor(l, topic),
    description,
    body,
    suffix: `categories/${topic.group}/${topic.slug}/`,
    kind: "collection",
    imageUrl: topic.image,
    updated: ed?.updated,
    crumbs: [
      { label: t.topics, href: `/${l}/categories/` },
      { label: t[topic.group], href: `/${l}/categories/${topic.group}/` },
      { label: topic.title, href: route },
    ],
    schemas: [
      {
        "@context": "https://schema.org",
        "@type": "CollectionPage",
        name: titleFor(l, topic),
        url: url(route),
        inLanguage: l,
        description,
        mainEntity: {
          "@type": "ItemList",
          numberOfItems: topic.stories.length,
          itemListElement: topic.stories.map((s, i) => ({
            "@type": "ListItem",
            position: i + 1,
            name: s.title,
            url: url(route) + "#" + s.id,
          })),
        },
      },
    ],
  });
}

function archives(l) {
  const t = labels[l];
  for (const group of ["", "jobs", "sports"]) {
    const topics = data[l].topics.filter((x) => !group || x.group === group);
    const route = `/${l}/categories/${group ? group + "/" : ""}`;
    const title = group ? t[group] : t.topics;
    const body = `<section class="wrap section"><div class="page-intro"><p class="eyebrow">${config.name}</p><h1>${title}</h1><p class="lead">${group ? t[group + "Intro"] : t.aboutShort}</p></div>${filter(t)}<div class="card-grid" data-filter-list>${topics.map((topic) => card(l, topic)).join("")}</div><p class="empty" data-filter-empty hidden>${t.empty}</p></section>`;
    page({
      l,
      route,
      title,
      description: group ? t[group + "Intro"] : t.aboutShort,
      body,
      suffix: `categories/${group ? group + "/" : ""}`,
      crumbs: [{ label: title, href: route }],
    });
  }
  const tagEntries = Object.entries(data[l].tags).sort((a, b) =>
    a[1].localeCompare(b[1], l),
  );
  const tagsPath = `/${l}/tags/`;
  page({
    l,
    route: tagsPath,
    title: t.tags,
    description: t.tagIntro,
    suffix: "tags/",
    noindex: true,
    kind: "tag",
    crumbs: [{ label: t.tags, href: tagsPath }],
    body: `<section class="wrap section"><div class="page-intro"><h1>${t.tags}</h1><p class="lead">${t.tagIntro}</p></div><div class="tag-cloud">${tagEntries.map(([slug, name]) => `<a href="${tagsPath}${e(slug)}/">#${e(name)}</a>`).join("")}</div></section>`,
  });
  for (const [slug, name] of tagEntries) {
    const topics = data[l].topics.filter((topic) =>
      topic.stories.some((s) => s.tags.includes(slug)),
    );
    const body = `<section class="wrap section"><div class="page-intro"><p class="eyebrow">${t.tags}</p><h1>#${e(name)}</h1><p class="lead">${t.tagMatches}</p></div>${
      topics.length
        ? `<div class="tag-results">${topics
            .map(
              (topic) =>
                `<section class="tag-result"><h2><a href="${topicPath(l, topic)}">${e(topic.title)}</a></h2><ul>${topic.stories
                  .filter((s) => s.tags.includes(slug))
                  .map(
                    (s) =>
                      `<li><a href="${topicPath(l, topic)}#${s.id}">${e(s.title)}</a></li>`,
                  )
                  .join("")}</ul></section>`,
            )
            .join("")}</div>`
        : `<p>${t.empty}</p><a class="button" href="/${l}/categories/">${t.all}</a>`
    }</section>`;
    page({
      l,
      route: `${tagsPath}${slug}/`,
      title: `#${name} · ${t.tags}`,
      description: `${name}. ${t.tagIntro}`,
      suffix: `tags/${slug}/`,
      noindex: true,
      kind: "tag",
      body,
      crumbs: [
        { label: t.tags, href: tagsPath },
        { label: name, href: `${tagsPath}${slug}/` },
      ],
    });
  }
}

function staticPages(l) {
  const t = labels[l];
  const mail = `<a class="button" href="mailto:${config.email}">${t.mail} ↗</a><p><a href="mailto:${config.email}">${config.email}</a></p>`;
  const bodies = {
    about: text(t.aboutBody) + mail,
    editorial:
      text(t.editorialBody) +
      `<p><a href="/${l}/static/contact/">${t.contact} →</a></p>`,
    contact: `<p>${e(t.contactBody)}</p>` + mail,
    privacy:
      text(t.privacyBody) +
      '<p><a href="https://policies.google.com/privacy">Google Privacy Policy</a> · <a href="https://policies.google.com/technologies/partner-sites">Google partner sites</a></p>' +
      `<button hidden class="button" data-preferences>${t.preferences}</button>`,
    terms: data[l].terms
      .map((p) => `<${p.tag}>${e(p.text)}</${p.tag}>`)
      .join("\n"),
  };
  for (const [slug, content] of Object.entries(bodies)) {
    const route = `/${l}/static/${slug}/`;
    page({
      l,
      route,
      title: t[slug],
      description: `${t[slug]} — ${config.name}. ${t.aboutShort}`,
      suffix: `static/${slug}/`,
      body: `<article class="wrap prose section"><p class="eyebrow">${config.name}</p><h1>${t[slug]}</h1>${content}</article>`,
      crumbs: [{ label: t[slug], href: route }],
    });
  }
}

for (const l of config.languages) {
  home(l);
  archives(l);
  for (const topic of data[l].topics) collection(l, topic);
  staticPages(l);
  const t = labels[l];
  page({
    l,
    route: `/${l}/saved/`,
    title: t.savedMoments,
    description: t.savedIntro,
    suffix: "saved/",
    noindex: true,
    kind: "saved",
    body: `<section class="wrap section prose"><h1>${t.savedMoments}</h1><p>${t.savedIntro}</p><div data-saved-list></div><noscript><p>${t.savedNoJS}</p></noscript><p><a class="underlink" href="/${l}/categories/">${t.topics} →</a></p></section>`,
  });
}

page({
  l: "en",
  route: "/",
  title: "Everyday humor in six languages",
  description:
    "Choose your language and explore relatable moments from work and sport. 日本語・English・Français・Português・Español・Deutsch.",
  body: `<section class="wrap section language-landing"><p class="eyebrow">LIFE MADE FUNNY</p><h1>A little humor.<br>A familiar feeling.</h1><p class="lead">Choose your language · 言語を選んで、あるあるを楽しもう。</p><div class="language-grid">${config.languages.map((l) => `<a href="/${l}/" lang="${l}" hreflang="${l}"><span>${labels[l].name}<span aria-hidden="true">↗</span></span><p>${e(labels[l].aboutShort)}</p></a>`).join("")}</div></section>`,
});
page({
  l: "en",
  route: "/404.html",
  title: "Page not found",
  description:
    "This page could not be found. Choose a language to keep exploring.",
  noindex: true,
  body: `<section class="wrap section prose"><p class="eyebrow">404</p><h1>This page took a different turn.</h1><p>The page could not be found. お探しのページが見つかりません。</p><a class="button" href="/">Choose your language / 言語を選ぶ →</a></section>`,
});

for (const [file, html] of output) {
  fs.mkdirSync(path.dirname(`dist/${file}`), { recursive: true });
  fs.writeFileSync(`dist/${file}`, html);
}
const indexed = routes.filter((r) => !r.noindex);
fs.writeFileSync(
  "dist/sitemap.xml",
  `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9" xmlns:xhtml="http://www.w3.org/1999/xhtml">\n${indexed.map((r) => `<url><loc>${url(r.route)}</loc>${r.updated ? `<lastmod>${r.updated}</lastmod>` : ""}${r.alternates.map((a) => `<xhtml:link rel="alternate" hreflang="${a.lang}" href="${a.href}"/>`).join("")}</url>`).join("\n")}\n</urlset>\n`,
);
fs.writeFileSync(
  "dist/robots.txt",
  `User-agent: *\nAllow: /\n\nUser-agent: Mediapartners-Google\nAllow: /\n\nUser-agent: AdsBot-Google\nAllow: /\n\nSitemap: ${url("/sitemap.xml")}\n`,
);
fs.writeFileSync(
  "dist/ads.txt",
  `google.com, ${config.publisherId.replace("ca-", "")}, DIRECT, f08c47fec0942fa0\n`,
);

// Exact known legacy pagination only. Preserve .html and trailing-slash forms.
// Group redirects sharing the same target, keeping Firebase's config compact.
const grouped = new Map();
for (const redirect of migration.redirects) {
  const values = grouped.get(redirect.to) || [];
  values.push(redirect.from.slice(0, -1));
  grouped.set(redirect.to, values);
}
const regexEscape = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
const redirects = [...grouped].map(([destination, sources]) => ({
  regex: `^(?:${sources.map(regexEscape).join("|")})(?:\\.html)?/?$`,
  destination,
  type: 301,
}));
redirects.push({
  regex: "^/backup_index(?:\\.html)?/?$",
  destination: "/",
  type: 301,
});
const firebase = readJSON("firebase.json");
firebase.hosting.redirects = redirects;
fs.writeFileSync("firebase.json", JSON.stringify(firebase, null, 2) + "\n");
fs.mkdirSync(".build", { recursive: true });
fs.writeFileSync(".build/routes.json", JSON.stringify(routes, null, 2));
console.log(
  `Built ${routes.length} static pages; ${indexed.length} canonical sitemap URLs; ${migration.redirects.length} old pagination URLs preserved by ${redirects.length} redirect rules.`,
);
