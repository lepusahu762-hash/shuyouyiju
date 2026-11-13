// New scripts use installed Playwright's browser, or an explicit local override.
// No developer-specific Chrome path or saved account is required by this helper.
const {chromium}=require(process.env.PLAYWRIGHT_MODULE_PATH||'playwright');
exports.launch=()=>chromium.launch({headless:process.env.HEADED!=='1',...(process.env.BROWSER_EXECUTABLE?{executablePath:process.env.BROWSER_EXECUTABLE}:{})});
