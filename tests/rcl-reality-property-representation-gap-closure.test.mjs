import test from 'node:test';import assert from 'node:assert/strict';
import { physicalQuantity,addPhysicalQuantities,multiplyPhysicalQuantities,createPhysicalPropertySet,createWorldLawSet,bindPropertyLaw,createPropertyTransitionProposal } from '../src/physical-property-law.mjs';
import { createRepresentationRef,createRepresentationPolicy,createRepresentationEquivalenceReceipt,createRepresentationTransition } from '../src/representation-governance.mjs';
const A='a'.repeat(64),B='b'.repeat(64),C='c'.repeat(64),D='d'.repeat(64),E='e'.repeat(64),F='f'.repeat(64);

test('physical quantity enforces dimensions and keeps uncertainty/provenance/authority explicit',()=>{
 const m=physicalQuantity({value:2,unit:'kg',dimension:{M:1},uncertainty:0.01,provenanceRoots:[A],authorityRoot:B});
 const m2=physicalQuantity({value:3,unit:'kg',dimension:{M:1},uncertainty:0.02,provenanceRoots:[C],authorityRoot:B});
 const sum=addPhysicalQuantities(m,m2);assert.equal(sum.value,5);assert.equal(sum.dimension.M,1);
 const v=physicalQuantity({value:4,unit:'m/s',dimension:{L:1,T:-1},authorityRoot:B});
 const p=multiplyPhysicalQuantities(m,v,{unit:'kg*m/s'});assert.deepEqual({M:p.dimension.M,L:p.dimension.L,T:p.dimension.T},{M:1,L:1,T:-1});
 assert.throws(()=>addPhysicalQuantities(m,v),/RCL_PHYSICAL_DIMENSION_MISMATCH/u);
});

test('PropertySet + WorldLawSet bind to RNCS truth ownership while RCL owns semantics only',()=>{
 const mass=physicalQuantity({value:10,unit:'kg',dimension:{M:1},authorityRoot:A});
 const props=createPhysicalPropertySet({objectId:'car:1',detailLevel:'P2',properties:{mass},evidenceRoots:[B]});
 const laws=createWorldLawSet({lawSetId:'earth',lawSetVersion:'1',laws:[{lawId:'newton-2',domain:'mechanical',expressionRoot:C,kind:'interaction'}],evidenceRoots:[D]});
 const binding=bindPropertyLaw({objectId:'car:1',propertySetRoot:props.propertySetRoot,lawSetRoot:laws.lawSetRoot,domains:['mechanical'],authorityRoot:E});
 assert.equal(props.canonicalTruthOwner,'rncs');assert.equal(laws.semanticOwner,'rcl');assert.equal(binding.canonicalTruthOwner,'rncs');
 const proposal=createPropertyTransitionProposal({objectId:'car:1',sourcePropertyRoot:props.propertySetRoot,sourceStateRoot:A,lawBindingRoot:binding.bindingRoot,appliedInputRoot:B,providerId:'physics-provider',predictedOutputRoot:C,constraintReceiptRoot:D,authorityRoot:E,uncertainty:0.1});
 assert.equal(proposal.status,'CANDIDATE_ONLY');assert.equal(proposal.rncsCommitPerformed,false);assert.equal(proposal.providerMayRewriteCanonicalTruth,false);
});

test('representation governance separates visual equivalence from physical/world truth',()=>{
 const left=createRepresentationRef({objectId:'obj:1',representationId:'gauss',representationType:'gaussian',providerId:'spark',providerVersion:'2.1',contentRoot:A,evidenceRoots:[B]});
 const right=createRepresentationRef({objectId:'obj:1',representationId:'mesh',representationType:'mesh',providerId:'mesh-provider',providerVersion:'1',contentRoot:C,evidenceRoots:[D]});
 const policy=createRepresentationPolicy({policyId:'p1',allowedTypes:['gaussian','mesh'],detailRange:{min:0,max:5},residencyTiers:['VRAM','RAM','SSD'],errorBudget:0.05,authorityRoot:E});
 const eq=createRepresentationEquivalenceReceipt({leftRoot:left.representationRoot,rightRoot:right.representationRoot,objectId:'obj:1',task:'visual-navigation',claims:{visual:{equivalent:true,evidenceRoot:F},physical:{equivalent:false}}});
 const tr=createRepresentationTransition({source:left,target:right,policyRoot:policy.policyRoot,equivalenceReceiptRoot:eq.receiptRoot,authorityRoot:E});
 assert.equal(left.providerOwnsWorldTruth,false);assert.equal(eq.claims.physical.equivalent,false);assert.equal(tr.canonicalWorldTruthChanged,false);assert.equal(tr.rncsCommitPerformed,false);
});

test('visual evidence cannot silently certify physical equivalence and object identity cannot drift',()=>{
 assert.throws(()=>createRepresentationEquivalenceReceipt({leftRoot:A,rightRoot:B,objectId:'o',claims:{visual:{equivalent:true,evidenceRoot:C},physical:{equivalent:true,evidenceRoot:C}}}),/RCL_REPRESENTATION_VISUAL_EVIDENCE_CANNOT_IMPLY_PHYSICAL_EQUIVALENCE/u);
 const a=createRepresentationRef({objectId:'a',representationId:'r1',representationType:'mesh',providerId:'p',providerVersion:'1',contentRoot:A});
 const b=createRepresentationRef({objectId:'b',representationId:'r2',representationType:'mesh',providerId:'p',providerVersion:'1',contentRoot:B});
 assert.throws(()=>createRepresentationTransition({source:a,target:b,policyRoot:C,equivalenceReceiptRoot:D,authorityRoot:E}),/RCL_REPRESENTATION_OBJECT_IDENTITY_MISMATCH/u);
});
