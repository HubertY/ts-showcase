var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
import { createTypeScriptSandbox } from "./sandbox/index";
import { directory, massFetch } from "./traverse";
export class Showcase {
    constructor(domEle, opts = {}) {
        this.destroyed = false;
        this.localScripts = new Map();
        this.initialize(domEle, opts);
    }
    run(target) {
        return __awaiter(this, void 0, void 0, function* () {
            if (this.sandbox) {
                let code = yield this.sandbox.getRunnableJS().catch((err) => {
                    console.log(err);
                });
                if (code) {
                    for (const [name, path] of this.localScripts) {
                        code = code.replace(new RegExp(` from "${name}";`, 'g'), ` from "${path}";`);
                        code = code.replace(new RegExp(` from '${name}';`, 'g'), ` from '${path}';`);
                    }
                    return executeJS(code, target);
                }
            }
        });
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
            this.sandbox.editor.focus();
        }
    }
    get editor() {
        var _a;
        return (_a = this.sandbox) === null || _a === void 0 ? void 0 : _a.editor;
    }
    initialize(domEle, opts) {
        return __awaiter(this, void 0, void 0, function* () {
            const localScripts = new Map();
            const localLibs = new Map();
            const inits = yield initialization;
            if (this.destroyed) {
                return;
            }
            if (opts.local) {
                const { libDir, localDeps } = opts.local;
                const files = yield directory(`${libDir}/directory.json`);
                if (this.destroyed) {
                    return;
                }
                yield massFetch(libDir, files.filter((s) => s.endsWith(".d.ts")), (path, data) => {
                    localLibs.set(path, data);
                });
                if (this.destroyed) {
                    return;
                }
                yield massFetch(libDir, files.filter((s) => s.endsWith("package.json")), (path, data) => {
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
                elementToAppend: domEle,
                libIgnore: opts.local ? opts.local.localDeps : []
            };
            const sandbox = createTypeScriptSandbox(sandboxConfig, inits.editor, inits.ts);
            for (const [s, data] of localLibs) {
                console.log(`adding /node_modules/${s}`);
                sandbox.addLibraryToRuntime(data, `/node_modules/${s}`);
            }
            this.sandbox = sandbox;
            this.localScripts = localScripts;
        });
    }
}
function executeJS(code, doc = document) {
    const el = doc.createElement("script");
    el.type = "module";
    el.className = "runtime";
    el.innerHTML = code;
    doc.body.appendChild(el);
}
function makeResolvable() {
    let res;
    const ret = new Promise((resolve) => {
        res = resolve;
    });
    ret.resolve = res;
    return ret;
}
const initialization = makeResolvable();
export function init(arg) {
    if (arg.editor && arg.ts) {
        initialization.resolve(arg);
    }
}
export function fetchModulesFromCDN() {
    return new Promise((resolve, reject) => {
        console.log("fetching monaco and typescript");
        // First set up the VSCode loader in a script tag
        const getLoaderScript = document.createElement("script");
        getLoaderScript.src = "https://www.typescriptlang.org/js/vs.loader.js";
        getLoaderScript.async = true;
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
            });
            // Grab a copy of monaco and TypeScript
            window.require(["vs/editor/editor.main", "vs/language/typescript/tsWorker"], (editor, _tsWorker) => {
                if (editor && _tsWorker && window.ts) {
                    console.log("monaco and typescript succesfully fetched");
                    resolve({ editor, ts: window.ts });
                }
                else {
                    reject(`module fetch failure: editor: ${!!editor}, _tsworker: ${!!_tsWorker}`);
                }
            });
        };
        document.body.appendChild(getLoaderScript);
    });
}
