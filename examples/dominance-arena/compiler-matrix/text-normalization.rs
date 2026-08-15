fn main() {
    let payload = "  RCL Beats Python  ";
    let normalized = payload.trim().to_ascii_lowercase();
    println!("{}", if normalized.contains("rcl") && normalized.contains("python") { normalized.chars().count() as i64 } else { -1_i64 });
}
