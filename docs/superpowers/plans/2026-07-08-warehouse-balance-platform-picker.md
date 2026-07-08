# Баланс: выбор площадки для сотрудников Офиса — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** сотрудники с площадкой «Офис» могут на экране `/warehouse-balance` выбрать любую площадку (не только свою) и увидеть её остатки.

**Architecture:** новый GET-action `platforms` в существующем GAS-бэкенде склада возвращает уникальные площадки из листа «Склад»; фронт добавляет одну функцию-клиент и переключатель площадки на странице Баланса (шторка со списком, тот же паттерн `ErpActionSheet`, что уже используется в Приёме/Выдаче).

**Tech Stack:** Nuxt 4 (Vue 3 `<script setup>`), Pinia, Google Apps Script (тот же проект `scripts/warehouse-gas-webapp.js`, staging + prod деплои уже существуют).

## Global Constraints

- Правка не касается сотрудников с площадкой ≠ «Офис» — для них поведение `/warehouse-balance` не меняется вообще (никакого нового запроса, никакого переключателя).
- Список площадок — уникальные непустые значения колонки B («Площадка») листа «Склад» (не хардкод, не отдельный справочник).
- По умолчанию при заходе на экран показывается баланс «Офис» (своя площадка сотрудника).
- В проекте нет автоматических тестов (`package.json` — только `build`/`dev`/`generate`); проверка каждого шага — вручную (`npm run build` для типов/сборки фронта, `curl` для нового GAS-action, живой клик в браузере для UI).
- Деплой GAS (push + redeploy staging/prod) — **не для делегирования fresh-subagent**: требует локального `clasp`-логина и уже известных ID существующих проектов/деплоев. Эти шаги в плане помечены явно и выполняются напрямую (тем, кто ведёт сессию), с обычным явным подтверждением перед пушем в прод.

---

### Task 1: Backend — action `platforms`

**Files:**
- Modify: `scripts/warehouse-gas-webapp.js`

**Interfaces:**
- Produces: GET `?action=platforms` → `{ok: true, platforms: string[]}` (отсортированы по алфавиту, без дублей, без пустых значений)

- [ ] **Step 1: Добавить `getPlatforms_()`**

Вставить после `getCategories_()` (после строки `}` на текущей строке 84, перед `function getItemsByCategory_`):

```js
// Склад: A ID | B Площадка | ...
function getPlatforms_() {
    const sheet = getSheet_(STOCK_SHEET)
    const values = sheet.getDataRange().getValues()
    const platforms = []
    const seen = {}
    for (let i = 1; i < values.length; i += 1) {
        const platform = normalizeCell_(values[i][1])
        if (platform && !seen[platform]) {
            seen[platform] = true
            platforms.push(platform)
        }
    }
    platforms.sort((a, b) => a.localeCompare(b, 'ru'))
    return platforms
}
```

- [ ] **Step 2: Добавить обработку action в `doGet`**

В `doGet(e)`, после блока `if (action === 'stock') { ... }` (текущие строки 30-32), добавить:

```js
        if (action === 'platforms') {
            return jsonResponse_({ok: true, platforms: getPlatforms_()})
        }
```

- [ ] **Step 3: Обновить doc-комментарий вверху файла**

В блоке комментария (строки 1-10), после строки `GET  ?action=stock&platform=...&category=...   (category опционален)`, добавить строку:

```
 * GET  ?action=platforms
```

- [ ] **Step 4: Деплой на staging и проверка (выполняется напрямую, не subagent)**

```bash
# staging script id: 1G9ARkH86ixylcKEJDiwnH8hnhxDSriLTE6h-cAAPVM1eJMmF9ZgE4N8w
# staging deployment id: AKfycbxPuXAmiwGsWb2oxlWcDkufddejWXVEMA3TNMh_whHL-1Q-gt-WghMLqYpBf0PfJW4L
mkdir -p /tmp/dealio-warehouse-gas-staging && cd /tmp/dealio-warehouse-gas-staging
echo '{"scriptId":"1G9ARkH86ixylcKEJDiwnH8hnhxDSriLTE6h-cAAPVM1eJMmF9ZgE4N8w"}' > .clasp.json
cp ~/dealio/scripts/warehouse-gas-webapp.js Код.js
npx --yes @google/clasp push --force
npx --yes @google/clasp deploy -i AKfycbxPuXAmiwGsWb2oxlWcDkufddejWXVEMA3TNMh_whHL-1Q-gt-WghMLqYpBf0PfJW4L -d "add platforms action"
```

Expected: push и deploy без ошибок.

- [ ] **Step 5: Ручная проверка через curl**

```bash
curl -sL "https://script.google.com/macros/s/AKfycbxPuXAmiwGsWb2oxlWcDkufddejWXVEMA3TNMh_whHL-1Q-gt-WghMLqYpBf0PfJW4L/exec?action=platforms"
```

Expected: `{"ok":true,"platforms":[...]}` со списком реальных площадок из staging-таблицы (непустой, без дублей).

- [ ] **Step 6: Commit**

```bash
git add scripts/warehouse-gas-webapp.js
git commit -m "feat(warehouse): GAS action platforms — список площадок для Баланса"
```

---

### Task 2: Frontend client — `fetchWarehousePlatforms`

**Files:**
- Modify: `app/utils/warehouse-sheets.ts`

**Interfaces:**
- Consumes: GET `action=platforms` (Task 1)
- Produces: `fetchWarehousePlatforms(): Promise<string[]>` — для использования в Task 3

- [ ] **Step 1: Добавить поле `platforms` в `WarehouseGasResponse`**

Изменить (строки 12-17):

```ts
interface WarehouseGasResponse {
    ok?: boolean
    error?: string
    categories?: string[]
    platforms?: string[]
    items?: string[] | WarehouseStockItem[]
}
```

- [ ] **Step 2: Добавить функцию `fetchWarehousePlatforms`**

Вставить после `fetchWarehouseCategories` (после строки 76):

```ts
export async function fetchWarehousePlatforms(): Promise<string[]> {
    const result = await requestGet({action: 'platforms'})
    if (!result.ok) throw new Error(result.error || 'Не удалось загрузить список площадок')
    return (result.platforms as string[]) ?? []
}
```

- [ ] **Step 3: Проверить сборку**

```bash
cd ~/dealio && npm run build
```

Expected: сборка без ошибок типов.

- [ ] **Step 4: Commit**

```bash
git add app/utils/warehouse-sheets.ts
git commit -m "feat(warehouse): клиент fetchWarehousePlatforms"
```

---

### Task 3: `warehouse-balance.vue` — переключатель площадки

**Files:**
- Modify: `app/pages/warehouse-balance.vue`

**Interfaces:**
- Consumes: `fetchWarehousePlatforms()` (Task 2), `fetchWarehouseStock(platform, category?)` (существует), `ErpActionSheet` (`open`, `busy`, `ariaLabel`, слоты `#label`/`#form`), `ErpListRow` (`selected`, `@click`), `ErpGroupedList`

- [ ] **Step 1: Добавить состояние и вычисляемые свойства**

В `<script setup>`, после строки `const employeeStore = useErpEmployeeStore()`, заменить блок объявления `items`/`isLoading`/`error`/`load` на:

```ts
const isOffice = computed(() => employeeStore.platform === 'Офис')

const selectedPlatform = ref(employeeStore.platform)
const platforms = ref<string[]>([])
const isPickerOpen = ref(false)

const items = ref<WarehouseStockItem[]>([])
const isLoading = ref(true)
const error = ref('')

const load = async () => {
    isLoading.value = true
    error.value = ''
    try {
        items.value = await fetchWarehouseStock(selectedPlatform.value)
    } catch (loadError) {
        error.value = loadError instanceof Error ? loadError.message : 'Ошибка загрузки остатков'
    } finally {
        isLoading.value = false
    }
}

const loadPlatforms = async () => {
    if (!isOffice.value) return
    try {
        platforms.value = await fetchWarehousePlatforms()
    } catch {
        platforms.value = []
    }
}

const selectPlatform = (platform: string) => {
    selectedPlatform.value = platform
    isPickerOpen.value = false
    load()
}

onMounted(() => {
    load()
    loadPlatforms()
})
```

Убрать старый `onMounted(load)` (текущая строка 27) и обновить импорт: добавить `fetchWarehousePlatforms` в импорт из `~/utils/warehouse-sheets` (строка 2).

- [ ] **Step 2: Обновить подзаголовок в шаблоне**

`ErpScreen`'s `#actions` рендерится в шапке справа (рядом с `shiftLink`), а не под заголовком — для строки-переключателя под заголовком нужно тело экрана, не `#actions`. Убрать `:subtitle` у `ErpScreen` и вставить строку в тело.

Заменить (текущие строки 30-49, от `<ErpScreen` до открывающего `<ErpEmptyState v-if="isLoading"`):

```vue
  <ErpScreen
      title="Баланс"
      icon="heroicons:scale"
      :subtitle="`Площадка: ${employeeStore.platform}`"
      :shift-link="{ to: '/warehouse', label: 'Склад', icon: 'heroicons:chevron-left', iconSize: 13 }"
  >
    <ErpEmptyState v-if="isLoading" loading>
```

на:

```vue
  <ErpScreen
      title="Баланс"
      icon="heroicons:scale"
      :shift-link="{ to: '/warehouse', label: 'Склад', icon: 'heroicons:chevron-left', iconSize: 13 }"
  >
    <button
        v-if="isOffice && platforms.length > 0"
        type="button"
        class="wh-bal-platform-toggle"
        @click="isPickerOpen = true"
    >
      Площадка: {{ selectedPlatform }}
      <Icon name="heroicons:chevron-down" size="14"/>
    </button>
    <p v-else class="wh-bal-subtitle">Площадка: {{ selectedPlatform }}</p>

    <ErpEmptyState v-if="isLoading" loading>
```

Условие `platforms.length > 0` покрывает и не-Офис (список никогда не грузится, остаётся `[]`), и Офис с ошибкой/пустым списком загрузки площадок — в обоих случаях подзаголовок остаётся обычным текстом, без стрелки и без возможности открыть шторку.

И убрать `:subtitle` проп у `ErpScreen` полностью (строка 34 из оригинала) — подзаголовок теперь рендерится в теле, а не в шапке, единообразно для обоих случаев (Офис/не-Офис).

- [ ] **Step 3: Обновить текст пустого состояния**

Заменить (текущая строка 47):

```vue
      <p>На вашей площадке нет остатков</p>
```

на:

```vue
      <p>На этой площадке нет остатков</p>
```

- [ ] **Step 4: Добавить шторку выбора площадки**

Перед закрывающим `</ErpScreen>` добавить:

```vue
    <ErpActionSheet
        :open="isPickerOpen"
        :busy="false"
        ariaLabel="Выбор площадки"
        @dismiss="isPickerOpen = false"
    >
      <template #label>Площадка</template>
      <template #form>
        <ErpGroupedList>
          <ErpListRow
              v-for="platform in platforms"
              :key="platform"
              :selected="platform === selectedPlatform"
              @click="selectPlatform(platform)"
          >
            {{ platform }}
          </ErpListRow>
        </ErpGroupedList>
      </template>
    </ErpActionSheet>
```

- [ ] **Step 5: Добавить стили переключателя**

В `<style scoped lang="sass">`, после `.wh-bal-cat` (последний блок), добавить:

```sass
.wh-bal-platform-toggle
  display: inline-flex
  align-items: center
  gap: 4px
  align-self: flex-start
  padding: 0
  border: none
  background: none
  color: var(--color-primary)
  font-size: var(--font-size-sm)
  font-weight: 600
  cursor: pointer

.wh-bal-subtitle
  margin: 0
  font-size: var(--font-size-sm)
  color: var(--color-text-secondary)
```

- [ ] **Step 6: Проверить в браузере**

```bash
cd ~/dealio && npm run dev -- --port 4173
```

Через `localStorage` (`erp-employee-profile` / `erp-profile-version`) залогиниться сотрудником с `platform: 'Офис'`, открыть `/warehouse-balance`:
- Ожидается: строка «Площадка: Офис ⌄» вместо обычного текста, баланс «Офис» загружен по умолчанию.
- Клик по строке → открывается шторка со списком площадок, текущая отмечена галочкой.
- Клик по другой площадке → шторка закрывается, список остатков перезагружается для выбранной площадки, строка обновляется.

Затем повторить со staging-профилем НЕ-Офис (`platform: 'Колпино'` и т.п.):
- Ожидается: обычный текст «Площадка: X», без стрелки, без шторки, без лишнего запроса `action=platforms` (проверить по вкладке Network).

- [ ] **Step 7: Commit**

```bash
git add app/pages/warehouse-balance.vue
git commit -m "feat(warehouse): выбор площадки в Балансе для сотрудников Офиса"
```

---

## После выполнения всех задач

Деплой на прод (push `scripts/warehouse-gas-webapp.js` через `clasp` на прод-скрипт + push фронта в `origin/main`) — только после явного «да» пользователя на каждый шаг, как обычно.
