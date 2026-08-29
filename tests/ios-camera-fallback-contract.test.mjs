import assert from 'node:assert/strict'
import {readFile} from 'node:fs/promises'
import test from 'node:test'

const scannerPages = ['scan-qr.vue', 'scan-measurement.vue', 'scan-handover.vue']

for (const page of scannerPages) {
  test(`${page} starts camera directly and allows a retry`, async () => {
    const source = await readFile(new URL(`../app/pages/${page}`, import.meta.url), 'utf8')
    assert.doesNotMatch(source, /QrScannerCtor\.hasCamera\(\)/)
    assert.match(source, /const startScanner = async \(\) =>/)
    assert.match(source, /@click="startScanner"/)
    assert.match(source, /Яндекс Браузер/)
  })
}
