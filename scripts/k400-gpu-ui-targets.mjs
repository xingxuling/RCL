import {createPortableGpuTextTarget} from '../src/portable-gpu-text-target.mjs';
export function createUiExecutionTarget(environment){
  if(environment!=='gpu')throw new Error('RCL_GPU_UI_TARGET_SCOPE');
  return createPortableGpuTextTarget({pythonPath:process.env.RCL_GPU_PYTHON??'C:/Users/User/AppData/Local/Programs/Python/Python311/python.exe'});
}
