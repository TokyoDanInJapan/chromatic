/**
 * The module entry point, for bundlers and for anything that imports rather
 * than loads a script tag.
 *
 * `chromatic.js` stays a classic script, because a module cannot be loaded
 * over `file://` and opening the demo by double-clicking it is worth keeping.
 * So the source is the script, and this is a wrapper over it rather than a
 * second copy of the library: it runs the script for its one side effect and
 * republishes what that side effect set.
 *
 * Importing this is safe anywhere. The script touches no DOM until a function
 * is called, so a server-side render that imports it does not fall over - it
 * only has nothing to draw on.
 */
import './chromatic.js';

/** Everything `chromatic.js` publishes, as one object. */
const Chromatic = globalThis.Chromatic;

export const { DISPERSION, supports, aberrate, spreadOf } = Chromatic;
export { Chromatic };
export default Chromatic;
