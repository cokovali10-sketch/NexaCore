// NEXA Core — adapters/vue.ts
// app.use(NexaPlugin, { particles: true }) + <canvas v-nexa>
import { Nexa } from '../src/index.js';

export const NexaPlugin = {
  install(app: any, opts: any = {}) {
    app.directive('nexa', {
      async mounted(el: HTMLCanvasElement) { await Nexa.boot({ canvas: el, ...opts }); }
    });
    app.config.globalProperties.$nexa = Nexa;
  }
};
