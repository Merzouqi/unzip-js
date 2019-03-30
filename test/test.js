var test = require('tape')
var unzip = require('../src/')
var testCases = require('./test-cases')

testCases.success.forEach(function (testCase) {
  test(testCase.name, { timeout: 500 }, function (t) {
    var checkCrc = testCase.name.indexOf('crc32') !== -1
    unzip(testCase.source, function (err, zipFile) {
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
          zipFile.readEntryData(entries[i], checkCrc, function (err, readStram) {
            t.error(err)

            var data = ''
            readStram.on('data', function (chunk) { data += chunk })
            readStram.on('error', function (err) { t.end(err) })
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
    unzip(testCase.source, function (err, zipFile) {
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

        zipFile.readEntryData(entries[0], true, function (err, readStream) {
          if (err) {
            t.strictEqual(err.message, testCase.expectedErrorMessage)
            t.end()
            return
          }

          readStream
            .resume()
            .on('error', function (err) {
              t.strictEqual(err.message, testCase.expectedErrorMessage)
              t.end()
            })
        })
      })
    })
  })
})
