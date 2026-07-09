// Общий (модульный, не per-component) флаг: страница может явно попросить
// спрятать глобальный таб-бар/рельс (см. badges.vue — поиск по бирке) без
// добавления слушателей фокуса на весь document. Только те экраны, что
// сами это включают, влияют на видимость бара.
const isTabBarHidden = ref(false)

export function useTabBarHidden() {
    return isTabBarHidden
}
