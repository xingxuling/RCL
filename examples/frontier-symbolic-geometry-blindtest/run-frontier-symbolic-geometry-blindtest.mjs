import { runFrontierSymbolicGeometryPressureSuite, writeFrontierSymbolicGeometryBlindtestReports } from '../../src/frontier-symbolic-geometry-blindtest.mjs';

const outDir = process.argv[2] || 'output/frontier-symbolic-geometry-blindtest-v0.1';
const report = writeFrontierSymbolicGeometryBlindtestReports(outDir);
console.log(JSON.stringify({ ...runFrontierSymbolicGeometryPressureSuite(), report }, null, 2));
