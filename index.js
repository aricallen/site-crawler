const cheerio = require('cheerio');
const axios = require('axios');
const fs = require('fs');
const path = require('path');

const outPath = path.resolve('data', 'results.json');

/**
 * [key: pageUrl]: {
 *   status: Status;
 *   links: string[];
 * }
 */
const pageMap = {};
const Status = {
  UNCRAWLED: 'UNCRAWLED',
  CRAWLED: 'CRAWLED',
  ERRORED: 'ERRORED',
};

const HOST = 'https://docdiggers-hackaton2020.netlify.app/';

const getStatus = (url) => {
  if (pageMap[url] === undefined) {
    return Status.UNCRAWLED;
  }
  return pageMap[url].status;
};

const isErrored = (url) => (pageMap[url] ? pageMap[url].status === Status.ERRORED : false);

const isCrawled = (url) => getStatus(url) === Status.CRAWLED;

const shouldCrawl = (url) =>
  url && (url.startsWith(HOST) || url.startsWith('/')) && !isErrored(url) && !isCrawled(url);

const getAbsUrl = (url) => (url.startsWith(HOST) ? url : `${HOST}${url.replace(/^\//, '')}`);

const crawl = async (url, foundOn) => {
  const pageUrl = getAbsUrl(url);
  console.log(`crawling: ${pageUrl}`);
  try {
    const { data: html } = await axios.get(pageUrl, { responseType: 'text' });
    const $ = cheerio.load(html);
    const anchors = $('a');
    const hrefs = [];
    anchors.each((i, elem) => {
      hrefs.push(elem.attribs.href);
    });
    pageMap[pageUrl] = {
      status: getStatus(pageUrl),
      links: hrefs,
    };
    const knownErrored = hrefs.filter(isErrored);
    knownErrored.forEach((erroredHref) => {
      pageMap[erroredHref].foundOn.push(foundOn);
    });
    const toCrawl = hrefs.filter(shouldCrawl);
    if (toCrawl.length === 0) {
      return;
    }

    for (const href of toCrawl) {
      await crawl(href, pageUrl);
    }
  } catch (err) {
    if (err.response.status === 404) {
      if (pageMap.pageUrl === undefined) {
        pageMap[pageUrl] = {
          status: Status.ERRORED,
          foundOn: [foundOn],
        };
      } else {
        pageMap[pageUrl].foundOn.push(foundOn);
      }
    }
  }
};

const run = async () => {
  try {
    await crawl(HOST);
    fs.writeFileSync(outPath, JSON.stringify(pageMap, null, 2), 'utf8');
    process.exit(0);
  } catch (err) {
    console.log('err', JSON.stringify(err));
    process.exit(1);
  }
};
run();
