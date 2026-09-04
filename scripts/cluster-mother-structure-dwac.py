"""Run the bounded DWAC structural pass over Mother Structure IR output.

This bridge is an analysis adapter only. It preserves SOURCE_ASSERTION claims,
candidate-only status, and the boundary between structural analogy and semantic
ownership.
"""

from __future__ import annotations

from collections import defaultdict
from pathlib import Path
import hashlib
import json
import os
import sys
from typing import Any


REPO_ROOT = Path(__file__).resolve().parents[1]
DWAC_ROOT = Path(os.environ.get("DWAC_ROOT", str(REPO_ROOT.parent / "dwac-main-postmerge-86cf")))
INPUT_PATH = Path(sys.argv[1] if len(sys.argv) > 1 else "output/mother-structure-ir-v0.1/corpus.json").resolve()
OUTPUT_PATH = Path(sys.argv[2] if len(sys.argv) > 2 else "output/mother-structure-ir-v0.1/dwac-clusters.json").resolve()

sys.path.insert(0, str(DWAC_ROOT))
sys.path.insert(0, str(DWAC_ROOT / "native_capability_organogenesis"))

from dual_teacher_distillation_runtime import MetaArchitectRuntime  # noqa: E402
from dwac_native_capability.analogy import StructuralAnalogyOrgan  # noqa: E402
from dwac_native_capability.knowledge_ir import PatternLens  # noqa: E402
from dwac_native_capability.pattern_lens import PatternLensFoundry, PatternLensLibrary  # noqa: E402
from dwac_native_capability.symbolic_system import SymbolicSystemCompiler  # noqa: E402


def short_id(value: str, prefix: str) -> str:
    return f"{prefix}.{hashlib.sha256(value.encode('utf-8')).hexdigest()[:16]}"


def load_json(path: Path) -> dict[str, Any]:
    return json.loads(path.read_text(encoding="utf-8"))


def main() -> None:
    corpus = load_json(INPUT_PATH)
    packs = corpus.get("dwacInput") or []
    compiler = SymbolicSystemCompiler(max_symbols=128, max_relations=256)
    foundry = PatternLensFoundry()
    library = PatternLensLibrary(max_patterns=4096)
    analogy = StructuralAnalogyOrgan(candidate_threshold=0.58)
    compiled: list[dict[str, Any]] = []
    compile_failures: list[dict[str, str]] = []
    lens_rows: dict[str, dict[str, Any]] = {}
    pack_by_id = {pack.get("system_id"): pack for pack in packs}

    for pack in packs:
        try:
            system = compiler.compile(pack)
            lens = foundry.extract(system)
            library.register(lens)
        except Exception as error:  # keep one malformed observation isolated
            compile_failures.append({"systemId": str(pack.get("system_id")), "error": f"{type(error).__name__}:{error}"})
            continue
        lens_dict = lens.to_dict()
        lens_rows.setdefault(lens.lens_id, {"lens": lens_dict, "systemIds": []})["systemIds"].append(pack["system_id"])
        compiled.append({"systemId": pack["system_id"], "lensId": lens.lens_id})

    repeated_lenses = {
        lens_id: row for lens_id, row in lens_rows.items() if len(row["systemIds"]) >= 2
    }
    lens_summaries = []
    for lens_id, row in sorted(repeated_lenses.items()):
        packs_for_lens = [pack_by_id[system_id] for system_id in row["systemIds"]]
        structure_ids = sorted({pack.get("metadata", {}).get("structureId") for pack in packs_for_lens})
        scopes = sorted({pack.get("domain", "unknown") for pack in packs_for_lens})
        lens_summaries.append({
            "lensId": lens_id,
            "occurrenceCount": len(packs_for_lens),
            "structureIds": [value for value in structure_ids if value],
            "scopes": scopes,
            "systemIds": sorted(row["systemIds"]),
            "lens": row["lens"],
        })

    lens_objects = {lens_id: PatternLens(**row["lens"]) for lens_id, row in repeated_lenses.items()}
    parent = {lens_id: lens_id for lens_id in lens_objects}

    def find(item: str) -> str:
        while parent[item] != item:
            parent[item] = parent[parent[item]]
            item = parent[item]
        return item

    def union(left: str, right: str) -> None:
        left_root, right_root = find(left), find(right)
        if left_root != right_root:
            parent[right_root] = left_root

    analogy_candidates = []
    lens_ids = sorted(lens_objects)
    for index, source_id in enumerate(lens_ids):
        for target_id in lens_ids[index + 1:]:
            candidate = analogy.compare(lens_objects[source_id], lens_objects[target_id]).to_dict()
            if candidate["decision"] == "STRUCTURAL_ANALOGY_CANDIDATE":
                analogy_candidates.append(candidate)
                union(source_id, target_id)

    components: dict[str, list[str]] = defaultdict(list)
    for lens_id in lens_ids:
        components[find(lens_id)].append(lens_id)
    mother_clusters = []
    for root, cluster_lens_ids in sorted(components.items()):
        system_ids = sorted({system_id for lens_id in cluster_lens_ids for system_id in repeated_lenses[lens_id]["systemIds"]})
        cluster_packs = [pack_by_id[system_id] for system_id in system_ids]
        structure_ids = sorted({pack.get("metadata", {}).get("structureId") for pack in cluster_packs if pack.get("metadata", {}).get("structureId")})
        scopes = sorted({pack.get("domain", "unknown") for pack in cluster_packs})
        mother_clusters.append({
            "clusterId": short_id("|".join(cluster_lens_ids), "mother"),
            "lensIds": sorted(cluster_lens_ids),
            "systemIds": system_ids,
            "structureIds": structure_ids,
            "scopes": scopes,
            "occurrenceCount": len(system_ids),
            "decision": "STRUCTURAL_MOTHER_CANDIDATE",
            "causalClaim": False,
            "identityClaim": False,
            "promotion": "NOT_AUTOMATIC",
            "basis": "exact observed graph recurrence plus bounded structural analogy; analogy does not establish semantic identity",
        })

    meta = MetaArchitectRuntime()
    meta_result = meta.analyze(
        goal="cluster repeated candidate semantic structures for later RCL Integration Court review",
        current_architecture={"modules": [
            {"name": "mother-structure-ir", "semantic_tags": ["candidate", "repetition", "graph", "provenance"]},
            {"name": "dwac-structural-analysis", "semantic_tags": ["candidate", "repetition", "graph", "provenance"]},
        ]},
        constraints={"no_automatic_promotion": True, "no_authority_transfer": True},
    )

    result_without_root = {
        "format": "rcl.mother-structure.dwac-clusters.v0.1",
        "status": "CANDIDATE_ONLY",
        "input": str(INPUT_PATH),
        "inputRoot": corpus.get("root"),
        "dwacRoot": str(DWAC_ROOT),
        "compiledCount": len(compiled),
        "compileFailures": compile_failures,
        "patternLensCount": len(lens_rows),
        "repeatedPatternLens": lens_summaries,
        "analogyCandidateCount": len(analogy_candidates),
        "analogyCandidates": analogy_candidates,
        "motherClusters": mother_clusters,
        "metaArchitect": meta_result,
        "authorityBoundary": {
            "canonicalOwner": "RCL candidate extraction only",
            "structuralAnalogyIsNotSemanticIdentity": True,
            "causalClaims": False,
            "identityClaims": False,
            "promotion": "NOT_AUTOMATIC",
            "integrationCourtRequired": True,
        },
    }
    result = {
        **result_without_root,
        "root": hashlib.sha256(json.dumps(result_without_root, sort_keys=True, separators=(",", ":")).encode("utf-8")).hexdigest(),
    }
    OUTPUT_PATH.parent.mkdir(parents=True, exist_ok=True)
    OUTPUT_PATH.write_text(json.dumps(result, indent=2, ensure_ascii=False) + "\n", encoding="utf-8")
    print(json.dumps({
        "status": result["status"],
        "compiledCount": result["compiledCount"],
        "compileFailureCount": len(result["compileFailures"]),
        "patternLensCount": result["patternLensCount"],
        "repeatedPatternLensCount": len(result["repeatedPatternLens"]),
        "analogyCandidateCount": result["analogyCandidateCount"],
        "motherClusterCount": len(result["motherClusters"]),
        "root": result["root"],
    }, indent=2))


if __name__ == "__main__":
    main()
