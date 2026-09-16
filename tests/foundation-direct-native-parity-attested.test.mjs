import assert from 'node:assert/strict';
import test from 'node:test';
import {
  FOUNDATION_DIRECT_NATIVE_PARITY_ATTESTED_FORMAT,
  verifyFoundationDirectNativeParityAttested,
} from '../src/foundation-direct-native-parity-attested.mjs';
import {
  createNativeVmExecutionAttestation,
  verifyNativeVmExecutionAttestation,
} from '../src/native-vm-execution-attestation.mjs';

function attestation() {
  return createNativeVmExecutionAttestation({
    format:'taowind.rcl-native-vm-materialization.v0.2', version:'0.2.0', provenance:'staged-repository-source-makefile',
    sourceRoot:'1'.repeat(64), binarySha256:'2'.repeat(64),
  }, {
    vm:'rcl-native-vm/0.6.0-alpha.1', bytecodeVersion:'1.0', program:'P', sourceRoot:'program-root',
  });
}
function base(overrides={}) {
  return {
    format:'taowind.rcl-foundation-direct-native-parity-composite.v0.3', version:'0.3.0',
    status:'native-verified', verified:true, diagnostics:[], lowering:{lowered:[],summary:{loweredCount:0}},
    lineage:{ok:true}, domainReceipt:{ok:true,receiptRoot:'receipt'},
    nativeExecutionAttestation:attestation(),
    parity:{state:true,semanticStateRoot:true,nativeStateRootVerified:true,nativeStateRootParity:true,loweringLineage:true,domainReceipt:true},
    roots:{nativeVmExecutionAttestationRoot:attestation().attestationRoot}, gaps:[], truthBoundary:{},
    ...overrides,
  };
}
function options(result) { return { verifyComposite:async()=>result }; }

test('attested Foundation parity requires and verifies exact executable identity', async()=>{
  const result=await verifyFoundationDirectNativeParityAttested({name:'P'},options(base()));
  assert.equal(result.format,FOUNDATION_DIRECT_NATIVE_PARITY_ATTESTED_FORMAT);
  assert.equal(result.status,'native-verified');
  assert.equal(result.verified,true);
  assert.equal(result.parity.nativeExecutionAttestation,true);
  assert.equal(result.executionAttestationVerification.ok,true);
  assert.equal(result.truthBoundary.exactExecutableArtifactIdentityIsNonCompensatory,true);
});

test('missing execution attestation fails closed even when all prior parity gates pass', async()=>{
  const result=await verifyFoundationDirectNativeParityAttested({name:'P'},options(base({nativeExecutionAttestation:null})));
  assert.equal(result.status,'parity-failed');
  assert.equal(result.verified,false);
  assert.equal(result.parity.nativeExecutionAttestation,false);
  assert.ok(result.gaps.includes('nativeExecutionAttestation'));
});

test('tampered executable digest invalidates attested native verification', async()=>{
  const bad=attestation(); bad.materialization.binarySha256='3'.repeat(64);
  const result=await verifyFoundationDirectNativeParityAttested({name:'P'},options(base({nativeExecutionAttestation:bad})));
  assert.equal(verifyNativeVmExecutionAttestation(bad).ok,false);
  assert.equal(result.status,'parity-failed');
  assert.equal(result.executionAttestationVerification.checks.attestationRoot,false);
});

test('execution attestation cannot compensate an earlier parity failure', async()=>{
  const result=await verifyFoundationDirectNativeParityAttested({name:'P'},options(base({status:'parity-failed',verified:false,parity:{state:false},gaps:['state']})));
  assert.equal(result.executionAttestationVerification.ok,true);
  assert.equal(result.verified,false);
  assert.equal(result.status,'parity-failed');
  assert.ok(result.gaps.includes('state'));
});

test('attested entry point reports that canonical default Foundation parity is promoted', async()=>{
  const result=await verifyFoundationDirectNativeParityAttested({name:'P'},options(base()));
  assert.equal(result.truthBoundary.defaultFoundationParityEntryPointPromotedToAttested,true);
  assert.equal(result.truthBoundary.nativeExecutionAttestationRequiredForNativeVerified,true);
});
