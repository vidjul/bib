const axios = require('axios');
const cheerio = require('cheerio');
const { cleanText, cleanElem, sleep } = require('./util');

/**
 * PARSER / TEXT HELPERS
 */

/**
 * Return an address object by parsing string in
 * Street, City, Zipcode, Country
 * @param {String} addrString
 */
const parseAddr = addrString => {
  const addrArr = addrString.split(',');
  return cleanElem({
    street: addrArr[0],
    city: addrArr[1],
    zip: addrArr[2],
    country: addrArr[3]
  });
};

/**
 * Return a price range object and a cooking type array
 * by parsing a priceString
 * @param {String} priceString
 */
const parsePriceCookingType = priceString => {
  const cleanedString = cleanText(priceString);
  const [range, cookingType] = cleanedString.split('•');
  const rangeMatch = range.match(/(\d+)/g);
  return {
    price: {
      min: rangeMatch[0],
      max: rangeMatch[1]
    },
    cookingType: cleanText(cookingType)
  };
};

/**
 * Get rating value from string
 * TODO: Check if it's really useful, as every restaurant will probably be BIB_GOURMAND
 * @param {String} ratingString
 */
const parseRating = ratingString => {
  switch (ratingString) {
    case 'ONE_STAR':
      return 1;
    case 'TWO_STARS':
      return 2;
    case 'THREE_STARS':
      return 3;
    default:
      return 0;
  }
};

/**
 * Get the total number of restaurants from a search url
 * @param {String} data
 * @return {Number} total number of restaurants
 */
const getRestaurantsTotal = data => {
  const $ = cheerio.load(data);

  return parseInt(
    $('.search-results__status > div > h1')
      .contents()
      .not('span')
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

  return $('.card__menu > a')
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
  const name = $('.section-main h2.restaurant-details__heading--title').text();
  const address = parseAddr(
    $(
      '.section-main ul.restaurant-details__heading--list > li:nth-child(1)'
    ).text()
  );
  const price = parsePriceCookingType(
    $(
      '.section-main ul.restaurant-details__heading--list > li.restaurant-details__heading-price'
    ).text()
  );
  const experience = $('#experience-section > ul > li:nth-child(2)')
    .contents()
    .not('i')
    .text();
  const website = $('[data-event=CTA_website]').attr('href');
  const phone = $('[data-event=CTA_tel]')
    .prev()
    .text();

  const rating = parseRating(
    $('[data-event=CTA_tel]').data('restaurant-distinction')
  );

  const services = cleanElem(
    $('.section-main ul.restaurant-details__services--list > li > div')
      .map((i, elem) => {
        return $(elem)
          .contents()
          .not('i')
          .text();
      })
      .get()
  );

  return Object.assign(
    {},
    cleanElem({ name, experience, website, phone }),
    { address, services, rating },
    price
  );
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

/**
 * Get all France located Bib Gourmand restaurants
 * @return {Array} restaurants
 */
module.exports.get = async () => {
  const BASE_URL = 'https://guide.michelin.com';
  const BIB_GOURMAND_URL = `${BASE_URL}/fr/fr/restaurants/bib-gourmand`;

  /**
   * Items per page value was identified as 20 after the investigation step.
   * Might be retrieved programatically but setting it manually makes everything
   * smoother.
   */
  const ITEMS_PER_PAGE = 20;

  const response = await axios(BIB_GOURMAND_URL);
  const { data, status } = response;

  if (status <= 200 && status > 300) {
    return console.error(status);
  }

  const total = getRestaurantsTotal(data);
  const nbPages = Math.round(total / ITEMS_PER_PAGE);

  console.log(`${total} restaurant(s) to scrape.`);

  console.log(`Gathering url from page 1/${nbPages}...`);
  const restaurantsUrl = [...getRestaurantUrls(data, BASE_URL)];

  /**
   * Loop from 2 to nbPages to build the array of search pages
   * We start from 2 as BIB_GOURMAND_URL is already the 1st page.
   */
  for (let i = 2; i <= nbPages; i++) {
    const pageUrl = `${BIB_GOURMAND_URL}/page/${i}`;
    const response = await axios(pageUrl);
    const { data, status } = response;

    if (status <= 200 && status > 300) {
      return console.error(status);
    }

    console.log(`Gathering url from page ${i}/${nbPages}...`);
    restaurantsUrl.push(...getRestaurantUrls(data, BASE_URL));
    await sleep(200);
  }

  const results = await Promise.all(
    restaurantsUrl.map(url => this.scrapeRestaurant(url))
  );

  return results;
};
