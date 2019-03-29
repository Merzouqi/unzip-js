'use strict'

var crc32 = require('buffer-crc32')
var createInflateRaw = require('zlib').createInflateRaw
var Transform = require('readable-stream').Transform
var Utils = require('./utils')
var E = Utils.E
var readUInt64LE = Utils.readUInt64LE
var cp437ToUnicode = Utils.cp437ToUnicode

module.exports = ZipFile

function ZipFile (reader, eocdr) {
  this.entries = []
  this.entryCount = eocdr.entryCount
  this.comment = eocdr.comment
  this._cdSize = eocdr.cdSize
  this._cdOffset = eocdr.cdOffset
  this._reader = reader
}

ZipFile.prototype.readEntries = function (callback) {
  var fixedFieldsSize = 46
  var self = this

  callback = (function (fn) {
    var called = false
    return function (err, entries) {
      if (called) return
      called = true
      fn(err, entries)
    }
  })(callback)

  var readStream = this._reader.createReadStream({
    start: this._cdOffset,
    end: (this._cdOffset + this._cdSize)
  })
  readStream.on('error', callback)
  readStream.on('end', function () {
    callback(
      self.entries.length === self.entryCount
        ? null
        : E('expected {0} entries got {1}', self.entryCount, self.entries.length),
      self.entries
    )
  })
  readStream.on('readable', onReadable)

  function destroyAndDrain (error) {
    readStream.destroy(error)
    readStream.read()
  }

  function onReadable () {
    while (this.readableLength > 0) {
      if (this.readableLength < fixedFieldsSize) {
        if (this.ended) {
          return destroyAndDrain(
            E('expected at least 46 bytes for Central File Header got {0}', this.readableLength)
          )
        }
        break
      }
      var fixedFieldsBuffer = this.read(fixedFieldsSize)
      var entry = new Entry()

      // central file header signature   4 bytes  (0x02014b50)
      if (fixedFieldsBuffer.readUInt32LE(0) !== 0x02014b50) {
        return destroyAndDrain(E('invalide Central File Header signature'))
      }
      // version made by                 2 bytes
      entry.versionMadeBy = fixedFieldsBuffer.readUInt16LE(4)
      // version needed to extract       2 bytes
      entry.versionNeededToExtract = fixedFieldsBuffer.readUInt16LE(6)
      // general purpose bit flag        2 bytes
      entry.generalPurposeBitFlag = fixedFieldsBuffer.readUInt16LE(8)
      // compression method              2 bytes
      entry.compressionMethod = fixedFieldsBuffer.readUInt16LE(10)
      // last mod file time              2 bytes
      entry.lastModTime = fixedFieldsBuffer.readUInt16LE(12)
      // last mod file date              2 bytes
      entry.lastModDate = fixedFieldsBuffer.readUInt16LE(14)
      // crc-32                          4 bytes
      entry.crc32 = fixedFieldsBuffer.readUInt32LE(16)
      // compressed size                 4 bytes
      entry.compressedSize = fixedFieldsBuffer.readUInt32LE(20)
      // uncompressed size               4 bytes
      entry.uncompressedSize = fixedFieldsBuffer.readUInt32LE(24)
      // file name length                2 bytes
      var nameLength = fixedFieldsBuffer.readUInt16LE(28)
      // extra field length              2 bytes
      var extraFieldsLength = fixedFieldsBuffer.readUInt16LE(30)
      // file comment length             2 bytes
      var commentLength = fixedFieldsBuffer.readUInt16LE(32)
      // disk number start               2 bytes
      // internal file attributes        2 bytes
      entry.internalAttributes = fixedFieldsBuffer.readUInt16LE(36)
      // external file attributes        4 bytes
      entry.externalAttributes = fixedFieldsBuffer.readUInt32LE(38)
      // relative offset of local header 4 bytes
      entry.localHeaderOffset = fixedFieldsBuffer.readUInt32LE(42)

      var variableFieldsSize = nameLength + extraFieldsLength + commentLength
      if (this.readableLength < variableFieldsSize) {
        if (this.ended) {
          return destroyAndDrain(
            E(
              'expected at least {0} bytes for variable fields in Central File Header got {1}',
              variableFieldsSize,
              this.readableLength
            )
          )
        }
        this.unshift(fixedFieldsBuffer)
        break
      }
      var variableFieldsBuffer = this.read(variableFieldsSize)

      // file name (variable size)
      entry.name = variableFieldsBuffer.slice(0, nameLength)
      // extra field (variable size)
      var extraFieldsBuffer = variableFieldsBuffer.slice(
        nameLength,
        nameLength + extraFieldsLength
      )
      for (var i = 0, len = extraFieldsBuffer.length - 3; i < len;) {
        var headerId = extraFieldsBuffer.readUInt16LE(i)
        var dataSize = extraFieldsBuffer.readUInt16LE(i += 2)
        var data = Buffer.from(extraFieldsBuffer.slice(i += 2, i += dataSize))
        entry.extraFields.push({ headerId: headerId, dataSize: dataSize, data: data })
      }
      // comment (variable size)
      entry.comment = variableFieldsBuffer.slice(nameLength + extraFieldsLength)

      // handle encoding
      var isUTF8 = (entry.generalPurposeBitFlag & 0x800) === 0x800
      if (isUTF8) {
        entry.name = entry.name.toString()
        entry.comment = entry.comment.toString()
      } else {
        entry.name = cp437ToUnicode(entry.name)
        entry.comment = cp437ToUnicode(entry.comment)
      }
      // Info-ZIP Unicode Path/Comment Extra Field
      ;['name', 'comment'].forEach(function (field) {
        var headerId
        var oldData
        if (field === 'name') {
          headerId = 0x7075
          oldData = variableFieldsBuffer.slice(0, nameLength)
        } else {
          headerId = 0x6375
          oldData = variableFieldsBuffer.slice(nameLength + extraFieldsLength)
        }
        var infoZipUEFs = entry.extraFields.filter(function (ef) {
          return ef.headerId === headerId
        })

        infoZipUEFs.forEach(function (infoZipUEF) {
          var data = infoZipUEF.data
          if (data.length > 6) {
            var versionRecognized = data.readUInt8(0) === 1
            var crcCheckPassed = crc32.unsigned(oldData) === data.readUInt32LE(1)
            var str = data.toString('utf8', 5)
            if (versionRecognized && crcCheckPassed && str.length > 0) entry[field] = str
          }
        })
      })

      // handle zip64 format
      if (
        entry.compressedSize === 0xffffffff ||
        entry.uncompressedSize === 0xffffffff ||
        entry.localHeaderOffset === 0xffffffff
      ) {
        var zip64EIEF = entry.extraFields.filter(function (ef) {
          return ef.headerId === 0x0001
        })[0]
        if (zip64EIEF) {
          var offset = 0
          var fields = ['uncompressedSize', 'compressedSize', 'localHeaderOffset']
          for (var j in fields) {
            var field = fields[j]
            if (entry[field] === 0xffffffff) {
              try {
                entry[field] = readUInt64LE(zip64EIEF.data, offset)
                offset += 8
              } catch (err) {
                return destroyAndDrain(
                  E('invalid Zip64 Extended Information Extra Field: {0} not found', field)
                )
              }
            }
          }
        } else {
          return destroyAndDrain(E('Zip64 Extended Information Extra Field not found'))
        }
      }

      self.entries.push(entry)
    }
    this.read(0)
  }
}

ZipFile.prototype.readEntryData = function (entry, checkCrc, callback) {
  if (entry.encrypted) {
    callback(E('encrypted files are not supported'))
    return
  }
  if (entry.compressionMethod !== 0 && entry.compressionMethod !== 8) {
    callback(E('compression method is not supported'))
    return
  }

  var fixedFieldsSize = 30
  var self = this
  this._reader.read(
    entry.localHeaderOffset,
    entry.localHeaderOffset + fixedFieldsSize,
    function (err, buf) {
      if (err) return callback(err)

      if (buf.length < fixedFieldsSize) {
        return callback(
          E('expected at least 30 bytes for Local File Header got {1}', buf.length)
        )
      }

      // local file header signature     4 bytes  (0x04034b50)
      if (buf.readUInt32LE(0) !== 0x04034b50) {
        return callback(E('invalid Local File Header signature'))
      }
      // version needed to extract       2 bytes
      // general purpose bit flag        2 bytes
      // compression method              2 bytes
      // last mod file time              2 bytes
      // last mod file date              2 bytes
      // crc-32                          4 bytes
      // compressed size                 4 bytes
      // uncompressed size               4 bytes
      // file name length                2 bytes
      var nameLength = buf.readUInt16LE(26)
      // extra field length              2 bytes
      var extraFieldLength = buf.readUInt16LE(28)

      var dataStart = entry.localHeaderOffset + fixedFieldsSize + nameLength + extraFieldLength
      var readStream = self._reader.createReadStream({
        start: dataStart,
        end: dataStart + entry.compressedSize
      })

      var outStream = readStream

      if (entry.compressionMethod === 8) {
        var inflate = createInflateRaw()
        outStream = outStream
          .on('error', function (err) { inflate.destroy(err) })
          .pipe(inflate)
      }

      if (checkCrc) {
        var partialCrc
        var crcTransform = new Transform({
          transform: function (chunk, encoding, callback) {
            partialCrc = crc32(chunk, partialCrc)
            callback(null, chunk)
          },
          flush: function (callback) {
            var finalCrc = partialCrc.readUInt32BE(0)
            callback(finalCrc === entry.crc32 ? null : E('corrupted file: crc check fails'))
          }
        })
        outStream = outStream
          .on('error', function (err) { crcTransform.destroy(err) })
          .pipe(crcTransform)
      }

      callback(null, outStream)
    }
  )
}

function Entry () {
  this.extraFields = []
}

Object.defineProperties(Entry.prototype, {
  encrypted: {
    get: function () { return (this.generalPurposeBitFlag & 0x0001) === 0x0001 }
  },
  lastModDateTime: {
    get: function () {
      return new Date(
        (this.lastModDate >> 9 & 0x7f) + 1980, // year
        (this.lastModDate >> 5 & 0xf) - 1, // month
        this.lastModDate & 0x1f, // day
        (this.lastModTime >> 11) & 0x1f, // hours
        (this.lastModTime >> 5) & 0x3f, // minutes
        (this.lastModTime & 0x1f) * 2 // seconds
      )
    }
  }
})
