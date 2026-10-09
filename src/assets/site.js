(() => {
  "use strict";
  const config = JSON.parse(document.getElementById("site-config").textContent);
  const store = {
    get(key) {
      try {
        return localStorage.getItem(key);
      } catch {
        return null;
      }
    },
    set(key, value) {
      try {
        localStorage.setItem(key, value);
      } catch {
        /* private mode: this visit still works */
      }
    },
  };
  const consentKey = "lmf:analytics-consent:v1";
  const savedKey = "lmf:saved-moments:v1";
  const banner = document.getElementById("consent");
  let consent = store.get(consentKey);
  let analyticsLoaded = false;
  let toastTimer;
  let saved;
  try {
    const values = JSON.parse(store.get(savedKey) || "[]");
    saved = new Map(
      Array.isArray(values)
        ? values
            .filter(
              (v) =>
                v &&
                typeof v.id === "string" &&
                typeof v.title === "string" &&
                typeof v.href === "string" &&
                /^\/(ja|en|fr|pt|es|de)\/categories\/[a-z_-]+\/[a-z_-]+\/#moment-[a-f0-9]+$/.test(
                  v.href,
                ),
            )
            .map((v) => [v.id, v])
        : [],
    );
  } catch {
    saved = new Map();
  }

  function announce(message) {
    const toast = document.getElementById("toast");
    toast.textContent = message;
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => {
      toast.textContent = "";
    }, 3500);
  }

  function loadAnalytics() {
    if (
      analyticsLoaded ||
      consent !== "granted" ||
      !/^G-[A-Z0-9]+$/.test(config.measurementId)
    )
      return;
    analyticsLoaded = true;
    window[`ga-disable-${config.measurementId}`] = false;
    window.dataLayer = window.dataLayer || [];
    window.gtag =
      window.gtag ||
      function () {
        window.dataLayer.push(arguments);
      };
    window.gtag("consent", "default", {
      analytics_storage: "granted",
      ad_storage: "denied",
      ad_user_data: "denied",
      ad_personalization: "denied",
    });
    window.gtag("js", new Date());
    window.gtag("config", config.measurementId, {
      allow_google_signals: false,
      allow_ad_personalization_signals: false,
    });
    const script = document.createElement("script");
    script.async = true;
    script.src = `https://www.googletagmanager.com/gtag/js?id=${config.measurementId}`;
    document.head.append(script);
  }

  function clearAnalyticsCookies() {
    const names = document.cookie
      .split(";")
      .map((cookie) => cookie.trim().split("=")[0])
      .filter((name) => /^_ga(?:_|$)/.test(name));
    const host = location.hostname;
    const labels = host.split(".");
    const domains = ["", host, "." + host];
    for (let i = 1; i < labels.length - 1; i++)
      domains.push("." + labels.slice(i).join("."));
    for (const name of names)
      for (const domain of domains)
        document.cookie = `${name}=; Max-Age=0; Path=/;${domain ? ` Domain=${domain};` : ""} SameSite=Lax`;
  }

  function setConsent(value) {
    consent = value;
    store.set(consentKey, value);
    banner.hidden = true;
    window[`ga-disable-${config.measurementId}`] = value !== "granted";
    if (window.gtag)
      window.gtag("consent", "update", {
        analytics_storage: value === "granted" ? "granted" : "denied",
      });
    if (value === "granted") loadAnalytics();
    else clearAnalyticsCookies();
  }

  document.querySelectorAll("[data-preferences]").forEach((button) => {
    button.hidden = false;
    button.addEventListener("click", () => {
      banner.hidden = false;
      banner.querySelector("button").focus();
    });
  });
  document
    .querySelectorAll("[data-consent]")
    .forEach((button) =>
      button.addEventListener("click", () =>
        setConsent(button.dataset.consent),
      ),
    );
  banner.hidden = consent === "granted" || consent === "denied";
  loadAnalytics();

  document.querySelectorAll("[data-save]").forEach((button) => {
    button.hidden = false;
    const update = () => {
      const active = saved.has(button.dataset.save);
      button.textContent = active ? config.saved : config.save;
      button.setAttribute("aria-pressed", String(active));
    };
    update();
    button.addEventListener("click", () => {
      const id = button.dataset.save;
      if (saved.has(id)) saved.delete(id);
      else
        saved.set(id, {
          id,
          title: button.dataset.title,
          href: button.dataset.href,
        });
      store.set(savedKey, JSON.stringify([...saved.values()]));
      update();
    });
  });

  const savedList = document.querySelector("[data-saved-list]");
  function renderSaved() {
    if (!savedList) return;
    savedList.replaceChildren();
    const values = [...saved.values()].filter((v) =>
      v.id.startsWith(config.lang + ":"),
    );
    if (!values.length) {
      const empty = document.createElement("p");
      empty.textContent = config.savedEmpty;
      savedList.append(empty);
      return;
    }
    for (const moment of values) {
      const row = document.createElement("div");
      row.className = "saved-row";
      const link = document.createElement("a");
      link.href = moment.href;
      link.textContent = moment.title;
      const remove = document.createElement("button");
      remove.textContent = config.removeSaved;
      remove.addEventListener("click", () => {
        saved.delete(moment.id);
        store.set(savedKey, JSON.stringify([...saved.values()]));
        renderSaved();
      });
      row.append(link, remove);
      savedList.append(row);
    }
  }
  renderSaved();

  document.querySelectorAll("[data-share]").forEach((button) => {
    button.hidden = false;
    button.addEventListener("click", async () => {
      const url = button.dataset.url;
      if (navigator.share) {
        try {
          await navigator.share({ title: button.dataset.share, url });
          return;
        } catch (error) {
          if (error.name === "AbortError") return;
        }
      }
      try {
        await navigator.clipboard.writeText(url);
        announce(config.copied);
      } catch {
        window.prompt(config.shareFallback, url);
      }
    });
  });

  const filter = document.querySelector("[data-filter]");
  if (filter) {
    filter.hidden = false;
    const input = filter.querySelector("input");
    const cards = [
      ...document.querySelectorAll("[data-filter-list] [data-filter-item]"),
    ];
    const normalize = (value) =>
      value.normalize("NFKC").toLocaleLowerCase(config.lang);
    const update = () => {
      const words = normalize(input.value).trim().split(/\s+/).filter(Boolean);
      let count = 0;
      cards.forEach((card) => {
        const haystack = normalize(card.dataset.keywords);
        card.hidden = !words.every((word) => haystack.includes(word));
        if (!card.hidden) count++;
      });
      filter.querySelector("[data-filter-count]").textContent =
        `${count} ${config.results}`;
      document.querySelector("[data-filter-empty]").hidden = count > 0;
    };
    input.addEventListener("input", update);
    filter
      .querySelector("[data-filter-clear]")
      .addEventListener("click", () => {
        input.value = "";
        update();
        input.focus();
      });
    update();
  }

  document.addEventListener("click", (event) => {
    document.querySelectorAll(".language-menu[open]").forEach((menu) => {
      if (!menu.contains(event.target)) menu.open = false;
    });
  });
  document.addEventListener("keydown", (event) => {
    if (event.key === "Escape")
      document.querySelectorAll(".language-menu[open]").forEach((menu) => {
        menu.open = false;
        menu.querySelector("summary").focus();
      });
  });
})();
