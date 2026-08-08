# A3 Legacy Evidence Closure Report v0.1

- Status: **VERIFIED**
- Branch: `research/rbc13-domain-call-salvage-v0.1`
- Commit: `79c5f67ea9b7f0bbd927175da2d051a3fcda947f`
- Expected inventory: 6 stable IDs
- Inventory root: `c33453601f567a33a11413b7d958f864ebca7f1445b65cae16b5f70a04003a8a`
- Evidence root: `d5193e31834b6f2b069b35f2d43df26d79f907e57c235726a260e7c194935f4e`
- Reproduction: `npm run verify:rbc13-legacy-evidence-closure`

## Scope

The committed expected inventory is authoritative for this closure. It contains one current-source RBC 1.1 Stage-5 encoder case and five current-source RBC 1.2 Foundation Native bridge cases. RBC 1.3 experimental Domain Organ cases are intentionally excluded.

## Receipt inventory

| Case | RBC | Runtime | Source root | Bytecode root | Result root | Receipt root | Replay |
|---|---:|---|---|---|---|---|---|
| rbc11.stage5.encoder | 1.1 | rcl-native-vm/0.6.0-alpha.1 | fd9b4e1db21e91221eb89e11002650b5be1b1e36f416f7982ee474f00615011f | 2d99bbd95d7e67077db9694d156faf9c43484e58bff54c3381a3a32857071aea | 57d29cd1e7990002f842657d9862e1d3a04135671985ab6bf3f895371058301d | f3c9ef94d8e42353cdaaaae374adf844f36c535bf3a2ff0192498c75f1c35645 | VERIFIED |
| rbc12.foundation.batch-a | 1.2 | rcl-native-vm/0.6.0-alpha.1 | 1c6d79d81ce5f6af02e73dde5021418df5061a73daabeadb72bfad2f143e88f8 | 3705305f0548d2945a313609c2f27da0c24166f31ee9659dc5ba7b0e57403209 | ea668d63168483bf6bc8e68a2c0166338df5912f355f2ae0edce5fc1d30d91ad | 9292b4a7fdcc23f878fcab2aa79efbb6377715d95fb02da36cdb77881f1a50c5 | VERIFIED |
| rbc12.foundation.meta-batch-b | 1.2 | rcl-native-vm/0.6.0-alpha.1 | a26349e4cfe61007dfdfff228a8a1f8047addda1029e062a2f65f5346aa8fdff | e5ed4c14852ed7d531e36eed46779533d9c7905deecb34364e19edaff8d3048f | 5563283f81d4e407af65129034a5cb80d3a2d9a19082ca9de0f15e3cc7467df3 | feb493a9cdb0079a5896817c2ec99b18e4a51a3f3cffb7dae649cabd262bc2e9 | VERIFIED |
| rbc12.foundation.batch-c | 1.2 | rcl-native-vm/0.6.0-alpha.1 | 8837e82b8e2a40dd1100044d6c8145cb7f4e5cd79b069944fcbb0dccfa808df3 | b9d3885ffdbcbaaf6f51fa229656bc235a1b6217f555e2f86f4983d2da3f14fa | 2740eb8b9fb8ff18d3aeae50a68996ab837e10601fbd38bb8beac741ae6a04ed | fecbf8083283367d19cbddf1ea6e80fadc68d9c7d33c209adff1518e0dfef770 | VERIFIED |
| rbc12.foundation.batch-d | 1.2 | rcl-native-vm/0.6.0-alpha.1 | 850f89424395477a24c9cd33be1c420110240b5f6db30c5df9a0047a2f50c4b7 | 46c8480d2232d73312f8072a450d028f6544142a24654787f1f4c54e752f70db | 60e94e8d86e2413c4b61fd0d1441315a895e8144b0b56e2a3e5c38e97d116b31 | 1d6e6ed322abf348383f7941b247153de5b44629cf68be5193c270380725d28b | VERIFIED |
| rbc12.foundation.batch-e | 1.2 | rcl-native-vm/0.6.0-alpha.1 | ddd309904ac311c9878ef622238dec862e245d3ec1f7906c2ff3022960eeeb83 | 804225ba2601885ea8f96a1e97d35dfccf396f56027d18926d1067c36ed58290 | f501994fd6c4654f092985381654aa8f0c81e66681cbe15c38fbbade7ba87496 | 889f51cc49ac3a2f118c871b5da76374afaedd2054ec63c6e17ac3ddfd0ca253 | VERIFIED |

## Closure checks

- expectedInventoryAuthoritative: PASS
- stableIdsUnique: PASS
- noUnexpectedCases: PASS
- noMissingCases: PASS
- noDuplicateReceiptRoots: PASS
- noStaleReceipts: PASS
- noAlteredReceipts: PASS
- replayRootConsistency: PASS
- rbc11Verified: PASS
- rbc12Verified: PASS

## Integrity findings

- Missing: none
- Duplicate: none
- Stale: none
- Altered: none
- Replay mismatch: none

## Boundary

This closes only the committed RBC 1.1/RBC 1.2 legacy receipt inventory. It does not canonize RBC 1.3 or validate the experimental AI and Universal tracks.
