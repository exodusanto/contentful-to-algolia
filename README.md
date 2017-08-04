# Transmit data from Contentful to Algolia

The application syncs content between Contentful and Algolia.
You can configure the service to run with Drafts (Preview API) from Contentful
and put it in different indexes in Algolia. The prefix of each index can be
configured.

## Install the module

    npm install --save contentful-to-algolia

## Documentation

The main method of Sync:
- `sync(String <types>, String <indexName>, Object <params> [Function <callback>])`
  Sync multiple content types from Contentful to Algolia

## Usage

    // Require module
    const ContentfulToAlgolia = require('contentful-to-algolia');

    // Generate new instance
    const Sync = new ContentfulToAlgolia(Object <config>);

    // Sync data
    Sync.sync(
      String <type>,
      String <indexName>,
      Object <params>
      [Function <callback>]
    );
    // Example params
    {
      include: 1 // Contentful deeplink
      fields:{
        title: {},
        image:{
          url:{}
        }
      }
    }

## Note

Algolia indexes need to have the following attributes searchable:

* `id`
* `locale`

## Example config

You can find a sample configuration in [config.sample.js](./config.sample.js).

## Todo

* Remove elements which are not used anymore
* Use Contentful's Syncronisation API
* Tests

## License

This project is under MIT license, 2017, ⓒ Hans Christian Reinl.
Read more in [LICENSE](./LICENSE).
