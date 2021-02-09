const cheerio = require('cheerio');
const axios = require('axios');
const fs = require('fs');
const path = require('path');

const outDir = path.resolve('data');
const outPath = path.resolve(outDir, 'results.json');
const erroredPath = path.resolve(outDir, 'errored.json');
const initPageMap = () => {
  if (fs.existsSync(outPath)) {
    return JSON.parse(fs.readFileSync(outPath, 'utf8'));
  }
  return {};
};

/**
 * [key: pageUrl]: {
 *   status: Status;
 *   links: string[];
 * }
 */
const pageMap = initPageMap();
const Status = {
  UNCRAWLED: 'UNCRAWLED',
  CRAWLED: 'CRAWLED',
  ERRORED: 'ERRORED',
};
let numCrawled = 0;

const HOST = 'https://docdiggers-hackaton2020.netlify.app';

const isErrored = (fullUrl) =>
  pageMap[fullUrl] ? pageMap[fullUrl].status === Status.ERRORED : false;

const getStatus = (fullUrl) => {
  if (pageMap[fullUrl] === undefined) {
    return Status.UNCRAWLED;
  }
  return pageMap[fullUrl].status;
};
const isCrawled = (url) => {
  return getStatus(url) === Status.CRAWLED;
};

const getAbsUrl = (url) => {
  const cleanUrl = url.replace(/[#?].+/, '');
  if (cleanUrl.startsWith(HOST)) {
    return cleanUrl;
  }
  return `${HOST}${cleanUrl}`;
};

const shouldCrawl = (url) => {
  if (!url) {
    return false;
  }
  if (!url.startsWith(HOST) && !url.startsWith('/')) {
    return false;
  }
  if (url === '/' || url.includes('_print')) {
    return false;
  }
  const fullUrl = getAbsUrl(url);
  return !isErrored(fullUrl) && !isCrawled(fullUrl);
};

const updateOutput = () => {
  if (fs.existsSync(outPath) === false) {
    fs.writeFileSync(outPath, '{}', 'utf8');
  }
  if (numCrawled % 100 === 0) {
    const existing = JSON.parse(fs.readFileSync(outPath, 'utf8'));
    const newOutput = { ...existing, ...pageMap };
    fs.writeFileSync(outPath, JSON.stringify(newOutput, null, 2), 'utf8');
  }
};

const crawl = async (url, foundOn) => {
  const pageUrl = getAbsUrl(url);
  numCrawled += 1;
  console.log(`crawling page ${numCrawled}: ${pageUrl}`);
  if (numCrawled > 1500) {
    console.log('crawling more than expected');
    return;
  }
  try {
    const { data: html } = await axios.get(pageUrl, { responseType: 'text' });
    const $ = cheerio.load(html);
    const anchors = $('a');
    const hrefs = [];
    anchors.each((i, elem) => {
      const { href } = elem.attribs;
      if (href) {
        hrefs.push(href);
      }
    });
    pageMap[pageUrl] = {
      status: Status.CRAWLED,
    };
    updateOutput();
    const knownErrored = hrefs.map(getAbsUrl).filter(isErrored);
    knownErrored.forEach((erroredHref) => {
      const currFoundOn = pageMap[erroredHref].foundOn;
      pageMap[erroredHref].foundOn = Array.from(new Set([...currFoundOn, foundOn]));
    });
    const toCrawl = hrefs.filter(shouldCrawl);
    if (toCrawl.length === 0) {
      return;
    }

    for (const href of toCrawl) {
      await crawl(href.replace(HOST, ''), getAbsUrl(pageUrl));
    }
  } catch (err) {
    if (err.response.status !== 404) {
      return;
    }
    if (pageMap.pageUrl === undefined) {
      pageMap[pageUrl] = {
        status: Status.ERRORED,
        foundOn: [foundOn],
      };
    } else {
      pageMap[pageUrl].foundOn.push(foundOn);
    }
  }
};

const run = async () => {
  try {
    await crawl(`${HOST}/`);
    const errored = Object.entries(pageMap)
      .filter(([, { status }]) => status === Status.ERRORED)
      .map(([pageUrl]) => pageUrl);
    fs.writeFileSync(outPath, JSON.stringify(pageMap, null, 2), 'utf8');
    fs.writeFileSync(erroredPath, errored.join('\n'), 'utf8');
    process.exit(0);
  } catch (err) {
    console.log('err', JSON.stringify(err));
    process.exit(1);
  }
};
run();
