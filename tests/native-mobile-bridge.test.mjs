import fs from 'node:fs';
import test from 'node:test';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {emitNativeUiAndroidBridge} from '../src/ui/native-android-bridge.mjs';
import {parseAndroidHierarchy} from '../src/ui/native-android-driver.mjs';
import {MOBILE_PROFILE} from '../scripts/k400-mobile-definitions.mjs';
const source=MOBILE_PROFILE.source(),sha=b=>createHash('sha256').update(b).digest('hex');
test('native mobile client derives canonical Views while leaving state and expression execution to RCL',()=>{
  const client=emitNativeUiAndroidBridge(source);assert.equal(client.nativeViews,true);assert.equal(client.webViewUsed,false);assert.equal(client.clientComputesRclState,false);
  assert.ok(client.java.includes('new TextView(this)'));assert.ok(client.java.includes('new Button(this)'));assert.ok(!client.java.includes('WebView'));assert.ok(!client.java.includes('rclBinary'));assert.ok(!client.java.includes('proposed.put'));assert.ok(!client.java.includes('count + step'));assert.ok(client.java.includes('expectedStateRoot'));assert.ok(client.java.includes('RCL_MOBILE_UI_ROOT_MISMATCH'));
  assert.ok(client.java.includes('new LinearLayout.LayoutParams(0, dp(48), 1f)'));assert.ok(client.java.includes('onSaveInstanceState'));assert.ok(client.java.includes('onDestroy'));assert.equal(client.javaHash,sha(client.java));
});
test('frozen APK and generated Java bind to the actual mobile source',()=>{
  const contract=JSON.parse(fs.readFileSync('examples/universal-stress/mobile-native/native-counter-contract.json','utf8')),build=JSON.parse(fs.readFileSync(contract.clientBuildPath,'utf8'));
  assert.equal(sha(fs.readFileSync(contract.apk.path)),contract.apk.sha256);assert.equal(sha(fs.readFileSync(contract.clientBuildPath)),contract.clientBuildHash);assert.equal(build.javaHash,emitNativeUiAndroidBridge(source).javaHash);assert.equal(build.apk.sha256,contract.apk.sha256);assert.equal(build.toolchain.offline,true);
});
test('Android hierarchy decoding preserves actual native classes, accessibility and touch bounds',()=>{
  const nodes=parseAndroidHierarchy('<hierarchy><node class="android.widget.Button" package="org.rcl.k400.mobile" text="增加" content-desc="增加计数" enabled="true" bounds="[72,294][450,390]"/></hierarchy>');
  assert.equal(nodes[0].class,'android.widget.Button');assert.equal(nodes[0]['content-desc'],'增加计数');assert.deepEqual(nodes[0].bounds,[72,294,450,390]);assert.equal(nodes[0].enabled,'true');
});
