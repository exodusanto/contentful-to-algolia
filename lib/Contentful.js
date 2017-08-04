/**
 * Contentful configuration and library
 */
const contentful = require('contentful');
const merge = require('deepmerge');
// const CircularJSON = require('circular-json');

const flatten = (array) => {
  return array.reduce((a, b) => {
    return a.concat(Array.isArray(b) ? flatten(b) : b);
  }, []);
};

class Contentful {

  /**
   * Constructor
   * @param  {Object} config  Configuration
   * @param  {Array}  locales Locales to check for
   * @return {void}
   */
  constructor (config, locales, params = {}) {
    const clientConfig = {
      space: config.space,
      accessToken: config.accessToken,
      host: config.host
    };

    /**
     * Create a new client
     */
    this.client = contentful.createClient(clientConfig);

    /**
     * Set the locales
     */
    this.locales = locales;

    this.include = typeof params.include !== "undefined" ? params.include : null;
    this.fields = typeof params.fields !== "undefined" ? params.fields : {};

    // if(this.params.fields) this.params.fields = ['id','locale'].concat(this.params.fields);
  }

  /**
   * Get all entries of a specific type
   * @param  {String}  categoryId Content type id
   * @param  {String}  entryId    Id of an entry that should be syced
   * @return {Promise}
   */
  getEntries (categoryId, entryId) {
    return new Promise((fulfill, reject) => {

      let includeDeep = this.include !== null 
        ? this.include : 2;

      let query = {
        content_type: categoryId,
        locale: '*',
        limit: 300,
        include: includeDeep
      };

      if (entryId) {
        query['sys.id'] = entryId;
      }

      this.client
        .getEntries(query)
        .then((entries) => {
          let data = entries.items.map( e => this._extractData(e));
          data = this.locales.map( locale => {
            return data.map( entry => {
              let extractData = this._deepExtract(entry, this.fields, locale)
              extractData['locale'] = locale;
              return extractData;
            });
          });
          data = flatten(data);

          fulfill(data);
        })
        .catch(reject);
    });
  }

  _extractData(entry){
    let newData = {}
    newData['id'] = entry.sys.id;
    newData = merge(newData, entry.fields);

    return newData;
  }

  _deepExtract(entry, fields, locale){

    let newEntry = {};
    newEntry['id'] = entry.id;

    Object.entries(entry).forEach( d => {
      let entryProp = d[0];
      let entryValue= d[1];
      let newD = {};

      if(fields.hasOwnProperty(entryProp)){
        let value = entryValue[locale];

        if(Array.isArray(value)){
          value = value.map( v => this._extractData(v));

          if(Object.keys(fields[entryProp]).length > 0)
            value = value.map( v => this._deepExtract(v, fields[entryProp], locale));

          newEntry[entryProp] = value;
        }else{
          newEntry[entryProp] = value;
        }
      }
    });

    return newEntry;
  }
}

/**
 * Exports
 * @type {Class}
 */
module.exports = Contentful;
