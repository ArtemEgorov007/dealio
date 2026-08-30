import assert from 'node:assert/strict'
import {readFile} from 'node:fs/promises'
import test from 'node:test'

// Тесты гоняются голым node --test без сборки, поэтому снимаем TS-аннотации
// с исходника и исполняем его. Так проверяется тот же код, что уедет в бандл.
const source = await readFile(new URL('../app/utils/error-message.ts', import.meta.url), 'utf8')
const runnable = source
    .replace('export function errorMessage(error: unknown, fallback: string): string', 'function errorMessage(error, fallback)')
    .replace('(error as {message: unknown}).message', 'error.message')

const {errorMessage} = new Function(`${runnable}; return {errorMessage}`)()

test('берёт message из Error', () => {
    assert.equal(errorMessage(new Error('Нет связи с сервером'), 'Запасной'), 'Нет связи с сервером')
})

test('принимает ошибку, отклонённую строкой', () => {
    assert.equal(errorMessage('Unknown action', 'Запасной'), 'Unknown action')
})

test('принимает объект с полем message (JSON-ответ, не Error)', () => {
    assert.equal(errorMessage({message: 'Неверный логин или пароль'}, 'Запасной'), 'Неверный логин или пароль')
})

test('возвращает запасной текст, когда достать нечего', () => {
    for (const value of [null, undefined, 0, {}, [], new Error(''), new Error('   '), '', '   ', {message: ''}]) {
        assert.equal(errorMessage(value, 'Запасной'), 'Запасной')
    }
})

test('не подменяет осмысленный текст запасным', () => {
    // Регрессия: раньше строковая ошибка от GAS отбрасывалась и пользователь
    // видел общий текст вместо конкретной причины.
    assert.notEqual(errorMessage('Нет доступа к управлению кадрами', 'Ошибка'), 'Ошибка')
})
