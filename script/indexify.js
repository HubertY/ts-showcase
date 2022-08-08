const fs = require("fs");
const path = require("path");
const { ContextExclusionPlugin } = require("webpack");

function opendirPrefixed(dir, prefix) {
    return fs.promises.opendir(path.join(prefix, dir));
}

async function* walk(dir, prefix = '') {
    for await (const d of await opendirPrefixed(dir, prefix)) {
        const entry = path.join(dir, d.name);
        if (d.isDirectory()) yield* walk(entry, prefix);
        else if (d.isFile()) yield entry;
    }
}

// Then, use it with a simple async for loop
async function main(prefix, inpath) {
    const out = { paths: [] };
    for await (const p of walk(inpath, prefix)) {
        const pp = p.replace(/\\/g, '/');
        out.paths.push(pp);
    }
    const s = JSON.stringify(out);
    await new Promise((resolve) => fs.writeFile(`${prefix}/directory.json`, s, resolve));
}
const argv = process.argv;
if (argv.length !== 3) {
    throw RangeError("needs one arguments");
} else {
    main(argv[2], "");
}