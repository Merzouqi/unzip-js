'use strict'

exports.readEOCDRecord = readEOCDRecord
exports.readUInt64LE = readUInt64LE
exports.E = E
exports.cp437ToUnicode = cp437ToUnicode

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
        if (eocd64r) eocd64r.comment = eocdr.comment
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
    message.replace(/{(\d+)}/g, function (match, p) {
      var r = args[+p + 1]
      return r === undefined ? match : r
    })
  )
}

function cp437ToUnicode (buffer) {
  var table = [
    0x0000, 0x263A, 0x263B, 0x2665, 0x2666, 0x2663, 0x2660, 0x2022, 0x25D8, 0x25CB, 0x25D9,
    0x2642, 0x2640, 0x266A, 0x266B, 0x263C, 0x25BA, 0x25C4, 0x2195, 0x203C, 0x00B6, 0x00A7,
    0x25AC, 0x21A8, 0x2191, 0x2193, 0x2192, 0x2190, 0x221F, 0x2194, 0x25B2, 0x25BC, 0x0020,
    0x0021, 0x0022, 0x0023, 0x0024, 0x0025, 0x0026, 0x0027, 0x0028, 0x0029, 0x002A, 0x002B,
    0x002C, 0x002D, 0x002E, 0x002F, 0x0030, 0x0031, 0x0032, 0x0033, 0x0034, 0x0035, 0x0036,
    0x0037, 0x0038, 0x0039, 0x003A, 0x003B, 0x003C, 0x003D, 0x003E, 0x003F, 0x0040, 0x0041,
    0x0042, 0x0043, 0x0044, 0x0045, 0x0046, 0x0047, 0x0048, 0x0049, 0x004A, 0x004B, 0x004C,
    0x004D, 0x004E, 0x004F, 0x0050, 0x0051, 0x0052, 0x0053, 0x0054, 0x0055, 0x0056, 0x0057,
    0x0058, 0x0059, 0x005A, 0x005B, 0x005C, 0x005D, 0x005E, 0x005F, 0x0060, 0x0061, 0x0062,
    0x0063, 0x0064, 0x0065, 0x0066, 0x0067, 0x0068, 0x0069, 0x006A, 0x006B, 0x006C, 0x006D,
    0x006E, 0x006F, 0x0070, 0x0071, 0x0072, 0x0073, 0x0074, 0x0075, 0x0076, 0x0077, 0x0078,
    0x0079, 0x007A, 0x007B, 0x007C, 0x007D, 0x007E, 0x2302, 0x00C7, 0x00FC, 0x00E9, 0x00E2,
    0x00E4, 0x00E0, 0x00E5, 0x00E7, 0x00EA, 0x00EB, 0x00E8, 0x00EF, 0x00EE, 0x00EC, 0x00C4,
    0x00C5, 0x00C9, 0x00E6, 0x00C6, 0x00F4, 0x00F6, 0x00F2, 0x00FB, 0x00F9, 0x00FF, 0x00D6,
    0x00DC, 0x00A2, 0x00A3, 0x00A5, 0x20A7, 0x0192, 0x00E1, 0x00ED, 0x00F3, 0x00FA, 0x00F1,
    0x00D1, 0x00AA, 0x00BA, 0x00BF, 0x2310, 0x00AC, 0x00BD, 0x00BC, 0x00A1, 0x00AB, 0x00BB,
    0x2591, 0x2592, 0x2593, 0x2502, 0x2524, 0x2561, 0x2562, 0x2556, 0x2555, 0x2563, 0x2551,
    0x2557, 0x255D, 0x255C, 0x255B, 0x2510, 0x2514, 0x2534, 0x252C, 0x251C, 0x2500, 0x253C,
    0x255E, 0x255F, 0x255A, 0x2554, 0x2569, 0x2566, 0x2560, 0x2550, 0x256C, 0x2567, 0x2568,
    0x2564, 0x2565, 0x2559, 0x2558, 0x2552, 0x2553, 0x256B, 0x256A, 0x2518, 0x250C, 0x2588,
    0x2584, 0x258C, 0x2590, 0x2580, 0x03B1, 0x00DF, 0x0393, 0x03C0, 0x03A3, 0x03C3, 0x00B5,
    0x03C4, 0x03A6, 0x0398, 0x03A9, 0x03B4, 0x221E, 0x03C6, 0x03B5, 0x2229, 0x2261, 0x00B1,
    0x2265, 0x2264, 0x2320, 0x2321, 0x00F7, 0x2248, 0x00B0, 0x2219, 0x00B7, 0x221A, 0x207F,
    0x00B2, 0x25A0, 0x00A0
  ]

  var convertedBuffer = new Array(buffer.length)
  var len = convertedBuffer.length
  var i
  for (i = 0; i < len; i++) {
    convertedBuffer[i] = table[buffer[i]]
  }

  var MAX_CHUNK_SIZE = 32767
  var str = ''
  for (i = 0; i < len; i += MAX_CHUNK_SIZE) {
    str += String.fromCharCode.apply(null, convertedBuffer.slice(i, i + MAX_CHUNK_SIZE))
  }
  return str
}
