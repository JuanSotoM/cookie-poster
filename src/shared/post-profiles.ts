export const DEFAULT_POST_URL = "http://localhost:3000"
export const PROFILES_STORAGE_KEY = "postProfiles"

export interface PostProfile {
    id: string
    name: string
    domain: string
    postUrl: string
    postToken: string
}

type PostProfileInput = Partial<PostProfile> & Record<string, unknown>

const LEGACY_POST_URL_KEY = "postUrl"
const LEGACY_POST_TOKEN_KEY = "postToken"

const isObject = (value: unknown): value is Record<string, unknown> => typeof value === "object" && value !== null

export const normalizeDomain = (domainInput: unknown): string => {
    const raw = String(domainInput || "")
        .trim()
        .toLowerCase()
    if (!raw) {
        throw new Error("Dominio vacio")
    }

    if (raw === "*") {
        return raw
    }

    const value = raw.startsWith("http://") || raw.startsWith("https://") ? raw : `https://${raw}`
    const { hostname } = new URL(value)

    if (!hostname) {
        throw new Error("Dominio invalido")
    }

    return hostname.replace(/^\.+/, "")
}

export const domainMatches = (hostnameInput: unknown, domainInput: unknown): boolean => {
    const hostname = String(hostnameInput || "")
        .trim()
        .toLowerCase()
    const domain = String(domainInput || "")
        .trim()
        .toLowerCase()

    if (!hostname || !domain) {
        return false
    }

    if (domain === "*") {
        return true
    }

    return hostname === domain || hostname.endsWith(`.${domain}`)
}

const sanitizeProfile = (profile: unknown): PostProfile | null => {
    if (!isObject(profile)) {
        return null
    }

    const candidate = profile as PostProfileInput

    const name = String(candidate.name || "").trim()
    const domain = normalizeDomain(candidate.domain)
    const postUrl = String(candidate.postUrl || "").trim() || DEFAULT_POST_URL
    const postToken = String(candidate.postToken || "").trim()

    if (!name) {
        throw new Error("Nombre vacio")
    }

    new URL(postUrl)

    return {
        id: String(candidate.id || crypto.randomUUID()),
        name,
        domain,
        postUrl,
        postToken
    }
}

const migrateLegacyProfile = async (): Promise<PostProfile[]> => {
    const stored = await chrome.storage.local.get([LEGACY_POST_URL_KEY, LEGACY_POST_TOKEN_KEY])

    const postUrl = stored[LEGACY_POST_URL_KEY]
    const postToken = stored[LEGACY_POST_TOKEN_KEY]

    const legacyUrl = String(postUrl || "").trim()
    const legacyToken = String(postToken || "").trim()
    if (!legacyUrl && !legacyToken) {
        return []
    }

    const migratedProfile = sanitizeProfile({
        id: crypto.randomUUID(),
        name: "Configuracion anterior",
        domain: "*",
        postUrl: legacyUrl || DEFAULT_POST_URL,
        postToken: legacyToken
    })

    if (!migratedProfile) {
        return []
    }

    await chrome.storage.local.set({ [PROFILES_STORAGE_KEY]: [migratedProfile] })
    return [migratedProfile]
}

export const getStoredProfiles = async (): Promise<PostProfile[]> => {
    const stored = await chrome.storage.local.get([PROFILES_STORAGE_KEY])
    const rawProfiles = stored[PROFILES_STORAGE_KEY]

    if (!Array.isArray(rawProfiles)) {
        return migrateLegacyProfile()
    }

    const profiles = rawProfiles
        .map(profile => {
            try {
                return sanitizeProfile(profile)
            } catch {
                return null
            }
        })
        .filter((profile): profile is PostProfile => Boolean(profile))

    if (profiles.length !== rawProfiles.length) {
        await chrome.storage.local.set({ [PROFILES_STORAGE_KEY]: profiles })
    }

    return profiles
}

export const saveProfiles = async (profiles: PostProfile[]): Promise<PostProfile[]> => {
    const sanitized = profiles.map(profile => sanitizeProfile(profile))
    if (sanitized.some(profile => profile === null)) {
        throw new Error("Perfil invalido")
    }

    const typedSanitized = sanitized as PostProfile[]

    await chrome.storage.local.set({ [PROFILES_STORAGE_KEY]: typedSanitized })
    return typedSanitized
}

export const createProfileFromFields = ({ name, domain, postUrl, postToken }: Omit<PostProfile, "id">): PostProfile => {
    const profile = sanitizeProfile({
        id: crypto.randomUUID(),
        name,
        domain,
        postUrl,
        postToken
    })

    if (!profile) {
        throw new Error("No se pudo crear el perfil")
    }

    return profile
}
