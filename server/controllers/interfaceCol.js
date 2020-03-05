const interfaceColModel = require('../models/interfaceCol.js');
const interfaceCaseModel = require('../models/interfaceCase.js');
const interfaceModel = require('../models/interface.js');
const projectModel = require('../models/project.js');
const baseController = require('./base.js');
const yapi = require('../yapi.js');
const _ = require('underscore');
const boundaryUtils = require('../../common/boundary.js')

class interfaceColController extends baseController {
  constructor(ctx) {
    super(ctx);
    this.colModel = yapi.getInst(interfaceColModel);
    this.caseModel = yapi.getInst(interfaceCaseModel);
    this.interfaceModel = yapi.getInst(interfaceModel);
    this.projectModel = yapi.getInst(projectModel);
  }

  /**
   * 获取所有接口用例集
   * @interface /col/list
   * @method GET
   * @category col
   * @foldnumber 10
   * @param {String} project_id email名称，不能为空
   * @returns {Object}
   * @example
   */
  async list(ctx) {
    try {
      let id = ctx.query.project_id;
      let project = await this.projectModel.getBaseInfo(id);
      if (project.project_type === 'private') {
        if ((await this.checkAuth(project._id, 'project', 'view')) !== true) {
          return (ctx.body = yapi.commons.resReturn(null, 406, '没有权限'));
        }
      }
      let islist = ctx.params.islist && ctx.params.islist === '1' ? true : false;
      let result = await this.getCol(id, islist);
      ctx.body = yapi.commons.resReturn(result);
    } catch (e) {
      ctx.body = yapi.commons.resReturn(null, 402, e.message);
    }
  }

  async getCol(project_id, islist, mycatid) {
    let result = yapi.commons.getCol(project_id, islist, mycatid);
    return result;
  }

  /**
   * 增加接口集
   * @interface /col/add_col
   * @method POST
   * @category col
   * @foldnumber 10
   * @param {Number} project_id
   * @param {String} name
   * @param {String} desc
   * @returns {Object}
   * @example
   */

  async addCol(ctx) {
    try {
      let params = ctx.request.body;
      params = yapi.commons.handleParams(params, {
        name: 'string',
        project_id: 'number',
        desc: 'string',
        parent_id: 'number'
      });

      if (!params.project_id) {
        return (ctx.body = yapi.commons.resReturn(null, 400, '项目id不能为空'));
      }
      if (!params.parent_id) {
        return (ctx.body = yapi.commons.resReturn(null, 400, '父集合id不能为空'));
      }
      if (!params.name) {
        return (ctx.body = yapi.commons.resReturn(null, 400, '名称不能为空'));
      }

      let auth = await this.checkAuth(params.project_id, 'project', 'edit');
      if (!auth) {
        return (ctx.body = yapi.commons.resReturn(null, 400, '没有权限'));
      }

      let result = await this.colModel.save({
        name: params.name,
        project_id: params.project_id,
        desc: params.desc,
        uid: this.getUid(),
        parent_id: params.parent_id,
        add_time: yapi.commons.time(),
        up_time: yapi.commons.time()
      });
      let username = this.getUsername();
      yapi.commons.saveLog({
        content: `<a href="/user/profile/${this.getUid()}">${username}</a> 添加了接口集 <a href="/project/${
          params.project_id
          }/interface/col/${result._id}">${params.name}</a>`,
        type: 'project',
        uid: this.getUid(),
        username: username,
        typeid: params.project_id
      });
      // this.projectModel.up(params.project_id,{up_time: new Date().getTime()}).then();
      ctx.body = yapi.commons.resReturn(result);
    } catch (e) {
      ctx.body = yapi.commons.resReturn(null, 402, e.message);
    }
  }

  /**
   * 获取一个接口集下的所有的测试用例
   * @interface /col/case_list
   * @method GET
   * @category col
   * @foldnumber 10
   * @param {String} col_id 接口集id
   * @returns {Object}
   * @example
   */
  async getCaseList(ctx) {
    let catids = ctx.query.col_id ? ctx.query.col_id.split(',') : [];

    let handleReport = json => {
      try {
        return JSON.parse(json);
      } catch (e) {
        return {};
      }
    }

    try {
      let alldata = {};
      for (let i = 0; i < catids.length; i++) {
        let id = Number(catids[i]);
        if (!id || id == 0) {
          return (ctx.body = yapi.commons.resReturn(null, 407, 'col_id不能为空'));
        }

        let colData = await this.colModel.get(id);

        let project = await this.projectModel.getBaseInfo(colData.project_id);
        if (project.project_type === 'private') {
          if ((await this.checkAuth(project._id, 'project', 'view')) !== true) {
            return (ctx.body = yapi.commons.resReturn(null, 406, '没有权限'));
          }
        }

        let ret = await yapi.commons.getCaseList(id);
        let test_report = handleReport(ret.colData.test_report);
        if (ret.errcode !== 0) {
          alldata = ret;
          break;
        } else {
          alldata.data = alldata.data ? alldata.data.concat(ret.data) : ret.data;
          typeof alldata.test_report === 'undefined' ? (alldata.test_report = {}) : '';
          Object.assign(alldata.test_report, test_report)
          //  console.log({test_report});
        }
      }

      let ctxBody = yapi.commons.resReturn(alldata.data);
      ctxBody.test_report = alldata.test_report;
      ctx.body = ctxBody;
      //  console.log({'ctx.body':ctx.body});
    } catch (e) {
      ctx.body = yapi.commons.resReturn(null, 402, e.message);
    }
  }

  /**
   * 替换一个测试集合下面的所有变量为目标值
   * @param {*} ctx 
   */
  async replaceVariables(ctx) {
    let params = ctx.request.body;
    params = yapi.commons.handleParams(params, {
      colId: 'string',
      originValue: 'string',
      targetValue: 'string'
    });
    let caseList = await yapi.commons.getCaseList(params.colId);

    // 处理 originValue 中的特殊字符
    let specialCharArr = ['$', '(', ')', '*', '+', '.', '[', '?', '\\', '^', '{', '|'];
    let originValueArr = params.originValue.split('');
    for (let i = 0; i < originValueArr.length; i++) {
      if (specialCharArr.indexOf(originValueArr[i]) > -1) {
        originValueArr[i] = '\\' + originValueArr[i];
      }
    }
    params.originValue = originValueArr.join('');

    let regExp = new RegExp(params.originValue, 'g');
    caseList.data.forEach(async caseItem => {
      if (caseItem.req_body_other) {
        caseItem.req_body_other = caseItem.req_body_other.replace(regExp, params.targetValue);
      }
      let props = ['req_params', 'req_headers', 'req_query', 'req_body_form'];
      props.forEach(prop => {
        caseItem[prop] = Array.from(caseItem[prop]);
        caseItem[prop].forEach(propValues => {
          if (propValues.value == params.originValue) {
            propValues.value = params.targetValue;
          }
        })
      });

      await this.caseModel.up(caseItem._id, caseItem);
    })
    ctx.body = yapi.commons.resReturn("替换成功");
  }

  /**
   * 获取一个接口集下的所有的测试用例的环境变量
   * @interface /col/case_env_list
   * @method GET
   * @category col
   * @foldnumber 10
   * @param {String} col_id 接口集id
   * @returns {Object}
   * @example
   */
  async getCaseEnvList(ctx) {
    let catids = ctx.query.col_id ? ctx.query.col_id.split(',') : [];

    try {
      let projectEnvList = [];
      let envProjectIdList = [];
      for (let i = 0; i < catids.length; i++) {
        let id = Number(catids[i]);
        if (!id || id == 0) {
          return (ctx.body = yapi.commons.resReturn(null, 407, 'col_id不能为空'));
        }

        let colData = await this.colModel.get(id);
        let project = await this.projectModel.getBaseInfo(colData.project_id);
        if (project.project_type === 'private') {
          if ((await this.checkAuth(project._id, 'project', 'view')) !== true) {
            return (ctx.body = yapi.commons.resReturn(null, 406, '没有权限'));
          }
        }

        // 通过col_id 找到 caseList
        let projectList = await this.caseModel.list(id, 'project_id');
        // 对projectList 进行去重处理

        projectList = this.unique(projectList, 'project_id');
        projectList.forEach(id => { envProjectIdList.includes(id) ? '' : envProjectIdList.push(id) });
        // 遍历projectList 找到项目和env


      }
      for (let i = 0; i < envProjectIdList.length; i++) {
        let result = await this.projectModel.getBaseInfo(envProjectIdList[i], 'name  env');
        projectEnvList.push(result);
      }
      //projectEnvList=this.unique(projectEnvList, '_id');
      ctx.body = yapi.commons.resReturn(projectEnvList);
    } catch (e) {
      ctx.body = yapi.commons.resReturn(null, 402, e.message);
    }
  }

  requestParamsToObj(arr) {
    if (!arr || !Array.isArray(arr) || arr.length === 0) {
      return {};
    }
    let obj = {};
    arr.forEach(item => {
      obj[item.name] = '';
    });
    return obj;
  }

  /**
   * 获取一个接口集下的所有的测试用例
   * @interface /col/case_list_by_var_params
   * @method GET
   * @category col
   * @foldnumber 10
   * @param {String} col_id 接口集id
   * @returns {Object}
   * @example
   */

  async getCaseListByVariableParams(ctx) {
    try {
      let id = ctx.query.col_id;
      if (!id || id == 0) {
        return (ctx.body = yapi.commons.resReturn(null, 407, 'col_id不能为空'));
      }
      let resultList = await this.caseModel.list(id, 'all');
      if (resultList.length === 0) {
        return (ctx.body = yapi.commons.resReturn([]));
      }
      let project = await this.projectModel.getBaseInfo(resultList[0].project_id);

      if (project.project_type === 'private') {
        if ((await this.checkAuth(project._id, 'project', 'view')) !== true) {
          return (ctx.body = yapi.commons.resReturn(null, 406, '没有权限'));
        }
      }

      for (let index = 0; index < resultList.length; index++) {
        let result = resultList[index].toObject();
        let item = {},
          body,
          query,
          bodyParams,
          pathParams;
        let data = await this.interfaceModel.get(result.interface_id);
        if (!data) {
          await this.caseModel.del(result._id);
          continue;
        }
        item._id = result._id;
        item.casename = result.casename;
        body = yapi.commons.json_parse(data.res_body);
        body = typeof body === 'object' ? body : {};
        if (data.res_body_is_json_schema) {
          body = yapi.commons.schemaToJson(body, {
            alwaysFakeOptionals: true,
            useDefaultValue: true
          });
        }
        item.body = Object.assign({}, body);
        query = this.requestParamsToObj(data.req_query);
        pathParams = this.requestParamsToObj(data.req_params);
        if (data.req_body_type === 'form') {
          bodyParams = this.requestParamsToObj(data.req_body_form);
        } else {
          bodyParams = yapi.commons.json_parse(data.req_body_other);
          if (data.req_body_is_json_schema) {
            bodyParams = yapi.commons.schemaToJson(bodyParams, {
              alwaysFakeOptionals: true,
              useDefaultValue: true
            });
          }
          bodyParams = typeof bodyParams === 'object' ? bodyParams : {};
        }
        item.params = Object.assign(pathParams, query, bodyParams);
        item.index = result.index;
        resultList[index] = item;
      }

      ctx.body = yapi.commons.resReturn(resultList);
    } catch (e) {
      ctx.body = yapi.commons.resReturn(null, 402, e.message);
    }
  }

  /**
   * 增加一个测试用例
   * @interface /col/add_case
   * @method POST
   * @category col
   * @foldnumber 10
   * @param {String} casename
   * @param {Number} col_id
   * @param {Number} project_id
   * @param {String} domain
   * @param {String} path
   * @param {String} method
   * @param {Object} req_query
   * @param {Object} req_headers
   * @param {String} req_body_type
   * @param {Array} req_body_form
   * @param {String} req_body_other
   * @returns {Object}
   * @example
   */

  async addCase(ctx) {
    try {
      let params = ctx.request.body;
      params = yapi.commons.handleParams(params, {
        casename: 'string',
        project_id: 'number',
        col_id: 'number',
        interface_id: 'number',
        case_env: 'string'
      });

      if (!params.project_id) {
        return (ctx.body = yapi.commons.resReturn(null, 400, '项目id不能为空'));
      }

      if (!params.interface_id) {
        return (ctx.body = yapi.commons.resReturn(null, 400, '接口id不能为空'));
      }

      let auth = await this.checkAuth(params.project_id, 'project', 'edit');
      if (!auth) {
        return (ctx.body = yapi.commons.resReturn(null, 400, '没有权限'));
      }

      if (!params.col_id) {
        return (ctx.body = yapi.commons.resReturn(null, 400, '接口集id不能为空'));
      }

      if (!params.casename) {
        return (ctx.body = yapi.commons.resReturn(null, 400, '用例名称不能为空'));
      }

      params.uid = this.getUid();
      params.index = 0;
      params.add_time = yapi.commons.time();
      params.up_time = yapi.commons.time();
      let result = await this.caseModel.save(params);
      let username = this.getUsername();

      this.colModel.get(params.col_id).then(col => {
        yapi.commons.saveLog({
          content: `<a href="/user/profile/${this.getUid()}">${username}</a> 在接口集 <a href="/project/${
            params.project_id
            }/interface/col/${params.col_id}">${col.name}</a> 下添加了测试用例 <a href="/project/${
            params.project_id
            }/interface/case/${result._id}">${params.casename}</a>`,
          type: 'project',
          uid: this.getUid(),
          username: username,
          typeid: params.project_id
        });
      });
      this.projectModel.up(params.project_id, { up_time: new Date().getTime() }).then();

      ctx.body = yapi.commons.resReturn(result);
    } catch (e) {
      ctx.body = yapi.commons.resReturn(null, 402, e.message);
    }
  }

  async addCaseList(ctx) {
    try {
      let params = ctx.request.body;
      params = yapi.commons.handleParams(params, {
        project_id: 'number',
        col_id: 'number'
      });
      if (!params.interface_list || !Array.isArray(params.interface_list)) {
        return (ctx.body = yapi.commons.resReturn(null, 400, 'interface_list 参数有误'));
      }

      if (!params.project_id) {
        return (ctx.body = yapi.commons.resReturn(null, 400, '项目id不能为空'));
      }

      let auth = await this.checkAuth(params.project_id, 'project', 'edit');
      if (!auth) {
        return (ctx.body = yapi.commons.resReturn(null, 400, '没有权限'));
      }

      if (!params.col_id) {
        return (ctx.body = yapi.commons.resReturn(null, 400, '接口集id不能为空'));
      }

      let data = {
        uid: this.getUid(),
        index: 0,
        add_time: yapi.commons.time(),
        up_time: yapi.commons.time(),
        project_id: params.project_id,
        col_id: params.col_id
      };

      for (let i = 0; i < params.interface_list.length; i++) {
        let interfaceData = await this.interfaceModel.get(params.interface_list[i]);
        data.interface_id = params.interface_list[i];
        data.casename = interfaceData.title;

        // 处理json schema 解析
        if (
          interfaceData.req_body_type === 'json' &&
          interfaceData.req_body_other &&
          interfaceData.req_body_is_json_schema
        ) {
          let req_body_other = yapi.commons.json_parse(interfaceData.req_body_other);
          req_body_other = yapi.commons.schemaToJson(req_body_other, {
            alwaysFakeOptionals: true,
            useDefaultValue: true
          });

          data.req_body_other = JSON.stringify(req_body_other);
        } else {
          data.req_body_other = interfaceData.req_body_other;
        }

        data.req_body_type = interfaceData.req_body_type;
        let caseResultData = await this.caseModel.save(data);
        let username = this.getUsername();
        this.colModel.get(params.col_id).then(col => {
          yapi.commons.saveLog({
            content: `<a href="/user/profile/${this.getUid()}">${username}</a> 在接口集 <a href="/project/${
              params.project_id
              }/interface/col/${params.col_id}">${col.name}</a> 下导入了测试用例 <a href="/project/${
              params.project_id
              }/interface/case/${caseResultData._id}">${data.casename}</a>`,
            type: 'project',
            uid: this.getUid(),
            username: username,
            typeid: params.project_id
          });
        });
      }

      this.projectModel.up(params.project_id, { up_time: new Date().getTime() }).then();

      ctx.body = yapi.commons.resReturn('ok');
    } catch (e) {
      ctx.body = yapi.commons.resReturn(null, 402, e.message);
    }
  }

  /**
   * 批量导入边界测试用例给测试集合
   * @param {*} ctx 请求上下文
   */
  async addBoundaryCaseList(ctx) {
    try {
      let params = ctx.request.body;
      params = yapi.commons.handleParams(params, {
        project_id: 'number',
        col_id: 'number'
      });
      if (!params.interface_list || !Array.isArray(params.interface_list)) {
        return (ctx.body = yapi.commons.resReturn(null, 400, 'interface_list 参数有误'));
      }

      if (!params.project_id) {
        return (ctx.body = yapi.commons.resReturn(null, 400, '项目id不能为空'));
      }

      let auth = await this.checkAuth(params.project_id, 'project', 'edit');
      if (!auth) {
        return (ctx.body = yapi.commons.resReturn(null, 400, '没有权限'));
      }

      if (!params.col_id) {
        return (ctx.body = yapi.commons.resReturn(null, 400, '接口集id不能为空'));
      }

      let data = {
        uid: this.getUid(),
        index: 0,
        add_time: yapi.commons.time(),
        up_time: yapi.commons.time(),
        project_id: params.project_id,
        col_id: params.col_id
      };

      for (let i = 0; i < params.interface_list.length; i++) {
        let interfaceData = await this.interfaceModel.get(params.interface_list[i]);
        data.interface_id = params.interface_list[i];
        data.casename = interfaceData.title;

        let bodyArray = [];

        // 处理json schema 解析
        if (
          interfaceData.req_body_type === 'json' &&
          interfaceData.req_body_other &&
          interfaceData.req_body_is_json_schema
        ) {
          // 生成各种边界 schema
          let schemaArray = [];
          // 生成 超长 string 的 schema
          let maxJson = {
            name: data.casename + '-max',
            data: yapi.commons.json_parse(interfaceData.req_body_other)
          };
          boundaryUtils.generateErrorMax(maxJson.data);
          schemaArray.push(maxJson);

          // 生成 短 string 的 schema
          let minStringJson = {
            name: data.casename + '-min',
            data: yapi.commons.json_parse(interfaceData.req_body_other)
          };
          boundaryUtils.generateErrorMin(minStringJson.data);
          schemaArray.push(minStringJson);

          // 根据 schema 生成数据
          for (let i = 0; i < schemaArray.length; i++) {
            bodyArray.push({
              name: schemaArray[i].name,
              data: JSON.stringify(yapi.commons.schemaToJson(schemaArray[i].data, {
                alwaysFakeOptionals: true
              }))
            })
          }
          // 生成 null 类型的测试用例
          let nullObj = {
            name: data.casename + '-null',
            data: JSON.parse(bodyArray[0].data)
          };
          boundaryUtils.generateErrorNull(nullObj.data);
          nullObj.data = JSON.stringify(nullObj.data);
          bodyArray.push(nullObj);

          console.log(bodyArray);
        } else {
          bodyArray.push({
            name: data.casename,
            data: interfaceData.req_body_other
          })
        }

        data.req_body_type = interfaceData.req_body_type;

        for (let i = 0; i < bodyArray.length; i++) {
          data.casename = bodyArray[i].name;
          data.req_body_other = bodyArray[i].data;

          let caseResultData = await this.caseModel.save(data);
          let username = this.getUsername();
          this.colModel.get(params.col_id).then(col => {
            yapi.commons.saveLog({
              content: `<a href="/user/profile/${this.getUid()}">${username}</a> 在接口集 <a href="/project/${
                params.project_id
                }/interface/col/${params.col_id}">${col.name}</a> 下导入了测试用例 <a href="/project/${
                params.project_id
                }/interface/case/${caseResultData._id}">${data.casename}</a>`,
              type: 'project',
              uid: this.getUid(),
              username: username,
              typeid: params.project_id
            });
          });
        }

      }

      this.projectModel.up(params.project_id, { up_time: new Date().getTime() }).then();

      ctx.body = yapi.commons.resReturn('ok');
    } catch (e) {
      ctx.body = yapi.commons.resReturn(null, 402, e.message);
    }
  }

  handleJsonString(obj) {
    if (obj && obj.type && obj.type === 'object') {
      this.handleJsonString(obj.properties);
    } else {
      for (let prop in obj) {
        if (obj[prop].type === 'string') {
          obj[prop].minLength = 300;
          obj[prop].maxLength = 600;
        }
        if (obj[prop].type === 'object') {
          this.handleJsonString(obj[prop].properties);
        }
      }
    }
  }

  async cloneCaseList(ctx) {
    try {
      let params = ctx.request.body;
      params = yapi.commons.handleParams(params, {
        project_id: 'number',
        col_id: 'number',
        new_col_id: 'number'
      });

      const { project_id, col_id, new_col_id } = params;

      if (!project_id) {
        return (ctx.body = yapi.commons.resReturn(null, 400, '项目id不能为空'));
      }

      let auth = await this.checkAuth(params.project_id, 'project', 'edit');

      if (!auth) {
        return (ctx.body = yapi.commons.resReturn(null, 400, '没有权限'));
      }

      if (!col_id) {
        return (ctx.body = yapi.commons.resReturn(null, 400, '被克隆的接口集id不能为空'));
      }

      if (!new_col_id) {
        return (ctx.body = yapi.commons.resReturn(null, 400, '克隆的接口集id不能为空'));
      }

      let oldColCaselistData = await this.caseModel.list(col_id, 'all');

      oldColCaselistData = oldColCaselistData.sort((a, b) => {
        return a.index - b.index;
      });

      const newCaseList = [];
      const oldCaseObj = {};
      let obj = {};

      const handleTypeParams = (data, name) => {
        let res = data[name];
        const type = Object.prototype.toString.call(res);
        if (type === '[object Array]' && res.length) {
          res = JSON.stringify(res);
          try {
            res = JSON.parse(handleReplaceStr(res));
          } catch (e) {
            console.log('e ->', e);
          }
        } else if (type === '[object String]' && data[name]) {
          res = handleReplaceStr(res);
        }
        return res;
      };

      const handleReplaceStr = str => {
        if (str.indexOf('$') !== -1) {
          str = str.replace(/\$\.([0-9]+)\./g, function (match, p1) {
            p1 = p1.toString();
            return `$.${newCaseList[oldCaseObj[p1]]}.` || '';
          });
        }
        return str;
      };

      // 处理数据里面的$id;
      const handleParams = data => {
        data.col_id = new_col_id;
        delete data._id;
        delete data.add_time;
        delete data.up_time;
        delete data.__v;
        data.req_body_other = handleTypeParams(data, 'req_body_other');
        data.req_query = handleTypeParams(data, 'req_query');
        data.req_params = handleTypeParams(data, 'req_params');
        data.req_body_form = handleTypeParams(data, 'req_body_form');
        return data;
      };

      for (let i = 0; i < oldColCaselistData.length; i++) {
        obj = oldColCaselistData[i].toObject();
        // 将被克隆的id和位置绑定
        oldCaseObj[obj._id] = i;
        let caseData = handleParams(obj);
        let newCase = await this.caseModel.save(caseData);
        newCaseList.push(newCase._id);
      }

      this.projectModel.up(params.project_id, { up_time: new Date().getTime() }).then();
      ctx.body = yapi.commons.resReturn('ok');
    } catch (e) {
      ctx.body = yapi.commons.resReturn(null, 402, e.message);
    }
  }

  /**
   * 更新一个测试用例
   * @interface /col/up_case
   * @method POST
   * @category col
   * @foldnumber 10
   * @param {number} id
   * @param {String} casename
   * @param {String} domain
   * @param {String} path
   * @param {String} method
   * @param {Object} req_query
   * @param {Object} req_headers
   * @param {String} req_body_type
   * @param {Array} req_body_form
   * @param {String} req_body_other
   * @param {String} pre_script
   * @param {String} post_script
   * @returns {Object}
   * @example
   */

  async upCase(ctx) {
    try {
      let params = ctx.request.body;
      params = yapi.commons.handleParams(params, {
        id: 'number',
        casename: 'string'
      });

      if (!params.id) {
        return (ctx.body = yapi.commons.resReturn(null, 400, '用例id不能为空'));
      }

      // if (!params.casename) {
      //   return (ctx.body = yapi.commons.resReturn(null, 400, '用例名称不能为空'));
      // }

      let caseData = await this.caseModel.get(params.id);
      let auth = await this.checkAuth(caseData.project_id, 'project', 'edit');
      if (!auth) {
        return (ctx.body = yapi.commons.resReturn(null, 400, '没有权限'));
      }

      params.uid = this.getUid();

      //不允许修改接口id和项目id
      delete params.interface_id;
      delete params.project_id;
      //console.log(params);
      let result = await this.caseModel.up(params.id, params);
      let username = this.getUsername();
      this.colModel.get(caseData.col_id).then(col => {
        yapi.commons.saveLog({
          content: `<a href="/user/profile/${this.getUid()}">${username}</a> 在接口集 <a href="/project/${
            caseData.project_id
            }/interface/col/${caseData.col_id}">${col.name}</a> 更新了测试用例 <a href="/project/${
            caseData.project_id
            }/interface/case/${params.id}">${params.casename || caseData.casename}</a>`,
          type: 'project',
          uid: this.getUid(),
          username: username,
          typeid: caseData.project_id
        });
      });

      this.projectModel.up(caseData.project_id, { up_time: new Date().getTime() }).then();

      ctx.body = yapi.commons.resReturn(result);
    } catch (e) {
      ctx.body = yapi.commons.resReturn(null, 402, e.message);
    }
  }

  /**
   * 获取一个测试用例详情
   * @interface /col/case
   * @method GET
   * @category col
   * @foldnumber 10
   * @param {String} caseid
   * @returns {Object}
   * @example
   */

  async getCase(ctx) {
    try {
      let id = ctx.query.caseid;
      let result = await this.caseModel.get(id);
      if (!result) {
        return (ctx.body = yapi.commons.resReturn(null, 400, '不存在的case'));
      }
      result = result.toObject();
      let data = await this.interfaceModel.get(result.interface_id);
      if (!data) {
        return (ctx.body = yapi.commons.resReturn(null, 400, '找不到对应的接口，请联系管理员'));
      }
      data = data.toObject();

      let projectData = await this.projectModel.getBaseInfo(data.project_id);
      result.path = projectData.basepath + data.path;
      result.method = data.method;
      result.req_body_type = data.req_body_type;
      result.req_headers = yapi.commons.handleParamsValue(data.req_headers, result.req_headers);
      result.res_body = data.res_body;
      result.res_body_type = data.res_body_type;
      result.req_body_form = yapi.commons.handleParamsValue(
        data.req_body_form,
        result.req_body_form
      );
      result.req_query = yapi.commons.handleParamsValue(data.req_query, result.req_query);
      result.req_params = yapi.commons.handleParamsValue(data.req_params, result.req_params);
      result.interface_up_time = data.up_time;
      result.req_body_is_json_schema = data.req_body_is_json_schema;
      result.res_body_is_json_schema = data.res_body_is_json_schema;
      ctx.body = yapi.commons.resReturn(result);
    } catch (e) {
      ctx.body = yapi.commons.resReturn(null, 400, e.message);
    }
  }

  /**
   * 更新一个接口集name或描述
   * @interface /col/up_col
   * @method POST
   * @category col
   * @foldnumber 10
   * @param {String} name
   * @param {String} desc
   * @returns {Object}
   * @example
   */

  async upCol(ctx) {
    try {
      let params = ctx.request.body;
      let id = params.col_id;
      if (!id) {
        return (ctx.body = yapi.commons.resReturn(null, 400, '缺少 col_id 参数'));
      }
      let colData = await this.colModel.get(id);
      if (!colData) {
        return (ctx.body = yapi.commons.resReturn(null, 400, '不存在'));
      }
      let auth = await this.checkAuth(colData.project_id, 'project', 'edit');
      if (!auth) {
        return (ctx.body = yapi.commons.resReturn(null, 400, '没有权限'));
      }
      delete params.col_id;
      let result = await this.colModel.up(id, params);
      let username = this.getUsername();
      yapi.commons.saveLog({
        content: `<a href="/user/profile/${this.getUid()}">${username}</a> 更新了测试集合 <a href="/project/${
          colData.project_id
          }/interface/col/${id}">${colData.name}</a> 的信息`,
        type: 'project',
        uid: this.getUid(),
        username: username,
        typeid: colData.project_id
      });

      ctx.body = yapi.commons.resReturn(result);
    } catch (e) {
      ctx.body = yapi.commons.resReturn(null, 400, e.message);
    }
  }

  /**
   * 更新多个接口case index
   * @interface /col/up_case_index
   * @method POST
   * @category col
   * @foldnumber 10
   * @param {Array}  [id, index]
   * @returns {Object}
   * @example
   */

  async upCaseIndex(ctx) {
    try {
      let params = ctx.request.body;
      if (!params || !Array.isArray(params)) {
        ctx.body = yapi.commons.resReturn(null, 400, '请求参数必须是数组');
      }
      params.forEach(item => {
        if (item.id) {
          this.caseModel.upCaseIndex(item.id, item.index).then(
            res => { },
            err => {
              yapi.commons.log(err.message, 'error');
            }
          );
        }
      });

      return (ctx.body = yapi.commons.resReturn('成功！'));
    } catch (e) {
      ctx.body = yapi.commons.resReturn(null, 400, e.message);
    }
  }


  /**
   * 根据接口id 刷新用例
   * @interface /col/flush
   * @method POST
   * @category col
   * @foldnumber 10
   * @param {Number}  interface_id
   * @returns {Object}
   * @example
   */
  async flush(ctx) {
    let params = ctx.params;
    if (!this.$tokenAuth) {
      let auth = await this.checkAuth(params.pid, 'project', 'edit');
      if (!auth) {
        return (ctx.body = yapi.commons.resReturn(null, 400, '没有权限'));
      }
    }

    try {
      this.caseModel.flush(params.inpid, params.pid).then(
        res => { },
        err => {
          yapi.commons.log(err.message, 'error');
        }
      );
      return (ctx.body = yapi.commons.resReturn('成功！'));
    } catch (e) {
      ctx.body = yapi.commons.resReturn(null, 400, e.message);
    }
  }

  /**
   * 移动用例case
   * @interface /col/move
   * @method POST
   * @category col
   * @foldnumber 10
   * @param {Array}  [id, index]
   * @returns {Object}
   * @example
   */

  async move(ctx) {
    let params = ctx.params;
    if (!this.$tokenAuth) {
      let auth = await this.checkAuth(params.pid, 'project', 'edit');
      if (!auth) {
        return (ctx.body = yapi.commons.resReturn(null, 400, '没有权限'));
      }
    }


    try {
      this.caseModel.move(params.caseId, params.cid).then(
        res => { },
        err => {
          yapi.commons.log(err.message, 'error');
        }
      );
      return (ctx.body = yapi.commons.resReturn('成功！'));
    } catch (e) {
      ctx.body = yapi.commons.resReturn(null, 400, e.message);
    }
  }


  /**
   * 更新多个测试集合 index
   * @interface /col/up_col_index
   * @method POST
   * @category col
   * @foldnumber 10
   * @param {Array}  [id, index]
   * @returns {Object}
   * @example
   */

  async upColIndex(ctx) {
    try {
      let params = ctx.request.body;
      if (!params || !Array.isArray(params)) {
        ctx.body = yapi.commons.resReturn(null, 400, '请求参数必须是数组');
      }
      params.forEach(item => {
        if (item.id) {
          this.colModel.upColIndex(item.id, item.index).then(
            res => { },
            err => {
              yapi.commons.log(err.message, 'error');
            }
          );
        }
      });

      return (ctx.body = yapi.commons.resReturn('成功！'));
    } catch (e) {
      ctx.body = yapi.commons.resReturn(null, 400, e.message);
    }
  }

  /**
   * 删除一个接口集
   * @interface /col/del_col
   * @method GET
   * @category col
   * @foldnumber 10
   * @param {String}
   * @returns {Object}
   * @example
   */

  async delCol(ctx) {
    try {
      let id = ctx.query.col_id;
      let colData = await this.colModel.get(id);
      if (!colData) {
        ctx.body = yapi.commons.resReturn(null, 400, '不存在的id');
      }

      if (colData.uid !== this.getUid()) {
        let auth = await this.checkAuth(colData.project_id, 'project', 'danger');
        if (!auth) {
          return (ctx.body = yapi.commons.resReturn(null, 400, '没有权限'));
        }
      }

      let coltreenode = await this.getCol(colData.project_id, false, id);
      let delcoltree = async coldata => {

        if (coldata.children && coldata.children.length > 0) {
          coldata.children.forEach(subcol => {
            delcoltree(subcol)
          })
        }

        let result = await this.colModel.del(coldata._id);
        await this.caseModel.delByCol(coldata._id);
        return result
      }
      let r = delcoltree(coltreenode);
      let username = this.getUsername();
      yapi.commons.saveLog({
        content: `<a href="/user/profile/${this.getUid()}">${username}</a> 删除了接口集 ${
          colData.name
          } 及子接口集以及其下面的接口`,
        type: 'project',
        uid: this.getUid(),
        username: username,
        typeid: colData.project_id
      });
      return (ctx.body = yapi.commons.resReturn(r));
    } catch (e) {
      yapi.commons.resReturn(null, 400, e.message);
    }
  }

  /**
   *
   * @param {*} ctx
   */

  async delCase(ctx) {
    try {
      let caseid = ctx.query.caseid;
      let caseData = await this.caseModel.get(caseid);
      if (!caseData) {
        ctx.body = yapi.commons.resReturn(null, 400, '不存在的caseid');
      }

      if (caseData.uid !== this.getUid()) {
        let auth = await this.checkAuth(caseData.project_id, 'project', 'danger');
        if (!auth) {
          return (ctx.body = yapi.commons.resReturn(null, 400, '没有权限'));
        }
      }

      let result = await this.caseModel.del(caseid);

      let username = this.getUsername();
      this.colModel.get(caseData.col_id).then(col => {
        yapi.commons.saveLog({
          content: `<a href="/user/profile/${this.getUid()}">${username}</a> 删除了接口集 <a href="/project/${
            caseData.project_id
            }/interface/col/${caseData.col_id}">${col.name}</a> 下的接口 ${caseData.casename}`,
          type: 'project',
          uid: this.getUid(),
          username: username,
          typeid: caseData.project_id
        });
      });

      this.projectModel.up(caseData.project_id, { up_time: new Date().getTime() }).then();
      return (ctx.body = yapi.commons.resReturn(result));
    } catch (e) {
      yapi.commons.resReturn(null, 400, e.message);
    }
  }

  async runCaseScript(ctx) {
    let params = ctx.request.body;
    ctx.body = await yapi.commons.runCaseScript(params, params.col_id, params.interface_id, this.getUid());
  }

  // 数组去重
  unique(array, compare) {
    let hash = {};
    let arr = array.reduce(function (item, next) {
      hash[next[compare]] ? '' : (hash[next[compare]] = true && item.push(next));
      // console.log('item',item.project_id)
      return item;
    }, []);
    // 输出去重以后的project_id
    return arr.map(item => {
      return item[compare];
    });
  }
}

module.exports = interfaceColController;
