import getAllCookies from "../shared/get-all-cookies.js"

/**
 * Update icon badge counter on active page
 */
const updateBadgeCounter = async (): Promise<void> => {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true })

    if (!tab) {
        return
    }

    const { id: tabId, url: urlString } = tab
    if (typeof tabId !== "number") {
        return
    }

    if (!urlString) {
        chrome.action.setBadgeText({ tabId, text: "" })
        return
    }

    const url = new URL(urlString)

    const cookies = await getAllCookies({
        url: url.href,
        partitionKey: { topLevelSite: url.origin }
    })

    const text = cookies.length.toFixed()

    chrome.action.setBadgeText({ tabId, text })
}

chrome.cookies.onChanged.addListener(() => {
    void updateBadgeCounter()
})
chrome.tabs.onUpdated.addListener(() => {
    void updateBadgeCounter()
})
chrome.tabs.onActivated.addListener(() => {
    void updateBadgeCounter()
})
chrome.windows.onFocusChanged.addListener(() => {
    void updateBadgeCounter()
})
