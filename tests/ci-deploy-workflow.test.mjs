import assert from 'node:assert/strict'
import {readFile} from 'node:fs/promises'
import test from 'node:test'

const workflow = await readFile(new URL('../.github/workflows/nuxtjs.yml', import.meta.url), 'utf8')

test('deploy workflow targets hosting environments instead of GitHub Pages', () => {
    assert.match(workflow, /workflow_dispatch:/)
    assert.match(workflow, /target:/)
    assert.match(workflow, /staging/)
    assert.match(workflow, /production/)
    assert.match(workflow, /upload-artifact@v4/)
    assert.match(workflow, /download-artifact@v4/)
    assert.match(workflow, /SFTP_KNOWN_HOSTS/)
    assert.match(workflow, /StrictHostKeyChecking=yes/)
    assert.match(workflow, /UserKnownHostsFile="\$HOME\/\.ssh\/known_hosts"/)
    assert.match(workflow, /sshpass -e scp/)
    assert.match(workflow, /-P "\$SFTP_PORT"/)
    assert.match(workflow, /\.\/site\/\./)
    assert.match(workflow, /environment:/)
    assert.match(workflow, /group: erp-deploy-\$\{\{ needs\.resolve-target\.outputs\.environment \}\}/)
    assert.match(workflow, /github\.event_name == 'workflow_dispatch' && inputs\.target \|\| 'staging'/)
    assert.doesNotMatch(workflow, /deploy-pages|upload-pages-artifact|configure-pages|FTP-Deploy-Action|NUXT_PUBLIC_CRM_GAS_URL|rsync[^\n]*--delete|mirror[^\n]*--delete|sftp[^\n]*\brm\b/)
})
