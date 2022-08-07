import { directory, massFetch } from "./traverse"


type Monaco = typeof import("monaco-editor");
type Sandbox = typeof import("@typescript/sandbox");

declare global {
    interface Window { mainFn: any, require: any, [key: string]: any }
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

function executeJS(code: string) {
    return new Promise(resolve => {
        if (!window.resolveHooks) {
            window.resolveHooks = [];
        }
        const i = window.resolveHooks.length;
        window.resolveHooks.push(resolve);
        const el = document.createElement("script");
        el.innerHTML = code + `\nwindow.resolveHooks[${i}]();`;
        el.type = "module";
        document.body.appendChild(el);
    });
}

const localDeps = ["ts-script"];
window.localDeps = localDeps;
const localLibs = new Map<string, string>();
const localScripts = new Map<string, string>();

async function main() {
    const stuff = await init();

    // Create a sandbox and embed it into the the div #monaco-editor-embed
    const sandboxConfig = {
        text: initialCode,
        compilerOptions: {

        },
        domID: "monaco-editor-embed",
    }


    const sandbox = stuff.sandbox.createTypeScriptSandbox(sandboxConfig, stuff.editor, window.ts);

    const files = await directory("./directory.json");

    await massFetch(files.filter((s) => s.endsWith(".d.ts")), (path, data) => {
        localLibs.set(path, data);
    });

    await massFetch(files.filter((s) => s.endsWith("package.json")), (path, data) => {
        localLibs.set(path, data);
        const pack = JSON.parse(data);
        console.log(pack);
        if (localDeps.includes(pack.name)) {
            localScripts.set(pack.name, `./${path.replace("package.json", pack.main)}`);
        }
    });

    for (const [s, data] of localLibs) {
        sandbox.addLibraryToRuntime(data, s.replace("lib", "/node_modules"));
    }
    sandbox.editor.focus()

    document.getElementById("run").addEventListener("click", async (ev) => {
        let code = await sandbox.getRunnableJS().catch((err) => {
            console.log(err);
        });
        if (code) {
            console.log(localScripts);
            for (const [name, path] of localScripts) {
                code = code.replace(new RegExp(`"${name}"`, 'g'), `"${path}"`);
                code = code.replace(new RegExp(`'${name}'`, 'g'), `'${path}'`);
            }
            executeJS(code);
        }
    })
}
main();

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
                    sandbox: "./sandbox",
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