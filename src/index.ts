type Monaco = typeof import("monaco-editor");
import * as fact from "@typescript/sandbox"

declare const window: { main: Monaco, sandboxFactory: typeof fact, ts: any, mainFn: any, [key: string]: any };


window.mainFn = function () {
    const initialCode = `console.log("Hello world!");
`
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
    sandbox.editor.focus()
    console.log("lessgo");
    sandbox.addLibraryToRuntime("export const x = 5;", "environment");

    document.getElementById("run").addEventListener("click", (ev) => {
        console.log("yo");
        sandbox.getRunnableJS().then((s) => {
            console.log(s);
            eval(s);
        }).catch((err) => {
            console.log(err);
        });
    })
}