const axios = require('axios');
const cheerio = require('cheerio');

/**
 * Clean a given text by removing white spaces and line breaks
 * @param {String} text text to clean
 */
const cleanText = text => {
  return text
    .trim()
    .replace(/^s+/gm, '')
    .replace(/\n/gm, '')
    .replace(/\s{2,}/gm, '');
};

/**
 *
 * @param {Object|Array} elem elem with fields to be cleaned
 */
const cleanElem = elem => {
  if (Array.isArray(elem)) {
    return elem.map(value => cleanText(value));
  } else {
    const res = {};
    Object.entries(elem).forEach(entry => {
      res[entry[0]] = cleanText(entry[1]);
    });
    return res;
  }
};

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
  const experience = $('#experience-section > ul > li:nth-child(2)').text();

  return Object.assign({}, cleanElem({ name, experience }), { address }, price);
};

/**
 * Scrape a given restaurant url
 * @param  {String}  url
 * @return {Object} restaurant
 */
module.exports.scrapeRestaurant = async url => {
  const response = await axios(url);
  const { data, status } = response;

  if (status >= 200 && status < 300) {
    return parse(data);
  }

  console.error(status);

  return null;
};

/**
 * Get all France located Bib Gourmand restaurants
 * @return {Array} restaurants
 */
module.exports.get = () => {
  return [];
};
