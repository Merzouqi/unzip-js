var dir = '/test/zip-files/'

exports.success = [
  'cp437.zip',
  'crc32-check-passes.zip',
  'deflate.zip',
  'directories.zip',
  'empty.zip',
  'info-zip-unicode-extra-field.zip',
  'store.zip',
  'unicode.zip',
  'zip-comment-missing-bytes.zip',
  'zip-comment.zip',
  'zip64-extended-information-extra-field.zip',
  'zip64.zip'
].map(function (e) {
  var testCase = {
    name: e.replace(/.zip$/, ''),
    source: dir + e,
    expectedComment: ''
  }

  if (e === 'zip-comment.zip') testCase.expectedComment = 'This is a comment'
  else if (e === 'zip-comment-missing-bytes.zip') testCase.expectedComment = 'This is a commen'

  var expectedContents = [
    {
      name: 'file.txt',
      data: 'Hello World\r\n',
      comment: '',
      date: new Date(2019, 2, 26, 17, 1, 32)
    }
  ]
  switch (e) {
    case 'cp437.zip':
      expectedContents[0].name = 'éèçàù.txt'
      break
    case 'unicode.zip':
    case 'info-zip-unicode-extra-field.zip':
      expectedContents[0].name = '文件.txt'
      if (e === 'info-zip-unicode-extra-field.zip') expectedContents[0].comment = '这是一个评论'
      break
    case 'empty.zip':
    case 'zip-comment.zip':
    case 'zip-comment-missing-bytes.zip':
      expectedContents.pop()
      break
    case 'directories.zip':
      expectedContents.push(
        {
          name: 'folder/',
          data: '',
          comment: '',
          date: new Date(2019, 2, 27, 0, 56, 46)
        },
        {
          name: 'folder/file2.txt',
          data: 'another file',
          comment: '',
          date: new Date(2019, 2, 26, 19, 54, 56)
        }
      )
      break
  }
  testCase.expectedContents = expectedContents

  return testCase
}).concat({
  name: 'unzip from Blob',
  source: new Blob([Buffer.from('UEsFBgAAAAAAAAAAAAAAAAAAAAAAAA==', 'base64').toString()]),
  expectedContents: [],
  expectedComment: ''
})

exports.failure = [
  [
    'central-header-invalid-signature.zip',
    'invalide Central File Header signature'
  ],
  [
    'central-header-no-enough-data-for-fixed-fields.zip',
    'expected at least 46 bytes for Central File Header got 45'
  ],
  [
    'central-header-no-enough-data-for-variable-fields.zip',
    'expected at least 45 bytes for variable fields in Central File Header got 44'
  ],
  [
    'crc32-check-fails.zip',
    'corrupted file: crc check fails'
  ],
  [
    'encrypted.zip',
    'encrypted files are not supported'
  ],
  [
    'eocd-disk-number-not-0.zip',
    'spanned zip files are not supported'
  ],
  [
    'eocd-invalid-signature.zip',
    'End Of Central Directory not found'
  ],
  [
    'eocd-no-enough-data.zip',
    'expected at least 22 bytes for End Of Central Directory got 21'
  ],
  [
    'eocd64-invalid-signature.zip',
    'Zip64 End Of Central Directory not found'
  ],
  [
    'eocd64-locator-disk-count-not-1.zip',
    'spanned zip files are not supported'
  ],
  [
    'eocd64-locator-invalid-signature.zip',
    'Zip64 End Of Central Directory Locator not found'
  ],
  [
    'local-header-invalid-signature.zip',
    'invalid Local File Header signature'
  ],
  [
    'missing-compressed-size-in-zip64-eief.zip',
    'invalid Zip64 Extended Information Extra Field: compressedSize not found'
  ],
  [
    'missing-entries.zip',
    'expected 2 entries got 1'
  ],
  [
    'missing-local-header-offset-in-zip64-eief.zip',
    'invalid Zip64 Extended Information Extra Field: localHeaderOffset not found'
  ],
  [
    'missing-origin-size-in-zip64-eief.zip',
    'invalid Zip64 Extended Information Extra Field: uncompressedSize not found'
  ],
  [
    'missing-zip64-eief.zip',
    'Zip64 Extended Information Extra Field not found'
  ],
  [
    'not-found.zip',
    'network error: 404 Not Found'
  ],
  [
    'unsupported-compression-method-deflate64.zip',
    'compression method is not supported'
  ]
].map(function (e) {
  return {
    name: e[0].replace(/.zip$/, ''),
    source: dir + e[0],
    expectedErrorMessage: e[1]
  }
}).concat({
  name: 'invalid argument',
  source: {},
  expectedErrorMessage: '"blob" argument must be an instance of Blob or File'
})
