declare type CompilerOptions = import("monaco-editor").languages.typescript.CompilerOptions;
import { SandboxConfig, createTypeScriptSandbox } from "./sandbox/index";
import { directory, massFetch } from "./traverse"

type Monaco = typeof import("monaco-editor");

type ShowcaseInitialization = { editor: Monaco, ts: typeof import("typescript") };

declare global {
    interface Window { require: any, ts: typeof import("typescript") | undefined }
}

export interface ShowcaseOptions {
    /**options for the Typescript compiler */
    compilerOptions?: CompilerOptions
    local?: { localDeps: string[], libDir: string }
    initialCode?: string
}

let LOCAL_CACHE: Record<string, { files: Map<string, string>, jspaths: Map<string, string> } | undefined> = {};
export function clearLocalCache(...args: string[]) {
    if (args.length === 0) {
        LOCAL_CACHE = {};
    }
    else {
        for (const arg of args) {
            delete LOCAL_CACHE[arg];
        }
    }
}

export class Showcase {
    sandbox: ReturnType<typeof createTypeScriptSandbox> | undefined;
    replaceJSPaths: Map<string, string>;
    destroyed: boolean;
    scriptDoc: Document | undefined;
    async run(target: Document) {
        if (this.sandbox) {
            let code = await this.sandbox.getRunnableJS().catch((err) => {
                console.log(err);
            });
            if (code) {
                for (const [name, path] of this.replaceJSPaths) {
                    code = code.replace(new RegExp(` from "${name}";`, 'g'), ` from "${path}";`);
                    code = code.replace(new RegExp(` from '${name}';`, 'g'), ` from '${path}';`);
                }
                return executeJS(code, target);
            }
        }
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
    private async localFetch(libDir: string) {
        const x = LOCAL_CACHE[libDir];
        if (!x) {
            const local = { files: new Map<string, string>(), jspaths: new Map<string, string>() };
            const dirFiles = await directory(`${libDir}/directory.json`);
            await massFetch(libDir, dirFiles.filter((s) => s.endsWith(".d.ts")), (path, data) => {
                local.files.set(path, data);
            });
            await massFetch(libDir, dirFiles.filter((s) => s.endsWith("package.json")), (path, data) => {
                local.files.set(path, data);
                const pack = JSON.parse(data);
                if (pack.name && pack.main) {
                    local.jspaths.set(pack.name, `${libDir}/${path.replace("package.json", pack.main)}`);
                }
            });
            LOCAL_CACHE[libDir] = local;
            return local;
        }
        else {
            return x;
        }
    }
    private async initialize(domEle: HTMLElement, opts: ShowcaseOptions) {
        const inits = await initialization;
        if (this.destroyed) {
            return false;
        }
        const local = opts.local ? await this.localFetch(opts.local.libDir) : null;
        if (this.destroyed) {
            return false;
        }
        const sandboxConfig = {
            text: opts.initialCode || "",
            compilerOptions: opts.compilerOptions || {},
            elementToAppend: domEle,
            libIgnore: opts.local?.localDeps || []
        }
        const sandbox = createTypeScriptSandbox(sandboxConfig, inits.editor, inits.ts);
        if (local && opts.local) {
            for (const [k, v] of local.files) {
                console.log(`adding /node_modules/${k}`)
                sandbox.addLibraryToRuntime(v, `/node_modules/${k}`);
            }

            for (const k of opts.local.localDeps) {
                const v = local.jspaths.get(k);
                if (v) {
                    this.replaceJSPaths.set(k, v);
                }
            }
        }
        this.sandbox = sandbox;
        return true;
    }
    constructor(domEle: HTMLElement, opts: ShowcaseOptions = {}) {
        this.destroyed = false;
        this.replaceJSPaths = new Map();
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

export function init(arg: { editor: Monaco, ts: typeof import("typescript") }) {
    if (arg.editor && arg.ts) {
        initialization.resolve(arg);
    }
}

export function fetchModulesFromCDN(): Promise<{ editor: Monaco, ts: typeof import("typescript") }> {
    return new Promise((resolve, reject) => {
        console.log("fetching monaco and typescript");
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
                },
                // This is something you need for monaco to work
                ignoreDuplicateModules: ["vs/editor/editor.main"],
            })

            // Grab a copy of monaco and TypeScript
            window.require(["vs/editor/editor.main", "vs/language/typescript/tsWorker"], (
                editor: Monaco,
                _tsWorker: any
            ) => {
                if (editor && _tsWorker && window.ts) {
                    console.log("monaco and typescript succesfully fetched");
                    resolve({ editor, ts: window.ts });
                }
                else {
                    reject(`module fetch failure: editor: ${!!editor}, _tsworker: ${!!_tsWorker}`);
                }
            })
        }
        document.body.appendChild(getLoaderScript)
    });
}