import test from "node:test";
import assert from "node:assert/strict";
import { fresh, restore, VERSION } from "../src/game.js";
import { skipPlacementConfirmation } from '../src/editing.js';

test('purchase and layout preferences restore independently, including older skip-purchase saves',()=>{
  const old={...fresh(),skipPurchaseConfirmation:true};delete old.skipBuildConfirmation;
  assert.equal(restore(old).skipBuildConfirmation,false);
  for(const purchase of [false,true])for(const build of [false,true]){
    const s=restore({...fresh(),skipPurchaseConfirmation:purchase,skipBuildConfirmation:build});
    assert.equal(s.skipPurchaseConfirmation,purchase);assert.equal(s.skipBuildConfirmation,build);
    for(const kind of ['expand','build','home-build','garden-build','studio-build','move','home-move','garden-move','studio-move'])assert.equal(skipPlacementConfirmation(s,{kind}),build);
    for(const kind of ['land-store','garden-edit','confirm','facility-upgrade','appearance-purchase'])assert.equal(skipPlacementConfirmation(s,{kind}),false);
  }
  for(const bad of ['true','false',1,{},null])assert.equal(restore({...fresh(),skipBuildConfirmation:bad}).skipBuildConfirmation,false);
});

test("new and older saves retain purchase confirmation by default", () => {
  assert.equal(fresh().skipPurchaseConfirmation, false);
  for (const version of [2, 3, 4, VERSION]) {
    const old = { ...fresh(), version };
    delete old.skipPurchaseConfirmation;
    assert.equal(restore(old).skipPurchaseConfirmation, false);
  }
});

test("the user's purchase preference survives export and reload in both directions", () => {
  for (const enabled of [true, false]) {
    const original = restore(fresh());
    original.skipPurchaseConfirmation = enabled;
    const loaded = restore(JSON.parse(JSON.stringify(original)));
    assert.equal(loaded.skipPurchaseConfirmation, enabled);
    assert.equal(loaded.money, original.money);
    assert.deepEqual(loaded.counts, original.counts);
  }
});

test("malformed imported preferences cannot silently disable confirmation", () => {
  for (const value of ["false", "true", 1, {}, [], null]) {
    assert.equal(
      restore({ ...fresh(), skipPurchaseConfirmation: value })
        .skipPurchaseConfirmation,
      false,
    );
  }
});
