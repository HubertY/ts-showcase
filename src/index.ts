declare type CompilerOptions = import("monaco-editor").languages.typescript.CompilerOptions;
import { directory, massFetch } from "./traverse"

type Monaco = typeof import("monaco-editor");
type SandboxLib = typeof import("./sandbox");

type ShowcaseInitialization = { editor: Monaco, sandbox: SandboxLib };

declare global {
    interface Window { require: any, [key: string]: any }
}

export interface ShowcaseOptions {
    compilerOptions?: CompilerOptions
    local?: { localDeps: string[], libDir: string }
    initialCode?: string
}

export class Showcase {
    sandbox: ReturnType<SandboxLib["createTypeScriptSandbox"]> | undefined;
    localScripts: Map<string, string>;
    destroyed: boolean;
    scriptDoc: Document | undefined;
    async run() {
        if (this.sandbox) {
            let code = await this.sandbox.getRunnableJS().catch((err) => {
                console.log(err);
            });
            if (code) {
                for (const [name, path] of this.localScripts) {
                    code = code.replace(new RegExp(`"${name}"`, 'g'), `"${path}"`);
                    code = code.replace(new RegExp(`'${name}'`, 'g'), `'${path}'`);
                }
                return executeJS(code, this.scriptDoc);
            }
        }
    }
    target(doc: Document) {
        this.scriptDoc = doc;
    }
    destroy() {
        if (this.sandbox) {
            this.sandbox.getModel().dispose();
            this.sandbox = undefined;
        }
        this.destroyed = true;
    }
    focus() {
        if (this.sandbox) {
            this.sandbox.editor.focus()
        }
    }
    get editor(): import("monaco-editor").editor.IStandaloneCodeEditor | undefined {
        return this.sandbox?.editor;
    }
    private async initialize(domEle: HTMLElement, opts: ShowcaseOptions) {
        const localScripts = new Map<string, string>();
        const localLibs = new Map<string, string>();

        const inits = await initialization;
        if (this.destroyed) {
            return;
        }
        if (opts.local) {
            const { libDir, localDeps } = opts.local;
            const files = await directory(`${libDir}/directory.json`);
            if (this.destroyed) {
                return;
            }
            await massFetch(libDir, files.filter((s) => s.endsWith(".d.ts")), (path, data) => {
                localLibs.set(path, data);
            });
            if (this.destroyed) {
                return;
            }
            await massFetch(libDir, files.filter((s) => s.endsWith("package.json")), (path, data) => {
                localLibs.set(path, data);
                const pack = JSON.parse(data);
                if (localDeps.indexOf(pack.name) !== -1) {
                    localScripts.set(pack.name, `${libDir}/${path.replace("package.json", pack.main)}`);
                }
            });
            if (this.destroyed) {
                return;
            }
        }

        const sandboxConfig = {
            text: opts.initialCode || "",
            compilerOptions: opts.compilerOptions || {},
            domEle,
            libIgnore: opts.local ? opts.local.localDeps : []
        }
        const sandbox = inits.sandbox.createTypeScriptSandbox(sandboxConfig, inits.editor, window.ts);
        for (const [s, data] of localLibs) {
            console.log(`adding /node_modules/${s}`)
            sandbox.addLibraryToRuntime(data, `/node_modules/${s}`);
        }
        this.sandbox = sandbox;
        this.localScripts = localScripts;
    }
    constructor(domEle: HTMLElement, opts: ShowcaseOptions = {}) {
        this.destroyed = false;
        this.localScripts = new Map();
        this.initialize(domEle, opts);
    }
}

function executeJS(code: string, doc: Document = document) {
    const el = doc.createElement("script");
    el.type = "module";
    el.className = "runtime";
    el.innerHTML = code;
    doc.body.appendChild(el);
}

interface Resolvable<T> extends Promise<T> {
    resolve: (arg: T) => void;
}
function makeResolvable<T>() {
    let res: (arg: T) => void;
    const ret = new Promise((resolve) => {
        res = resolve;
    }) as Resolvable<T>;
    ret.resolve = res!;
    return ret;
}

const initialization = makeResolvable<ShowcaseInitialization>();

export async function init(sandboxPath: string) {
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
                initialization.resolve({ editor, sandbox: sandbox });
            }
            else {
                throw new ErrorEvent(`showcase init failure: editor: ${!!editor}, _tsworker: ${!!_tsWorker}, sandbox: ${!!sandbox}`);
            }
        })
    }
    document.body.appendChild(getLoaderScript)
    return initialization;
}