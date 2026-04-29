import { cp, mkdir, rm } from "node:fs/promises"
import { dirname, join } from "node:path"

const rootDir = process.cwd()
const distDir = join(rootDir, "dist")

const runtimePaths = [
    "manifest.json",
    "build",
    "src/assets",
    "src/options/options.html",
    "src/options/options.css",
    "src/popup/popup.html",
    "src/popup/popup.css"
]

async function copyRuntimePath(relativePath) {
    const sourcePath = join(rootDir, relativePath)
    const destinationPath = join(distDir, relativePath)

    await mkdir(dirname(destinationPath), { recursive: true })
    await cp(sourcePath, destinationPath, { recursive: true })
}

async function main() {
    await rm(distDir, { recursive: true, force: true })
    await mkdir(distDir, { recursive: true })

    for (const runtimePath of runtimePaths) {
        await copyRuntimePath(runtimePath)
    }

    console.log("Dist package generated at ./dist")
}

main().catch(error => {
    console.error("Failed to generate dist package", error)
    process.exitCode = 1
})
