const fs = require('fs').promises;
const _ = require('lodash');
const wuzzy = require('wuzzy');

/**
 * MATCHERS
 */

const matchers = {
  phone: (restaurant1, restaurant2) => {
    return restaurant1.phone.includes(restaurant2.phone);
  },
  website: (restaurant1, restaurant2) => {
    return restaurant1.website === restaurant2.website;
  },
  reference: (restaurant1, restaurant2) => {
    const THRESHOLD = 0.7;
    const token1 = restaurant1.reference.split('-');
    const token2 = restaurant2.reference.split('-');

    return wuzzy.jaccard(token1, token2) > THRESHOLD;
  },
  address: (restaurant1, restaurant2) => {
    const THRESHOLD = 0.9;

    return _.isEqualWith(restaurant1.address, restaurant2.address, (a, b) => {
      if (
        wuzzy.levenshtein(a.street, b.street) > THRESHOLD &&
        wuzzy.levenshtein(a.city, b.city) > THRESHOLD &&
        wuzzy.levenshtein(a.zip, b.zip) > THRESHOLD
      ) {
        return true;
      }
      return false;
    });
  }
};

const match = (restaurant1, restaurants, property) => {
  return restaurants.find(restaurant2 => {
    if (restaurant1[property] && restaurant2[property]) {
      return matchers[property](restaurant1, restaurant2);
    }
    return null;
  });
};

module.exports.get = async () => {
  const michelinRestaurants = JSON.parse(
    await fs.readFile('./server/output/michelin.json')
  );
  const maitreRestaurants = JSON.parse(
    await fs.readFile('./server/output/maitre.json')
  );

  const results = [];

  for (const maitreRestaurant of maitreRestaurants) {
    const michelinRestaurant = match(
      maitreRestaurant,
      michelinRestaurants,
      'phone'
    );

    if (michelinRestaurant) {
      results.push({
        maitre: maitreRestaurant,
        michelin: michelinRestaurant
      });
    }
  }
  return results;
};
