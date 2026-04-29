/**
 * Get all cookies that match the given criteria.
 * @param {chrome.cookies.GetAllDetails} details
 * @returns {Promise<chrome.cookies.Cookie[]>}
 */
export default async function getAllCookies(details: chrome.cookies.GetAllDetails): Promise<chrome.cookies.Cookie[]> {
    details.storeId ??= await getCurrentCookieStoreId()
    const { partitionKey, ...detailsWithoutPartitionKey } = details

    // Error handling for browsers that do not support partitionKey, such as chrome < 119.
    // `chrome.cookies.getAll()` returns Promise but cannot directly catch() chain.
    const cookiesWithPartitionKey: chrome.cookies.Cookie[] = partitionKey
        ? await Promise.resolve()
              .then(() => chrome.cookies.getAll(details))
              .catch(() => [] as chrome.cookies.Cookie[])
        : []

    const cookies = await chrome.cookies.getAll(detailsWithoutPartitionKey as chrome.cookies.GetAllDetails)

    return [...cookies, ...cookiesWithPartitionKey]
}

/**
 * Get the current cookie store ID.
 * @returns {Promise<string | undefined>}
 */
const getCurrentCookieStoreId = async (): Promise<string | undefined> => {
    // If the extension is in split incognito mode, return undefined to choose the default store.
    if (chrome.runtime.getManifest().incognito === "split") {
        return undefined
    }

    // Firefox supports the `tab.cookieStoreId` property.
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true })
    if (!tab) {
        return undefined
    }

    if (tab.cookieStoreId) {
        return tab.cookieStoreId
    }

    if (typeof tab.id !== "number") {
        return undefined
    }

    const tabId = tab.id

    // Chrome does not support the `tab.cookieStoreId` property.
    const stores = await chrome.cookies.getAllCookieStores()
    return stores.find(store => store.tabIds.includes(tabId))?.id
}
