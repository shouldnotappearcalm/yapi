import task from './component/Task/Task.js'

function hander(routers) {
  routers.interfaceOauth111 = {
    name: '定时测试任务',
    component: task
  };
}

module.exports = function() {
  this.bindHook('sub_setting_nav', hander);
};
