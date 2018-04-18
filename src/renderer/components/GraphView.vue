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
import * as Viva from 'vivagraphjs'; // TODO: try import Viva
import fs from 'fs';
import fsExtra from 'fs-extra';
import { remote, ipcRenderer } from 'electron';
import pdf from 'pdfjs-dist-for-node';
import PDFWindow from 'electron-pdf-window';
const { BrowserWindow, dialog } = remote;
const resolve = require('path').resolve;

/* --- TODO ---
- add PDF
- local file management
   ------------ */

export default {
  name: 'graph-view',
  data() {
    return {
      graph: Viva.Graph.graph(),
      openingGraphFile: '',
      newNodeName: '',
      newStartNodeName: '',
      newEndNodeName: '',
      currentNodeNames: [],
    };
  },
  mounted() {
    const graphics = Viva.Graph.View.svgGraphics();
    const nodeSize = 100;
    const linkLength = 200;

    // set custom node appearance
    graphics.node((node) => {
      // The function is called every time renderer needs a ui to display node
      const ui = Viva.Graph.svg('g');
      const svgText = Viva.Graph.svg('text').attr('y', '-4px').text(node.id);
      const img = Viva.Graph.svg('image')
        .attr('width', nodeSize)
        .attr('height', nodeSize)
        .link(node.data.png); // => <image xmlns:xlink="http://www.w3.org/1999/xlink" xlink:href=/path/to/png></image>
      ui.append(svgText);
      ui.append(img);
      $(ui).hover(() => { // mouse overs
        this.highlightRelatedNodes(graphics, node.id, true);
      }, () => { // mouse out
        this.highlightRelatedNodes(graphics, node.id, false);
      });
      ui.addEventListener('click', () => { // node click
        // document.getElementById('detail').innerHTML = node.data.title;
        this.openPdf(node.data.pdf);
      });
      return ui;
    }).placeNode((nodeUI, pos) => {
      nodeUI.attr('transform',
        `translate(${pos.x - (nodeSize / 2)},${pos.y - (nodeSize / 2)})`);
    });

    // change layout
    const layout = Viva.Graph.Layout.forceDirected(this.graph, {
      springLength: linkLength,
    });
    // this.graph.addLink('a', 'b');
    const renderer = Viva.Graph.View.renderer(this.graph, {
      container: document.getElementById('vg'),
      graphics,
      layout,
    });
    renderer.run();
    this.monitorGraph();
    // this.addNode('c');
    this.monitorGraphIo();
  },
  methods: {
    highlightRelatedNodes(graphics, nodeId, isOn) {
      this.graph.forEachLinkedNode(nodeId, (node, link) => {
        const linkUI = graphics.getLinkUI(link.id);
        if (linkUI) {
          linkUI.attr('stroke', isOn ? 'red' : 'grey');
        }
      });
    },
    monitorGraphIo() {
      ipcRenderer.on('open', () => { this.openGraph(); });
      ipcRenderer.on('save', () => { this.saveGraph(); });
      ipcRenderer.on('save-as', () => { this.saveGraphAs(); });
    },
    existFile(fileName) {
      let retval = true;
      try {
        fs.statSync(fileName);
      } catch (err) {
        if (err.code === 'ENOENT') {
          retval = false;
        }
      }
      return retval;
    },
    requirePdf() {
      return dialog.showOpenDialog({ // synchronous
        filters: [{ name: 'PDF', extensions: ['pdf'] }],
      })[0];
    },
    openPdf(fileName) {
      const win = new BrowserWindow({ width: 800, height: 1000 });
      PDFWindow.addSupport(win);
      win.loadURL(fileName);
    },
    generateThumbnail(inPdfFileName, outPngPrefix) {
      const canvas = document.createElement('canvas');
      const ctx = canvas.getContext('2d');
      return pdf.getDocument(`file://${resolve(inPdfFileName)}`).then(doc => doc.getPage(1).then((page) => {
        const viewport = page.getViewport(1.0);
        canvas.height = viewport.height;
        canvas.width = viewport.width;
        const renderer = {
          canvasContext: ctx,
          viewport,
        };
        return page.render(renderer).then(() => new Promise(((resolve) => {
          ctx.globalCompositeOperation = 'destination-over';
          ctx.fillStyle = '#ffffff';
          ctx.fillRect(0, 0, canvas.width, canvas.height);
          const image = canvas.toDataURL('image/png').replace(/^data:image\/png;base64,/, '');
          fs.writeFileSync(`${outPngPrefix}.png`, image, 'base64');
          resolve();
        })));
      }));
    },
    checkNewNode(nodeId, attributes) {
      let retval;
      // already existing nodes must be assured to have all attributes
      if (!this.graph.getNode(nodeId)) {
        let title;
        let fileName;
        retval = new Promise(((resolve) => {
          title = attributes === undefined ? nodeId : attributes.title;
          fileName = attributes === undefined
            || !this.existFile(attributes.pdf) ? this.requirePdf() : attributes.pdf;
          resolve(fileName);
        })).then(fileName => (!this.existFile(`${nodeId}.png`) ? this.generateThumbnail(fileName, nodeId) : null)).then(() => {
          this.graph.addNode(nodeId, { pdf: `file://${resolve(`${fileName}`)}`, png: `file://${resolve(`${nodeId}.png`)}`, title });
        });
      }
      return retval;
    },
    loadGraphFromJSON(jsonFname) {
      const edgesAndNodes = JSON.parse(fs.readFileSync(jsonFname, 'utf8'));
      const nodes = edgesAndNodes.nodes;
      const edges = edgesAndNodes.edges;

      Promise.all(nodes.map((node) => {
        const id = node.id;
        delete node.id;
        return this.checkNewNode(id, node);
      }))
        .then(() => {
          for (let i = 0; i < edges.length; i += 1) {
            this.graph.addLink(edges[i].source, edges[i].target);
          }
        });
    },
    writeGraphToJSON(jsonFname) {
      const nodes = [];
      const edges = [];
      this.graph.forEachNode((node) => {
        const obj = node.data;
        obj.id = node.id;
        nodes.push(obj);
      });
      this.graph.forEachLink((link) => {
        edges.push({ source: link.fromId, target: link.toId });
      });
      fsExtra.writeJson(jsonFname, { nodes, edges });
    },
    openGraph() {
      const jsonFname = dialog.showOpenDialog({
        filters: [{ name: 'JSON', extensions: ['json'] }],
      })[0];

      this.graph.clear();
      this.loadGraphFromJSON(jsonFname);
      this.openingGraphFile = jsonFname;
    },
    saveGraph() {
      if (this.openingGraphFile === '') {
        this.saveFileAs();
      } else {
        this.writeGraphToJSON(this.openingGraphFile);
      }
    },
    saveGraphAs() {
      const jsonFname = dialog.showSaveDialog({
        filters: [{ name: 'JSON', extensions: ['json'] }],
      });
      this.writeGraphToJSON(jsonFname);
      this.openingGraphFile = jsonFname;
    },
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
  background: white;
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
