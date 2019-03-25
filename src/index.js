var BlobSlicer = require('blob-slicer')
var ZipFile = require('./zip-file')
var Utils = require('./utils')
var E = Utils.E
var readEOCDRecord = Utils.readEOCDRecord

module.exports = function load (source, callback) {
  if (typeof source === 'string') {
    var xhr = new XMLHttpRequest()
    xhr.addEventListener('readystatechange', function () {
      if (this.readyState === 4) {
        if (this.status === 200) {
          var reader = new BlobSlicer(this.response)
          readEOCDRecord(reader, function (err, eocdr) {
            if (err) return callback(err)
            callback(null, new ZipFile(reader, eocdr))
          })
        } else {
          callback(E('network error: {0} {1}', this.status, this.statusText))
        }
      }
    })
    xhr.open('GET', source)
    xhr.responseType = 'blob'
    xhr.send()
  } else {
    try {
      var reader = new BlobSlicer(source)
      readEOCDRecord(reader, function (err, eocdr) {
        if (err) return callback(err)
        callback(null, new ZipFile(reader, eocdr))
      })
    } catch (err) {
      callback(E('source must be Blob, File or string'))
    }
  }
}
