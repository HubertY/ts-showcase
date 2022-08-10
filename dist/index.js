var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
import { directory, massFetch } from "./traverse";
export class Showcase {
    constructor(domEle, localDeps = [], libDir = ".", initialCode = "") {
        this.destroyed = false;
        this.localScripts = new Map();
        this.initialize(domEle, localDeps, libDir, initialCode);
    }
    run() {
        return __awaiter(this, void 0, void 0, function* () {
            if (this.sandbox) {
                let code = yield this.sandbox.getRunnableJS().catch((err) => {
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
        });
    }
    target(doc) {
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
            this.sandbox.editor.focus();
        }
    }
    get editor() {
        var _a;
        return (_a = this.sandbox) === null || _a === void 0 ? void 0 : _a.editor;
    }
    initialize(domEle, localDeps = [], libDir = ".", initialCode = "") {
        return __awaiter(this, void 0, void 0, function* () {
            if (libDir === "/") {
                libDir = "";
            }
            const localScripts = new Map();
            const localLibs = new Map();
            const inits = yield initialization;
            if (this.destroyed) {
                return;
            }
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
            const sandboxConfig = {
                text: initialCode,
                compilerOptions: {},
                domEle,
                libIgnore: localDeps
            };
            const sandbox = inits.sandbox.createTypeScriptSandbox(sandboxConfig, inits.editor, window.ts);
            for (const [s, data] of localLibs) {
                console.log(`adding /node_modules/${s}`);
                sandbox.addLibraryToRuntime(data, `/node_modules/${s}`);
            }
            this.sandbox = sandbox;
            this.localScripts = localScripts;
        });
    }
}
const _runtimes = [];
window._runtimes = _runtimes;
function executeJS(code, doc = document) {
    return new Promise(resolve => {
        const i = window._runtimes.length;
        const el = doc.createElement("script");
        el.type = "module";
        el.className = "runtime";
        el.innerHTML = code + `
window._runtimes[${i}].el.parentNode.removeChild(window._runtimes[${i}].el);
window._runtimes[${i}].resolve();
window._runtimes[${i}] = {};
`;
        window._runtimes.push({ el, resolve });
        doc.body.appendChild(el);
    });
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
export function init(sandboxPath) {
    return __awaiter(this, void 0, void 0, function* () {
        console.log("initializing showcase...");
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
                    sandbox: sandboxPath,
                },
                // This is something you need for monaco to work
                ignoreDuplicateModules: ["vs/editor/editor.main"],
            });
            // Grab a copy of monaco, TypeScript and the sandbox
            window.require(["vs/editor/editor.main", "vs/language/typescript/tsWorker", "sandbox/index"], (editor, _tsWorker, sandbox) => {
                if (editor && _tsWorker && sandbox) {
                    console.log("showcase initialized");
                    initialization.resolve({ editor, sandbox: sandbox });
                }
                else {
                    throw new ErrorEvent(`showcase init failure: editor: ${!!editor}, _tsworker: ${!!_tsWorker}, sandbox: ${!!sandbox}`);
                }
            });
        };
        document.body.appendChild(getLoaderScript);
        return initialization;
    });
}
