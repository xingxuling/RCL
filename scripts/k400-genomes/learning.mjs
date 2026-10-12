import { donorSource, inputFacets, edit, definition, casesFrom } from './shared.mjs';

const donor = 'examples/universal-stress/k333-compiler-machine-learning.rcl';
const baseline = { epochs: 16, nodes: 4, hotness: 2 };
function source() {
  let text = inputFacets(donorSource(donor, 'PortableLearning', 'k400-learning-v1'), baseline);
  text = edit(text, 'facet training.epochs : Number = 16', 'facet training.epochs : Number = input.epochs');
  text = edit(text, 'facet inference.nodes : Number = 4', 'facet inference.nodes : Number = input.nodes');
  return edit(text, 'facet inference.hotness : Number = 2', 'facet inference.hotness : Number = input.hotness');
}
function oracle({ epochs, nodes, hotness }) {
  const dataset = [[1,1,0],[3,1,1],[1,3,1],[3,3,1]];
  let parameters = [0,0,0];
  const score = (x,y) => parameters[0] * x + parameters[1] * y + parameters[2];
  for (let epoch = 0; epoch < epochs; epoch++) for (const [x,y,label] of dataset) {
    if ((score(x,y) >= 0 ? 1 : 0) !== label) { const direction = label === 1 ? 1 : -1; parameters = [parameters[0]+direction*x,parameters[1]+direction*y,parameters[2]+direction]; }
  }
  const correct = dataset.filter(([x,y,label]) => (score(x,y)>=0?1:0) === label).length;
  const prediction = score(nodes,hotness), classification = prediction >= 0 ? 1 : 0;
  return { state: { 'training.final_parameters': parameters, 'evaluation.correct':correct, 'evaluation.accuracy':correct/4,
    'inference.score':prediction,'inference.classification':classification,'inference.recommendation':classification===1?'EXPENSIVE_OPTIMIZATION_CANDIDATE':'STANDARD_OPTIMIZATION_CANDIDATE',
    'boundary.small_cold_classification':score(1,1)>=0?1:0,'authority.model_commit_granted':false }, historyRules: [] };
}
export default definition({ id:'learning', donor, source, baseline, oracle, families:['machine-learning'],
  scope:'bounded RCL-owned integer perceptron training and numerical inference; model output remains advisory, with no Tensor/Transformer/general ML claim',
  cases:casesFrom(['epochs','nodes','hotness'],[[0,0,0],[1,1,1],[2,3,1],[3,1,3],[4,3,3],[8,-2,5],[16,1,1],[20,0,0],[24,6,-3],[12,1.5,0.5]]),
  mutations:[
    {id:'bias-direction',good:'bias(parameters) + choose(sequence_get(sample, 2) == 1, 1, -1)',bad:'bias(parameters) + choose(sequence_get(sample, 2) == 1, -1, 1)',intent:'Train a binary perceptron: for a misclassified sample add its features and one to the bias for a positive label; subtract them for a negative label.'},
    {id:'score-bias',good:'hotness_weight(parameters) * hotness + bias(parameters)',bad:'hotness_weight(parameters) * hotness - bias(parameters)',intent:'Inference uses the dot product of feature weights with features plus the learned bias, consistently during training and prediction.'},
    {id:'weight-direction',good:'node_weight(parameters) + choose(sequence_get(sample, 2) == 1, sequence_get(sample, 0), -sequence_get(sample, 0))',bad:'node_weight(parameters) + choose(sequence_get(sample, 2) == 1, -sequence_get(sample, 0), sequence_get(sample, 0))',intent:'The node-feature perceptron weight moves toward a misclassified positive sample and away from a misclassified negative sample.'},
  ] }, 'scripts/k400-genomes/learning.mjs');
