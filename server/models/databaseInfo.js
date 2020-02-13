const yapi = require('../yapi.js');
const baseModel = require('./base.js');

class databaseModel extends baseModel {
  getName() {
    return 'database_info';
  }

  getSchema() {
    return {
      uid: { type: Number},
      // 项目 id
      project_id: { type: Number, required: true },
      //环境变量的id
      env_id: { type: String, required: true },
      //环境变量的名称
      env_name: { type: String, required: true },
      // 数据库类型
      database_type: { type: String, required: true },
      // 数据库主机地址
      database_host: { type: String, required: true },
      // 数据库端口
      database_port: { type: Number, required: true },
      // 连接数据库的用户
      database_user: { type: String },
      // 连接数据库的密码
      database_password: { type: String },
      // 连接的数据库
      database_name: { type: String, required: true },
      add_time: Number,
      update_time: Number
    };
  }

  getByProjectId(id) {
    return this.model.find({
      project_id: id
    }).select(
      '_id uid project_id env_id env_name database_type database_host database_port database_user database_password database_name add_time update_time'
    )
    .sort({ _id: -1 })
    .exec(); 
  }

  getByProjectIdAndEnvId(projectId, envId) {
    return this.model.findOne({
      project_id: projectId,
      env_id: envId
    }) 
  }

  delByProjectId(project_id){
    return this.model.remove({
      project_id: project_id
    })
  }

  delByProjectIdAndEnvId(projectId, envId) {
    return this.model.remove({
      project_id: projectId,
      env_id: envId
    }) 
  } 

  save(data) {
    data.add_time = yapi.commons.time();
    data.update_time = yapi.commons.time();
    let m = new this.model(data);
    return m.save();
  }

  listAll() {
    return this.model
      .find({})
      .select(
        '_id uid project_id env_id env_name database_type database_host database_port database_user database_password database_name add_time update_time'
      )
      .sort({ _id: -1 })
      .exec();
  }

  up(data) {
    let id = data.id;
    delete data.id;
    data.update_time = yapi.commons.time();
    return this.model.update({
      _id: id
    }, data)
  }

  upById(id, data) {
    delete data.id;
    data.update_time = yapi.commons.time();
    return this.model.update({
      _id: id
    }, data)
  }

  del(id){
    return this.model.remove({
      _id: id
    })
  }

}

module.exports = databaseModel;
