const projectModel = require('../models/project.js');
const interfaceColModel = require('../models/interfaceCol.js');
const interfaceCaseModel = require('../models/interfaceCase.js');
const interfaceModel = require('../models/interface.js');
const interfaceCatModel = require('../models/interfaceCat.js');
const followModel = require('../models/follow.js');
const userModel = require('../models/user.js');
const yapi = require('../yapi.js');
const baseController = require('./base.js');
const {
  handleParams,
  crossRequest,
  handleCurrDomain,
  checkNameIsExistInArray
} = require('../../common/postmanLib');
const { handleParamsValue, ArrayToObject } = require('../../common/utils.js');
const renderToHtml = require('../utils/reportHtml');
const HanldeImportData = require('../../common/HandleImportData');
const _ = require('underscore');
const createContex = require('../../common/createContext')

/**
 * {
 *    postman: require('./m')
 * }
 */
const importDataModule = {};
yapi.emitHook('import_data', importDataModule);

class openController extends baseController {
  constructor(ctx) {
    super(ctx);
    this.projectModel = yapi.getInst(projectModel);
    this.interfaceColModel = yapi.getInst(interfaceColModel);
    this.interfaceCaseModel = yapi.getInst(interfaceCaseModel);
    this.interfaceModel = yapi.getInst(interfaceModel);
    this.interfaceCatModel = yapi.getInst(interfaceCatModel);
    this.followModel = yapi.getInst(followModel);
    this.userModel = yapi.getInst(userModel);
    this.handleValue = this.handleValue.bind(this);
    this.schemaMap = {
      runAutoTest: {
        '*id': 'number',
        project_id: 'string',
        token: 'string',
        mode: {
          type: 'string',
          default: 'html'
        },
        email: {
          type: 'boolean',
          default: false
        },
        download: {
          type: 'boolean',
          default: false
        },
        closeRemoveAdditional: true
      },
      importData: {
        '*type': 'string',
        url: 'string',
        '*token': 'string',
        json: 'string',
        project_id: 'string',
        merge: {
          type: 'string',
          default: 'normal'
        }
      }
    };
  }

  async importData(ctx) {
    let type = ctx.params.type;
    let content = ctx.params.json;
    let project_id = ctx.params.project_id;
    let dataSync = ctx.params.merge;

    let warnMessage = ''

    /**
     * 因为以前接口文档写错了，做下兼容
     */
    try{
      if(!dataSync &&ctx.params.dataSync){
        warnMessage = 'importData Api 已废弃 dataSync 传参，请联系管理员将 dataSync 改为 merge.'
        dataSync = ctx.params.dataSync
      }
    }catch(e){}

    let token = ctx.params.token;
    if (!type || !importDataModule[type]) {
      return (ctx.body = yapi.commons.resReturn(null, 40022, '不存在的导入方式'));
    }

    if (!content && !ctx.params.url) {
      return (ctx.body = yapi.commons.resReturn(null, 40022, 'json 或者 url 参数，不能都为空'));
    }
    try {
      let request = require("request");// let Promise = require('Promise');
      let syncGet = function (url){
          return new Promise(function(resolve, reject){
              request.get({url : url}, function(error, response, body){
                  if(error){
                      reject(error);
                  }else{
                      resolve(body);
                  }
              });
          });
      } 
      if(ctx.params.url){
        content = await syncGet(ctx.params.url);
      }else if(content.indexOf('http://') === 0 || content.indexOf('https://') === 0){
        content = await syncGet(content);
      }
      content = JSON.parse(content);
    } catch (e) {
      return (ctx.body = yapi.commons.resReturn(null, 40022, 'json 格式有误:' + e));
    }

    let menuList = await this.interfaceCatModel.list(project_id);
    let selectCatid = menuList[0]._id;
    let projectData = await this.projectModel.get(project_id);
    let res = await importDataModule[type](content);

    let successMessage;
    let errorMessage = [];
    await HanldeImportData(
      res,
      project_id,
      selectCatid,
      menuList,
      projectData.basePath,
      dataSync,
      err => {
        errorMessage.push(err);
      },
      msg => {
        successMessage = msg;
      },
      () => {},
      token,
      yapi.WEBCONFIG.port
    );

    if (errorMessage.length > 0) {
      return (ctx.body = yapi.commons.resReturn(null, 404, errorMessage.join('\n')));
    }
    ctx.body = yapi.commons.resReturn(null, 0, successMessage + warnMessage);
  }

  async projectInterfaceData(ctx) {
    ctx.body = 'projectInterfaceData';
  }

  handleValue(val, global) {
    let globalValue = ArrayToObject(global);
    let context = Object.assign({}, {global: globalValue}, this.records);
    return handleParamsValue(val, context);
  }

  handleEvnParams(params) {
    let result = [];
    Object.keys(params).map(item => {
      if (/env_/gi.test(item)) {
        let curEnv = yapi.commons.trim(params[item]);
        let value = { curEnv, project_id: item.split('_')[1] };
        result.push(value);
      }
    });
    return result;
  }
  async runAutoTest(ctx) {
    if (!this.$tokenAuth) {
      return (ctx.body = yapi.commons.resReturn(null, 40022, 'token 验证失败'));
    }
    // console.log(1231312)
    const token = ctx.query.token;

    const projectId = ctx.params.project_id;
    const startTime = new Date().getTime();
    const testList = [];
    const records = (this.records = {});
    const reports = (this.reports = {});
    let rootid = ctx.params.id;
    let curEnvList = this.handleEvnParams(ctx.params);


    let colData2 = await yapi.commons.getCol(projectId,false,rootid);
    let colids=[];
    colids.push(colData2._id);
   // console.log({ctx,projectId,'ctx.params':ctx.params});
    if((ctx.params.descendants && ctx.params.descendants == 'true') || rootid == -1) {
      colids = colids.concat(colData2.descendants);
    }
   // console.log({colids});
    if (!colData2) {
      return (ctx.body = yapi.commons.resReturn(null, 40022, 'id值不存在'));
    }
    let projectData = await this.projectModel.get(projectId);
//--------------
    for(let c=0;c<colids.length;c++){
      let id=colids[c];


      if (id == -1) {
        continue;
      }

      let caseList = await yapi.commons.getCaseList(id);
      if (caseList.errcode !== 0) {
        ctx.body = caseList;
      }

      let unCheckedCaseArray = (ctx.params.runCheckedCase && ctx.params.runCheckedCase == 'true') && caseList.colData.unCheckedColCase ? caseList.colData.unCheckedColCase : [];
      let unCheckedCaseSet = new Set(unCheckedCaseArray);
      caseList = caseList.data;
      for (let i = 0, l = caseList.length; i < l; i++) {

        let item = caseList[i];
        // 如果 item._id 在 uncheckedCaseArray 中
        if (unCheckedCaseSet.has(item._id)) {
          continue;
        }

        let curEnvItem = _.find(curEnvList, key => {
          return key.project_id == item.project_id;
        });

        let result = await this.caseItemrun(caseList[i], curEnvItem, projectData.pre_script,projectData.after_script,records,reports);


        testList.push(result);
      }
    }
//-----------------------
    function getMessage(testList) {
      let successNum = 0,
        failedNum = 0,
        len = 0,
        msg = '';
      testList.forEach(item => {
        len++;
        if (item.code === 0) {
          successNum++;
        }
        else {
          failedNum++;
        }
      });
      if (failedNum === 0) {
        msg = `一共 ${len} 测试用例，全部验证通过`;
      } else {
        msg = `一共 ${len} 测试用例，${successNum} 个验证通过， ${failedNum} 个未通过。`;
      }

      return { msg, len, successNum, failedNum };
    }

    const endTime = new Date().getTime();
    const executionTime = (endTime - startTime) / 1000;

  //  console.log({testList});
    let reportsResult = {
      message: getMessage(testList),
      runTime: executionTime + 's',
      numbs: testList.length,
      list: testList
    };

    if (ctx.params.email === true && reportsResult.message.failedNum !== 0) {
      let autoTestUrl = `${
        ctx.request.origin
      }/api/open/run_auto_test?id=${rootid}&token=${token}&mode=${ctx.params.mode}&descendants=${ctx.params.descendants}&runCheckedCase=${ctx.params.runCheckedCase}`;
      yapi.commons.sendNotice(projectId, {
        title: `crazy-YApi自动化测试报告`,
        content: `
        <html>
        <head>
        <title>测试报告</title>
        <meta charset="utf-8" />
        <body>
        <div>
        <h3>测试结果：</h3>
        <p>${reportsResult.message.msg}</p>
        <h3>测试结果详情如下：</h3>
        <p>${autoTestUrl}</p>
        </div>
        </body>
        </html>`
      });
    }
    let mode = ctx.params.mode || 'html';
    if(ctx.params.download === true) {
      ctx.set('Content-Disposition', `attachment; filename=test.${mode}`);
    }
    if (ctx.params.mode === 'json') {
      return (ctx.body = reportsResult);
    } else {
      return (ctx.body = renderToHtml(reportsResult));
    }
  }

  async caseItemrun(caseme, curEnvItem, pre_script,after_script,records,reports) {

    let item = caseme;
    let projectEvn = await this.projectModel.getByEnv(item.project_id);
    item.id = item._id;
    item.case_env = curEnvItem ? curEnvItem.curEnv || item.case_env : item.case_env;
    item.req_headers = this.handleReqHeader(item.req_headers, projectEvn.env, item.case_env);
    item.pre_script = pre_script;
    item.after_script = after_script;
    item.env = projectEvn.env;
    let result;
    // console.log('item',item.case_env)
    try {
      result = await this.handleTest(item);
    } catch (err) {
      result = err;
    }
    reports[item.id] = result;
    records[item.id] = {
      params: result.params,
      body: result.res_body
    };
    return result
  }

  async handleTest(caseItemData) {
    let requestParams = {};
    let options;
    options = handleParams(caseItemData, this.handleValue, requestParams);
    let result = {
      id: caseItemData.id,
      name: caseItemData.casename,
      path: caseItemData.path,
      code: 400,
      validRes: [],
      intf_id:caseItemData.interface_id,
      uid:caseItemData.uid
    };

    try {
      options.taskId = this.getUid();

      let data = await crossRequest(options, caseItemData.pre_script, caseItemData.after_script,caseItemData.case_pre_script,caseItemData.case_post_script,createContex(
        this.getUid(),
        caseItemData.project_id,
        caseItemData.interface_id||caseItemData.id
      ));

      let res = data.res;

      result = Object.assign(result, {
        status: res.status,
        statusText: res.statusText,
        url: data.req.url,
        method: data.req.method,
        data: data.req.data,
        headers: data.req.headers,
        res_header: res.header,
        res_body: res.body
      });
      if (options.data && typeof options.data === 'object') {
        requestParams = Object.assign(requestParams, options.data);
      }

      let validRes = [];

      let responseData = Object.assign(
        {},
        {
          status: res.status,
          body: res.body,
          header: res.header,
          statusText: res.statusText
        }
      );
      let errcode = 0;
      if (caseItemData.enable_script == true && caseItemData.test_script && caseItemData.test_script.length > 0) {
        errcode = await this.handleScriptTest(caseItemData, responseData, validRes, requestParams, data.utils, data.storage);
      } else {
        validRes.push({ message: '验证通过' });
      }


      result.params = requestParams;
      if (errcode == 0) {
        result.code = 0;
        result.statusText='OK'
      } else {
        result.code = 1;
        result.statusText='test脚本出错!!！'
      }
      result.validRes = validRes;
    } catch (data) {
      result = Object.assign(options, result, {
        res_header: data.header,
        res_body: data.body || data.message,
        status: null,
        statusText: data.message,
        code: 400
      });
    }

    return result;
  }

  async handleScriptTest(caseItemData, response, validRes, requestParams, utils, storage) {
    let curEnv = _.find(caseItemData.env, item => item.name === caseItemData.case_env);

      try {
      let test = await yapi.commons.runCaseScript({
        response: response,
        records: this.records,
        script: caseItemData.test_script,
        utils:utils,
        storage:storage,
        params: requestParams,
        taskId: this.getUid(),
        project_id: caseItemData.project_id,
        env_id: curEnv._id.toString()
      }, caseItemData.col_id, caseItemData.interface_id, this.getUid());

      if (test.errcode == 0) {
        validRes.push({ message: '验证通过' });
      }
      test.data.logs.forEach(item => {
        validRes.push({
          message: item
        });
      });
      return test.errcode;
    } catch (err) {
      validRes.push({
        message: 'Error: ' + err.message
      });
      return -1;
    }
  }

  handleReqHeader(req_header, envData, curEnvName) {
    let currDomain = handleCurrDomain(envData, curEnvName);

    let header = currDomain.header;
    header.forEach(item => {
      if (!checkNameIsExistInArray(item.name, req_header)) {
        item.abled = true;
        req_header.push(item);
      }
    });
    req_header = req_header.filter(item => {
      return item && typeof item === 'object';
    });
    return req_header;
  }
}

module.exports = openController;
