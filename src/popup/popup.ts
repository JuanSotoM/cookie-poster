import getAllCookies from "../shared/get-all-cookies.js"
import { domainMatches, getStoredProfiles } from "../shared/post-profiles.js"
import type { PostProfile } from "../shared/post-profiles.js"

const requiredElement = <T extends Element>(selector: string): T => {
    const element = document.querySelector<T>(selector)
    if (!element) {
        throw new Error(`Elemento no encontrado: ${selector}`)
    }

    return element
}

const postButton = requiredElement<HTMLButtonElement>("#postCookie")
const status = requiredElement<HTMLParagraphElement>("#status")
const emptyState = requiredElement<HTMLParagraphElement>("#emptyState")
const profilesContainer = requiredElement<HTMLDivElement>("#profilesContainer")
const openOptionsButton = requiredElement<HTMLButtonElement>("#openOptions")

let profiles: PostProfile[] = []

const setStatus = (text: string, isError = false): void => {
    status.textContent = text
    status.classList.toggle("error", isError)
}

/**
 * @returns {Promise<URL>}
 */
const getActiveTabUrl = async (): Promise<URL> => {
    const [activeTab] = await chrome.tabs.query({
        active: true,
        currentWindow: true
    })
    if (!activeTab?.url) {
        throw new Error("No active tab URL available")
    }
    return new URL(activeTab.url)
}

const isHttpUrl = (url: URL): boolean => url.protocol === "http:" || url.protocol === "https:"

const getMatchedProfileForActiveTab = async (): Promise<{
    matchedProfile: PostProfile | null
    activeTabUrl: URL
}> => {
    const activeTabUrl = await getActiveTabUrl()
    if (!isHttpUrl(activeTabUrl)) {
        return { matchedProfile: null, activeTabUrl }
    }

    const matchedProfile = profiles.find(profile => domainMatches(activeTabUrl.hostname, profile.domain))

    return { matchedProfile: matchedProfile ?? null, activeTabUrl }
}

const buildCookieKey = (cookie: chrome.cookies.Cookie): string =>
    [cookie.name, cookie.domain, cookie.path, cookie.storeId, cookie.partitionKey?.topLevelSite || ""].join("|")

const dedupeCookies = (cookieBatches: chrome.cookies.Cookie[][]): chrome.cookies.Cookie[] => {
    const map = new Map<string, chrome.cookies.Cookie>()

    cookieBatches.flat().forEach(cookie => {
        map.set(buildCookieKey(cookie), cookie)
    })

    return [...map.values()]
}

const findOpenTabForDomain = async (domain: string): Promise<URL | null> => {
    const tabs = await chrome.tabs.query({})
    for (const tab of tabs) {
        if (!tab.url) {
            continue
        }

        try {
            const url = new URL(tab.url)
            if (!isHttpUrl(url)) {
                continue
            }

            if (domainMatches(url.hostname, domain)) {
                return url
            }
        } catch {
            // Ignore invalid or privileged tab URLs.
        }
    }

    return null
}

const getCookiesForProfile = async (
    profile: PostProfile,
    activeTabUrl: URL | null = null
): Promise<chrome.cookies.Cookie[]> => {
    if (profile.domain === "*") {
        if (!activeTabUrl) {
            throw new Error("No se puede usar dominio * sin tab activa valida")
        }

        return getAllCookies({
            url: activeTabUrl.href,
            partitionKey: { topLevelSite: activeTabUrl.origin }
        })
    }

    const cookieBatches = [await getAllCookies({ domain: profile.domain })]
    let matchedTabUrl = null

    if (activeTabUrl && domainMatches(activeTabUrl.hostname, profile.domain)) {
        matchedTabUrl = activeTabUrl
    } else {
        matchedTabUrl = await findOpenTabForDomain(profile.domain)
    }

    // When a matching tab exists, this includes partitioned cookies for that top-level site.
    if (matchedTabUrl) {
        cookieBatches.push(
            await getAllCookies({
                url: matchedTabUrl.href,
                partitionKey: { topLevelSite: matchedTabUrl.origin }
            })
        )
    }

    return dedupeCookies(cookieBatches)
}

const getHeaders = (postToken: string): Record<string, string> => {
    const headers: Record<string, string> = { "Content-Type": "application/json" }
    const token = String(postToken || "").trim()

    if (token) {
        headers.Authorization = token.startsWith("Bearer ") ? token : `Bearer ${token}`
    }

    return headers
}

const executeProfilePost = async (profile: PostProfile, activeTabUrl: URL | null = null): Promise<void> => {
    const cookies = await getCookiesForProfile(profile, activeTabUrl)
    if (cookies.length === 0) {
        throw new Error("No hay cookies para enviar")
    }

    const response = await fetch(profile.postUrl, {
        method: "POST",
        headers: getHeaders(profile.postToken),
        body: JSON.stringify(cookies)
    })

    if (!response.ok) {
        throw new Error(`Request failed with status ${response.status}`)
    }
}

const setSendingState = (
    isSending: boolean,
    { includeMainButton = true }: { includeMainButton?: boolean } = {}
): void => {
    if (includeMainButton) {
        postButton.disabled = isSending
    }

    openOptionsButton.disabled = isSending
    profilesContainer.querySelectorAll<HTMLButtonElement>("button").forEach(button => {
        button.disabled = isSending
    })
}

const withSendingState = async (
    callback: () => Promise<void>,
    options?: { includeMainButton?: boolean }
): Promise<void> => {
    setSendingState(true, options)
    try {
        await callback()
    } finally {
        setSendingState(false, options)
    }
}

const renderProfiles = (): void => {
    profilesContainer.replaceChildren()
    emptyState.hidden = profiles.length > 0

    profiles.forEach(profile => {
        const button = document.createElement("button")
        button.type = "button"
        button.className = "profile-btn"
        button.textContent = profile.name
        button.title = `${profile.domain} -> ${profile.postUrl}`

        button.addEventListener("click", async () => {
            await withSendingState(async () => {
                setStatus(`Enviando ${profile.name}...`)
                await executeProfilePost(profile)
                setStatus(`Enviado con ${profile.name}.`)
            }).catch((error: unknown) => {
                console.error(error)
                setStatus(`Error con ${profile.name}.`, true)
            })
        })

        profilesContainer.append(button)
    })
}

const setButtonState = (label: string, disabled: boolean): void => {
    postButton.textContent = label
    postButton.disabled = disabled
}

const resetButton = (): void => {
    setButtonState("Enviar por tab actual", false)
}

const syncMainButtonAvailability = async (): Promise<void> => {
    try {
        const { matchedProfile } = await getMatchedProfileForActiveTab()
        if (!matchedProfile) {
            setButtonState("Sin perfil para esta tab", true)
            return
        }

        setButtonState("Enviar por tab actual", false)
    } catch {
        setButtonState("Sin tab disponible", true)
    }
}

postButton.addEventListener("click", async () => {
    await withSendingState(
        async () => {
            setButtonState("Buscando perfil...", true)

            const { matchedProfile, activeTabUrl } = await getMatchedProfileForActiveTab()

            if (!matchedProfile) {
                throw new Error("No existe perfil para la tab actual")
            }

            setButtonState("Enviando...", true)
            setStatus(`Usando ${matchedProfile.name}.`)
            await executeProfilePost(matchedProfile, activeTabUrl)
            setButtonState("Enviado", true)
            setStatus(`Enviado con ${matchedProfile.name}.`)
            setTimeout(() => {
                resetButton()
                void syncMainButtonAvailability()
            }, 1300)
        },
        { includeMainButton: false }
    ).catch((error: unknown) => {
        console.error(error)
        const message = error instanceof Error ? error.message : "No se pudo enviar"
        setButtonState("Error", true)
        setStatus(message, true)
        setTimeout(() => {
            resetButton()
            void syncMainButtonAvailability()
        }, 2000)
    })
})

openOptionsButton.addEventListener("click", () => {
    chrome.runtime.openOptionsPage()
})

const init = async () => {
    profiles = await getStoredProfiles()
    renderProfiles()
    await syncMainButtonAvailability()
}

init().catch((error: unknown) => {
    console.error(error)
    setStatus("No se pudieron cargar los perfiles.", true)
})
