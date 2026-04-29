import { DEFAULT_POST_URL, createProfileFromFields, getStoredProfiles, saveProfiles } from "../shared/post-profiles.js"
import type { PostProfile } from "../shared/post-profiles.js"

const requiredElement = <T extends Element>(selector: string): T => {
    const element = document.querySelector<T>(selector)
    if (!element) {
        throw new Error(`Elemento no encontrado: ${selector}`)
    }

    return element
}

const form = requiredElement<HTMLFormElement>("#settingsForm")
const submitButton = form.querySelector<HTMLButtonElement>("button[type='submit']")
if (!submitButton) {
    throw new Error("No se encontro boton submit en el formulario")
}

const addProfileButton = requiredElement<HTMLButtonElement>("#addProfileButton")
const cancelButton = requiredElement<HTMLButtonElement>("#cancelButton")
const profileNameInput = requiredElement<HTMLInputElement>("#profileName")
const profileDomainInput = requiredElement<HTMLInputElement>("#profileDomain")
const postUrlInput = requiredElement<HTMLInputElement>("#postUrl")
const postTokenInput = requiredElement<HTMLInputElement>("#postToken")
const profilesList = requiredElement<HTMLUListElement>("#profilesList")
const emptyState = requiredElement<HTMLParagraphElement>("#emptyState")
const status = requiredElement<HTMLParagraphElement>("#status")

let profiles: PostProfile[] = []
let editingProfileId: string | null = null

const setStatus = (text: string, isError = false): void => {
    status.textContent = text
    status.classList.toggle("error", isError)
}

const clearForm = (): void => {
    form.reset()
    postUrlInput.value = DEFAULT_POST_URL
}

const setEditMode = (profileId: string | null = null): void => {
    editingProfileId = profileId
    submitButton.textContent = editingProfileId ? "Guardar cambios" : "Guardar perfil"
}

const showForm = (show: boolean): void => {
    form.classList.toggle("hidden", !show)
    addProfileButton.disabled = show
    if (show) {
        profileNameInput.focus()
    }
}

const renderProfiles = (): void => {
    profilesList.replaceChildren()
    emptyState.hidden = profiles.length > 0

    profiles.forEach(profile => {
        const item = document.createElement("li")
        item.className = "profile-item"

        const info = document.createElement("div")
        info.className = "profile-info"
        const title = document.createElement("strong")
        title.textContent = profile.name

        const domain = document.createElement("span")
        domain.textContent = `Dominio: ${profile.domain}`

        const endpoint = document.createElement("span")
        endpoint.textContent = `POST: ${profile.postUrl}`

        info.append(title, domain, endpoint)

        const actions = document.createElement("div")
        actions.className = "profile-actions"

        const editButton = document.createElement("button")
        editButton.type = "button"
        editButton.className = "edit"
        editButton.textContent = "Editar"
        editButton.addEventListener("click", () => {
            setEditMode(profile.id)
            profileNameInput.value = profile.name
            profileDomainInput.value = profile.domain
            postUrlInput.value = profile.postUrl
            postTokenInput.value = profile.postToken
            showForm(true)
            setStatus(`Editando perfil: ${profile.name}`)
        })

        const removeButton = document.createElement("button")
        removeButton.type = "button"
        removeButton.className = "danger"
        removeButton.textContent = "Eliminar"
        removeButton.addEventListener("click", async () => {
            profiles = profiles.filter(current => current.id !== profile.id)
            await saveProfiles(profiles)
            renderProfiles()

            if (editingProfileId === profile.id) {
                clearForm()
                setEditMode(null)
                showForm(false)
            }

            setStatus("Perfil eliminado.")
        })

        actions.append(editButton, removeButton)
        item.append(info, actions)
        profilesList.append(item)
    })
}

form.addEventListener("submit", async (event: SubmitEvent) => {
    event.preventDefault()

    try {
        const wasEditing = Boolean(editingProfileId)
        const profileData = {
            name: profileNameInput.value,
            domain: profileDomainInput.value,
            postUrl: postUrlInput.value.trim() || DEFAULT_POST_URL,
            postToken: postTokenInput.value
        }

        if (editingProfileId) {
            const updatedProfile = {
                ...createProfileFromFields(profileData),
                id: editingProfileId
            }

            profiles = profiles.map(profile => (profile.id === editingProfileId ? updatedProfile : profile))
        } else {
            const profile = createProfileFromFields(profileData)
            profiles = [...profiles, profile]
        }

        await saveProfiles(profiles)
        renderProfiles()
        clearForm()
        setEditMode(null)
        showForm(false)
        setStatus(wasEditing ? "Perfil actualizado." : "Perfil guardado.")
    } catch (error: unknown) {
        console.error(error)
        setStatus("Revisa nombre, dominio y URL del POST.", true)
    }
})

addProfileButton.addEventListener("click", () => {
    setEditMode(null)
    clearForm()
    showForm(true)
})

cancelButton.addEventListener("click", () => {
    setEditMode(null)
    showForm(false)
    clearForm()
    setStatus("")
})

const loadSettings = async (): Promise<void> => {
    profiles = await getStoredProfiles()
    renderProfiles()
    setEditMode(null)
    clearForm()
    showForm(false)
}

loadSettings().catch((error: unknown) => {
    console.error(error)
    setStatus("No se pudo cargar la configuracion.", true)
})
