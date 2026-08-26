import assert from 'node:assert/strict'
import {readFile} from 'node:fs/promises'
import test from 'node:test'

const workflow = await readFile(new URL('../.github/workflows/nuxtjs.yml', import.meta.url), 'utf8')

test('deployment artifact contains a non-secret release marker', () => {
  assert.match(workflow, /name: Write release marker/)
  assert.match(workflow, /GITHUB_SHA/)
  assert.match(workflow, /\.output\/public\/release\.txt/)
  assert.match(workflow, /test -f \.output\/public\/release\.txt/)
})
