'use strict'

exports.readEOCDRecord = readEOCDRecord
exports.readUInt64LE = readUInt64LE
exports.E = E

function readEOCDRecord (reader, callback) {
  var fixedFieldsSize = 22
  var maxRecordSize = fixedFieldsSize + 0xffff

  reader.read(-maxRecordSize, function (err, buf) {
    if (err) return callback(err)

    if (buf.length < fixedFieldsSize) {
      return callback(
        E('expected at least 22 bytes for End Of Central Directory got {0}', buf.length)
      )
    }

    var eocdr = {}
    // end of central dir signature    4 bytes  (0x06054b50)
    var offset = buf.lastIndexOf('PK\x05\x06')
    if (offset === -1) return callback(E('End Of Central Directory not found'))
    var recordBuffer = buf.slice(offset)
    // number of this disk             2 bytes
    if (recordBuffer.readUInt16LE(4) !== 0) {
      return callback(E('spanned zip files are not supported'))
    }
    // number of the disk with the
    // start of the central directory  2 bytes
    // total number of entries in the
    // central directory on this disk  2 bytes
    // total number of entries in
    // the central directory           2 bytes
    eocdr.entryCount = recordBuffer.readUInt16LE(10)
    // size of the central directory   4 bytes
    eocdr.cdSize = recordBuffer.readUInt32LE(12)
    // offset of start of central
    // directory with respect to
    // the starting disk number        4 bytes
    eocdr.cdOffset = recordBuffer.readUInt32LE(16)
    // .ZIP file comment length        2 bytes
    var commentLength = recordBuffer.readUInt16LE(20)
    // .ZIP file comment       (variable size)
    eocdr.comment = recordBuffer.toString('utf-8', 22, 22 + commentLength)
    console.assert(
      eocdr.comment.length === commentLength,
      'expected ' + commentLength + ' bytes for zip file comment got ' + eocdr.comment.length
    )

    if (
      eocdr.entryCount === 0xffff ||
      eocdr.cdSize === 0xffffffff ||
      eocdr.cdOffset === 0xffffffff
    ) {
      readEOCD64Record(reader, offset, function (err, eocd64r) {
        eocd64r.comment = eocdr.comment
        callback(err, eocd64r)
      })
    } else callback(null, eocdr)
  })
}

function readEOCD64Record (reader, eocdOffset, callback) {
  var fixedFieldsSize = 56

  readEOCDLocator(reader, eocdOffset, function (err, eocd64Offset) {
    if (err) return callback(err)

    reader.read(eocd64Offset, eocd64Offset + fixedFieldsSize, function (err, buf) {
      if (err) return callback(err)

      if (buf.length < fixedFieldsSize) {
        return callback(
          E('expected at least 56 bytes for Zip64 End Of Central Directory got {0}', buf.length)
        )
      }

      var eocd64r = {}
      // zip64 end of central dir
      // signature                       4 bytes  (0x06064b50)
      if (buf.readUInt32LE(0) !== 0x06064b50) {
        return callback(E('Zip64 End Of Central Directory not found'))
      }
      // size of zip64 end of central
      // directory record                8 bytes
      // version made by                 2 bytes
      // version needed to extract       2 bytes
      // number of this disk             4 bytes
      // number of the disk with the
      // start of the central directory  4 bytes
      // total number of entries in the
      // central directory on this disk  8 bytes
      // total number of entries in the
      // central directory               8 bytes
      eocd64r.entryCount = readUInt64LE(buf, 32)
      // size of the central directory   8 bytes
      eocd64r.cdSize = readUInt64LE(buf, 40)
      // offset of start of central
      // directory with respect to
      // the starting disk number        8 bytes
      eocd64r.cdOffset = readUInt64LE(buf, 48)
      // zip64 extensible data sector    (variable size)

      callback(null, eocd64r)
    })
  })
}

function readEOCDLocator (reader, eocdOffset, callback) {
  var locatorRecordSize = 20

  reader.read(eocdOffset - locatorRecordSize, eocdOffset, function (err, buf) {
    if (err) return callback(err)

    if (buf.length < locatorRecordSize) {
      return callback(
        E(
          'expected at least 20 bytes for Zip64 End Of Central Directory Locator got {0}',
          buf.length
        )
      )
    }

    // zip64 end of central dir locator
    // signature                       4 bytes  (0x07064b50)
    if (buf.readUInt32LE(0) !== 0x07064b50) {
      return callback(E('Zip64 End Of Central Directory Locator not found'))
    }
    // number of the disk with the
    // start of the zip64 end of
    // central directory               4 bytes
    // relative offset of the zip64
    // end of central directory record 8 bytes
    var eocd64Offset = readUInt64LE(buf, 8)
    // total number of disks           4 bytes
    if (buf.readUInt32LE(16) !== 1) {
      return callback(E('spanned zip files are not supported'))
    }

    callback(null, eocd64Offset)
  })
}

function readUInt64LE (buffer, offset) {
  return buffer.readUInt32LE(offset) + (buffer.readUInt32LE(offset + 4) * 0x100000000)
}

function E (message) {
  var args = arguments
  return new Error(
    message.replace(/{(\d+)}/g, function (match, p) { return args[+p + 1] || match })
  )
}
