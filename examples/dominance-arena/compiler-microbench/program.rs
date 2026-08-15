fn main() {
    let seed: f64 = 17.0;
    let scale: f64 = 23.0;
    let s01 = seed * scale + 11.0;
    let s02 = s01 * scale - seed;
    let s03 = s02 + scale * 3.0;
    let s04 = s03 / 5.0 + seed;
    let s05 = s04 / 2.0 + seed;
    let s06 = s05 * scale - seed;
    let s07 = s06 + scale * 3.0;
    let s08 = s07 / 5.0 + seed;
    let s09 = s08 / 2.0 + seed;
    let s10 = s09 * scale - seed;
    let s11 = s10 + scale * 3.0;
    let s12 = s11 / 5.0 + seed;
    let s13 = s12 / 2.0 + seed;
    let s14 = s13 * scale - seed;
    let s15 = s14 + scale * 3.0;
    let s16 = s15 / 5.0 + seed;
    let s17 = s16 / 2.0 + seed;
    let s18 = s17 * scale - seed;
    let s19 = s18 + scale * 3.0;
    let s20 = s19 / 5.0 + seed;
    let s21 = s20 / 2.0 + seed;
    let s22 = s21 * scale - seed;
    let s23 = s22 + scale * 3.0;
    let s24 = s23 / 5.0 + seed;
    println!("{:.17}", s24);
}
