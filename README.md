# SiteCrawler

Super hacky project for crawling a site and finding 404s.

## Setup

```sh
# install deps
yarn
```

## Run

```sh
# run the crawler
yarn start


# the crawler caches results incrementally in case of an error so it doesn't have to start from scratch each time
# to re-run from scratch, remove the results.json/errored.json files from `data`
rm data/*.json && yarn start
```

## Known issues

There is a bug where some pages are crawled multiple times and so the script is in an infinite loop.
The workaround is, I counted the expected pages within the target site and set a maximum limit
of pages to crawl. Once that is hit, it will exit by skipping the remaining.