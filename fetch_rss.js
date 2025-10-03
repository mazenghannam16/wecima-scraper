const puppeteer = require('puppeteer');
const { parseStringPromise } = require('xml2js');

(async () => {
  try {
    const rssUrl =
      process.argv[2] ||
      "https://wecima.now/category/%D8%A3%D9%81%D9%84%D8%A7%D9%85/%D8%A7%D9%81%D9%84%D8%A7%D9%85-%D8%B9%D8%B1%D8%A8%D9%8A-arabic-movies/feed/";

    const browser = await puppeteer.launch({
      args: ['--no-sandbox', '--disable-setuid-sandbox'],
      headless: true,
    });

    const page = await browser.newPage();
    await page.setUserAgent(
      'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/121.0.0.0 Safari/537.36'
    );
    await page.setExtraHTTPHeaders({
      'Accept-Language': 'ar,en-US;q=0.9,en;q=0.8',
    });

    // افتح الرابط وانتظر الصفحة تحمل
    await page.goto(rssUrl, { waitUntil: 'networkidle2', timeout: 60000 });

    // ناخد النص الخام
    let content = await page.evaluate(
      () => document.body.innerText || document.body.textContent || ""
    );

    await browser.close();

    // قص من بداية XML
    const xmlStart = content.indexOf('<?xml');
    if (xmlStart !== -1) {
      content = content.slice(xmlStart);
    }

    if (!content.includes("<rss")) {
      throw new Error("لم أستطع الحصول على RSS (الصفحة أرجعت HTML مش XML)");
    }

    // حلّل الـ XML
    const parsed = await parseStringPromise(content, {
      explicitArray: false,
      trim: true,
    });
    const items = parsed?.rss?.channel?.item ?? [];
    const arr = Array.isArray(items) ? items : [items];

    // استخرج الأفلام
    const movies = arr.map((it) => {
      const title = it.title || '';
      const link = it.link || '';
      let image = '';

      // جرب description
      const desc = it.description || '';
      let m = desc.match(/<img[^>]*src=["']([^"']+)["']/i);
      if (m) image = m[1];

      // جرب media:content
      if (!image && it['media:content'] && it['media:content'].$ && it['media:content'].$.url) {
        image = it['media:content'].$.url;
      }

      // جرب content:encoded
      if (!image && it['content:encoded']) {
        m = it['content:encoded'].match(/<img[^>]*src=["']([^"']+)["']/i);
        if (m) image = m[1];
      }

      return { title, image, watch_link: link };
    });

    console.log(JSON.stringify(movies, null, 2));
    process.exit(0);
  } catch (err) {
    console.error("Error:", err.message || err);
    process.exit(1);
  }
})();
