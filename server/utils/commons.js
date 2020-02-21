const fs = require('fs-extra');
const path = require('path');
const yapi = require('../yapi.js');
const sha1 = require('sha1');
const logModel = require('../models/log.js');
const projectModel = require('../models/project.js');
const interfaceColModel = require('../models/interfaceCol.js');
const interfaceCaseModel = require('../models/interfaceCase.js');
const interfaceModel = require('../models/interface.js');
const databaseInfoModel = require('../models/databaseInfo')
const userModel = require('../models/user.js');
const followModel = require('../models/follow.js');
const json5 = require('json5');
const _ = require('underscore');
const Ajv = require('ajv');
const Mock = require('mockjs');
const utils = require('../../common/power-string.js').utils;
const CryptoJS = require('crypto-js');
const jsrsasign = require('jsrsasign');
const axios = require('axios');
const getStorage = require('../../common/postmanLib').getStorage;
const ejs = require('easy-json-schema');
const jsf = require('json-schema-faker');
const { schemaValidator } = require('../../common/utils');
const https = require('https');
const defaultUtil = require('util')

const sqlRunnerHost = yapi.WEBCONFIG.sqlRunnerHost;

jsf.extend('mock', function () {
  return {
    mock: function (xx) {
      return Mock.mock(xx);
    }
  };
});

const defaultOptions = {
  failOnInvalidTypes: false,
  failOnInvalidFormat: false
};

// formats.forEach(item => {
//   item = item.name;
//   jsf.format(item, () => {
//     if (item === 'mobile') {
//       return jsf.random.randexp('^[1][34578][0-9]{9}$');
//     }
//     return Mock.mock('@' + item);
//   });
// });

exports.schemaToJson = function (schema, options = {}) {
  Object.assign(options, defaultOptions);

  jsf.option(options);
  let result;
  try {
    result = jsf(schema);
  } catch (err) {
    result = err.message;
  }
  jsf.option(defaultOptions);
  return result;
};

exports.resReturn = (data, num, errmsg) => {
  num = num || 0;

  return {
    errcode: num,
    errmsg: errmsg || '成功！',
    data: data
  };
};

exports.log = (msg, type) => {
  if (!msg) {
    return;
  }

  type = type || 'log';

  let f;

  switch (type) {
    case 'log':
      f = console.log; // eslint-disable-line
      break;
    case 'warn':
      f = console.warn; // eslint-disable-line
      break;
    case 'error':
      f = console.error; // eslint-disable-line
      break;
    default:
      f = console.log; // eslint-disable-line
      break;
  }

  f(type + ':', msg);

  let date = new Date();
  let year = date.getFullYear();
  let month = date.getMonth() + 1;

  let logfile = path.join(yapi.WEBROOT_LOG, year + '-' + month + '.log');

  if (typeof msg === 'object') {
    if (msg instanceof Error) msg = msg.message;
    else msg = JSON.stringify(msg);
  }

  // let data = (new Date).toLocaleString() + '\t|\t' + type + '\t|\t' + msg + '\n';
  let data = `[ ${new Date().toLocaleString()} ] [ ${type} ] ${msg}\n`;

  fs.writeFileSync(logfile, data, {
    flag: 'a'
  });
};

exports.fileExist = filePath => {
  try {
    return fs.statSync(filePath).isFile();
  } catch (err) {
    return false;
  }
};

exports.time = () => {
  return Date.parse(new Date()) / 1000;
};

exports.fieldSelect = (data, field) => {
  if (!data || !field || !Array.isArray(field)) {
    return null;
  }

  var arr = {};

  field.forEach(f => {
    typeof data[f] !== 'undefined' && (arr[f] = data[f]);
  });

  return arr;
};

exports.rand = (min, max) => {
  return Math.floor(Math.random() * (max - min) + min);
};

exports.json_parse = json => {
  try {
    return json5.parse(json);
  } catch (e) {
    return json;
  }
};

exports.randStr = () => {
  return Math.random()
    .toString(36)
    .substr(2);
};
exports.getIp = ctx => {
  let ip;
  try {
    ip = ctx.ip.match(/\d+.\d+.\d+.\d+/) ? ctx.ip.match(/\d+.\d+.\d+.\d+/)[0] : 'localhost';
  } catch (e) {
    ip = null;
  }
  return ip;
};

exports.generatePassword = (password, passsalt) => {
  return sha1(password + sha1(passsalt));
};

exports.expireDate = day => {
  let date = new Date();
  date.setTime(date.getTime() + day * 86400000);
  return date;
};

exports.sendMail = (options, cb) => {
  if (!yapi.mail) return false;
  options.subject = options.subject ? options.subject + '-YApi 平台' : 'YApi 平台';

  cb =
    cb ||
    function (err) {
      if (err) {
        yapi.commons.log('send mail ' + options.to + ' error,' + err.message, 'error');
      } else {
        yapi.commons.log('send mail ' + options.to + ' success');
      }
    };

  try {
    yapi.mail.sendMail(
      {
        from: yapi.WEBCONFIG.mail.from,
        to: options.to,
        subject: options.subject,
        html: options.contents
      },
      cb
    );
  } catch (e) {
    yapi.commons.log(e.message, 'error');
    console.error(e.message); // eslint-disable-line
  }
};

exports.validateSearchKeyword = keyword => {
  if (/^\*|\?|\+|\$|\^|\\|\.$/.test(keyword)) {
    return false;
  }

  return true;
};

exports.filterRes = (list, rules) => {
  return list.map(item => {
    let filteredRes = {};

    rules.forEach(rule => {
      if (typeof rule == 'string') {
        filteredRes[rule] = item[rule];
      } else if (typeof rule == 'object') {
        filteredRes[rule.alias] = item[rule.key];
      }
    });

    return filteredRes;
  });
};

exports.handleVarPath = (pathname, params) => {
  function insertParams(name) {
    if (!_.find(params, { name: name })) {
      params.push({
        name: name,
        desc: ''
      });
    }
  }

  if (!pathname) return;
  if (pathname.indexOf(':') !== -1) {
    let paths = pathname.split('/'),
      name,
      i;
    for (i = 1; i < paths.length; i++) {
      if (paths[i] && paths[i][0] === ':') {
        name = paths[i].substr(1);
        insertParams(name);
      }
    }
  }
  pathname.replace(/\{(.+?)\}/g, function (str, match) {
    insertParams(match);
  });
};

/**
 * 验证一个 path 是否合法
 * path第一位必需为 /, path 只允许由 字母数字-/_:.{}= 组成
 */
exports.verifyPath = path => {
  // if (/^\/[a-zA-Z0-9\-\/_:!\.\{\}\=]*$/.test(path)) {
  //   return true;
  // } else {
  //   return false;
  // }
  return /^\/[a-zA-Z0-9\-\/_:!\.\{\}\=]*$/.test(path);
};

/**
 * 沙盒执行 js 代码
 * @sandbox Object context
 * @script String script
 * @return sandbox
 *
 * @example let a = sandbox({a: 1}, 'a=2')
 * a = {a: 2}
 */
exports.sandbox = async (sandbox, script) => {
  const vm2 = require('vm2');
  sandbox = sandbox || {};
  // script = new vm.Script(script);
  // const context = new vm.createContext(sandbox);
  // script.runInContext(context, {
  //   timeout: 10000
  // });
  const vm = new vm2.VM({
    sandbox: sandbox
  });
  await vm.run(`(async () => {\n${script}\n})()`);

  return sandbox;
};

function trim(str) {
  if (!str) {
    return str;
  }

  str = str + '';

  return str.replace(/(^\s*)|(\s*$)/g, '');
}

function ltrim(str) {
  if (!str) {
    return str;
  }

  str = str + '';

  return str.replace(/(^\s*)/g, '');
}

function rtrim(str) {
  if (!str) {
    return str;
  }

  str = str + '';

  return str.replace(/(\s*$)/g, '');
}

exports.trim = trim;
exports.ltrim = ltrim;
exports.rtrim = rtrim;

/**
 * 处理请求参数类型，String 字符串去除两边空格，Number 使用parseInt 转换为数字
 * @params Object {a: ' ab ', b: ' 123 '}
 * @keys Object {a: 'string', b: 'number'}
 * @return Object {a: 'ab', b: 123}
 */
exports.handleParams = (params, keys) => {
  if (!params || typeof params !== 'object' || !keys || typeof keys !== 'object') {
    return false;
  }

  for (var key in keys) {
    var filter = keys[key];
    if (params[key]) {
      switch (filter) {
        case 'string':
          params[key] = trim(params[key] + '');
          break;
        case 'number':
          params[key] = !isNaN(params[key]) ? parseInt(params[key], 10) : 0;
          break;
        default:
          params[key] = trim(params + '');
      }
    }
  }

  return params;
};



exports.translateDataToTree = (data, mynodeid) => {
  let mynode = { "id": Number(mynodeid), "node": null };
  data.forEach(item => {

    item.title = item.name;
    item.key = item._id;
    item.value = item._id + '';
    if (!data.find(me => me._id === item.parent_id)) {
      item.parent_id = -1;
    }
  });
  let parents = JSON.parse(JSON.stringify(data.filter(value => (typeof value.parent_id) == 'undefined' || value.parent_id == -1)));
  let children = JSON.parse(JSON.stringify(data.filter(value => (typeof value.parent_id) !== 'undefined' && value.parent_id != -1)));
  if (mynode.id && mynode.id == -1) {
    parents = JSON.parse(JSON.stringify(data.filter(value => value._id == -1)));
    children = JSON.parse(JSON.stringify(data.filter(value => (typeof value.parent_id) !== 'undefined' || value._id != -1)));
  }

  let translator = (parents, children, mynode) => {
    parents.forEach((parent) => {
      parent.parent_id = (typeof parent.parent_id) == 'undefined' ? -1 : parent.parent_id;
      parent.treePath = (typeof parent.treePath) == 'undefined' ? [] : parent.treePath;
      mynode.node = mynode.id === parent._id ? parent : mynode.node;
      children.forEach((current, index) => {
        if (current.parent_id === parent._id) {

          if (typeof parent.children !== 'undefined') {
            parent.children.push(current);
          } else {
            parent.children = [current];
          }
          if (typeof current.treePath !== 'undefined') {
            current.treePath.push(...parent.treePath, parent._id);
          } else {
            current.treePath = [...parent.treePath, parent._id];
          }
          if (current.treePath.includes(mynode.id)) {
            if (typeof mynode.node.descendants !== 'undefined') {
              mynode.node.descendants.push(current._id);
            } else {
              mynode.node.descendants = [current._id];
            }
          }
          let temp = JSON.parse(JSON.stringify(children));
          temp.splice(index, 1);
          translator([current], temp, mynode);
        }
      }
      )
    }
    )
  }
  translator(parents, children, mynode)
  let ret = mynode.node ? mynode.node : parents;
  return ret
}


exports.getCol = async function getCol(project_id,islist,mycatid) {

  const caseInst = yapi.getInst(interfaceCaseModel);
  const colInst = yapi.getInst(interfaceColModel);
  const interfaceInst = yapi.getInst(interfaceModel);
 let result = await colInst.list(project_id);
 result = result.sort((a, b) => {
   return a.index - b.index;
 });

 for (let i = 0; i < result.length; i++) {
   result[i] = result[i].toObject();
   result[i].parent_id=(typeof result[i].parent_id) == 'undefined'?-1: result[i].parent_id;
   let caseList = await caseInst.list(result[i]._id);

   // for(let j=0; j< caseList.length; j++){
   //   let item = caseList[j].toObject();
   //   let interfaceData = await interfaceInst.getBaseinfo(item.interface_id);
   //   item.path = interfaceData.path;
   //   caseList[j] = item;
   //
   // }

   const interfaceDataList = await Promise.all(
     caseList.map(item => interfaceInst.getBaseinfo(item.interface_id))
   );
   interfaceDataList.forEach((item, index) => {
     caseList[index] = caseList[index].toObject();
     caseList[index].path = item.path;
   });

   caseList = caseList.sort((a, b) => {
     return a.index - b.index;
   });
   if(caseList&&caseList.length>0){
     result[i].caseList = caseList;
   }
 }
 result = islist ? result :  this.translateDataToTree(result,mycatid);
 return result;
}


exports.validateParams = (schema2, params) => {
  const flag = schema2.closeRemoveAdditional;
  const ajv = new Ajv({
    allErrors: true,
    coerceTypes: true,
    useDefaults: true,
    removeAdditional: flag ? false : true
  });

  var localize = require('ajv-i18n');
  delete schema2.closeRemoveAdditional;

  const schema = ejs(schema2);

  schema.additionalProperties = flag ? true : false;
  const validate = ajv.compile(schema);
  let valid = validate(params);

  let message = '请求参数 ';
  if (!valid) {
    localize.zh(validate.errors);
    message += ajv.errorsText(validate.errors, { separator: '\n' });
  }

  return {
    valid: valid,
    message: message
  };
};

exports.saveLog = logData => {
  try {
    let logInst = yapi.getInst(logModel);
    let data = {
      content: logData.content,
      type: logData.type,
      uid: logData.uid,
      username: logData.username,
      typeid: logData.typeid,
      data: logData.data
    };

    logInst.save(data).then();
  } catch (e) {
    yapi.commons.log(e, 'error'); // eslint-disable-line
  }
};

/**
 *
 * @param {*} router router
 * @param {*} baseurl base_url_path
 * @param {*} routerController controller
 * @param {*} path  routerPath
 * @param {*} method request_method , post get put delete ...
 * @param {*} action controller action_name
 * @param {*} ws enable ws
 */
exports.createAction = (router, baseurl, routerController, action, path, method, ws) => {
  router[method](baseurl + path, async ctx => {
    let inst = new routerController(ctx);
    try {
      await inst.init(ctx);
      ctx.params = Object.assign({}, ctx.request.query, ctx.request.body, ctx.params);
      if (inst.schemaMap && typeof inst.schemaMap === 'object' && inst.schemaMap[action]) {

        let validResult = yapi.commons.validateParams(inst.schemaMap[action], ctx.params);

        if (!validResult.valid) {
          return (ctx.body = yapi.commons.resReturn(null, 400, validResult.message));
        }
      }
      if (inst.$auth === true) {
        await inst[action].call(inst, ctx);
      } else {
        if (ws === true) {
          ctx.ws.send('请登录...');
        } else {
          ctx.body = yapi.commons.resReturn(null, 40011, '请登录...');
        }
      }
    } catch (err) {
      ctx.body = yapi.commons.resReturn(null, 40011, '服务器出错...');
      yapi.commons.log(err, 'error');
    }
  });
};

/**
 *
 * @param {*} params 接口定义的参数
 * @param {*} val  接口case 定义的参数值
 */
function handleParamsValue(params, val) {
  let value = {};
  try {
    params = params.toObject();
  } catch (e) { }
  if (params.length === 0 || val.length === 0) {
    return params;
  }
  val.forEach(item => {
    value[item.name] = item;
  });
  params.forEach((item, index) => {
    if (!value[item.name] || typeof value[item.name] !== 'object') return null;
    params[index].value = value[item.name].value;
    if (!_.isUndefined(value[item.name].enable)) {
      params[index].enable = value[item.name].enable;
    }
  });
  return params;
}

exports.handleParamsValue = handleParamsValue;

exports.getCaseList = async function getCaseList(id) {
  const caseInst = yapi.getInst(interfaceCaseModel);
  const colInst = yapi.getInst(interfaceColModel);
  const projectInst = yapi.getInst(projectModel);
  const interfaceInst = yapi.getInst(interfaceModel);

  let resultList = await caseInst.list(id, 'all');
  let colData = await colInst.get(id);
  for (let index = 0; index < resultList.length; index++) {
    let result = resultList[index].toObject();
    let data = await interfaceInst.get(result.interface_id);
    if (!data) {
      await caseInst.del(result._id);
      continue;
    }
    let projectData = await projectInst.getBaseInfo(data.project_id);
    result.path = projectData.basepath + data.path;
    result.method = data.method;
    result.title = data.title;
    result.req_body_type = data.req_body_type;
    result.req_headers = handleParamsValue(data.req_headers, result.req_headers);
    result.res_body_type = data.res_body_type;
    result.req_body_form = handleParamsValue(data.req_body_form, result.req_body_form);
    result.req_query = handleParamsValue(data.req_query, result.req_query);
    result.req_params = handleParamsValue(data.req_params, result.req_params);
    result.col_name = colData.name;
    resultList[index] = result;
  }
  resultList = resultList.sort((a, b) => {
    return a.index - b.index;
  });
  let ctxBody = yapi.commons.resReturn(resultList);
  ctxBody.colData = colData;
  return ctxBody;
};

function convertString(variable) {
  if (variable instanceof Error) {
    return variable.name + ': ' + variable.message;
  }
  try {
    if (variable && typeof variable === 'string') {
      return variable;
    }
    return JSON.stringify(variable, null, '   ');
  } catch (err) {
    return variable || '';
  }
}


exports.runCaseScript = async function runCaseScript(params, colId, interfaceId) {
  const colInst = yapi.getInst(interfaceColModel);
  let colData = await colInst.get(colId);

  // 获取当前环境对应的数据库连接配置
  const databaseInfoInst = yapi.getInst(databaseInfoModel);
  let databaseInfo = await databaseInfoInst.getByProjectIdAndEnvId(params.project_id, params.env_id);
  databaseInfo = JSON.parse(JSON.stringify(databaseInfo))
  yapi.commons.changeObjKeytoHump(databaseInfo);

  
  const currentStorage = await getStorage(params.taskId || Math.random() + '');
  if (params.storageDict && typeof params.storageDict === 'object') {
    const storageKeys = Object.keys(params.storageDict);
    await Promise.all(storageKeys.map(key => currentStorage.setItem(key, params.storageDict[key])))
  }
  const logs = [];
  const context = {
    assert: require('assert'),
    status: params.response.status,
    body: params.response.body,
    header: params.response.header,
    records: params.records,
    params: params.params,
    defaultUtil: defaultUtil,
    utils: Object.freeze({
      _: _,
      CryptoJS: CryptoJS,
      jsrsasign: jsrsasign,
      base64: utils.base64,
      md5: utils.md5,
      sha1: utils.sha1,
      sha224: utils.sha224,
      sha256: utils.sha256,
      sha384: utils.sha384,
      sha512: utils.sha512,
      unbase64: utils.unbase64,
      axios: axios
    }),
    storage: currentStorage,
    log: msg => {
      logs.push('log: ' + convertString(msg));
    },
    database: databaseInfo,
    execSQL: async sql => {
      if (!databaseInfo) {
        logs.push('log: 当前环境尚未配置数据库连接信息，跳过【' + sql + '】执行');
        return;
      }

      let dataObj = {
        sql: sql,
        databaseInfoDto: databaseInfo
      };
      logs.push("传入sql语句：【" + sql + "】");

      const axios = require('axios')
      let response = await axios({
        method: "POST",
        url: sqlRunnerHost + '/api/v1/sql/actions/exec',
        data: JSON.stringify(dataObj),
        headers: {
          'Content-Type': 'application/json'
        }
      })
      logs.push('sql结果行数:' + response.data.row);
      return response.data;
    }
  };

  let result = {};
  try {

    if (colData.checkHttpCodeIs200) {
      let status = +params.response.status;
      if (status !== 200) {
        throw ('Http status code 不是 200，请检查(该规则来源于于 [测试集->通用规则配置] )')
      }
    }

    if (colData.checkResponseField.enable) {
      if (params.response.body[colData.checkResponseField.name] != colData.checkResponseField.value) {
        throw (`返回json ${colData.checkResponseField.name} 值不是${colData.checkResponseField.value}，请检查(该规则来源于于 [测试集->通用规则配置] )`)
      }
    }

    if (colData.checkResponseSchema) {
      const interfaceInst = yapi.getInst(interfaceModel);
      let interfaceData = await interfaceInst.get(interfaceId);
      if (interfaceData.res_body_is_json_schema && interfaceData.res_body) {
        let schema = JSON.parse(interfaceData.res_body);
        let result = schemaValidator(schema, context.body)
        if (!result.valid) {
          throw (`返回Json 不符合 response 定义的数据结构,原因: ${result.message}
数据结构如下：
${JSON.stringify(schema, null, 2)}`)
        }
      }
    }

    if (colData.checkScript.enable) {
      let globalScript = colData.checkScript.content;
      // script 是断言
      if (globalScript) {
        logs.push('执行globalScript test脚本：' + globalScript)
        result = await yapi.commons.sandbox(context, globalScript);
      }
    }


    let script = params.script;
    // script 是断言
    if (script) {
      logs.push('执行test 脚本:' + script)
      result = await yapi.commons.sandbox(context, script);
    }
    result.logs = logs;
    delete result.utils;
    delete result.storage;
    delete result.assert;
    return yapi.commons.resReturn(result);
  } catch (err) {
    //logs.push(convertString(err));
    result.logs = logs;
    console.log('err result', result);
    logs.push(err.name + ': ' + err.message)
    return yapi.commons.resReturn(result, 400, err.name + ': ' + err.message);
  }
};

exports.getUserdata = async function getUserdata(uid, role) {
  role = role || 'dev';
  let userInst = yapi.getInst(userModel);
  let userData = await userInst.findById(uid);
  if (!userData) {
    return null;
  }
  return {
    role: role,
    uid: userData._id,
    username: userData.username,
    email: userData.email
  };
};
// 邮件发送
exports.sendNotice = async function (projectId, data) {

  const followInst = yapi.getInst(followModel);
  const userInst = yapi.getInst(userModel);
  const projectInst = yapi.getInst(projectModel);
  const list = await followInst.listByProjectId(projectId);
  const starUsers = list.map(item => item.uid);

  const projectList = await projectInst.get(projectId);
  const projectMenbers = projectList.members
    .filter(item => item.email_notice)
    .map(item => item.uid);

  const users = arrUnique(projectMenbers, starUsers);
  const usersInfo = await userInst.findByUids(users);
  const emails = usersInfo.map(item => item.email).join(',');
  console.log({ 'sendNotice': usersInfo });
  try {
    yapi.commons.sendMail({
      to: emails,
      contents: data.content,
      subject: data.title
    });
  } catch (e) {
    console.log({ 'sendNotice': e });
    yapi.commons.log('邮件发送失败：' + e, 'error');
  }
};

function arrUnique(arr1, arr2) {
  let arr = arr1.concat(arr2);
  let res = arr.filter(function (item, index, arr) {
    return arr.indexOf(item) === index;
  });
  return res;
}

// 处理mockJs脚本
exports.handleMockScript = function (script, context) {
  let sandbox = {
    header: context.ctx.header,
    query: context.ctx.query,
    body: context.ctx.request.body,
    mockJson: context.mockJson,
    params: Object.assign({}, context.ctx.query, context.ctx.request.body),
    resHeader: context.resHeader,
    httpCode: context.httpCode,
    delay: context.httpCode,
    Random: Mock.Random
  };
  sandbox.cookie = {};

  context.ctx.header.cookie &&
    context.ctx.header.cookie.split(';').forEach(function (Cookie) {
      var parts = Cookie.split('=');
      sandbox.cookie[parts[0].trim()] = (parts[1] || '').trim();
    });
  sandbox = yapi.commons.sandbox(sandbox, script);
  sandbox.delay = isNaN(sandbox.delay) ? 0 : +sandbox.delay;

  context.mockJson = sandbox.mockJson;
  context.resHeader = sandbox.resHeader;
  context.httpCode = sandbox.httpCode;
  context.delay = sandbox.delay;
};

/**
     * 将对象的数据库信息对象 key 下划线转换为驼峰命名
     * @param {*} databaseInfo 
     */
exports.changeObjKeytoHump = function (databaseInfo) {
  for (let key in databaseInfo) {
    let humpKey = toHump(key);
    databaseInfo[humpKey] = databaseInfo[key];
    delete databaseInfo[key];
  }
}

/**
 * 下划线转换为驼峰命名
 * @param {*} name key 的名字
 */
function toHump(name) {
  return name.replace(/\_(\w)/g, function (all, letter) {
    return letter.toUpperCase();
  });
}



exports.createWebAPIRequest = async function (ops) {
  let response = await axios({
    method: 'GET',
    url: ops.href,
    timeout: 5000,
    maxRedirects: 0,
    httpsAgent: new https.Agent({
      rejectUnauthorized: false
    })
  });
  if (response.status > 400) {
    throw new Error('获取数据失败，请确认 swaggerUrl 是否正确')
  }
  return response.data;
}