# unzip-js

[![Build Status][travis-image]][travis-url]
[![Coverage Status][coveralls-image]][coveralls-url]
[![npm][npm-image]][npm-url]
[![JavaScript Style Guide][standard-image]][standard-url]


[travis-image]: https://travis-ci.org/Merzouqi/unzip-js.svg?branch=master
[travis-url]: https://travis-ci.org/Merzouqi/unzip-js
[coveralls-image]: https://coveralls.io/repos/github/Merzouqi/unzip-js/badge.svg?branch=master
[coveralls-url]: https://coveralls.io/github/Merzouqi/unzip-js?branch=master
[npm-image]: https://img.shields.io/npm/v/unzip-js.svg
[npm-url]: https://npmjs.org/package/unzip-js
[standard-image]: https://img.shields.io/badge/code_style-standard-brightgreen.svg
[standard-url]: https://standardjs.com

unzip .ZIP files in the browser

## Install

```
npm install unzip-js
```

## Usage

```javascript
var unzip = require('unzip-js')

unzip(getBlobOrFileSomehow(), function (err, zipFile) {
  if (err) {
    return console.error(err)
  }

  zipFile.readEntries(function (err, entries) {
    if (err) {
      return console.error(err)
    }

    entries.forEach(function (entry) {
      zipFile.readEntryData(entry, false, function (err, readStream) {
        if (err) {
          return console.error(err)
        }

        readStream.on('data', function (chunk) { ... })
        readStream.on('error', function (err) { ... })
        readStream.on('end', function () { ... })
      })
    })
  })
})
```

## API

**unzip(source, callback)**
* ```source```: must be a ```Blob```, ```File``` or ```string``` that represents a valid url.
* ```callback```: ```function(err: Error, zipFile: ZipFile)```

**Class: ZipFile**

**zipFile.readEntries(callback)**\
Read metadata of all entries (parse Central Dircotroy Records).
* ```callback```: ```function(err: Error, entries: Entry[])```

**zipFile.readEntryData(entry, checkCrc, callback)**\
Read data of a specific entry.
* ```entry```: ```Entry```
* ```callback```: ```function(err: Error, readStream: ReadStream)```
* ```checkCrc```: ```boolean``` if ```true```, performs a crc32 check on the extracted data.

**Class: Entry**\
A representation of a zip entry (a Central Dircotroy Record).

see the zip spec section [4.3.12  Central directory structure][spec-url] for more informations.

[spec-url]: https://pkware.cachefly.net/webdocs/APPNOTE/APPNOTE-6.3.5.TXT

**entry.versionMadeBy**: ```number```\
**entry.versionNeededToExtract**: ```number```\
**entry.generalPurposeBitFlag**: ```number```\
**entry.compressionMethod**: ```number```\
**entry.lastModTime**: ```number```\
**entry.lastModDate**: ```number```\
**entry.crc32**: ```number```\
**entry.compressedSize**: ```number```\
**entry.uncompressedSize**: ```number```\
**entry.internalAttributes**: ```number```\
**entry.externalAttributes**: ```number```\
**entry.localHeaderOffset**: ```number```\
**entry.name**: ```string```\
**entry.commment**: ```string```\
**entry.extraFields**: ```object[]```
* ```object```: ```{ headerId: number, dataSize: number, data: Buffer }```


**entry.encrypted**: ```boolean```\
retrun ```true``` if the data is encrypted.

**entry.lastModTimeDate**: ```Date```\
Return a ```Date``` object representation of ```entry.lastModTime``` and ```entry.lastModDate```.

**Class: ReadStream**\
see [blob-slicer](https://github.com/Merzouqi/blob-slicer#api).

## Limitations

Only files stored with no compression or compressed with deflate algorithm are supported,
```zipFile.readEntryData callback``` will recieve an error for any entry with compression methode
other than 0 (stored) or 8 (deflated), or if the file is encrypted.

Zip files spanned across multiple removable media are not supported.

## Supported browsers

Firefox | Chrome | Internet Explorer | Edge | Safari | ios | Android
------- | ------ | ----------------- | ---- | ------ | --- | --------
YES | YES | YES (10 - 11) | YES | YES| YES | YES

## License

MIT. Copyright (c) Merzouqi.
