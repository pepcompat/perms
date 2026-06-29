// afterSign hook — notarize + staple .app บน macOS
// ข้ามอัตโนมัติถ้าไม่ใช่ mac หรือไม่มี Apple credentials (เช่น build ในเครื่องแบบ unsigned)
const { notarize } = require('@electron/notarize')
const { execFileSync } = require('child_process')

exports.default = async function notarizing(context) {
  const { electronPlatformName, appOutDir } = context
  if (electronPlatformName !== 'darwin') return

  const { APPLE_ID, APPLE_APP_SPECIFIC_PASSWORD, APPLE_TEAM_ID } = process.env
  if (!APPLE_ID || !APPLE_APP_SPECIFIC_PASSWORD || !APPLE_TEAM_ID) {
    console.log('  • skip notarize — ไม่มี APPLE_* env (build แบบ unsigned)')
    return
  }

  const appName = context.packager.appInfo.productFilename
  const appPath = `${appOutDir}/${appName}.app`

  console.log(`  • notarizing ${appName}.app …`)
  await notarize({
    tool: 'notarytool',
    appPath,
    appleId: APPLE_ID,
    appleIdPassword: APPLE_APP_SPECIFIC_PASSWORD,
    teamId: APPLE_TEAM_ID
  })

  // staple ticket ลงตัวแอป เพื่อให้ Gatekeeper ตรวจได้แบบ offline
  console.log('  • stapling …')
  execFileSync('xcrun', ['stapler', 'staple', appPath], { stdio: 'inherit' })
}
