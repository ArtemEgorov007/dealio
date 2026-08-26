import assert from 'node:assert/strict'
import {readFile} from 'node:fs/promises'
import test from 'node:test'

const packageJson = JSON.parse(await readFile(new URL('../package.json', import.meta.url), 'utf8'))
const workflow = await readFile(new URL('../.github/workflows/nuxtjs.yml', import.meta.url), 'utf8')

test('release workflow runs the complete verification gate before generating the deploy artifact', () => {
    assert.equal(typeof packageJson.scripts.verify, 'string')
    assert.match(packageJson.scripts.verify, /test:contract/)
    assert.match(packageJson.scripts.verify, /typecheck/)
    assert.match(packageJson.scripts.verify, /lint/)

    const verifyIndex = workflow.indexOf('run: npm run verify')
    const generateIndex = workflow.indexOf('run: npm run generate')

    assert.ok(verifyIndex >= 0, 'workflow must run npm run verify')
    assert.ok(generateIndex >= 0, 'workflow must generate the artifact')
    assert.ok(verifyIndex < generateIndex, 'verification must finish before artifact generation')
})
