import { directory, massFetch } from "./traverse"


type Monaco = typeof import("monaco-editor");
type Sandbox = typeof import("@typescript/sandbox");

declare global {
    interface Window { require: any, [key: string]: any }
}

class Showcase {
    sandbox: ReturnType<Sandbox["createTypeScriptSandbox"]>;
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
            executeJS(code);
        }
    }
    focus() {
        this.sandbox.editor.focus()
    }
    constructor(sandbox: ReturnType<Sandbox["createTypeScriptSandbox"]>, localScripts: Map<string, string> = new Map()) {
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


export async function makeShowcase(inits: { editor: Monaco, sandbox: Sandbox }, domID: string, localDeps: string[] = [], libDir: string = ".", initialCode: string = "") {
    const localLibs = new Map<string, string>();
    const localScripts = new Map<string, string>();

    // Create a sandbox and embed it into the the div #monaco-editor-embed
    const sandboxConfig = {
        text: initialCode,
        compilerOptions: {},
        domID: "monaco-editor-embed",
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
        if (localDeps.includes(pack.name)) {
            localScripts.set(pack.name, `./${libDir}/${path.replace("package.json", pack.main)}`);
        }
    });

    for (const [s, data] of localLibs) {
        console.log(`/node_modules/${s}`)
        sandbox.addLibraryToRuntime(data, `/node_modules/${s}`);
    }

    return new Showcase(sandbox, localScripts);
}

export function init(): Promise<{ editor: Monaco, sandbox: Sandbox }> {
    return new Promise((resolve, reject) => {
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
                    sandbox: "./static/sandbox",
                },
                // This is something you need for monaco to work
                ignoreDuplicateModules: ["vs/editor/editor.main"],
            })

            // Grab a copy of monaco, TypeScript and the sandbox
            window.require(["vs/editor/editor.main", "vs/language/typescript/tsWorker", "sandbox/index"], (
                editor: Monaco,
                _tsWorker: any,
                sandbox: Sandbox
            ) => {
                document.getElementById("loader").parentNode.removeChild(document.getElementById("loader"))
                if (editor && _tsWorker && sandbox) {
                    resolve({ editor, sandbox });
                }
                else {
                    reject({ editor: !!editor, _tsWorker: !!_tsWorker, sandbox: !!sandbox });
                }
            })
        }
        document.body.appendChild(getLoaderScript)
    });
}

const initialCode = `import * as script from "ts-script";

const eng = new script.ScriptingEngine();
const myScript = eng.createScript("myScript",[eng.Time],
async (ctx)=>{
    for(let i = 0; i < 100; i++){
        await ctx.Time.waitUntil(i*100);
        console.log("yay");
    }
})
eng.run(myScript,eng.createContext());
`
async function main() {
    const inits = await init();

    const showcase = await makeShowcase(inits, "monaco-editor-embed", ["ts-script"], "static/lib", initialCode);


    document.getElementById("run").addEventListener("click", () => {
        showcase.run();
    })
}

main()