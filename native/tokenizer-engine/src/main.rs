use serde::{Deserialize, Serialize};
use serde_json::json;
use sha2::{Digest, Sha256};
use std::env;
use std::fs;
use std::io::{self, Read};
use std::path::Path;

const REQUEST_FORMAT: &str = "rcl.byte-tokenizer-request.v0.1";
const RESPONSE_FORMAT: &str = "rcl.byte-tokenizer-result.v0.1";
const RECEIPT_FORMAT: &str = "rcl.byte-token-stream-receipt.v0.1";
const TOKENIZER_ID: &str = "rcl.byte-tokenizer.utf8.v0.1";
const NORMALIZATION: &str = "NONE";
const PAD: u32 = 256;
const BOS: u32 = 257;
const EOS: u32 = 258;
const VOCAB_SIZE: u32 = 259;
const TOKEN_STREAM_ENCODING: &str = "u32-le";

#[derive(Debug)]
struct TokenizerError {
    code: &'static str,
    message: String,
}

impl TokenizerError {
    fn new(code: &'static str, message: impl Into<String>) -> Self {
        Self {
            code,
            message: message.into(),
        }
    }
}

#[derive(Clone, Debug, Deserialize)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
struct TokenizerRequest {
    format: String,
    operation: String,
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

#[derive(Clone, Debug, Serialize)]
#[serde(rename_all = "camelCase")]
struct TokenizerResult {
    format: &'static str,
    status: &'static str,
    operation: String,
    tokenizer_id: &'static str,
    tokenizer_root: String,
    normalization: &'static str,
    vocab_size: u32,
    #[serde(skip_serializing_if = "Option::is_none")]
    text: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    tokens: Option<Vec<u32>>,
    byte_count: usize,
    token_count: usize,
}

#[derive(Clone, Debug, Serialize)]
#[serde(rename_all = "camelCase")]
struct TokenStreamReceiptBody {
    format: &'static str,
    tokenizer_id: &'static str,
    tokenizer_root: String,
    normalization: &'static str,
    token_stream_encoding: &'static str,
    vocab_size: u32,
    byte_count: usize,
    token_count: usize,
    add_bos: bool,
    add_eos: bool,
    source_sha256: String,
    token_stream_sha256: String,
}

#[derive(Clone, Debug, Serialize)]
#[serde(rename_all = "camelCase")]
struct TokenStreamReceipt {
    #[serde(flatten)]
    body: TokenStreamReceiptBody,
    receipt_root: String,
}

fn sha256_hex(bytes: impl AsRef<[u8]>) -> String {
    hex::encode(Sha256::digest(bytes.as_ref()))
}

fn tokenizer_descriptor() -> String {
    format!(
        "id={TOKENIZER_ID}|encoding=utf-8|normalization={NORMALIZATION}|byteTokens=0..255|pad={PAD}|bos={BOS}|eos={EOS}|vocabSize={VOCAB_SIZE}|stream={TOKEN_STREAM_ENCODING}"
    )
}

fn tokenizer_root() -> String {
    format!("sha256:{}", sha256_hex(tokenizer_descriptor()))
}

fn encode_text(text: &str, add_bos: bool, add_eos: bool) -> Vec<u32> {
    let mut tokens = Vec::with_capacity(text.len() + usize::from(add_bos) + usize::from(add_eos));
    if add_bos {
        tokens.push(BOS);
    }
    tokens.extend(text.as_bytes().iter().map(|byte| u32::from(*byte)));
    if add_eos {
        tokens.push(EOS);
    }
    tokens
}

fn decode_tokens(tokens: &[u32], allow_special: bool) -> Result<String, TokenizerError> {
    let mut bytes = Vec::with_capacity(tokens.len());
    for token in tokens {
        match *token {
            0..=255 => bytes.push(*token as u8),
            PAD | BOS | EOS if allow_special => {}
            PAD | BOS | EOS => {
                return Err(TokenizerError::new(
                    "RCL_TOKENIZER_SPECIAL_TOKEN",
                    format!("special token {token} requires allowSpecial=true"),
                ));
            }
            _ => {
                return Err(TokenizerError::new(
                    "RCL_TOKENIZER_TOKEN_RANGE",
                    format!("token {token} is outside the canonical vocabulary 0..={}", VOCAB_SIZE - 1),
                ));
            }
        }
    }
    String::from_utf8(bytes).map_err(|error| {
        TokenizerError::new(
            "RCL_TOKENIZER_INVALID_UTF8",
            format!("decoded byte sequence is not valid UTF-8: {error}"),
        )
    })
}

fn execute(request: TokenizerRequest) -> Result<TokenizerResult, TokenizerError> {
    if request.format != REQUEST_FORMAT {
        return Err(TokenizerError::new(
            "RCL_TOKENIZER_REQUEST_FORMAT",
            format!("unsupported request format {}", request.format),
        ));
    }
    match request.operation.as_str() {
        "encode" => {
            if request.tokens.is_some() {
                return Err(TokenizerError::new(
                    "RCL_TOKENIZER_REQUEST_SHAPE",
                    "encode accepts text, not tokens",
                ));
            }
            let text = request.text.ok_or_else(|| {
                TokenizerError::new("RCL_TOKENIZER_TEXT_REQUIRED", "encode requires text")
            })?;
            let tokens = encode_text(&text, request.add_bos, request.add_eos);
            Ok(TokenizerResult {
                format: RESPONSE_FORMAT,
                status: "ok",
                operation: "encode".into(),
                tokenizer_id: TOKENIZER_ID,
                tokenizer_root: tokenizer_root(),
                normalization: NORMALIZATION,
                vocab_size: VOCAB_SIZE,
                byte_count: text.len(),
                token_count: tokens.len(),
                text: None,
                tokens: Some(tokens),
            })
        }
        "decode" => {
            if request.text.is_some() || request.add_bos || request.add_eos {
                return Err(TokenizerError::new(
                    "RCL_TOKENIZER_REQUEST_SHAPE",
                    "decode accepts tokens and allowSpecial only",
                ));
            }
            let tokens = request.tokens.ok_or_else(|| {
                TokenizerError::new("RCL_TOKENIZER_TOKENS_REQUIRED", "decode requires tokens")
            })?;
            let text = decode_tokens(&tokens, request.allow_special)?;
            Ok(TokenizerResult {
                format: RESPONSE_FORMAT,
                status: "ok",
                operation: "decode".into(),
                tokenizer_id: TOKENIZER_ID,
                tokenizer_root: tokenizer_root(),
                normalization: NORMALIZATION,
                vocab_size: VOCAB_SIZE,
                byte_count: text.len(),
                token_count: tokens.len(),
                text: Some(text),
                tokens: None,
            })
        }
        operation => Err(TokenizerError::new(
            "RCL_TOKENIZER_OPERATION",
            format!("unsupported tokenizer operation {operation}"),
        )),
    }
}

fn token_stream_bytes(tokens: &[u32]) -> Vec<u8> {
    let mut bytes = Vec::with_capacity(tokens.len() * 4);
    for token in tokens {
        bytes.extend_from_slice(&token.to_le_bytes());
    }
    bytes
}

fn encode_file(
    source_path: &Path,
    token_path: &Path,
    receipt_path: &Path,
    add_bos: bool,
    add_eos: bool,
) -> Result<TokenStreamReceipt, TokenizerError> {
    let source = fs::read(source_path)
        .map_err(|error| TokenizerError::new("RCL_TOKENIZER_SOURCE_IO", error.to_string()))?;
    let text = std::str::from_utf8(&source).map_err(|error| {
        TokenizerError::new(
            "RCL_TOKENIZER_SOURCE_UTF8",
            format!("source corpus must be valid UTF-8: {error}"),
        )
    })?;
    let tokens = encode_text(text, add_bos, add_eos);
    let stream = token_stream_bytes(&tokens);
    if let Some(parent) = token_path.parent() {
        fs::create_dir_all(parent)
            .map_err(|error| TokenizerError::new("RCL_TOKENIZER_TOKEN_IO", error.to_string()))?;
    }
    fs::write(token_path, &stream)
        .map_err(|error| TokenizerError::new("RCL_TOKENIZER_TOKEN_IO", error.to_string()))?;

    let body = TokenStreamReceiptBody {
        format: RECEIPT_FORMAT,
        tokenizer_id: TOKENIZER_ID,
        tokenizer_root: tokenizer_root(),
        normalization: NORMALIZATION,
        token_stream_encoding: TOKEN_STREAM_ENCODING,
        vocab_size: VOCAB_SIZE,
        byte_count: source.len(),
        token_count: tokens.len(),
        add_bos,
        add_eos,
        source_sha256: format!("sha256:{}", sha256_hex(&source)),
        token_stream_sha256: format!("sha256:{}", sha256_hex(&stream)),
    };
    let receipt_root = format!(
        "sha256:{}",
        sha256_hex(serde_json::to_vec(&body).map_err(|error| {
            TokenizerError::new("RCL_TOKENIZER_RECEIPT_JSON", error.to_string())
        })?)
    );
    let receipt = TokenStreamReceipt { body, receipt_root };
    if let Some(parent) = receipt_path.parent() {
        fs::create_dir_all(parent)
            .map_err(|error| TokenizerError::new("RCL_TOKENIZER_RECEIPT_IO", error.to_string()))?;
    }
    fs::write(
        receipt_path,
        format!(
            "{}\n",
            serde_json::to_string_pretty(&receipt).map_err(|error| {
                TokenizerError::new("RCL_TOKENIZER_RECEIPT_JSON", error.to_string())
            })?
        ),
    )
    .map_err(|error| TokenizerError::new("RCL_TOKENIZER_RECEIPT_IO", error.to_string()))?;
    Ok(receipt)
}

fn read_request(argument: Option<&String>) -> Result<String, TokenizerError> {
    match argument {
        Some(path) if path != "-" => fs::read_to_string(path)
            .map_err(|error| TokenizerError::new("RCL_TOKENIZER_REQUEST_IO", error.to_string())),
        _ => {
            let mut input = String::new();
            io::stdin()
                .read_to_string(&mut input)
                .map_err(|error| TokenizerError::new("RCL_TOKENIZER_REQUEST_IO", error.to_string()))?;
            Ok(input)
        }
    }
}

fn fail<T>(error: TokenizerError) -> T {
    eprintln!(
        "{}",
        json!({"status":"error","code":error.code,"message":error.message})
    );
    std::process::exit(1)
}

fn describe() {
    println!(
        "{}",
        json!({
            "format": "rcl.byte-tokenizer-description.v0.1",
            "tokenizerId": TOKENIZER_ID,
            "tokenizerRoot": tokenizer_root(),
            "encoding": "utf-8",
            "normalization": NORMALIZATION,
            "byteTokens": [0, 255],
            "specialTokens": {"pad":PAD,"bos":BOS,"eos":EOS},
            "vocabSize": VOCAB_SIZE,
            "tokenStreamEncoding": TOKEN_STREAM_ENCODING,
            "losslessForValidUtf8": true
        })
    );
}

fn main() {
    let arguments = env::args().collect::<Vec<_>>();
    match arguments.get(1).map(String::as_str).unwrap_or("execute") {
        "describe" => describe(),
        "execute" => {
            let input = read_request(arguments.get(2)).unwrap_or_else(fail);
            let request = serde_json::from_str::<TokenizerRequest>(&input).unwrap_or_else(|error| {
                fail(TokenizerError::new("RCL_TOKENIZER_REQUEST_JSON", error.to_string()))
            });
            let result = execute(request).unwrap_or_else(fail);
            println!("{}", serde_json::to_string(&result).unwrap());
        }
        "encode-file" => {
            let source = arguments.get(2).unwrap_or_else(|| {
                eprintln!("encode-file requires <source> <tokens.bin> <receipt.json>");
                std::process::exit(2)
            });
            let tokens = arguments.get(3).unwrap_or_else(|| {
                eprintln!("encode-file requires <source> <tokens.bin> <receipt.json>");
                std::process::exit(2)
            });
            let receipt = arguments.get(4).unwrap_or_else(|| {
                eprintln!("encode-file requires <source> <tokens.bin> <receipt.json>");
                std::process::exit(2)
            });
            let add_bos = arguments.iter().any(|value| value == "--bos");
            let add_eos = arguments.iter().any(|value| value == "--eos");
            let result = encode_file(
                Path::new(source),
                Path::new(tokens),
                Path::new(receipt),
                add_bos,
                add_eos,
            )
            .unwrap_or_else(fail);
            println!("{}", serde_json::to_string(&result).unwrap());
        }
        command => {
            eprintln!("unsupported command {command}: use describe, execute, or encode-file");
            std::process::exit(2)
        }
    }
}
