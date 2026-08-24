# TaoWind Language Federation Map v0.1

Status: **CANDIDATE**

```text
Natural / Living surfaces
  zh-CN, en-US, future locales
           |
           v
Expression / Domain auxiliary organs
  RSL [CANDIDATE]   IAL [CANDIDATE]   SNLL [LOCAL CANDIDATE]   CSL [EXECUTABLE]
           \              |                    |                    /
            \             |                    |                   /
             +------ Semantic profiles / ASIL [EXECUTABLE, FEDERATION CANDIDATE]
                                      |
                                      v
                        RCL [VERIFIED CANONICAL REALITY IR]
                                      |
                                      v
Execution organs
  native C/RBC [VERIFIED], Node reference [VERIFIED], Web/Android [CANDIDATE],
  other specialist languages [UNREGISTERED / UNKNOWN]
```

The v0.1 implemented path is deliberately narrow:

```text
RSL create-project surface (zh-CN or en-US)
  -> locale-specific Surface AST
  -> ASIL Programming Profile TaskFrame subset
  -> RCL candidate program containing `foresee`, not `realize`
```

It proves two different surfaces can share one meaning root and one RCL program root. It does not prove general RSL, general natural-language understanding, or a general ASIL-to-RCL compiler.
