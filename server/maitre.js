const _ = require('lodash');
const axios = require('axios');
const queryString = require('query-string');
const cheerio = require('cheerio');

const { sleep, cleanElem, cleanText } = require('./util');

/**
 * Return an array of phone numbers in +33 X XX XX XX XX format
 * @param {object} data request response data
 */
const parsePhone = data => {
  const $ = cheerio.load(data);

  let phones = $('.ep-section-item > .section-item-right')
    .contents()
    .not('span')
    .not('a')
    .text()
    .split(',');

  phones = _.reject(phones, _.isEmpty);

  if (!phones) {
    return null;
  }
  return phones.map(phone => '+33 ' + cleanText(phone).substring(1));
};

/**
 * Return the website url
 * Might need a validator as some maitres sets emails as website...
 * @param {object} data response data
 */
const parseWebsite = data => {
  const $ = cheerio.load(data);

  return $('.ep-section-item > .section-item-right > a').attr('href');
};

const parseAddress = data => {
  const $ = cheerio.load(data);

  const parsed = $('.profil-tooltip > p > a').text();

  /**
   * Small util to format a city string
   * Might not be really useful, to remove if not needed
   * @param {string} string city string in UPPERCASE
   */
  const formatCity = string => {
    return _.chain(string)
      .split('-')
      .map(_.lowerCase)
      .map(_.upperFirst)
      .join('-')
      .value();
  };

  if (parsed) {
    const addrArr = _.chain(parsed)
      .split('\n')
      .map(cleanText)
      .reject(_.isEmpty)
      .value();

    return {
      street: addrArr[0],
      zip: addrArr[1],
      city: formatCity(addrArr[2]),
      country: 'France'
    };
  }
  return parsed;
};

const parseSpecialities = data => {
  const $ = cheerio.load(data);

  const parsed = $('.ep-section-body')
    .find('.subcontent')
    .text();

  if (!_.isEmpty(parsed)) {
    return _.chain(parsed)
      .split('\n')
      .map(cleanText)
      .reject(_.isEmpty)
      .value();
  }
  return [];
};

/**
 * Return the request_id set in response form to make the next request
 * (Dunno if it's really useful though!)
 * @param {*} data request reponse data
 */
const getRequestId = data => {
  const $ = cheerio.load(data);

  return $('input[name="request_id"]').val();
};

/**
 * Get the total number of restaurants from a search url
 * @param {String} data
 * @return {Number} total number of restaurants
 */
const getRestaurantsTotal = data => {
  const $ = cheerio.load(data);

  return parseInt(
    $('.nbresults')
      .text()
      .match(/\d+/g)[0],
    10
  );
};

/**
 * Get an array of restaurants url from a search result
 * @param {Object} data - html responge for the page
 * @param {String} prefix - url prefix
 */
const getRestaurantUrls = (data, prefix) => {
  const $ = cheerio.load(data);

  return $('.single_libel > a')
    .map((_i, elem) => {
      return prefix + $(elem).attr('href');
    })
    .get();
};

/**
 * Parse webpage restaurant
 * @param  {String} data - html response
 * @return {Object} restaurant
 */
const parse = data => {
  const $ = cheerio.load(data);
  const name = $(
    '.ep-section-item > .section-item-right > span > strong'
  ).text();

  const phone = parsePhone(data);
  const website = parseWebsite(data);
  const address = parseAddress(data);
  const specialities = parseSpecialities(data);

  return Object.assign({}, cleanElem({ name, website }), {
    phone,
    address,
    specialities
  });
};

/**
 * Scrape a given restaurant url
 * @param  {String}  url
 * @return {Object} restaurant
 */
module.exports.scrapeRestaurant = async url => {
  const response = await axios(url);
  const { data, status } = response;

  process.stdout.write(`Scraping ${url}...`);
  if (status >= 200 && status < 300) {
    const parsed = parse(data);

    process.stdout.write('Done. \n');
    return parsed;
  }

  process.stdout.write(`Error: ${status} \n`);

  return null;
};

module.exports.get = async () => {
  const BASE_URL = 'https://www.maitresrestaurateurs.fr';

  /**
   * This URL will be used to get the first results page and
   * the request_id param, which will be used to get the other pages.
   */
  const BASE_SEARCH_URL =
    'https://www.maitresrestaurateurs.fr/annuaire/recherche';

  const baseParam = {
    result: 1,
    // eslint-disable-next-line camelcase
    annuaire_mode: 'standard'
  };

  /**
   * This is the AJAX endpoint that will be used to iterate through
   * the various results pages.
   */
  const SEARCH_URL =
    'https://www.maitresrestaurateurs.fr/annuaire/ajax/loadresult';

  const ITEMS_PER_PAGE = 10;

  let response = await axios.post(
    BASE_SEARCH_URL,
    queryString.stringify(baseParam)
  );

  let { data, status } = response;

  if (status <= 200 && status > 300) {
    return console.error(status);
  }

  const total = getRestaurantsTotal(data);
  const nbPages = Math.round(total / ITEMS_PER_PAGE);

  const requestId = getRequestId(data);

  console.log(`${total} restaurant(s) to scrape.`);

  console.log(`Gathering url from page 1/${nbPages}...`);
  const restaurantsUrl = [...getRestaurantUrls(data, BASE_URL)];

  /**
   * Loop from 2 to nbPages to build the array of search pages
   * We start from 2 as BIB_GOURMAND_URL is already the 1st page.
   */
  for (let i = 2; i <= nbPages; i++) {
    const searchParam = {
      page: i,
      // eslint-disable-next-line camelcase
      request_id: requestId
    };

    response = await axios.post(SEARCH_URL, queryString.stringify(searchParam));
    data = response.data;
    status = response.data;

    if (status <= 200 && status > 300) {
      return console.error(status);
    }

    console.log(`Gathering url from page ${i}/${nbPages}...`);
    restaurantsUrl.push(...getRestaurantUrls(data, BASE_URL));
    await sleep(50);
  }

  const results = [];
  const CHUNK_SIZE = 400;
  const urlChunks = _.chunk(restaurantsUrl, CHUNK_SIZE);

  for (const chunk of urlChunks) {
    const scraped = await Promise.all(
      chunk.map(url => this.scrapeRestaurant(url))
    );

    results.push(...scraped);
  }

  return results;
};
