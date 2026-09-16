import metadata from '../package.json' with { type: 'json' };
// package.json is the display-release source of truth. Save schema stays separate.
export const RELEASE_VERSION = metadata.version;
export const RELEASE_NAME = `V${RELEASE_VERSION}`;
export const GAME_NAME = "MC Clicker 2.0";
export const RELEASE_CREDIT = "GPT-6 Astra";
