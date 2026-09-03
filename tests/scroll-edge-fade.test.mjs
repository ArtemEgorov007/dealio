import assert from 'node:assert/strict'
import {readFile} from 'node:fs/promises'
import test from 'node:test'
import {loadTsModule} from './helpers/load-ts.mjs'

const {
  scrollEdgeFadeMask,
  updateScrollEdgeFlags,
} = await loadTsModule(new URL('../app/utils/scroll-edge-fade.ts', import.meta.url))

test('scrollEdgeFadeMask fades only overflowing sides', () => {
  assert.equal(scrollEdgeFadeMask(false, false).maskImage, 'none')
  assert.match(scrollEdgeFadeMask(false, true).maskImage, /calc\(100% - 14px\)/)
  assert.match(scrollEdgeFadeMask(true, false).maskImage, /^linear-gradient\(to right, transparent/)
  assert.match(scrollEdgeFadeMask(true, true).maskImage, /transparent.*calc\(100%/)
})

test('updateScrollEdgeFlags uses edge threshold', () => {
  const el = {
    scrollWidth: 400,
    clientWidth: 200,
    scrollLeft: 0,
  }
  assert.deepEqual(updateScrollEdgeFlags(el), {canScrollLeft: false, canScrollRight: true})
  el.scrollLeft = 100
  assert.deepEqual(updateScrollEdgeFlags(el), {canScrollLeft: true, canScrollRight: true})
  el.scrollLeft = 200
  assert.deepEqual(updateScrollEdgeFlags(el), {canScrollLeft: true, canScrollRight: false})
})

test('queue tabs and tabbar share scroll-edge fade approach', async () => {
  const queue = await readFile(new URL('../app/pages/supply-requests-queue.vue', import.meta.url), 'utf8')
  const tabbar = await readFile(new URL('../app/components/erp/ErpTabBar.vue', import.meta.url), 'utf8')
  const segmented = await readFile(new URL('../app/components/ui/segmented-control/SegmentedControl.vue', import.meta.url), 'utf8')

  assert.match(queue, /useScrollEdgeFade/)
  assert.match(queue, /maskStyle/)
  assert.match(tabbar, /useScrollEdgeFade/)
  assert.match(segmented, /useScrollEdgeFade/)
})
