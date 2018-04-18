import Vue from 'vue';
import Router from 'vue-router';

Vue.use(Router);

export default new Router({
  routes: [
    {
      path: '/',
      name: 'graph-view',
      component: require('@/components/GraphView').default,
    },
    {
      path: '*',
      redirect: '/',
    },
  ],
});
