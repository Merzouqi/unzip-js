'use strict'

var BlobSlicer = require('blob-slicer')
var ZipFile = require('./zip-file')
var Utils = require('./utils')

module.exports = function unzip (source, callback) {
  if (typeof source === 'string') {
    var xhr = new XMLHttpRequest()
    xhr.addEventListener('readystatechange', function () {
      if (this.readyState === 4) {
        if (this.status === 200) createZipFile(this.response, callback)
        else callback(Utils.E('network error: {0} {1}', this.status, this.statusText))
      }
    })
    try {
      xhr.open('GET', source)
      xhr.responseType = 'blob'
      xhr.send()
    } catch (err) {
      callback(err)
    }
  } else {
    createZipFile(source, callback)
  }
}

function createZipFile (source, callback) {
  try {
    var reader = new BlobSlicer(source)
    Utils.readEOCDRecord(reader, function (err, eocdr) {
      callback(err, err ? null : new ZipFile(reader, eocdr))
    })
  } catch (err) {
    callback(err)
  }
}
