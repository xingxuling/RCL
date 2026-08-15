fn main() {
    let payload = r#"{"name":"rcl","version":1,"features":["text","sequence"]}"#;
    let required = ["\"name\":\"rcl\"", "\"version\":1", "\"features\":["];
    println!("{}", if required.iter().all(|fragment| payload.contains(fragment)) { payload.len() as i64 } else { -1_i64 });
}
