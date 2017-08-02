/**
 * Contentful configuration and library
 */
const contentful = require('contentful');
const merge = require('deepmerge');

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
  constructor (config, locales, params) {
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

    this.params = params;

    if(this.params.fields) this.params.fields = ['id','locale'].concat(this.params.fields);
      else this.params.fields = ['id','locale'];
  }

  /**
   * Get all entries of a specific type
   * @param  {String}  categoryId Content type id
   * @param  {String}  entryId    Id of an entry that should be syced
   * @return {Promise}
   */
  getEntries (categoryId, entryId) {
    return new Promise((fulfill, reject) => {

      let includeDeep = typeof this.params.include !== "undefined" 
        ? this.params.include : 2;

      let query = {
        content_type: categoryId,
        locale: '*',
        include: includeDeep
      };

      if (entryId) {
        query['sys.id'] = entryId;
      }

      this.client
        .getEntries(query)
        .then((entries) => {
          let data = entries.items.map(this._getLocalizedEntries.bind(this));
          data = this._filterData(data, this.params.fields, this.params.relations);
          data = flatten(data);

          fulfill(data);
        })
        .catch(reject);
    });
  }

  _getLocalizedEntries (entry) {
    let localizedEntries = [];
    entry = this._cleanEntry(entry);

    if (!this.locales) {
      return this._mergeFields(entry, entry.fields);
    }

    // Generate entries for all locales
    this.locales.forEach((locale) => {
      let newEntry = entry;
      let fields = newEntry.fields;

      fields = this._getFieldsForLocale(fields, locale);
      fields = this._getFields(fields, locale);

      newEntry = this._mergeFields(newEntry, fields);
      delete newEntry.fields;

      newEntry = this._cleanMore(newEntry, locale);
      newEntry = this._cleanLocales(newEntry, locale);

      localizedEntries.push(newEntry);
    });

    return localizedEntries;
  }

  /**
   * Clean entries a bit more (to reduce file size)
   * @param  {Object} entry  Entry to clean
   * @param  {Array}  locale Locales
   * @return {Object}        Cleaned entry
   */
  _cleanMore (entry, locale) {
    let newEntry = {};

    for (let key in entry) {
      if (typeof entry[key] === 'object') {
        if (entry[key].sys) {

          newEntry[key] = this._cleanEntry(entry[key]);
        } else if (entry[key].elements && entry[key].elements.constructor === Array) {
          newEntry[key] = {};
          newEntry[key].elements = entry[key].elements.map((entry) => {
            entry = this._cleanEntry(entry, true);

            return this._getFieldsForLocale(entry.fields, locale);
          });

          delete entry[key].elements;

          newEntry[key] = merge(entry[key], newEntry[key]);
        } else {
          newEntry[key] = this._cleanMore(entry[key], locale);
        }
      }
    }

    return merge(entry, newEntry);
  }

  _filterData(data, fields = [], relations = {}){
    if(Object.keys(relations).length > 0){
      data = data.map((e) => {
        let data = e[0];
        Object.keys(relations).forEach((relation) =>{
          let relationData = e[0][relation];
          if(typeof relationData !== "undefined"){
            if(fields.indexOf(relation) === -1) fields.push(relation);
            relationData = Object.entries(relationData).map((singleRelation) => {
              let data = {};
              relations[relation].forEach((relationField) => {
                data[relationField.split(".").join('_')] = this._navigateObject(singleRelation[1], relationField);
              });

              return data;
            })

            e[0][relation] = this._clearObject(relationData);
          }
        });

        return e;
      });
    }

    // console.log(data);

    if(fields.length > 0){
      data = data.map((e) => {
        let fieldsData = e[0];

        if(typeof fieldsData !== "undefined"){

          Object.keys(fieldsData).map((f) => {
            if(fields.indexOf(f) === -1){
              delete fieldsData[f];
            }
          });

          return fieldsData;
        }
      });
    }

    // console.log(data);

    return data;
  }

  _clearObject(o){
    Object.keys(o).forEach((key) => (o[key] == null) && delete o[key]);

    return o;
  }

  _navigateObject(o, s) {
      s = s.replace(/\[(\w+)\]/g, '.$1'); // convert indexes to properties
      s = s.replace(/^\./, '');           // strip a leading dot
      var a = s.split('.');
      for (var i = 0, n = a.length; i < n; ++i) {
          var k = a[i];
          if (k in o) {
              o = o[k];
          } else {
              return;
          }
      }
      return o;
  }

  /**
   * Clean fields to only transport locale information
   * @param  {Object} entry  Entry to localize
   * @param  {Array}  locale Locales
   * @return {Object}        Localized entry
   */
  _cleanLocales (entry, locale) {
    for (let key in entry) {
      if (typeof entry[key] === 'object') {
        if (entry[key].fields) {
          entry[key] = this._getFieldsForLocale(entry[key].fields, locale);
        }
      }
    }

    return entry;
  }

  /**
   * Clean a provided entry of its metadata
   * @param  {Object}  entry Entry to be cleaned
   * @param  {Boolean} full  Should all meta data be removed
   * @return {Object}        Cleaned entry
   */
  _cleanEntry (entry, full = false) {
    let newEntry = {};
    let contentType = false;

    newEntry.fields = {};

    if (!entry) {
      return newEntry;
    }

    if (entry.sys) {

      if (entry.sys.contentType) {
        contentType = entry.sys.contentType.sys.id;
      }

      if (full) {
        delete entry.sys;
      } else {
        delete entry.sys.space;
        delete entry.sys.contentType;
        delete entry.sys.type;
        delete entry.sys.revision;

        newEntry = entry.sys;
      }
    }

    newEntry.fields = entry.fields;

    if (typeof newEntry.fields === 'object' && !newEntry.fields.contentType) {
      newEntry.fields.contentType = {};
      this.locales.forEach((locale) => {
        locale.forEach((string) => {
          newEntry.fields.contentType[string] = contentType;
        });
      });
    }

    return newEntry;
  }

  /**
   * Merge two fieldsets
   * @param  {Object} entry  Fieldset one
   * @param  {Object} fields Fieldset two
   * @return {Obejct}        New fieldsets
   */
  _mergeFields (entry = {}, fields = {}) {
    entry = merge(entry, fields);
    delete entry.fields;

    return entry;
  }

  /**
   * Get complete field entries with siblings
   * @param  {Object} fields All fields
   * @param  {String} key    Name of a field that should be found
   * @param  {Array}  locale Locales to search for
   * @return {Object}        Converted object
   */
  _getFieldEntry (fields, key, locale) {
    if (!fields[key]) {
      return fields;
    }

    if (fields[key].constructor === Array) {
      fields[key] = fields[key].map((entry) => {
        if (!(entry instanceof Object)) {
          return entry;
        }

        entry = this._cleanEntry(entry, true);
        entry = this._mergeFields(entry, entry.fields);
        entry = this._getFields(entry, locale);
        entry = this._getFieldsForLocale(entry, locale);

        return entry;
      });
    }

    return fields;
  }

  /**
   * Iterate through all fields of an entry
   * @param  {Object} fields All fields of a given entry
   * @param  {Array}  locale Locales to search for
   * @return {Object}        New entry
   */
  _getFields (fields, locale) {
    for (var key in fields) {
      if (fields.hasOwnProperty(key)) {
        fields = this._getFieldEntry(fields, key, locale);
      }
    }

    return fields;
  }

  /**
   * Get all fields for a configured locale
   * @param  {Object}  fields   All fields in all availabe languages
   * @param  {Array}   locale   Locale configuration
   * @return {Object}           Localized fieldset
   */
  _getFieldsForLocale (fields, locale) {
    let entry = {};

    for (let key in fields) {
      entry[key] = this._getLocaleString(fields[key], locale);
    }

    entry.locale = locale[0];

    return entry;
  }

  /**
   * Get local string
   * @param  {Mixed}        field  Field to find content in
   * @param  {Array|String} locale Locales to check
   * @return {Mixed}               Localized field
   */
  _getLocaleString (field, locale) {
    let localizedField;

    if (locale.constructor !== Array) {
      locale = [locale];
    }

    locale.forEach((currentLocale) => {
      if (field[currentLocale] && !localizedField) {
        localizedField = field[currentLocale];
      }
    });

    return localizedField;
  }
}

/**
 * Exports
 * @type {Class}
 */
module.exports = Contentful;
