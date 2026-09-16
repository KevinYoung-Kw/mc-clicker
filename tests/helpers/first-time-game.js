import { fresh as newGame } from '../../src/game.js';
import { chooseOpening } from '../../src/opening-guide.js';
export function fresh(...args) {
  const s=newGame(...args);chooseOpening(s,'first');return s;
}
