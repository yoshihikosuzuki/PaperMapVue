<template>
  <div id='vg'>
    <form id='addNodeForm' @submit.prevent='addNode(newNodeName)'>
      <input type='text' id='newNodeName' placeholder='Node name' v-model='newNodeName'/>
      <input type='submit' id='addNode' value='Add node'/>
    </form>
    <!--<form id='addEdgeForm' @submit.prevent='addEdge(newStartNodeName, newEndNodeName)'>
      <input type='text' placeholder='Start node name' v-model='newStartNodeName'/>
      <input type='text' placeholder='End node name' v-model='newEndNodeName'/>
      <input type='submit' value='Add edge'/>
    </form>
    <div>
      <button @click='resetGraph()'>Reset</button>
    </div>
    <div>
      <ul>
        <li v-for='nodeName in currentNodeNames' :key='nodeName.id'>
          {{nodeName}}
        </li>
      </ul>
    </div>-->
  </div>
</template>

<script>
import * as Viva from 'vivagraphjs';

/* --- TODO ---
- load json
- add PDF
- show PNG
- local file management
   ------------ */

export default {
  name: 'graph-view',
  data() {
    return {
      graph: Viva.Graph.graph(),
      newNodeName: '',
      newStartNodeName: '',
      newEndNodeName: '',
      currentNodeNames: [],
    };
  },
  mounted() {
    this.graph.addLink('a', 'b');
    const renderer = Viva.Graph.View.renderer(this.graph, {
      container: document.getElementById('vg'),
      graphics: Viva.Graph.View.svgGraphics(),
    });
    renderer.run();
    this.monitorGraph();
    this.addNode('c');
  },
  methods: {
    monitorGraph() {
      this.graph.on(
        'changed',
        (changes) => {
          console.log('changed', changes[0]);
          this.getNodes();
        },
        this,
      );
    },
    resetGraph() {
      this.graph.clear();
    },
    addNode(s) {
      this.graph.addNode(s);
    },
    addEdge(s, t) {
      this.graph.addLink(s, t);
    },
    getNodes() {
      // NOTE: too naive
      this.currentNodeNames = [];
      this.graph.forEachNode((node) => {
        this.currentNodeNames.push(node.id);
      });
    },
    getEdges() {
      const edges = [];
      this.graph.forEachLink((link) => {
        edges.push({ source: link.fromId, target: link.toId });
      });
    },
  },
};
</script>

<!-- Add 'scoped' attribute to limit CSS to this component only -->
<style>
#vg,
svg {
  width: 100%;
  height: 100%;
}
#addNodeForm {
  padding: 0 14px;
  position: absolute;
  white-space: nowrap;
  box-shadow: 0 2px 4px rgba(0, 0, 0, 0.2), 0 -1px 0 rgba(0, 0, 0, 0.02);
  top: 8px;
  left: 8px;
  width: 300px;
  display: flex;
}
#newNodeName {
  height: 56px;
  padding-left: 10px;
  font-size: 18px;
  outline: none;
  border: none;
  flex: 1;
}
#newNodeName:focus {
  border: none;
}
#addNode {
  color: #4183c4;
  background: transparent;
  border: none;
  padding: 0;
  font-size: 14px;
  cursor: pointer;
  margin-left: 4px;
}
#addNode:hover {
  color: #ff4081;
}
</style>
