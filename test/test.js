var test = require('tape')
var Unzip = require('../src/')
var testCases = require('./test-cases')

var location = document.location
var baseUrl = location.protocol + '//' + location.host + '/test/zip-files/'

testCases.success.forEach(function (testCase) {
  test(testCase.name, { timeout: 500 }, function (t) {
    Unzip(baseUrl + testCase.file, function (err, zipFile) {
      t.error(err)
      t.strictEqual(zipFile.entryCount, testCase.expectedContents.length)
      t.strictEqual(zipFile.comment, testCase.expectedComment)

      zipFile.readEntries(function (err, entries) {
        t.error(err)

        var actuelContents = []
        function iterate (i) {
          var actuelEntry = {
            name: entries[i].name,
            date: entries[i].lastModDateTime,
            comment: entries[i].comment
          }
          zipFile.readEntryData(entries[i], false, function (err, readStram) {
            t.error(err)

            var data = ''
            readStram.on('data', function (chunk) { data += chunk })
            readStram.on('end', function () {
              actuelEntry.data = data
              actuelContents.push(actuelEntry)
              if (++i < entries.length) iterate(i)
              else {
                t.deepEquals(actuelContents, testCase.expectedContents)
                t.end()
              }
            })
          })
        }

        entries.length ? iterate(0) : t.end()
      })
    })
  })
})

testCases.failure.forEach(function (testCase) {
  test(testCase.name, { timeout: 500 }, function (t) {
    Unzip(baseUrl + testCase.file, function (err, zipFile) {
      if (err) {
        t.strictEqual(err.message, testCase.expectedErrorMessage)
        t.end()
        return
      }

      zipFile.readEntries(function (err, entries) {
        if (err) {
          t.strictEqual(err.message, testCase.expectedErrorMessage)
          t.end()
          return
        }

        zipFile.readEntryData(entries[0], false, function (err, readStream) {
          t.strictEqual(err.message, testCase.expectedErrorMessage)
          t.end()
        })
      })
    })
  })
})

test('unzip from Blob', function (t) {
  var emptyZip = Buffer.from('UEsFBgAAAAAAAAAAAAAAAAAAAAAAAA==', 'base64')
  Unzip(new Blob([emptyZip]), function (err, zipFile) {
    t.error(err)
    t.ok(zipFile)
    t.end()
  })
})

test('invalid arguments', function (t) {
  Unzip({}, function (err, zipFile) {
    t.strictEqual(err.message, 'source must be Blob, File or string')
    t.notOk(zipFile)
    t.end()
  })
})

test('crc32', { timeout: 500 }, function (t) {
  Unzip(baseUrl + 'store.zip', function (err, zipFile) {
    t.error(err)
    zipFile.readEntries(function (err, entries) {
      t.error(err)
      zipFile.readEntryData(entries[0], true, function (err, readStream) {
        t.error(err)
        readStream
          .resume()
          .on('error', function () { t.end(new Error('should not be called')) })
          .on('end', function () { t.end() })
      })
    })
  })
})
