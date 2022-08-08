import { directory, massFetch } from "./traverse"

type Monaco = typeof import("monaco-editor");
type SandboxLib = typeof import("./sandbox");

export type ShowcaseInitialization = { editor: Monaco, sandbox: SandboxLib };

declare global {
    interface Window { require: any, [key: string]: any }
}

class Showcase {
    sandbox: ReturnType<SandboxLib["createTypeScriptSandbox"]>;
    localScripts: Map<string, string>;
    async run() {
        let code = await this.sandbox.getRunnableJS().catch((err) => {
            console.log(err);
        });
        if (code) {
            for (const [name, path] of this.localScripts) {
                code = code.replace(new RegExp(`"${name}"`, 'g'), `"${path}"`);
                code = code.replace(new RegExp(`'${name}'`, 'g'), `'${path}'`);
            }
            return executeJS(code);
        }
    }
    focus() {
        this.sandbox.editor.focus()
    }
    get editor(): import("monaco-editor").editor.IStandaloneCodeEditor {
        return this.sandbox.editor;
    }
    constructor(sandbox: ReturnType<SandboxLib["createTypeScriptSandbox"]>, localScripts: Map<string, string> = new Map()) {
        this.sandbox = sandbox;
        this.localScripts = localScripts;
    }
}

const _runtimes = [] as { el: HTMLScriptElement, resolve: () => void }[];
window._runtimes = _runtimes;
function executeJS(code: string) {
    return new Promise<void>(resolve => {
        const i = window._runtimes.length;
        const el = document.createElement("script");
        el.type = "module";
        el.className = "runtime";
        el.innerHTML = code + `
window._runtimes[${i}].el.parentNode.removeChild(window._runtimes[${i}].el);
window._runtimes[${i}].resolve();
window._runtimes[${i}] = {};
`
        window._runtimes.push({ el, resolve });
        document.body.appendChild(el);
    });
}


export async function makeShowcase(inits: ShowcaseInitialization, domID: string, localDeps: string[] = [], libDir: string = ".", initialCode: string = "") {
    if (libDir === "/") {
        libDir = "";
    }

    const localLibs = new Map<string, string>();
    const localScripts = new Map<string, string>();

    // Create a sandbox and embed it into the the div #monaco-editor-embed
    const sandboxConfig = {
        text: initialCode,
        compilerOptions: {},
        domID,
        libIgnore: localDeps
    }

    const sandbox = inits.sandbox.createTypeScriptSandbox(sandboxConfig, inits.editor, window.ts);

    const files = await directory(`${libDir}/directory.json`);

    await massFetch(libDir, files.filter((s) => s.endsWith(".d.ts")), (path, data) => {
        localLibs.set(path, data);
    });

    await massFetch(libDir, files.filter((s) => s.endsWith("package.json")), (path, data) => {
        localLibs.set(path, data);
        const pack = JSON.parse(data);
        if (localDeps.indexOf(pack.name) !== -1) {
            localScripts.set(pack.name, `${libDir}/${path.replace("package.json", pack.main)}`);
        }
    });

    for (const [s, data] of localLibs) {
        console.log(`adding /node_modules/${s}`)
        sandbox.addLibraryToRuntime(data, `/node_modules/${s}`);
    }

    return new Showcase(sandbox, localScripts);
}
let initialization: Promise<ShowcaseInitialization> | undefined = undefined;
export function init(sandboxPath: string): Promise<ShowcaseInitialization> {
    if (!initialization) {
        initialization = new Promise((resolve, reject) => {
            console.log("initializing showcase...");
            // First set up the VSCode loader in a script tag
            const getLoaderScript = document.createElement("script")
            getLoaderScript.src = "https://www.typescriptlang.org/js/vs.loader.js"
            getLoaderScript.async = true
            getLoaderScript.onload = () => {
                // Now the loader is ready, tell require where it can get the version of monaco, and the sandbox
                // This version uses the latest version of the sandbox, which is used on the TypeScript website

                // For the monaco version you can use unpkg or the TypeScript web infra CDN
                // You can see the available releases for TypeScript here:
                // https://typescript.azureedge.net/indexes/releases.json
                //
                window.require.config({
                    paths: {
                        vs: "https://typescript.azureedge.net/cdn/4.7.3/monaco/min/vs",
                        sandbox: sandboxPath,
                    },
                    // This is something you need for monaco to work
                    ignoreDuplicateModules: ["vs/editor/editor.main"],
                })

                // Grab a copy of monaco, TypeScript and the sandbox
                window.require(["vs/editor/editor.main", "vs/language/typescript/tsWorker", "sandbox/index"], (
                    editor: Monaco,
                    _tsWorker: any,
                    sandbox: SandboxLib
                ) => {
                    if (editor && _tsWorker && sandbox) {
                        console.log("showcase initialized");
                        resolve({ editor, sandbox: sandbox });
                    }
                    else {
                        console.log("showcase initialize error");
                        reject({ editor: !!editor, _tsWorker: !!_tsWorker, sandbox: !!sandbox });
                    }
                })
            }
            document.body.appendChild(getLoaderScript)
        });
    }
    return initialization;
}