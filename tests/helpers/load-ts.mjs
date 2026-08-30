import {readFile} from 'node:fs/promises'
import {createRequire} from 'node:module'

const require = createRequire(import.meta.url)
const ts = require('typescript')

/**
 * Загружает TypeScript-модуль приложения в тест.
 *
 * Тесты гоняются голым `node --test` без сборки. Раньше такой тест снимал
 * аннотации типов своими регулярками — по одной на каждую функцию, и
 * добавление новой функции роняло тест на SyntaxError, хотя код был верным.
 * Здесь тот же компилятор, что и в сборке, поэтому проверяется именно тот
 * код, который уедет в бандл.
 */
export async function loadTsModule(url) {
    const source = await readFile(url, 'utf8')
    const {outputText} = ts.transpileModule(source, {
        compilerOptions: {module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022},
        fileName: url.pathname,
    })

    const exports = {}
    // Модули app/utils самодостаточны: если понадобится импорт, тест упадёт
    // здесь с внятным сообщением, а не подсунет молча заглушку.
    const requireStub = (name) => {
        throw new Error(`loadTsModule: модуль запросил '${name}' — подключите его в тесте явно`)
    }
    new Function('exports', 'require', 'module', outputText)(exports, requireStub, {exports})
    return exports
}
