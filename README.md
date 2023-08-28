# ts-showcase
An extension of Typescript Playground that allows injection of non-npm packages.

## Usage:
1. Load Monaco and Typescript into your environment. You can use `fetchModulesFromCDN()`  in the browser to fetch them as UMD modules.
2. Pass Monaco and Typescript into `init({editor, ts})`.
3. Make a new Showcase with `new Showcase(domEle, opts)`. Once the sandbox is initialized and all packages are downloaded, the editor will render as a child of `domEle`.
4. To compile the code in the editor to Javascript and run it in the browser, call `Showcase.run(target)` where target is a `Document` such as `window.document` or the `HTMLIFrameElement.contentDocument`.

## To provide custom packages:
1. Create a directory of custom packages, such as `.../packages/pkg1/`, `.../packages/pkg2/`, etc.
2. Use `npm run indexify` to create a directory listing `.../proj/static/packages/directory.json`.
3. Expose the packages to the internet, e.g at `https://site.com/static/packages/`.
4. Set the option `{local?: { localDeps: string[], libDir: string }}` when constructing the Showcase. `localDeps` is a list of custom package names (as if they were installed in node_modules). `libDir` is a path to the public location of the package directory (as if it was a link to node_modules). In this case it would be `{ localDeps: ["pkg1", "pkg2"], libDir: "/static/packages" }`.

Only supports importing single-file JS bundles, so maybe use Webpack. Multiple type declaration files are OK.

It's suggested to pass `allowJs: true` and `noImplicitAny: false` as Typescript compiler options when constructing the Showcase.