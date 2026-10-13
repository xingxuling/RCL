import {createHash} from 'node:crypto';
import {compileNativeUiForExecution} from './native-event-lowering.mjs';
import {collectUiNodes} from './ui-compiler.mjs';
import {lowerNativeUiToAndroid,emitNativeUiAndroidActivity} from './android-ui-backend.mjs';
const sha=s=>createHash('sha256').update(s).digest('hex');
const javaId=id=>id.replace(/[^A-Za-z0-9_$]/gu,'_');
const dp=n=>/^\d+$/u.test(String(n))?'dp('+n+')':String(n);
/** Native Android Views share the canonical layout; only RCL computes state. */
export function emitNativeUiAndroidBridge(source,{applicationId='org.rcl.k400.mobile',activity='MainActivity'}={}){
  const ui=compileNativeUiForExecution(source),manifest=lowerNativeUiToAndroid(ui,{applicationId,activity,title:'RCL 计数器'}),original=emitNativeUiAndroidActivity(manifest),nodes=collectUiNodes(ui.viewTree);
  if(nodes.some(n=>!['container','text','action','input'].includes(n.role)))throw new Error('RCL_MOBILE_BRIDGE_ROLE_UNSUPPORTED');
  const allFields=[...original.matchAll(/  private [^\n]+ view_[^\n]+;/gu)].map(m=>m[0]).join('\n');
  const build=/  private void buildUi\(\) \{\n([\s\S]*?)\n  \}/u.exec(original)?.[1];if(!build)throw new Error('RCL_MOBILE_CANONICAL_LAYOUT_MISSING');
  let body=build.replace(/\.setPadding\((\d+), (\d+), (\d+), (\d+)\)/gu,(_m,...v)=>'.setPadding('+v.slice(0,4).map(dp).join(', ')+')')
    .replace(/\.setMargins\((\d+), (\d+), (\d+), (\d+)\)/gu,(_m,...v)=>'.setMargins('+v.slice(0,4).map(dp).join(', ')+')')
    .replace(/new LinearLayout\.LayoutParams\(([^,\n]+), ([^)\n]+)\)/gu,(_m,w,h)=>'new LinearLayout.LayoutParams('+dp(w)+', '+dp(h)+')');
  for(const parent of nodes.filter(n=>n.role==='container'&&n.layout.mode==='horizontal'))for(const child of parent.children.filter(n=>n.layout.width.mode==='fill')){
    const variable='params_'+javaId(parent.id)+'_'+javaId(child.id),pattern=new RegExp('(LinearLayout\\.LayoutParams '+variable+' = )new LinearLayout\\.LayoutParams\\((?:ViewGroup.LayoutParams.MATCH_PARENT|-1), (.+?)\\);','u');
    body=body.replace(pattern,(_m,p,h)=>p+'new LinearLayout.LayoutParams(0, '+h+', 1f);');
  }
  for(const n of nodes){const variable='view_'+javaId(n.id),pattern=new RegExp('('+variable+' = new [A-Za-z]+\\(this\\);)','u');if(!pattern.test(body))throw new Error('RCL_MOBILE_NODE_LAYOUT_MISSING:'+n.id);body=body.replace(pattern,'$1\n    views.put('+JSON.stringify(n.id)+', '+variable+'); '+variable+'.setTag('+JSON.stringify(n.id)+');');}
  const layoutRoot=sha(JSON.stringify({tree:ui.viewTree,mappings:manifest.nodeMappings}));
  const java=`package ${applicationId};
import android.app.Activity;
import android.graphics.Color;
import android.os.Bundle;
import android.util.Log;
import android.view.Gravity;
import android.view.View;
import android.view.ViewGroup;
import android.widget.*;
import android.text.*;
import java.util.*;
import java.util.concurrent.*;
import java.net.*;
import java.io.*;
import org.json.*;

public final class ${activity} extends Activity {
  private static final String TAG="RCLRemoteUI", LAYOUT_ROOT=${JSON.stringify(layoutRoot)};
  private final Map<String,View> views=new LinkedHashMap<>();
  private final ExecutorService worker=Executors.newSingleThreadExecutor();
  private final String instance=UUID.randomUUID().toString();
  private String endpoint,token,session,expectedUiRoot;
  private JSONObject snapshot=null;
  private boolean pending=false,rendering=false,destroyed=false;
  private TextView status;
${allFields}
  private int dp(int value){return Math.round(value*getResources().getDisplayMetrics().density);}
  private String setting(String name,Bundle saved){String value=getIntent().getStringExtra(name);if(value==null&&saved!=null)value=saved.getString(name);if(value==null)value=getPreferences(MODE_PRIVATE).getString(name,null);return value;}
  @Override protected void onCreate(Bundle saved){super.onCreate(saved);endpoint=setting("endpoint",saved);token=setting("token",saved);session=setting("session",saved);expectedUiRoot=setting("uiRoot",saved);buildUi();log("create",null);if(endpoint!=null&&token!=null&&session!=null&&expectedUiRoot!=null){getPreferences(MODE_PRIVATE).edit().putString("endpoint",endpoint).putString("token",token).putString("session",session).putString("uiRoot",expectedUiRoot).apply();refresh();}else showError("请通过本地 RCL 服务打开此应用");}
  @Override protected void onStart(){super.onStart();log("activate",null);}
  @Override protected void onResume(){super.onResume();log("resume",null);}
  @Override protected void onPause(){log("suspend",null);super.onPause();}
  @Override protected void onDestroy(){destroyed=true;log("destroy",null);worker.shutdown();super.onDestroy();}
  @Override protected void onSaveInstanceState(Bundle saved){for(String key:new String[]{"endpoint","token","session","uiRoot"})saved.putString(key,setting(key,null));log("save",null);super.onSaveInstanceState(saved);}
  private void buildUi(){
${body.replace(/    setContentView\(([^)]+)\);/u,(_m,root)=>'    LinearLayout frame=new LinearLayout(this);frame.setOrientation(LinearLayout.VERTICAL);frame.setPadding(dp(12),dp(16),dp(12),dp(12));frame.addView('+root+',new LinearLayout.LayoutParams(-1,-2));status=new TextView(this);status.setTextSize(16);frame.addView(status,new LinearLayout.LayoutParams(-1,-2));Button retry=new Button(this);retry.setText("重新连接");retry.setContentDescription("重新连接 RCL 服务");retry.setOnClickListener(v -> refresh());frame.addView(retry,new LinearLayout.LayoutParams(-1,dp(48)));setContentView(frame);')}
    busy(true);
  }
  private void busy(boolean value){pending=value;for(View v:views.values())if(v instanceof Button||v instanceof EditText)v.setEnabled(!value);}
  private void showError(String message){status.setText(message);busy(true);}
  private JSONObject request(String path,JSONObject body)throws Exception {
    URL url=new URL(endpoint+path);if(!"http".equals(url.getProtocol())||!"127.0.0.1".equals(url.getHost()))throw new IOException("RCL_MOBILE_LOOPBACK_REQUIRED");
    HttpURLConnection connection=(HttpURLConnection)url.openConnection();connection.setConnectTimeout(10000);connection.setReadTimeout(60000);connection.setRequestProperty("x-rcl-ui-token",token);connection.setRequestProperty("content-type","application/json");
    try{if(body!=null){connection.setRequestMethod("POST");connection.setDoOutput(true);try(OutputStream out=connection.getOutputStream()){out.write(body.toString().getBytes("UTF-8"));}}
      int code=connection.getResponseCode();InputStream input=code>=400?connection.getErrorStream():connection.getInputStream();ByteArrayOutputStream bytes=new ByteArrayOutputStream();if(input!=null)try(InputStream in=input){byte[] buffer=new byte[8192];int n;while((n=in.read(buffer))!=-1){bytes.write(buffer,0,n);if(bytes.size()>16777216)throw new IOException("RCL_MOBILE_RESPONSE_LIMIT");}}
      JSONObject result=new JSONObject(bytes.toString("UTF-8"));JSONObject receipt=new JSONObject();receipt.put("path",path);receipt.put("httpStatus",code);receipt.put("code",result.optString("code",""));log("http",receipt);if(code!=200)throw new IOException(result.optString("code","RCL_MOBILE_HTTP_ERROR"));return result;
    }finally{connection.disconnect();}
  }
  private void refresh(){if(pending&&snapshot!=null)return;busy(true);status.setText("正在连接");worker.execute(()->{try{JSONObject next=request("/api/state",null);runOnUiThread(()->accept(next,"ready"));}catch(Exception e){runOnUiThread(()->fail(e));}});}
  private void dispatch(String node,String type,Map<String,Object> payload){if(pending||snapshot==null)return;try{JSONObject body=new JSONObject();JSONObject event=new JSONObject();event.put("nodeId",node);event.put("type",type);event.put("payload",new JSONObject(payload));body.put("event",event);body.put("expectedStateRoot",snapshot.getString("stateRoot"));busy(true);JSONObject clicked=new JSONObject();clicked.put("nodeId",node);clicked.put("type",type);log("touch",clicked);worker.execute(()->{try{JSONObject response=request("/api/event",body);runOnUiThread(()->{try{accept(response.getJSONObject("snapshot"),"commit");}catch(Exception e){fail(e);}});}catch(Exception e){runOnUiThread(()->fail(e));}});}catch(Exception e){fail(e);}}
  private void accept(JSONObject next,String kind){if(destroyed)return;try{if(!expectedUiRoot.equals(next.getString("uiRoot")))throw new IOException("RCL_MOBILE_UI_ROOT_MISMATCH");JSONObject rendered=next.getJSONObject("rendered");if(rendered.length()!=views.size())throw new IOException("RCL_MOBILE_RENDER_SHAPE");rendering=true;for(String id:views.keySet()){JSONObject properties=rendered.getJSONObject(id);View view=views.get(id);for(Iterator<String> keys=properties.keys();keys.hasNext();){String key=keys.next();if("value".equals(key)||"label".equals(key)){if(!(view instanceof TextView))throw new IOException("RCL_MOBILE_RENDER_ROLE");((TextView)view).setText(String.valueOf(properties.get(key)));}}}rendering=false;snapshot=next;busy(false);status.setText("");getWindow().getDecorView().post(()->log(kind,null));}catch(Exception e){rendering=false;fail(e);}}
  private void fail(Exception error){if(destroyed)return;showError("连接失败，请重新连接");try{JSONObject data=new JSONObject();data.put("code",error.getMessage());log("error",data);}catch(Exception ignored){}}
  private void log(String kind,JSONObject detail){try{JSONObject data=new JSONObject();data.put("kind",kind);data.put("session",session);data.put("instance",instance);data.put("pid",android.os.Process.myPid());data.put("layoutRoot",LAYOUT_ROOT);data.put("uiRoot",expectedUiRoot);data.put("snapshot",snapshot==null?JSONObject.NULL:snapshot);if(detail!=null)data.put("detail",detail);JSONObject rendered=new JSONObject();for(String id:views.keySet()){View v=views.get(id);JSONObject item=new JSONObject();int[] xy=new int[2];v.getLocationOnScreen(xy);item.put("class",v.getClass().getName());item.put("text",v instanceof TextView?((TextView)v).getText().toString():"");item.put("label",v.getContentDescription()==null?"":v.getContentDescription().toString());item.put("enabled",v.isEnabled());item.put("bounds",new JSONArray(new int[]{xy[0],xy[1],v.getWidth(),v.getHeight()}));rendered.put(id,item);}data.put("views",rendered);Log.i(TAG,data.toString());}catch(Exception error){Log.e(TAG,"RCL_MOBILE_LOG_ERROR",error);}}
}
`;
  return{format:'rcl.native-ui.android-bridge.v1',ui,manifest,layoutRoot,java,javaHash:sha(java),canonicalEmitterHash:sha(original),nativeViews:true,webViewUsed:false,clientComputesRclState:false};
}
