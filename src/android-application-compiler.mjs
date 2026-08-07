import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { compileReality } from './compiler.mjs';
import { compileRealityToBytecode } from './bytecode.mjs';

export const RCL_ANDROID_APPLICATION_COMPILER_VERSION = '0.1.0';
export const RCL_ANDROID_APPLICATION_FORMAT = 'rcl.android-application.v0.1';
export const RCL_ANDROID_RUNTIME_MANIFEST_FORMAT = 'rcl.android-runtime-manifest.v0.1';

const NODE_TYPES = new Set(['column', 'row', 'text', 'input', 'button']);
const PACKAGE_PATTERN = /^[a-z][a-z0-9_]*(?:\.[a-z][a-z0-9_]*)+$/u;
const JAVA_IDENTIFIER = /^[A-Za-z_$][A-Za-z0-9_$]*$/u;

function sha256(value) {
  return crypto.createHash('sha256').update(typeof value === 'string' ? value : JSON.stringify(value)).digest('hex');
}

function canonicalJson(value) {
  if (Array.isArray(value)) return `[${value.map(canonicalJson).join(',')}]`;
  if (value && typeof value === 'object') {
    return `{${Object.keys(value).sort().map((key) => `${JSON.stringify(key)}:${canonicalJson(value[key])}`).join(',')}}`;
  }
  return JSON.stringify(value);
}

function javaString(value) {
  return JSON.stringify(String(value));
}

function xmlAttribute(value) {
  return String(value)
    .replaceAll('&', '&amp;')
    .replaceAll('"', '&quot;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;');
}

function javaIdentifier(value, fallback = 'node') {
  const normalized = String(value).replace(/[^A-Za-z0-9_$]/gu, '_');
  const candidate = /^[A-Za-z_$]/u.test(normalized) ? normalized : `${fallback}_${normalized}`;
  return JAVA_IDENTIFIER.test(candidate) ? candidate : `${fallback}_node`;
}

function javaLiteral(value) {
  if (value === null) return 'null';
  if (typeof value === 'string') return javaString(value);
  if (typeof value === 'boolean') return value ? 'Boolean.TRUE' : 'Boolean.FALSE';
  if (typeof value === 'number' && Number.isFinite(value)) {
    if (Number.isInteger(value)) return `${value}L`;
    return `${value}d`;
  }
  throw new Error(`RCL_ANDROID_UNSUPPORTED_LITERAL:${typeof value}`);
}

function literalFacetValue(facet) {
  if (!facet.value || facet.value.kind !== 'LiteralExpr') {
    throw new Error(`RCL_ANDROID_NON_LITERAL_INITIAL_FACET:${facet.path}`);
  }
  return facet.value.value;
}

function lowerExpr(expr) {
  if (!expr) return null;
  if (expr.kind === 'LiteralExpr') return { kind: 'literal', value: expr.value };
  if (expr.kind === 'PathExpr') return { kind: 'path', path: expr.path };
  if (expr.kind === 'UnaryExpr') return { kind: 'unary', operator: expr.operator, expression: lowerExpr(expr.expression) };
  if (expr.kind === 'BinaryExpr') return { kind: 'binary', operator: expr.operator, left: lowerExpr(expr.left), right: lowerExpr(expr.right) };
  if (expr.kind === 'CallExpr' && expr.name === 'choose') return { kind: 'choose', args: expr.args.map(lowerExpr) };
  throw new Error(`RCL_ANDROID_UNSUPPORTED_EXPRESSION:${expr.kind}${expr.name ? `:${expr.name}` : ''}`);
}

function lowerRule(rule) {
  if ((rule.calls ?? []).length > 0) throw new Error(`RCL_ANDROID_HOST_CALL_NOT_YET_SUPPORTED:${rule.name}`);
  return {
    name: rule.name,
    kind: rule.kind,
    actor: rule.kind === 'Emergence' ? rule.cause : rule.from,
    when: lowerExpr(rule.when),
    needs: structuredClone(rule.needs ?? []),
    alters: (rule.alters ?? []).map((alter) => ({ target: alter.target, expression: lowerExpr(alter.expression) })),
    preserves: (rule.preserves ?? []).map(lowerExpr),
    witnesses: [...(rule.witnesses ?? [])],
  };
}

function normalizeNode(node, pathName, ids) {
  if (!node || typeof node !== 'object' || !NODE_TYPES.has(node.type)) {
    throw new Error(`RCL_ANDROID_INVALID_UI_NODE:${pathName}`);
  }
  const id = node.id ?? `node_${pathName.replaceAll('.', '_')}`;
  if (!JAVA_IDENTIFIER.test(id)) throw new Error(`RCL_ANDROID_INVALID_UI_ID:${id}`);
  if (ids.has(id)) throw new Error(`RCL_ANDROID_DUPLICATE_UI_ID:${id}`);
  ids.add(id);
  const normalized = { ...node, id };
  if (node.children !== undefined && !Array.isArray(node.children)) {
    throw new Error(`RCL_ANDROID_UI_CHILDREN_NOT_ARRAY:${id}`);
  }
  normalized.children = (node.children ?? []).map((child, index) => normalizeNode(child, `${pathName}.${index}`, ids));
  if (node.type === 'button' && typeof node.rule !== 'string') throw new Error(`RCL_ANDROID_BUTTON_RULE_REQUIRED:${id}`);
  if (node.type === 'input' && typeof node.observeState !== 'string') throw new Error(`RCL_ANDROID_INPUT_OBSERVE_REQUIRED:${id}`);
  if (node.type === 'text' && node.text === undefined && node.textState === undefined) {
    throw new Error(`RCL_ANDROID_TEXT_CONTENT_REQUIRED:${id}`);
  }
  if ((node.textState || node.valueState || node.observeState) && typeof (node.textState || node.valueState || node.observeState) !== 'string') {
    throw new Error(`RCL_ANDROID_STATE_BINDING_INVALID:${id}`);
  }
  return normalized;
}

function normalizeAndroidSpec(spec) {
  if (!spec || spec.schema !== RCL_ANDROID_APPLICATION_FORMAT) throw new Error('RCL_ANDROID_SPEC_SCHEMA');
  if (!PACKAGE_PATTERN.test(spec.applicationId)) throw new Error(`RCL_ANDROID_APPLICATION_ID:${spec.applicationId}`);
  const activity = spec.activity ?? 'MainActivity';
  if (!JAVA_IDENTIFIER.test(activity)) throw new Error(`RCL_ANDROID_ACTIVITY_NAME:${activity}`);
  if (!spec.screen || spec.screen.type !== 'column') throw new Error('RCL_ANDROID_SCREEN_ROOT');
  const ids = new Set();
  const screen = normalizeNode(spec.screen, 'root', ids);
  return structuredClone({
    ...spec,
    activity,
    minSdk: Number(spec.minSdk ?? 26),
    compileSdk: Number(spec.compileSdk ?? 35),
    targetSdk: Number(spec.targetSdk ?? spec.compileSdk ?? 35),
    lifecycle: { restoreState: true, ...(spec.lifecycle ?? {}) },
    screen,
  });
}

function validateBinding(pathName, state, code) {
  if (!Object.prototype.hasOwnProperty.call(state, pathName)) throw new Error(`RCL_ANDROID_UNKNOWN_STATE:${code}:${pathName}`);
}

function validateUiBindings(node, state, rules) {
  if (node.textState) validateBinding(node.textState, state, node.id);
  if (node.valueState) validateBinding(node.valueState, state, node.id);
  if (node.observeState) validateBinding(node.observeState, state, node.id);
  if (node.rule && !rules.some((rule) => rule.name === node.rule)) throw new Error(`RCL_ANDROID_UNKNOWN_RULE:${node.id}:${node.rule}`);
  for (const child of node.children ?? []) validateUiBindings(child, state, rules);
}

export function compileRclAndroidApplication(rclSource, androidSpec) {
  const program = compileReality(rclSource);
  const spec = normalizeAndroidSpec(androidSpec);
  const state = Object.fromEntries(program.facets.filter((facet) => !facet.deferred).map((facet) => [facet.path, literalFacetValue(facet)]));
  const warrants = program.warrants.map((warrant) => ({ subject: warrant.subject, capability: warrant.capability, target: warrant.target }));
  const rules = program.rules.map(lowerRule);
  validateUiBindings(spec.screen, state, rules);
  const manifest = {
    schema: RCL_ANDROID_RUNTIME_MANIFEST_FORMAT,
    compiler: 'RCL Native Android Application Compiler',
    compilerVersion: RCL_ANDROID_APPLICATION_COMPILER_VERSION,
    program: program.name,
    programRoot: program.programRoot,
    state,
    facets: program.facets.filter((facet) => !facet.deferred).map((facet) => ({ path: facet.path, valueType: facet.valueType })),
    warrants,
    rules,
    application: {
      applicationId: spec.applicationId,
      activity: spec.activity,
      title: spec.title ?? program.name,
      minSdk: spec.minSdk,
      compileSdk: spec.compileSdk,
      targetSdk: spec.targetSdk,
      theme: spec.theme ?? 'light',
    },
    screen: spec.screen,
    lifecycle: spec.lifecycle,
    metadata: {
      sourceFormat: RCL_ANDROID_APPLICATION_FORMAT,
      semantics: ['RCL state', 'RCL authority', 'RCL transaction rules', 'native Android View projection', 'Android lifecycle state restoration'],
      coverageMode: 'lowered-execution',
    },
  };
  return Object.freeze({ ...manifest, manifestRoot: sha256(canonicalJson(manifest)) });
}

function emitJavaExpr(expr, snapshotName) {
  if (!expr) return 'Boolean.TRUE';
  if (expr.kind === 'literal') return javaLiteral(expr.value);
  if (expr.kind === 'path') return `rclPath(${snapshotName}, ${javaString(expr.path)})`;
  if (expr.kind === 'unary') return `rclUnary(${javaString(expr.operator)}, ${emitJavaExpr(expr.expression, snapshotName)})`;
  if (expr.kind === 'binary') return `rclBinary(${javaString(expr.operator)}, ${emitJavaExpr(expr.left, snapshotName)}, ${emitJavaExpr(expr.right, snapshotName)})`;
  if (expr.kind === 'choose') return `rclChoose(${emitJavaExpr(expr.args[0], snapshotName)}, ${emitJavaExpr(expr.args[1], snapshotName)}, ${emitJavaExpr(expr.args[2], snapshotName)})`;
  throw new Error(`RCL_ANDROID_JAVA_EXPRESSION:${expr.kind}`);
}

function nodeFieldName(node) {
  return `view_${javaIdentifier(node.id)}`;
}

function collectBoundNodes(node, result = []) {
  if (node.textState || node.valueState) result.push(node);
  for (const child of node.children ?? []) collectBoundNodes(child, result);
  return result;
}

function emitUiNode(node, lines, indent, state) {
  const variable = nodeFieldName(node);
  const type = node.type === 'text' ? 'TextView' : node.type === 'input' ? 'EditText' : node.type === 'button' ? 'Button' : 'LinearLayout';
  const bound = Boolean(node.textState || node.valueState);
  lines.push(`${indent}${bound ? `this.${variable}` : `${type} ${variable}`} = new ${type}(this);`);
  if (node.type === 'column' || node.type === 'row') {
    lines.push(`${indent}${variable}.setOrientation(LinearLayout.${node.type === 'column' ? 'VERTICAL' : 'HORIZONTAL'});`);
    lines.push(`${indent}${variable}.setPadding(24, 16, 24, 16);`);
    for (const child of node.children ?? []) {
      const childVariable = emitUiNode(child, lines, indent, state);
      lines.push(`${indent}${variable}.addView(${childVariable}, new LinearLayout.LayoutParams(-1, -2));`);
    }
  }
  if (node.type === 'text') {
    if (node.text !== undefined) lines.push(`${indent}${variable}.setText(${javaString(node.text)});`);
    lines.push(`${indent}${variable}.setTextSize(16);`);
  }
  if (node.type === 'input') {
    if (node.hint !== undefined) lines.push(`${indent}${variable}.setHint(${javaString(node.hint)});`);
    lines.push(`${indent}${variable}.setSingleLine(true);`);
    lines.push(`${indent}${variable}.addTextChangedListener(new TextWatcher() {`);
    lines.push(`${indent}  @Override public void beforeTextChanged(CharSequence s, int start, int count, int after) {}`);
    lines.push(`${indent}  @Override public void onTextChanged(CharSequence s, int start, int before, int count) {}`);
    lines.push(`${indent}  @Override public void afterTextChanged(Editable value) { if (!rendering) observe(${javaString(node.observeState)}, value.toString()); }`);
    lines.push(`${indent}});`);
  }
  if (node.type === 'button') {
    lines.push(`${indent}${variable}.setText(${javaString(node.text ?? node.rule)});`);
    lines.push(`${indent}${variable}.setOnClickListener(clicked -> realize(${javaString(node.rule)}));`);
  }
  return variable;
}

function emitRuleMethod(rule) {
  const lines = [];
  const method = `realize_${javaIdentifier(rule.name, 'rule')}`;
  lines.push(`  private void ${method}() {`);
  lines.push('    final Map<String, Object> before = new LinkedHashMap<>(state);');
  if (rule.when) lines.push(`    if (!rclTruthy(${emitJavaExpr(rule.when, 'before')})) return;`);
  for (const need of rule.needs) {
    lines.push(`    requireAuthority(${javaString(rule.name)}, ${javaString(rule.actor)}, ${javaString(need.capability)}, ${javaString(need.target)});`);
  }
  lines.push('    final Map<String, Object> proposed = new LinkedHashMap<>(before);');
  for (const alter of rule.alters) lines.push(`    proposed.put(${javaString(alter.target)}, ${emitJavaExpr(alter.expression, 'before')});`);
  for (const preserve of rule.preserves) lines.push(`    if (!rclTruthy(${emitJavaExpr(preserve, 'proposed')})) throw new IllegalStateException(${javaString(`RCL_ANDROID_PRESERVE_FAILED:${rule.name}`)});`);
  lines.push(`    commit(${javaString(rule.name)}, ${javaString(rule.actor)}, before, proposed, Arrays.asList(${rule.witnesses.map(javaString).join(', ')}));`);
  lines.push('  }');
  return lines.join('\n');
}

function emitJavaRuntimeHelpers() {
  return `  private static Object rclPath(Map<String, Object> snapshot, String path) {
    if (!snapshot.containsKey(path)) throw new IllegalStateException("RCL_ANDROID_STATE_MISSING:" + path);
    return snapshot.get(path);
  }

  private static boolean rclTruthy(Object value) {
    if (value == null) return false;
    if (value instanceof Boolean) return (Boolean) value;
    if (value instanceof Number) return ((Number) value).doubleValue() != 0d;
    if (value instanceof CharSequence) return ((CharSequence) value).length() > 0;
    return true;
  }

  private static Object rclChoose(Object condition, Object whenTrue, Object whenFalse) {
    return rclTruthy(condition) ? whenTrue : whenFalse;
  }

  private static Object rclUnary(String operator, Object value) {
    if ("not".equals(operator)) return !rclTruthy(value);
    if ("-".equals(operator) && value instanceof Number) return -((Number) value).doubleValue();
    throw new IllegalStateException("RCL_ANDROID_UNARY:" + operator);
  }

  private static Object rclBinary(String operator, Object left, Object right) {
    if ("and".equals(operator)) return rclTruthy(left) && rclTruthy(right);
    if ("or".equals(operator)) return rclTruthy(left) || rclTruthy(right);
    if ("+".equals(operator) && (left instanceof CharSequence || right instanceof CharSequence)) return String.valueOf(left) + String.valueOf(right);
    if ("+".equals(operator) || "-".equals(operator) || "*".equals(operator) || "/".equals(operator) || "%".equals(operator)) {
      if (!(left instanceof Number) || !(right instanceof Number)) throw new IllegalStateException("RCL_ANDROID_NUMBER_REQUIRED:" + operator);
      double l = ((Number) left).doubleValue();
      double r = ((Number) right).doubleValue();
      double result;
      if ("+".equals(operator)) result = l + r;
      else if ("-".equals(operator)) result = l - r;
      else if ("*".equals(operator)) result = l * r;
      else if ("/".equals(operator)) result = l / r;
      else result = l % r;
      return Math.rint(result) == result ? Long.valueOf((long) result) : Double.valueOf(result);
    }
    if ("==".equals(operator)) return java.util.Objects.equals(left, right);
    if ("!=".equals(operator)) return !java.util.Objects.equals(left, right);
    if (left instanceof Number && right instanceof Number) {
      double l = ((Number) left).doubleValue();
      double r = ((Number) right).doubleValue();
      if ("<".equals(operator)) return l < r;
      if ("<=".equals(operator)) return l <= r;
      if (">".equals(operator)) return l > r;
      if (">=".equals(operator)) return l >= r;
    }
    if (left instanceof CharSequence && right instanceof CharSequence) {
      int comparison = left.toString().compareTo(right.toString());
      if ("<".equals(operator)) return comparison < 0;
      if ("<=".equals(operator)) return comparison <= 0;
      if (">".equals(operator)) return comparison > 0;
      if (">=".equals(operator)) return comparison >= 0;
    }
    throw new IllegalStateException("RCL_ANDROID_COMPARISON:" + operator);
  }`;
}

function emitWarrantMethod(warrants) {
  const conditions = warrants.map((warrant) => `(subject.equals(${javaString(warrant.subject)}) && capability.equals(${javaString(warrant.capability)}) && target.equals(${javaString(warrant.target)}))`);
  return `  private boolean hasWarrant(String subject, String capability, String target) {
    return ${conditions.length ? conditions.join(' || ') : 'false'};
  }

  private void requireAuthority(String rule, String actor, String capability, String target) {
    if (!hasWarrant(actor, capability, target)) throw new IllegalStateException("RCL_ANDROID_AUTHORITY_DENIED:" + rule + ":" + capability);
  }`;
}

function emitStateLifecycle(manifest) {
  const init = manifest.facets.map((facet) => `    state.put(${javaString(facet.path)}, ${javaLiteral(manifest.state[facet.path])});`).join('\n');
  const save = manifest.facets.map((facet) => {
    const key = javaString(`rcl.state.${facet.path}`);
    if (facet.valueType === 'Text') return `    outState.putString(${key}, String.valueOf(state.get(${javaString(facet.path)})));`;
    if (facet.valueType === 'Boolean') return `    outState.putBoolean(${key}, rclTruthy(state.get(${javaString(facet.path)})));`;
    return `    outState.putLong(${key}, ((Number) state.get(${javaString(facet.path)})).longValue());`;
  }).join('\n');
  const restore = manifest.facets.map((facet) => {
    const key = javaString(`rcl.state.${facet.path}`);
    const pathLiteral = javaString(facet.path);
    if (facet.valueType === 'Text') return `    if (savedState.containsKey(${key})) state.put(${pathLiteral}, savedState.getString(${key}));`;
    if (facet.valueType === 'Boolean') return `    if (savedState.containsKey(${key})) state.put(${pathLiteral}, savedState.getBoolean(${key}));`;
    return `    if (savedState.containsKey(${key})) state.put(${pathLiteral}, savedState.getLong(${key}));`;
  }).join('\n');
  return { init, save, restore };
}

function emitRender(manifest, boundNodes) {
  const lines = ['  private void render() {', '    rendering = true;'];
  for (const node of boundNodes) {
    const field = nodeFieldName(node);
    const pathName = node.textState ?? node.valueState;
    const next = node.text !== undefined
      ? `String.valueOf(${javaString(node.text)}) + String.valueOf(rclPath(state, ${javaString(pathName)}))`
      : `String.valueOf(rclPath(state, ${javaString(pathName)}))`;
    if (node.type === 'input') lines.push(`    if (!${field}.getText().toString().equals(${next})) ${field}.setText(${next});`);
    else lines.push(`    ${field}.setText(${next});`);
  }
  lines.push('    rendering = false;', '  }');
  return lines.join('\n');
}

export function emitNativeAndroidActivity(manifest) {
  const app = manifest.application;
  const boundNodes = collectBoundNodes(manifest.screen);
  const lifecycle = emitStateLifecycle(manifest);
  const uiLines = [];
  const rootVariable = emitUiNode(manifest.screen, uiLines, '    ', manifest.state);
  const dispatch = manifest.rules.map((rule) => `    if (${javaString(rule.name)}.equals(name)) { realize_${javaIdentifier(rule.name, 'rule')}(); return; }`).join('\n');
  const ruleMethods = manifest.rules.map(emitRuleMethod).join('\n\n');
  const fields = boundNodes.map((node) => `  private ${node.type === 'input' ? 'EditText' : 'TextView'} ${nodeFieldName(node)};`).join('\n');
  const source = `package ${app.applicationId};

import android.app.Activity;
import android.os.Bundle;
import android.text.Editable;
import android.text.TextWatcher;
import android.view.View;
import android.widget.Button;
import android.widget.EditText;
import android.widget.LinearLayout;
import android.widget.TextView;
import java.util.ArrayList;
import java.util.Arrays;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

public final class ${app.activity} extends Activity {
  private final Map<String, Object> state = new LinkedHashMap<>();
  private final List<String> history = new ArrayList<>();
  private boolean rendering = false;
${fields}

  @Override protected void onCreate(Bundle savedState) {
    super.onCreate(savedState);
    initializeState();
    restoreState(savedState);
    buildUi();
    render();
  }

  private void initializeState() {
${lifecycle.init}
  }

  private void buildUi() {
${uiLines.join('\n')}
    setContentView(${rootVariable});
  }

  private void observe(String path, Object value) {
    if (!state.containsKey(path)) throw new IllegalStateException("RCL_ANDROID_OBSERVE_UNKNOWN:" + path);
    Object before = state.put(path, value);
    history.add("observed:" + path + ":" + String.valueOf(before) + "→" + String.valueOf(value));
    render();
  }

  private void realize(String name) {
${dispatch}
    throw new IllegalArgumentException("RCL_ANDROID_RULE_UNKNOWN:" + name);
  }

  private void commit(String name, String actor, Map<String, Object> before, Map<String, Object> proposed, List<String> witnesses) {
    state.clear();
    state.putAll(proposed);
    history.add("realized:" + name + ":" + actor + ":" + witnesses.toString());
    render();
  }

${emitJavaRuntimeHelpers()}

${emitWarrantMethod(manifest.warrants)}

${ruleMethods}

${emitRender(manifest, boundNodes)}

  private void restoreState(Bundle savedState) {
    if (savedState == null) return;
${lifecycle.restore}
  }

  @Override protected void onSaveInstanceState(Bundle outState) {
    super.onSaveInstanceState(outState);
${lifecycle.save}
  }
}
`;
  return source;
}

function renderStyles() {
  return '<resources><style name="AppTheme" parent="android:style/Theme.Material.Light.NoActionBar"/></resources>\n';
}

function renderGradleFiles(manifest) {
  const app = manifest.application;
  return {
    'settings.gradle': `pluginManagement { repositories { google(); mavenCentral(); gradlePluginPortal() } }\ndependencyResolutionManagement { repositoriesMode.set(RepositoriesMode.FAIL_ON_PROJECT_REPOS); repositories { google(); mavenCentral() } }\nrootProject.name='${javaIdentifier(manifest.program, 'rcl').toLowerCase()}'\ninclude ':app'\n`,
    'build.gradle': `plugins { id 'com.android.application' version '8.5.2' apply false }\n`,
    'gradle.properties': 'org.gradle.jvmargs=-Xmx2048m -Dfile.encoding=UTF-8\nandroid.useAndroidX=true\n',
    'app/build.gradle': `plugins { id 'com.android.application' }\n\nandroid {\n    namespace '${app.applicationId}'\n    compileSdk ${app.compileSdk}\n    defaultConfig { applicationId '${app.applicationId}'; minSdk ${app.minSdk}; targetSdk ${app.targetSdk}; versionCode 1; versionName '0.1.0' }\n}\n`,
  };
}

function renderAndroidManifest(manifest) {
  const app = manifest.application;
  return `<manifest xmlns:android="http://schemas.android.com/apk/res/android">\n  <application android:theme="@style/AppTheme" android:label="${xmlAttribute(app.title)}" android:allowBackup="true" android:supportsRtl="true">\n    <activity android:name=".${app.activity}" android:exported="true">\n      <intent-filter>\n        <action android:name="android.intent.action.MAIN"/>\n        <category android:name="android.intent.category.LAUNCHER"/>\n      </intent-filter>\n    </activity>\n  </application>\n</manifest>\n`;
}

function writeText(file, content) {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, content, 'utf8');
}

export function buildRclAndroidApplication({ rclPath, specPath, outputPath }) {
  const source = fs.readFileSync(rclPath, 'utf8');
  const spec = JSON.parse(fs.readFileSync(specPath, 'utf8'));
  const manifest = compileRclAndroidApplication(source, spec);
  const root = path.resolve(outputPath);
  writeText(path.join(root, 'program.rcl'), source);
  fs.writeFileSync(path.join(root, 'program.rbc'), compileRealityToBytecode(source));
  writeText(path.join(root, 'rcl.android-runtime-manifest.json'), `${JSON.stringify(manifest, null, 2)}\n`);
  for (const [file, content] of Object.entries(renderGradleFiles(manifest))) writeText(path.join(root, file), content);
  writeText(path.join(root, 'app/src/main/AndroidManifest.xml'), renderAndroidManifest(manifest));
  writeText(path.join(root, 'app/src/main/res/values/styles.xml'), renderStyles());
  writeText(path.join(root, `app/src/main/java/${manifest.application.applicationId.replaceAll('.', '/')}/${manifest.application.activity}.java`), emitNativeAndroidActivity(manifest));
  writeText(path.join(root, 'app/src/main/assets/program.rcl'), source);
  fs.mkdirSync(path.join(root, 'app/src/main/assets'), { recursive: true });
  fs.copyFileSync(path.join(root, 'program.rbc'), path.join(root, 'app/src/main/assets/program.rbc'));
  writeText(path.join(root, 'gradle-build.sh'), '#!/usr/bin/env sh\nset -eu\nif [ -x ./gradlew ]; then exec ./gradlew assembleDebug; fi\nexec gradle assembleDebug\n');
  fs.chmodSync(path.join(root, 'gradle-build.sh'), 0o755);
  writeText(path.join(root, 'README.md'), `# ${manifest.application.title}\n\nGenerated by RCL Native Android Application Compiler v${RCL_ANDROID_APPLICATION_COMPILER_VERSION}.\n\nThis project owns application state, authority and transactional rules in the RCL manifest and lowers them into a native Android Activity. It is not an APK until a real Android Gradle toolchain builds it.\n\n- Runtime manifest: \`rcl.android-runtime-manifest.json\`\n- RCL source: \`program.rcl\`\n- RBC source asset: \`app/src/main/assets/program.rbc\`\n- Activity: \`${manifest.application.activity}\`\n- Build: \`./gradle-build.sh\`\n`);
  return Object.freeze({
    status: 'PROJECT_GENERATED',
    root,
    program: manifest.program,
    applicationId: manifest.application.applicationId,
    manifestRoot: manifest.manifestRoot,
    activitySource: path.join(root, `app/src/main/java/${manifest.application.applicationId.replaceAll('.', '/')}/${manifest.application.activity}.java`),
    buildCommand: './gradle-build.sh',
    coverageMode: 'lowered-execution',
  });
}

function jsTruthy(value) {
  if (value === null || value === undefined) return false;
  if (typeof value === 'boolean') return value;
  if (typeof value === 'number') return value !== 0;
  if (typeof value === 'string') return value.length > 0;
  return true;
}

function jsBinary(operator, left, right) {
  if (operator === 'and') return jsTruthy(left) && jsTruthy(right);
  if (operator === 'or') return jsTruthy(left) || jsTruthy(right);
  if (operator === '+') return typeof left === 'string' || typeof right === 'string' ? String(left) + String(right) : left + right;
  if (operator === '-') return left - right;
  if (operator === '*') return left * right;
  if (operator === '/') return left / right;
  if (operator === '%') return left % right;
  if (operator === '==') return left === right;
  if (operator === '!=') return left !== right;
  if (operator === '<') return left < right;
  if (operator === '<=') return left <= right;
  if (operator === '>') return left > right;
  if (operator === '>=') return left >= right;
  throw new Error(`RCL_ANDROID_OPERATOR:${operator}`);
}

function evalJsExpr(expr, snapshot) {
  if (!expr) return true;
  if (expr.kind === 'literal') return expr.value;
  if (expr.kind === 'path') {
    if (!Object.prototype.hasOwnProperty.call(snapshot, expr.path)) throw new Error(`RCL_ANDROID_STATE_MISSING:${expr.path}`);
    return snapshot[expr.path];
  }
  if (expr.kind === 'unary') {
    const value = evalJsExpr(expr.expression, snapshot);
    if (expr.operator === 'not') return !jsTruthy(value);
    if (expr.operator === '-') return -value;
    throw new Error(`RCL_ANDROID_UNARY:${expr.operator}`);
  }
  if (expr.kind === 'choose') return jsTruthy(evalJsExpr(expr.args[0], snapshot)) ? evalJsExpr(expr.args[1], snapshot) : evalJsExpr(expr.args[2], snapshot);
  return jsBinary(expr.operator, evalJsExpr(expr.left, snapshot), evalJsExpr(expr.right, snapshot));
}

function scopeMatches(granted, required) {
  return granted === required || required.startsWith(`${granted}.`) || granted === '*';
}

export function simulateRclAndroidApplication(manifest, events = []) {
  const state = structuredClone(manifest.state);
  const history = [];
  const realize = (name) => {
    const rule = manifest.rules.find((item) => item.name === name);
    if (!rule) throw new Error(`RCL_ANDROID_RULE_UNKNOWN:${name}`);
    const before = structuredClone(state);
    if (!jsTruthy(evalJsExpr(rule.when, before))) return { status: 'not-triggered', rule: name, state: structuredClone(state) };
    for (const need of rule.needs) {
      const granted = manifest.warrants.some((warrant) => warrant.subject === rule.actor && warrant.capability === need.capability && scopeMatches(warrant.target, need.target));
      if (!granted) throw new Error(`RCL_ANDROID_AUTHORITY_DENIED:${name}:${need.capability}`);
    }
    const proposed = structuredClone(before);
    for (const alter of rule.alters) proposed[alter.target] = evalJsExpr(alter.expression, before);
    for (const preserve of rule.preserves) if (!jsTruthy(evalJsExpr(preserve, proposed))) throw new Error(`RCL_ANDROID_PRESERVE_FAILED:${name}`);
    Object.keys(state).forEach((key) => delete state[key]);
    Object.assign(state, proposed);
    history.push({ status: 'realized', rule: name, before, after: structuredClone(state), witnesses: [...rule.witnesses] });
    return history.at(-1);
  };
  for (const event of events) {
    if (event.type === 'observe') {
      if (!Object.prototype.hasOwnProperty.call(state, event.path)) throw new Error(`RCL_ANDROID_OBSERVE_UNKNOWN:${event.path}`);
      const before = state[event.path];
      state[event.path] = event.value;
      history.push({ status: 'observed', path: event.path, before, after: event.value });
    } else if (event.type === 'realize') {
      realize(event.name);
    } else {
      throw new Error(`RCL_ANDROID_EVENT:${event.type}`);
    }
  }
  return { state, history };
}
