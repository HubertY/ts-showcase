import { supportedReleases } from './release_data';
/**
 * The versions of monaco-typescript which we can use
 * for backwards compatibility with older versions
 * of TS in the playground.
 */
export const monacoTSVersions = [...supportedReleases, 'Latest'];
/** Returns the latest TypeScript version supported by the sandbox */
export const latestSupportedTypeScriptVersion = Object.keys(monacoTSVersions)
    .filter(key => key !== 'Nightly' && !key.includes('-'))
    .sort()
    .pop();
