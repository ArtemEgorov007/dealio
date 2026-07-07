<script setup lang="ts">
definePageMeta({layout: 'erp'})
useSeoMeta({title: 'Склад | ERP'})

const router = useRouter()
</script>

<template>
  <ErpScreen title="Склад" icon="heroicons:archive-box">
    <div class="wh-hub-actions">
      <ErpGroupedList>
        <ErpListRow chevron @click="router.push('/warehouse-receive')">
          <template #leading>
            <span class="wh-hub-ic wh-hub-ic--receive">
              <Icon name="heroicons:arrow-down-tray" size="20"/>
            </span>
          </template>
          <span class="wh-hub-row">
            <span class="wh-hub-row__title">Приём</span>
            <span class="wh-hub-row__sub">Оприходовать товар на склад</span>
          </span>
        </ErpListRow>
      </ErpGroupedList>
      <ErpGroupedList>
        <ErpListRow chevron @click="router.push('/warehouse-issue')">
          <template #leading>
            <span class="wh-hub-ic wh-hub-ic--issue">
              <Icon name="heroicons:arrow-up-tray" size="20"/>
            </span>
          </template>
          <span class="wh-hub-row">
            <span class="wh-hub-row__title">Выдача</span>
            <span class="wh-hub-row__sub">Выдать товар со склада</span>
          </span>
        </ErpListRow>
      </ErpGroupedList>
      <ErpGroupedList>
        <ErpListRow chevron @click="router.push('/warehouse-balance')">
          <template #leading>
            <span class="wh-hub-ic wh-hub-ic--balance">
              <Icon name="heroicons:scale" size="20"/>
            </span>
          </template>
          <span class="wh-hub-row">
            <span class="wh-hub-row__title">Баланс</span>
            <span class="wh-hub-row__sub">Остатки по вашей площадке</span>
          </span>
        </ErpListRow>
      </ErpGroupedList>
    </div>
  </ErpScreen>
</template>

<style scoped lang="sass">
.wh-hub-actions
  display: flex
  flex-direction: column
  gap: 12px

.wh-hub-ic
  display: flex
  align-items: center
  justify-content: center
  width: 36px
  height: 36px
  border-radius: 11px

  &--receive
    color: #1E8A4C
    background-color: rgba(30, 138, 76, 0.12)

  &--issue
    color: #C97A0C
    background-color: rgba(230, 145, 15, 0.14)

  &--balance
    color: #7C5CE0
    background-color: rgba(120, 90, 220, 0.12)

.wh-hub-row
  display: flex
  flex-direction: column
  gap: 1px

.wh-hub-row__title
  font-size: 15.5px
  font-weight: 650

.wh-hub-row__sub
  font-size: 12.5px
  color: var(--color-text-secondary)
</style>
