const puppeteer = require('puppeteer');
const fs = require('fs').promises;
const json2csv = require('json2csv').parse;

(async () => {
    const browser = await puppeteer.launch({
        // uncomment for debugging
        // headless: false,
    });

    const [page] = await browser.pages();

    await page.setViewport({ width: 1200, height: 1080 });

    await page.setRequestInterception(true);

    // maybe this helps make scraping faster, did not time it
    page.on('request', (req) => {
        if (req.resourceType() === 'font' || req.resourceType() === 'image') {
            req.abort();
        } else {
            req.continue();
        }
    });

    const url = 'https://ukr.warspotting.net/search/?belligerent=2&weapon=1';
    await page.goto(url);

    const list = [];

    let i = 0;

    async function scrapePage() {
        const rows = await page.$$('#vehicleList tbody tr');

        for (const row of rows) {
            const model_element = await row.$('a.vehicle-link');

            const model = await model_element.evaluate(element => element.textContent.trim());
            const link = await model_element.evaluate(element => element.getAttribute('href'));

            const status_element = await row.$('span.badge');
            const status = await status_element.evaluate(element => element.getAttribute('title'));

            const date_element = await row.$('a[title="Search other losses that day"]');
            const date = await date_element.evaluate(element => element.textContent.trim());

            const id_element = await row.$('th.id');
            const id = await id_element.evaluate(element => element.textContent.trim().replace('#', ''));

            list.push({
                id: id,
                model: model,
                status: status,
                date: date,
                link: link,
            });
        }

        i += 1;

        console.log(`Scraped ${i} pages.`);

        const next_page_button_selector = '.page-item:not(.disabled) a.bi-arrow-right';

        const next_page_button = await page.$(next_page_button_selector);
        if (next_page_button) {
            // click on the next page button and wait for navigation
            await Promise.all([
                page.waitForNavigation(),
                next_page_button.click(),
            ]);

            // recursive call to scrape the next page
            await scrapePage();
        } else {
            console.log('No more pages available.');
        }
    }

    await scrapePage();

    await browser.close();

    console.log('Scraping finished.');

    const csv = json2csv(list, { header: true });
    const filename = `output-${new Date().toISOString().substring(0, 10)}.csv`;
    await fs.writeFile(filename, csv);

    console.log('csv saved.');
})();
