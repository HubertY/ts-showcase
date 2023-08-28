var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
import { sandboxTheme, sandboxThemeDark } from "./theme";
import { getDefaultSandboxCompilerOptions, getCompilerOptionsFromParams, createURLQueryWithCompilerOptions, } from "./compilerOptions";
import lzstring from "lz-string";
import { supportedReleases } from "./release_data";
import { getInitialCode } from "./getInitialCode";
import { extractTwoSlashCompilerOptions, twoslashCompletions } from "./twoslashSupport";
import * as tsvfs from "./vendor/vfs";
import { setupTypeAcquisition } from "./vendor/ata/index";
const languageType = (config) => (config.filetype === "js" ? "javascript" : "typescript");
// Basically android and monaco is pretty bad, this makes it less bad
// See https://github.com/microsoft/pxt/pull/7099 for this, and the long
// read is in https://github.com/microsoft/monaco-editor/issues/563
const isAndroid = navigator && /android/i.test(navigator.userAgent);
/** Default Monaco settings for playground */
const sharedEditorOptions = {
    scrollBeyondLastLine: true,
    scrollBeyondLastColumn: 3,
    minimap: {
        enabled: false,
    },
    lightbulb: {
        enabled: true,
    },
    quickSuggestions: {
        other: !isAndroid,
        comments: !isAndroid,
        strings: !isAndroid,
    },
    acceptSuggestionOnCommitCharacter: !isAndroid,
    acceptSuggestionOnEnter: !isAndroid ? "on" : "off",
    accessibilitySupport: !isAndroid ? "on" : "off",
    inlayHints: {
        enabled: true,
    },
};
/** The default settings which we apply a partial over */
export function defaultPlaygroundSettings() {
    const config = {
        text: "",
        domID: "",
        compilerOptions: {},
        acquireTypes: true,
        filetype: "ts",
        supportTwoslashCompilerOptions: false,
        logger: console,
        libIgnore: []
    };
    return config;
}
function defaultFilePath(config, compilerOptions, monaco) {
    const isJSX = compilerOptions.jsx !== monaco.languages.typescript.JsxEmit.None;
    const ext = isJSX && config.filetype !== "d.ts" ? config.filetype + "x" : config.filetype;
    return "input." + ext;
}
/** Creates a monaco file reference, basically a fancy path */
function createFileUri(config, compilerOptions, monaco) {
    return monaco.Uri.file(defaultFilePath(config, compilerOptions, monaco));
}
/** Creates a sandbox editor, and returns a set of useful functions and the editor */
export const createTypeScriptSandbox = (partialConfig, monaco, ts) => {
    if (!("domID" in partialConfig) && !("elementToAppend" in partialConfig))
        throw new Error("You did not provide a domID or elementToAppend");
    const config = Object.assign(Object.assign({}, defaultPlaygroundSettings()), partialConfig);
    const defaultText = config.suppressAutomaticallyGettingDefaultText
        ? config.text
        : getInitialCode(config.text, document.location);
    // Defaults
    const compilerDefaults = getDefaultSandboxCompilerOptions(config, monaco, ts);
    // Grab the compiler flags via the query params
    let compilerOptions;
    if (!config.suppressAutomaticallyGettingCompilerFlags) {
        const params = new URLSearchParams(location.search);
        let queryParamCompilerOptions = getCompilerOptionsFromParams(compilerDefaults, ts, params);
        if (Object.keys(queryParamCompilerOptions).length)
            config.logger.log("[Compiler] Found compiler options in query params: ", queryParamCompilerOptions);
        compilerOptions = Object.assign(Object.assign({}, compilerDefaults), queryParamCompilerOptions);
    }
    else {
        compilerOptions = compilerDefaults;
    }
    const isJSLang = config.filetype === "js";
    // Don't allow a state like allowJs = false
    if (isJSLang) {
        compilerOptions.allowJs = true;
    }
    const language = languageType(config);
    const filePath = createFileUri(config, compilerOptions, monaco);
    const element = "elementToAppend" in config ? config.elementToAppend : document.getElementById(config.domID);
    if (!element) {
        throw new Error("DOM element lookup by domID failed");
    }
    const model = monaco.editor.createModel(defaultText, language, filePath);
    monaco.editor.defineTheme("sandbox", sandboxTheme);
    monaco.editor.defineTheme("sandbox-dark", sandboxThemeDark);
    monaco.editor.setTheme("sandbox");
    const monacoSettings = Object.assign({ model }, sharedEditorOptions, config.monacoSettings || {});
    const editor = monaco.editor.create(element, monacoSettings);
    const getWorker = isJSLang
        ? monaco.languages.typescript.getJavaScriptWorker
        : monaco.languages.typescript.getTypeScriptWorker;
    const defaults = isJSLang
        ? monaco.languages.typescript.javascriptDefaults
        : monaco.languages.typescript.typescriptDefaults;
    // @ts-ignore - these exist
    if (config.customTypeScriptWorkerPath && defaults.setWorkerOptions) {
        // @ts-ignore - this func must exist to have got here
        defaults.setWorkerOptions({
            customWorkerPath: config.customTypeScriptWorkerPath,
        });
    }
    defaults.setDiagnosticsOptions(Object.assign(Object.assign({}, defaults.getDiagnosticsOptions()), { noSemanticValidation: false, 
        // This is when tslib is not found
        diagnosticCodesToIgnore: [2354] }));
    // In the future it'd be good to add support for an 'add many files'
    const addLibraryToRuntime = (code, _path) => {
        const path = "file://" + _path;
        defaults.addExtraLib(code, path);
        const uri = monaco.Uri.file(path);
        if (monaco.editor.getModel(uri) === null) {
            monaco.editor.createModel(code, "javascript", uri);
        }
        config.logger.log(`[ATA] Adding ${path} to runtime`, { code });
    };
    const getTwoSlashCompilerOptions = extractTwoSlashCompilerOptions(ts);
    // Auto-complete twoslash comments
    if (config.supportTwoslashCompilerOptions) {
        const langs = ["javascript", "typescript"];
        langs.forEach(l => monaco.languages.registerCompletionItemProvider(l, {
            triggerCharacters: ["@", "/", "-"],
            provideCompletionItems: twoslashCompletions(ts, monaco),
        }));
    }
    const ata = setupTypeAcquisition({
        projectName: "TypeScript Playground",
        typescript: ts,
        logger: console,
        delegate: {
            receivedFile: addLibraryToRuntime,
            progress: (downloaded, total) => {
                // console.log({ dl, ttl })
            },
            started: () => {
                console.log("ATA start");
            },
            finished: f => {
                console.log("ATA done");
            },
        },
    }, config.libIgnore);
    const textUpdated = () => {
        const model = editor.getModel();
        if (model) {
            const code = editor.getValue();
            if (config.supportTwoslashCompilerOptions) {
                const configOpts = getTwoSlashCompilerOptions(code);
                updateCompilerSettings(configOpts);
            }
            if (config.acquireTypes) {
                ata(code);
            }
        }
    };
    // Debounced sandbox features like twoslash and type acquisition to once every second
    let debouncingTimer = false;
    editor.onDidChangeModelContent(_e => {
        if (debouncingTimer)
            return;
        debouncingTimer = true;
        setTimeout(() => {
            debouncingTimer = false;
            textUpdated();
        }, 1000);
    });
    config.logger.log("[Compiler] Set compiler options: ", compilerOptions);
    defaults.setCompilerOptions(compilerOptions);
    // To let clients plug into compiler settings changes
    let didUpdateCompilerSettings = (opts) => { };
    const updateCompilerSettings = (opts) => {
        const newKeys = Object.keys(opts);
        if (!newKeys.length)
            return;
        // Don't update a compiler setting if it's the same
        // as the current setting
        newKeys.forEach(key => {
            if (compilerOptions[key] == opts[key])
                delete opts[key];
        });
        if (!Object.keys(opts).length)
            return;
        config.logger.log("[Compiler] Updating compiler options: ", opts);
        compilerOptions = Object.assign(Object.assign({}, compilerOptions), opts);
        defaults.setCompilerOptions(compilerOptions);
        didUpdateCompilerSettings(compilerOptions);
    };
    const updateCompilerSetting = (key, value) => {
        config.logger.log("[Compiler] Setting compiler options ", key, "to", value);
        compilerOptions[key] = value;
        defaults.setCompilerOptions(compilerOptions);
        didUpdateCompilerSettings(compilerOptions);
    };
    const setCompilerSettings = (opts) => {
        config.logger.log("[Compiler] Setting compiler options: ", opts);
        compilerOptions = opts;
        defaults.setCompilerOptions(compilerOptions);
        didUpdateCompilerSettings(compilerOptions);
    };
    const getCompilerOptions = () => {
        return compilerOptions;
    };
    const setDidUpdateCompilerSettings = (func) => {
        didUpdateCompilerSettings = func;
    };
    /** Gets the results of compiling your editor's code */
    const getEmitResult = () => __awaiter(void 0, void 0, void 0, function* () {
        const model = editor.getModel();
        const client = yield getWorkerProcess();
        return yield client.getEmitOutput(model.uri.toString());
    });
    /** Gets the JS  of compiling your editor's code */
    const getRunnableJS = () => __awaiter(void 0, void 0, void 0, function* () {
        // This isn't quite _right_ in theory, we can downlevel JS -> JS
        // but a browser is basically always esnext-y and setting allowJs and
        // checkJs does not actually give the downlevel'd .js file in the output
        // later down the line.
        if (isJSLang) {
            return getText();
        }
        const result = yield getEmitResult();
        const firstJS = result.outputFiles.find((o) => o.name.endsWith(".js") || o.name.endsWith(".jsx"));
        return (firstJS && firstJS.text) || "";
    });
    /** Gets the DTS for the JS/TS  of compiling your editor's code */
    const getDTSForCode = () => __awaiter(void 0, void 0, void 0, function* () {
        const result = yield getEmitResult();
        return result.outputFiles.find((o) => o.name.endsWith(".d.ts")).text;
    });
    const getWorkerProcess = () => __awaiter(void 0, void 0, void 0, function* () {
        const worker = yield getWorker();
        // @ts-ignore
        return yield worker(model.uri);
    });
    const getDomNode = () => editor.getDomNode();
    const getModel = () => editor.getModel();
    const getText = () => getModel().getValue();
    const setText = (text) => getModel().setValue(text);
    const setupTSVFS = (fsMapAdditions) => __awaiter(void 0, void 0, void 0, function* () {
        const fsMap = yield tsvfs.createDefaultMapFromCDN(compilerOptions, ts.version, true, ts, lzstring);
        fsMap.set(filePath.path, getText());
        if (fsMapAdditions) {
            fsMapAdditions.forEach((v, k) => fsMap.set(k, v));
        }
        const system = tsvfs.createSystem(fsMap);
        const host = tsvfs.createVirtualCompilerHost(system, compilerOptions, ts);
        const program = ts.createProgram({
            rootNames: [...fsMap.keys()],
            options: compilerOptions,
            host: host.compilerHost,
        });
        return {
            program,
            system,
            host,
            fsMap,
        };
    });
    /**
     * Creates a TS Program, if you're doing anything complex
     * it's likely you want setupTSVFS instead and can pull program out from that
     *
     * Warning: Runs on the main thread
     */
    const createTSProgram = () => __awaiter(void 0, void 0, void 0, function* () {
        const tsvfs = yield setupTSVFS();
        return tsvfs.program;
    });
    const getAST = () => __awaiter(void 0, void 0, void 0, function* () {
        const program = yield createTSProgram();
        program.emit();
        return program.getSourceFile(filePath.path);
    });
    // Pass along the supported releases for the playground
    const supportedVersions = supportedReleases;
    textUpdated();
    return {
        /** The same config you passed in */
        config,
        /** A list of TypeScript versions you can use with the TypeScript sandbox */
        supportedVersions,
        /** The monaco editor instance */
        editor,
        /** Either "typescript" or "javascript" depending on your config */
        language,
        /** The outer monaco module, the result of require("monaco-editor")  */
        monaco,
        /** Gets a monaco-typescript worker, this will give you access to a language server. Note: prefer this for language server work because it happens on a webworker . */
        getWorkerProcess,
        /** A copy of require("@typescript/vfs") this can be used to quickly set up an in-memory compiler runs for ASTs, or to get complex language server results (anything above has to be serialized when passed)*/
        tsvfs,
        /** Get all the different emitted files after TypeScript is run */
        getEmitResult,
        /** Gets just the JavaScript for your sandbox, will transpile if in TS only */
        getRunnableJS,
        /** Gets the DTS output of the main code in the editor */
        getDTSForCode,
        /** The monaco-editor dom node, used for showing/hiding the editor */
        getDomNode,
        /** The model is an object which monaco uses to keep track of text in the editor. Use this to directly modify the text in the editor */
        getModel,
        /** Gets the text of the main model, which is the text in the editor */
        getText,
        /** Shortcut for setting the model's text content which would update the editor */
        setText,
        /** Gets the AST of the current text in monaco - uses `createTSProgram`, so the performance caveat applies there too */
        getAST,
        /** The module you get from require("typescript") */
        ts,
        /** Create a new Program, a TypeScript data model which represents the entire project. As well as some of the
         * primitive objects you would normally need to do work with the files.
         *
         * The first time this is called it has to download all the DTS files which is needed for an exact compiler run. Which
         * at max is about 1.5MB - after that subsequent downloads of dts lib files come from localStorage.
         *
         * Try to use this sparingly as it can be computationally expensive, at the minimum you should be using the debounced setup.
         *
         * Accepts an optional fsMap which you can use to add any files, or overwrite the default file.
         *
         * TODO: It would be good to create an easy way to have a single program instance which is updated for you
         * when the monaco model changes.
         */
        setupTSVFS,
        /** Uses the above call setupTSVFS, but only returns the program */
        createTSProgram,
        /** The Sandbox's default compiler options  */
        compilerDefaults,
        /** The Sandbox's current compiler options */
        getCompilerOptions,
        /** Replace the Sandbox's compiler options */
        setCompilerSettings,
        /** Overwrite the Sandbox's compiler options */
        updateCompilerSetting,
        /** Update a single compiler option in the SAndbox */
        updateCompilerSettings,
        /** A way to get callbacks when compiler settings have changed */
        setDidUpdateCompilerSettings,
        /** A copy of lzstring, which is used to archive/unarchive code */
        lzstring,
        /** Returns compiler options found in the params of the current page */
        createURLQueryWithCompilerOptions,
        /**
         * @deprecated Use `getTwoSlashCompilerOptions` instead.
         *
         * Returns compiler options in the source code using twoslash notation
         */
        getTwoSlashComplierOptions: getTwoSlashCompilerOptions,
        /** Returns compiler options in the source code using twoslash notation */
        getTwoSlashCompilerOptions,
        /** Gets to the current monaco-language, this is how you talk to the background webworkers */
        languageServiceDefaults: defaults,
        /** The path which represents the current file using the current compiler options */
        filepath: filePath.path,
        /** Adds a file to the vfs used by the editor */
        addLibraryToRuntime,
    };
};
