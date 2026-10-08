const { onRequest } = require("firebase-functions/v2/https");
const admin = require("firebase-admin");
admin.initializeApp(); // Admin SDK を初期化
const db = admin.firestore();

exports.redirectByLocale = onRequest((req, res) => {
    const acceptLang = req.headers['accept-language'] || '';
    const langMap = {
        ja: '/ja/', en: '/en/', fr: '/fr/', de: '/de/', es: '/es/', pt: '/pt/'
    };
    let locale = 'en';
    for (const l of Object.keys(langMap)) {
        if (acceptLang.toLowerCase().includes(l)) {
            locale = l;
            break;
        }
    }
    // noindexヘッダーを追加
    res.set('X-Robots-Tag', 'noindex');
    res.redirect(302, langMap[locale]);
});


exports.countPageView = onRequest(async (req, res) => {
    if (req.method !== "POST") {
        res.status(405).send("Not available.");
    }

    try {
        let reqData = {};
        if (typeof req.body === "object") reqData = req.body;
        else reqData = JSON.parse(req.body);

        const lang = reqData.lang || null;
        const type = reqData.type || null;
        const docId = reqData.docId || null;
        if (!lang || !type || !docId) {
            res.status(405).send("Insufficient data.");
        }

        const ref = db.collection(type).doc(docId);
        try {
            await ref.update({
                [`${lang}_page_view`]: admin.firestore.FieldValue.increment(1),
            });

            res.status(200).send("OK");
        } catch (error) {
            console.error("Data registration failed =", error);
            res.status(500).send("Data registration failed.");
        }
    } catch (error) {
        console.error("error =", error);
        res.status(500).send("Internal Error.");
    }
});