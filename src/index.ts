import { massFetch } from "./traverse"

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
window.localDeps = ["ts-script"];

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
        compilerOptions: {},
        domID: "monaco-editor-embed",
    }


    const sandbox = window.sandboxFactory.createTypeScriptSandbox(sandboxConfig, window.main, window.ts)

    const localLibs = new Map<string, string>();
    const localScripts = new Map<string, string>();
    await massFetch("./directory.json",
        (s) => s.endsWith(".ts") || s.endsWith("package.json") || s.endsWith(".js"),
        (s, data) => {
            if (s.endsWith(".js")) {
                localScripts.set(s, data);
            }
            else {
                localLibs.set(s, data);
            }
        });
    for (const [s, data] of localLibs) {
        sandbox.addLibraryToRuntime(data, s.replace("lib", "/node_modules"));
    }


    sandbox.editor.focus()

    document.getElementById("run").addEventListener("click", (ev) => {
        sandbox.getRunnableJS().then((s) => {
            console.log(s);
            eval(s);
        }).catch((err) => {
            console.log(err);
        });
    })
}
export { };