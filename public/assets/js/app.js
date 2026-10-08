const site_header = document.getElementById("site_header");
window.addEventListener("scroll", () => {
    if (0 < window.scrollY) {
        site_header.style.position = "fixed";
        document.body.style.paddingTop = "60px";
    } else {
        site_header.style.position = "relative";
        document.body.style.paddingTop = 0;
    }
});

const menuClose = () => {
    const heder_nav = document.getElementById("heder_nav");
    const heder_nav_list = document.getElementById("heder_nav_list");
    const close_menu = document.getElementById("close_menu");

    heder_nav_list.style.transform = "translate(100%, 0)";
    close_menu.style.right = 0;
    heder_nav.style.opacity = 0;
    document.body.style.overflow = "";
    setTimeout(() => (heder_nav.style.display = "none"), 400);
};

const menuOpen = () => {
    const heder_nav = document.getElementById("heder_nav");
    const heder_nav_list = document.getElementById("heder_nav_list");
    const close_menu = document.getElementById("close_menu");
    heder_nav.style.display = "block";
    heder_nav.style.opacity = 1;
    document.body.style.overflow = "hidden";
    setTimeout(() => {
        heder_nav_list.style.transform = "translate(0, 0)";
        close_menu.style.right = "80%";
    }, 100);
};

window.addEventListener("load", () => {
    const langType = document.getElementById("langType");
    const viewType = document.getElementById("viewType");
    const pageId = document.getElementById("pageId");
    if (!langType || !viewType || !pageId) return;
    const lang = langType.value;
    const type = viewType.value;
    const docId = pageId.value;
    if (!lang || !type || !docId) return;

    const functionsUrl = "https://us-central1-lifemadefunny-1b2a3.cloudfunctions.net/countPageView";
    const sendData = JSON.stringify({ lang: lang, type: type, docId: docId });
    if (!navigator.sendBeacon(functionsUrl, sendData)) {
        fetch(functionsUrl, {
            method: "POST",
            body: sendData,
            keepalive: true,
            headers: { "Content-Type": "application/json" }
        });
    }
});

const setLanguage = (lang) => {
    const expires = new Date(Date.now() + 365 * 864e5).toUTCString();
    document.cookie = `firebase-language-override=${lang}; expires=${expires}; path=/`;
    location.reload();
};