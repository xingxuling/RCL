use serde::{Deserialize, Serialize};
use serde_json::json;
use sha2::{Digest, Sha256};
use std::collections::{BTreeMap, HashMap};
use std::env;
use std::fs;
use std::io::{self, Read};
use std::path::{Path, PathBuf};

const REQUEST_FORMAT: &str = "rcl.bpe-tokenizer-request.v0.1";
const ARTIFACT_FORMAT: &str = "rcl.bpe-tokenizer-artifact.v0.1";
const BASE_TOKENIZER_ID: &str = "rcl.byte-tokenizer.utf8.v0.1";
const NORMALIZATION: &str = "NONE";
const BASE_VOCAB: u32 = 259;
const MAX_VOCAB: u32 = 65_536;
const PAD: u32 = 256;
const BOS: u32 = 257;
const EOS: u32 = 258;

#[derive(Debug)]
struct BpeError {
    code: &'static str,
    message: String,
}

impl BpeError {
    fn new(code: &'static str, message: impl Into<String>) -> Self {
        Self { code, message: message.into() }
    }
}

#[derive(Clone, Debug, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
struct SpecialTokens {
    pad: u32,
    bos: u32,
    eos: u32,
}

#[derive(Clone, Debug, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
struct MergeRecord {
    rank: u32,
    new_id: u32,
    left: u32,
    right: u32,
    frequency: u64,
}

#[derive(Clone, Debug, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
struct ArtifactBody {
    format: String,
    algorithm: String,
    base_tokenizer_id: String,
    normalization: String,
    special_tokens: SpecialTokens,
    base_vocabulary_size: u32,
    maximum_vocabulary_size: u32,
    target_vocabulary_size: u32,
    actual_vocabulary_size: u32,
    minimum_frequency: u64,
    corpus_sha256: String,
    corpus_byte_count: usize,
    complete_target: bool,
    exhausted: bool,
    merge_selection: String,
    merge_application: String,
    byte_fallback: bool,
    merges: Vec<MergeRecord>,
}

#[derive(Clone, Debug, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
struct Artifact {
    #[serde(flatten)]
    body: ArtifactBody,
    artifact_root: String,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
struct Request {
    format: String,
    operation: String,
    #[serde(default)]
    corpus_path: Option<String>,
    #[serde(default)]
    artifact_path: Option<String>,
    #[serde(default)]
    target_vocabulary_size: Option<u32>,
    #[serde(default)]
    minimum_frequency: Option<u64>,
    #[serde(default)]
    text: Option<String>,
    #[serde(default)]
    tokens: Option<Vec<u32>>,
    #[serde(default)]
    add_bos: bool,
    #[serde(default)]
    add_eos: bool,
    #[serde(default)]
    allow_special: bool,
}

fn sha256_hex(bytes: impl AsRef<[u8]>) -> String {
    hex::encode(Sha256::digest(bytes.as_ref()))
}

fn artifact_root(body: &ArtifactBody) -> Result<String, BpeError> {
    let bytes = serde_json::to_vec(body)
        .map_err(|error| BpeError::new("RCL_BPE_ARTIFACT_JSON", error.to_string()))?;
    Ok(format!("sha256:{}", sha256_hex(bytes)))
}

fn valid_target(target: u32) -> bool {
    target > BASE_VOCAB && target <= MAX_VOCAB
}

fn special_tokens() -> SpecialTokens {
    SpecialTokens { pad: PAD, bos: BOS, eos: EOS }
}

fn count_pairs(sequence: &[u32]) -> BTreeMap<(u32, u32), u64> {
    let mut counts = BTreeMap::new();
    for pair in sequence.windows(2) {
        *counts.entry((pair[0], pair[1])).or_insert(0) += 1;
    }
    counts
}

fn select_pair(counts: BTreeMap<(u32, u32), u64>, minimum_frequency: u64) -> Option<((u32, u32), u64)> {
    let mut best: Option<((u32, u32), u64)> = None;
    for (pair, frequency) in counts {
        if frequency < minimum_frequency {
            continue;
        }
        match best {
            None => best = Some((pair, frequency)),
            Some((best_pair, best_frequency)) => {
                if frequency > best_frequency || (frequency == best_frequency && pair < best_pair) {
                    best = Some((pair, frequency));
                }
            }
        }
    }
    best
}

fn apply_one_merge(sequence: &[u32], left: u32, right: u32, new_id: u32) -> Vec<u32> {
    let mut output = Vec::with_capacity(sequence.len());
    let mut index = 0usize;
    while index < sequence.len() {
        if index + 1 < sequence.len() && sequence[index] == left && sequence[index + 1] == right {
            output.push(new_id);
            index += 2;
        } else {
            output.push(sequence[index]);
            index += 1;
        }
    }
    output
}

fn validate_artifact(artifact: &Artifact) -> Result<(), BpeError> {
    let body = &artifact.body;
    if body.format != ARTIFACT_FORMAT
        || body.algorithm != "byte-bpe"
        || body.base_tokenizer_id != BASE_TOKENIZER_ID
        || body.normalization != NORMALIZATION
        || body.base_vocabulary_size != BASE_VOCAB
        || body.maximum_vocabulary_size != MAX_VOCAB
        || body.special_tokens != special_tokens()
        || !body.byte_fallback
        || body.merge_selection != "highest-frequency-then-lowest-numeric-pair-left-right"
        || body.merge_application != "non-overlapping-left-to-right"
    {
        return Err(BpeError::new("RCL_BPE_ARTIFACT_SEMANTICS", "artifact semantic header does not match the canonical K08-M profile"));
    }
    if !valid_target(body.target_vocabulary_size) || body.minimum_frequency < 2 {
        return Err(BpeError::new("RCL_BPE_ARTIFACT_CONFIG", "artifact target/minimum frequency is outside the canonical boundary"));
    }
    if body.actual_vocabulary_size != BASE_VOCAB + body.merges.len() as u32 {
        return Err(BpeError::new("RCL_BPE_ARTIFACT_VOCAB", "actual vocabulary size does not match merge count"));
    }
    for (index, merge) in body.merges.iter().enumerate() {
        let rank = index as u32;
        let expected_id = BASE_VOCAB + rank;
        if merge.rank != rank || merge.new_id != expected_id {
            return Err(BpeError::new("RCL_BPE_ARTIFACT_RANK", format!("merge {index} rank/id is not canonical")));
        }
        if merge.left >= merge.new_id || merge.right >= merge.new_id || merge.frequency < body.minimum_frequency {
            return Err(BpeError::new("RCL_BPE_ARTIFACT_REFERENCE", format!("merge {index} has invalid references/frequency")));
        }
    }
    let expected_root = artifact_root(body)?;
    if artifact.artifact_root != expected_root {
        return Err(BpeError::new("RCL_BPE_ARTIFACT_ROOT", format!("artifact root mismatch: expected {expected_root}")));
    }
    Ok(())
}

fn load_artifact(path: &Path) -> Result<Artifact, BpeError> {
    let bytes = fs::read(path).map_err(|error| BpeError::new("RCL_BPE_ARTIFACT_IO", error.to_string()))?;
    let artifact: Artifact = serde_json::from_slice(&bytes)
        .map_err(|error| BpeError::new("RCL_BPE_ARTIFACT_JSON", error.to_string()))?;
    validate_artifact(&artifact)?;
    Ok(artifact)
}

fn train(corpus_path: &Path, artifact_path: &Path, target: u32, minimum_frequency: u64) -> Result<Artifact, BpeError> {
    if !valid_target(target) {
        return Err(BpeError::new("RCL_BPE_TARGET_VOCAB", format!("target vocabulary must be {}..={MAX_VOCAB}", BASE_VOCAB + 1)));
    }
    if minimum_frequency < 2 {
        return Err(BpeError::new("RCL_BPE_MIN_FREQUENCY", "minimum frequency must be at least 2"));
    }
    let corpus = fs::read(corpus_path).map_err(|error| BpeError::new("RCL_BPE_CORPUS_IO", error.to_string()))?;
    if corpus.is_empty() {
        return Err(BpeError::new("RCL_BPE_CORPUS_EMPTY", "training corpus must not be empty"));
    }
    std::str::from_utf8(&corpus)
        .map_err(|error| BpeError::new("RCL_BPE_CORPUS_UTF8", format!("training corpus must be valid UTF-8: {error}")))?;

    let mut sequence: Vec<u32> = corpus.iter().map(|byte| u32::from(*byte)).collect();
    let mut merges = Vec::new();
    while BASE_VOCAB + merges.len() as u32 < target {
        let Some(((left, right), frequency)) = select_pair(count_pairs(&sequence), minimum_frequency) else {
            break;
        };
        let rank = merges.len() as u32;
        let new_id = BASE_VOCAB + rank;
        sequence = apply_one_merge(&sequence, left, right, new_id);
        merges.push(MergeRecord { rank, new_id, left, right, frequency });
    }

    let actual_vocabulary_size = BASE_VOCAB + merges.len() as u32;
    let complete_target = actual_vocabulary_size == target;
    let body = ArtifactBody {
        format: ARTIFACT_FORMAT.into(),
        algorithm: "byte-bpe".into(),
        base_tokenizer_id: BASE_TOKENIZER_ID.into(),
        normalization: NORMALIZATION.into(),
        special_tokens: special_tokens(),
        base_vocabulary_size: BASE_VOCAB,
        maximum_vocabulary_size: MAX_VOCAB,
        target_vocabulary_size: target,
        actual_vocabulary_size,
        minimum_frequency,
        corpus_sha256: format!("sha256:{}", sha256_hex(&corpus)),
        corpus_byte_count: corpus.len(),
        complete_target,
        exhausted: !complete_target,
        merge_selection: "highest-frequency-then-lowest-numeric-pair-left-right".into(),
        merge_application: "non-overlapping-left-to-right".into(),
        byte_fallback: true,
        merges,
    };
    let root = artifact_root(&body)?;
    let artifact = Artifact { body, artifact_root: root };
    validate_artifact(&artifact)?;
    if let Some(parent) = artifact_path.parent() {
        fs::create_dir_all(parent).map_err(|error| BpeError::new("RCL_BPE_ARTIFACT_IO", error.to_string()))?;
    }
    fs::write(
        artifact_path,
        format!("{}\n", serde_json::to_string_pretty(&artifact).map_err(|error| BpeError::new("RCL_BPE_ARTIFACT_JSON", error.to_string()))?),
    )
    .map_err(|error| BpeError::new("RCL_BPE_ARTIFACT_IO", error.to_string()))?;
    Ok(artifact)
}

fn encode_with_artifact(artifact: &Artifact, text: &str, add_bos: bool, add_eos: bool) -> Vec<u32> {
    let mut tokens: Vec<u32> = text.as_bytes().iter().map(|byte| u32::from(*byte)).collect();
    for merge in &artifact.body.merges {
        tokens = apply_one_merge(&tokens, merge.left, merge.right, merge.new_id);
    }
    if add_bos {
        tokens.insert(0, BOS);
    }
    if add_eos {
        tokens.push(EOS);
    }
    tokens
}

fn expansion_table(artifact: &Artifact) -> Result<HashMap<u32, Vec<u8>>, BpeError> {
    let mut table = HashMap::new();
    for byte in 0u32..=255 {
        table.insert(byte, vec![byte as u8]);
    }
    for merge in &artifact.body.merges {
        let left = table.get(&merge.left).cloned().ok_or_else(|| BpeError::new("RCL_BPE_ARTIFACT_REFERENCE", "missing left expansion"))?;
        let right = table.get(&merge.right).cloned().ok_or_else(|| BpeError::new("RCL_BPE_ARTIFACT_REFERENCE", "missing right expansion"))?;
        let mut bytes = left;
        bytes.extend(right);
        table.insert(merge.new_id, bytes);
    }
    Ok(table)
}

fn decode_with_artifact(artifact: &Artifact, tokens: &[u32], allow_special: bool) -> Result<String, BpeError> {
    let table = expansion_table(artifact)?;
    let mut bytes = Vec::new();
    for token in tokens {
        match *token {
            PAD | BOS | EOS if allow_special => {}
            PAD | BOS | EOS => return Err(BpeError::new("RCL_BPE_SPECIAL_TOKEN", format!("special token {token} requires allowSpecial=true"))),
            value => {
                let expansion = table.get(&value).ok_or_else(|| BpeError::new("RCL_BPE_TOKEN_RANGE", format!("token {value} is not present in the artifact vocabulary")))?;
                bytes.extend(expansion);
            }
        }
    }
    String::from_utf8(bytes).map_err(|error| BpeError::new("RCL_BPE_DECODE_UTF8", error.to_string()))
}

fn execute(request: Request) -> Result<serde_json::Value, BpeError> {
    if request.format != REQUEST_FORMAT {
        return Err(BpeError::new("RCL_BPE_REQUEST_FORMAT", format!("unsupported request format {}", request.format)));
    }
    match request.operation.as_str() {
        "train" => {
            let corpus_path = PathBuf::from(request.corpus_path.ok_or_else(|| BpeError::new("RCL_BPE_CORPUS_REQUIRED", "train requires corpusPath"))?);
            let artifact_path = PathBuf::from(request.artifact_path.ok_or_else(|| BpeError::new("RCL_BPE_ARTIFACT_REQUIRED", "train requires artifactPath"))?);
            let target = request.target_vocabulary_size.ok_or_else(|| BpeError::new("RCL_BPE_TARGET_REQUIRED", "train requires targetVocabularySize"))?;
            let minimum_frequency = request.minimum_frequency.unwrap_or(2);
            let artifact = train(&corpus_path, &artifact_path, target, minimum_frequency)?;
            Ok(json!({
                "status":"ok",
                "operation":"train",
                "artifactRoot":artifact.artifact_root,
                "corpusSha256":artifact.body.corpus_sha256,
                "targetVocabularySize":artifact.body.target_vocabulary_size,
                "actualVocabularySize":artifact.body.actual_vocabulary_size,
                "mergeCount":artifact.body.merges.len(),
                "completeTarget":artifact.body.complete_target,
                "exhausted":artifact.body.exhausted
            }))
        }
        "encode" => {
            let artifact_path = PathBuf::from(request.artifact_path.ok_or_else(|| BpeError::new("RCL_BPE_ARTIFACT_REQUIRED", "encode requires artifactPath"))?);
            let text = request.text.ok_or_else(|| BpeError::new("RCL_BPE_TEXT_REQUIRED", "encode requires text"))?;
            let artifact = load_artifact(&artifact_path)?;
            let tokens = encode_with_artifact(&artifact, &text, request.add_bos, request.add_eos);
            Ok(json!({
                "status":"ok",
                "operation":"encode",
                "artifactRoot":artifact.artifact_root,
                "byteCount":text.len(),
                "tokenCount":tokens.len(),
                "tokens":tokens
            }))
        }
        "decode" => {
            let artifact_path = PathBuf::from(request.artifact_path.ok_or_else(|| BpeError::new("RCL_BPE_ARTIFACT_REQUIRED", "decode requires artifactPath"))?);
            let tokens = request.tokens.ok_or_else(|| BpeError::new("RCL_BPE_TOKENS_REQUIRED", "decode requires tokens"))?;
            let artifact = load_artifact(&artifact_path)?;
            let text = decode_with_artifact(&artifact, &tokens, request.allow_special)?;
            Ok(json!({
                "status":"ok",
                "operation":"decode",
                "artifactRoot":artifact.artifact_root,
                "byteCount":text.len(),
                "tokenCount":tokens.len(),
                "text":text
            }))
        }
        "describe" => {
            let artifact_path = PathBuf::from(request.artifact_path.ok_or_else(|| BpeError::new("RCL_BPE_ARTIFACT_REQUIRED", "describe requires artifactPath"))?);
            let artifact = load_artifact(&artifact_path)?;
            Ok(json!({
                "status":"ok",
                "operation":"describe",
                "artifactRoot":artifact.artifact_root,
                "baseTokenizerId":artifact.body.base_tokenizer_id,
                "targetVocabularySize":artifact.body.target_vocabulary_size,
                "actualVocabularySize":artifact.body.actual_vocabulary_size,
                "mergeCount":artifact.body.merges.len(),
                "completeTarget":artifact.body.complete_target,
                "exhausted":artifact.body.exhausted,
                "corpusSha256":artifact.body.corpus_sha256,
                "normalization":artifact.body.normalization,
                "byteFallback":artifact.body.byte_fallback
            }))
        }
        operation => Err(BpeError::new("RCL_BPE_OPERATION", format!("unsupported operation {operation}"))),
    }
}

fn read_request(argument: Option<&String>) -> Result<String, BpeError> {
    match argument {
        Some(path) if path != "-" => fs::read_to_string(path).map_err(|error| BpeError::new("RCL_BPE_REQUEST_IO", error.to_string())),
        _ => {
            let mut input = String::new();
            io::stdin().read_to_string(&mut input).map_err(|error| BpeError::new("RCL_BPE_REQUEST_IO", error.to_string()))?;
            Ok(input)
        }
    }
}

fn fail<T>(error: BpeError) -> T {
    eprintln!("{}", json!({"status":"error","code":error.code,"message":error.message}));
    std::process::exit(1)
}

fn main() {
    let arguments = env::args().collect::<Vec<_>>();
    let input = read_request(arguments.get(1)).unwrap_or_else(fail);
    let request = serde_json::from_str::<Request>(&input)
        .unwrap_or_else(|error| fail(BpeError::new("RCL_BPE_REQUEST_JSON", error.to_string())));
    let result = execute(request).unwrap_or_else(fail);
    println!("{}", serde_json::to_string(&result).unwrap());
}
