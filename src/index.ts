import { directory, massFetch } from "./traverse"


type Monaco = typeof import("monaco-editor");
type sbox = typeof import("@typescript/sandbox");

declare global {
    interface Window { main: Monaco, sandboxFactory: sbox, ts: any, mainFn: any, [key: string]: any }
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

window.mainFn = async function () {
    const isOK = window.main && window.ts && window.sandboxFactory
    if (isOK) {
        document.getElementById("loader").parentNode.removeChild(document.getElementById("loader"))
    } else {
        console.error("Could not get all the dependencies of sandbox set up!")
        console.error("main", !!window.main, "ts", !!window.ts, "sandbox", !!window.sandboxFactory)
        return
    }

    // Create a sandbox and embed it into the the div #monaco-editor-embed
    const sandboxConfig = {
        text: initialCode,
        compilerOptions: {

        },
        domID: "monaco-editor-embed",
    }


    const sandbox = window.sandboxFactory.createTypeScriptSandbox(sandboxConfig, window.main, window.ts)

    const files = await directory("./directory.json");

    await massFetch(files.filter((s) => s.endsWith(".d.ts")), (path, data) => {
        localLibs.set(path, data);
    });

    await massFetch(files.filter((s) => s.endsWith("package.json")), (path, data) => {
        localLibs.set(path, data);
        const pack = JSON.parse(data);
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
            for (const [name, path] of localScripts) {
                code = code.replace(new RegExp(`"${name}"`, 'g'), `"${path}"`);
                code = code.replace(new RegExp(`'${name}'`, 'g'), `'${path}'`);
            }
            executeJS(code);
        }
    })
}
export { };