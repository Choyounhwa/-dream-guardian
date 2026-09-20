const fs = require('fs');
const vm = require('vm');

const html = fs.readFileSync('index.html', 'utf8');
const script = html.substring(html.indexOf('<script>')+8, html.lastIndexOf('</script>'));

const sandbox = {
  window: { 
    innerWidth: 1024, 
    innerHeight: 768, 
    addEventListener: () => {}, 
    AudioContext: class { state = 'suspended'; },
    webkitAudioContext: class {}
  },
  document: {
    getElementById: (id) => {
       let obj = { 
           getContext: () => new Proxy({ canvas: { width: 1024, height: 768 } }, {
               get: function(target, prop) {
                   if (prop in target) return target[prop];
                   if (prop === 'measureText') return () => ({width:10});
                   if (prop === 'createLinearGradient') return () => ({addColorStop:()=>{}});
                   if (prop === 'createRadialGradient') return () => ({addColorStop:()=>{}});
                   return () => {};
               }
           }),
           classList: { add:()=>{}, remove:()=>{} },
           style: { display: '' },
           width: 1024, height: 768,
           naturalWidth: 100, naturalHeight: 100, complete: true
       };
       return obj;
    },
    createElement: () => ({
        getContext: () => ({ drawImage:()=>{}, getImageData:()=>({data:[]}), putImageData:()=>{} }),
        width: 100, height: 100
    })
  },
  fetch: () => Promise.resolve({ text: () => Promise.resolve('"1","1","Title","Sub","q","c","w","va","vb","0","0",""') }),
  Date: Date,
  Math: Math,
  console: console,
  parseInt: parseInt,
  Number: Number,
  Map: Map,
  setInterval: setInterval,
  setTimeout: (cb, t) => { cb(); }, // immediate
  requestAnimationFrame: () => {},
  Image: class { constructor() { this.src=''; this.onload = null; } }
};

  try {
  vm.createContext(sandbox);
  // mock mediapipe classes
  vm.runInContext(`
    class Pose { setOptions(){} onResults(){} }
    class Camera { constructor(){} start(){} }
    function drawConnectors(){}
    function drawLandmarks(){}
    const POSE_CONNECTIONS = [];
  `, sandbox);
  vm.runInContext(script, sandbox);
  
  // mock results
  sandbox.fakeResults = {
      image: {},
      poseLandmarks: []
  };
  for(let i=0; i<33; i++) sandbox.fakeResults.poseLandmarks.push({x:0.5, y:0.5, visibility:0.9});
  
  vm.runInContext(`
    // populate questions
    fetch('fake').then(r=>r.text()).then(t => {
        // test startGame
        startGame(1);
        console.log("State after startGame:", gameState);
        
        // simulate frame
        onResults(fakeResults);
        console.log("State after onResults:", gameState);
        
        // test spacebar
        runGauge = targetRunGauge + 1;
        onResults(fakeResults);
        console.log("State after spacebar transition:", gameState);
    });
  `, sandbox);
  
} catch (e) {
  console.error("ERROR:", e);
}
