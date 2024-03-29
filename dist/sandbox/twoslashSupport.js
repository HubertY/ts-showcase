const booleanConfigRegexp = /^\/\/\s?@(\w+)$/;
// https://regex101.com/r/8B2Wwh/1
const valuedConfigRegexp = /^\/\/\s?@(\w+):\s?(.+)$/;
/**
 * This is a port of the twoslash bit which grabs compiler options
 * from the source code
 */
export const extractTwoSlashCompilerOptions = (ts) => {
    let optMap = new Map();
    if (!("optionDeclarations" in ts)) {
        console.error("Could not get compiler options from ts.optionDeclarations - skipping twoslash support.");
    }
    else {
        // @ts-ignore - optionDeclarations is not public API
        for (const opt of ts.optionDeclarations) {
            optMap.set(opt.name.toLowerCase(), opt);
        }
    }
    return (code) => {
        const codeLines = code.split("\n");
        const options = {};
        codeLines.forEach(_line => {
            let match;
            const line = _line.trim();
            if ((match = booleanConfigRegexp.exec(line))) {
                if (optMap.has(match[1].toLowerCase())) {
                    options[match[1]] = true;
                    setOption(match[1], "true", options, optMap);
                }
            }
            else if ((match = valuedConfigRegexp.exec(line))) {
                if (optMap.has(match[1].toLowerCase())) {
                    setOption(match[1], match[2], options, optMap);
                }
            }
        });
        return options;
    };
};
function setOption(name, value, opts, optMap) {
    const opt = optMap.get(name.toLowerCase());
    if (!opt)
        return;
    switch (opt.type) {
        case "number":
        case "string":
        case "boolean":
            opts[opt.name] = parsePrimitive(value, opt.type);
            break;
        case "list":
            const elementType = opt.element.type;
            const strings = value.split(",");
            if (typeof elementType === "string") {
                opts[opt.name] = strings.map(v => parsePrimitive(v, elementType));
            }
            else {
                opts[opt.name] = strings.map(v => getOptionValueFromMap(opt.name, v, elementType)).filter(Boolean);
            }
            break;
        default: // It's a map!
            const optMap = opt.type;
            opts[opt.name] = getOptionValueFromMap(opt.name, value, optMap);
    }
    if (opts[opt.name] === undefined) {
        const keys = Array.from(opt.type.keys());
        console.log(`Invalid value ${value} for ${opt.name}. Allowed values: ${keys.join(",")}`);
    }
}
export function parsePrimitive(value, type) {
    switch (type) {
        case "number":
            return +value;
        case "string":
            return value;
        case "boolean":
            return value.toLowerCase() === "true" || value.length === 0;
    }
    console.log(`Unknown primitive type ${type} with - ${value}`);
}
function getOptionValueFromMap(name, key, optMap) {
    const result = optMap.get(key.toLowerCase());
    if (result === undefined) {
        const keys = Array.from(optMap.keys());
        console.error(`Invalid inline compiler value`, `Got ${key} for ${name} but it is not a supported value by the TS compiler.`, `Allowed values: ${keys.join(",")}`);
    }
    return result;
}
// Function to generate autocompletion results
export const twoslashCompletions = (ts, monaco) => (model, position, _token) => {
    const result = [];
    // Split everything the user has typed on the current line up at each space, and only look at the last word
    const thisLine = model.getValueInRange({
        startLineNumber: position.lineNumber,
        startColumn: 0,
        endLineNumber: position.lineNumber,
        endColumn: position.column,
    });
    // Not a comment
    if (!thisLine.startsWith("//")) {
        return { suggestions: [] };
    }
    const words = thisLine.replace("\t", "").split(" ");
    // Not the right amount of
    if (words.length !== 2) {
        return { suggestions: [] };
    }
    const word = words[1];
    if (word.startsWith("-")) {
        return {
            suggestions: [
                {
                    label: "---cut---",
                    kind: 14,
                    detail: "Twoslash split output",
                    insertText: "---cut---".replace(word, ""),
                },
            ],
        };
    }
    // Not a @ at the first word
    if (!word.startsWith("@")) {
        return { suggestions: [] };
    }
    const knowns = [
        "noErrors",
        "errors",
        "showEmit",
        "showEmittedFile",
        "noStaticSemanticInfo",
        "emit",
        "noErrorValidation",
        "filename",
    ];
    // @ts-ignore - ts.optionDeclarations is private
    const optsNames = ts.optionDeclarations.map(o => o.name);
    knowns.concat(optsNames).forEach(name => {
        if (name.startsWith(word.slice(1))) {
            // somehow adding the range seems to not give autocomplete results?
            result.push({
                label: name,
                kind: 14,
                detail: "Twoslash comment",
                insertText: name,
            });
        }
    });
    return {
        suggestions: result,
    };
};
