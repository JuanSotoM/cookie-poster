declare namespace chrome.tabs {
    interface Tab {
        cookieStoreId?: string
    }
}

declare namespace chrome.cookies {
    interface Cookie {
        partitionKey?: {
            topLevelSite?: string
        }
    }

    interface GetAllDetails {
        partitionKey?: {
            topLevelSite?: string
        }
    }
}
