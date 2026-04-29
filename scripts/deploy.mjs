import { execFile } from "node:child_process"
import { cp, mkdir, readFile, rm, writeFile } from "node:fs/promises"
import { basename, dirname, join } from "node:path"
import { createInterface } from "node:readline/promises"
import { stdin as input, stdout as output } from "node:process"
import { promisify } from "node:util"

const execFileAsync = promisify(execFile)

const rootDir = process.cwd()
const distDir = join(rootDir, "dist")
const legacyReleaseZipPath = join(rootDir, "release.zip")
const packageJsonPath = join(rootDir, "package.json")
const semverPattern = /^\d+\.\d+\.\d+(?:-[0-9A-Za-z.-]+)?(?:\+[0-9A-Za-z.-]+)?$/

const runtimePaths = [
    "manifest.json",
    "build",
    "src/assets",
    "src/options/options.html",
    "src/options/options.css",
    "src/popup/popup.html",
    "src/popup/popup.css"
]

const sourcePaths = ["manifest.json", "package.json", "pnpm-lock.yaml", "tsconfig.json", "README.md", "scripts", "src"]

async function copyRuntimePath(relativePath) {
    const sourcePath = join(rootDir, relativePath)
    const destinationPath = join(distDir, relativePath)

    await mkdir(dirname(destinationPath), { recursive: true })
    await cp(sourcePath, destinationPath, { recursive: true })
}

async function askAndUpdateVersion() {
    const packageJsonRaw = await readFile(packageJsonPath, "utf8")
    const packageJson = JSON.parse(packageJsonRaw)
    const currentVersion = packageJson.version

    const rl = createInterface({ input, output })
    const response = await rl.question(`New version (current ${currentVersion}): `)
    rl.close()

    const nextVersion = response.trim() || currentVersion

    if (!semverPattern.test(nextVersion)) {
        throw new Error(`Invalid version "${nextVersion}". Expected semver, for example: 1.2.3`)
    }

    if (nextVersion !== currentVersion) {
        packageJson.version = nextVersion
        await writeFile(packageJsonPath, `${JSON.stringify(packageJson, null, 4)}\n`, "utf8")
        console.log(`Updated package.json version: ${currentVersion} -> ${nextVersion}`)
    } else {
        console.log(`Version unchanged: ${currentVersion}`)
    }

    return nextVersion
}

function getReleaseArchivePaths(version) {
    const safeVersion = version.replace(/\+/g, "-")

    return {
        extensionZipPath: join(rootDir, `release-extension-v${safeVersion}.zip`),
        sourceZipPath: join(rootDir, `release-source-code-v${safeVersion}.zip`)
    }
}

async function createReleaseArchives(version) {
    const archivePaths = getReleaseArchivePaths(version)

    await rm(archivePaths.extensionZipPath, { force: true })
    await rm(archivePaths.sourceZipPath, { force: true })
    await rm(legacyReleaseZipPath, { force: true })
    await rm(join(rootDir, "release-extension.zip"), { force: true })
    await rm(join(rootDir, "release-source-code.zip"), { force: true })

    try {
        await execFileAsync("zip", ["-r", "-q", archivePaths.extensionZipPath, "."], { cwd: distDir })
        await execFileAsync("zip", ["-r", "-q", archivePaths.sourceZipPath, ...sourcePaths], { cwd: rootDir })
    } catch (error) {
        if (error && error.code === "ENOENT") {
            throw new Error("zip command is not available in PATH. Install zip or create archives manually.")
        }

        throw error
    }

    return archivePaths
}

async function main() {
    const version = await askAndUpdateVersion()

    await rm(distDir, { recursive: true, force: true })
    await mkdir(distDir, { recursive: true })

    for (const runtimePath of runtimePaths) {
        await copyRuntimePath(runtimePath)
    }

    const archivePaths = await createReleaseArchives(version)

    console.log(`Dist package generated at ./dist (version ${version})`)
    console.log("Release archives generated:")
    console.log(`- ./${basename(archivePaths.extensionZipPath)}`)
    console.log(`- ./${basename(archivePaths.sourceZipPath)}`)
}

main().catch(error => {
    console.error("Failed to generate dist package", error)
    process.exitCode = 1
})
