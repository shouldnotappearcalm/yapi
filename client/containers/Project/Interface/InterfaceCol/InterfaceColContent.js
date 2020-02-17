import React, { PureComponent as Component } from 'react';
import { connect } from 'react-redux';
import PropTypes from 'prop-types';
import { withRouter } from 'react-router';
import { Link } from 'react-router-dom';
import {findMeInTree} from '../../../../common.js';
//import constants from '../../../../constants/variable.js'
import {Tooltip, Icon, Input, Button, Row, Col, Spin, Modal, message, Select, Switch, Checkbox, InputNumber} from 'antd';
import {
  fetchInterfaceColList,
  fetchCaseList,
  setColData,
  fetchCaseEnvList
} from '../../../../reducer/modules/interfaceCol';
import HTML5Backend from 'react-dnd-html5-backend';
import { getToken, getEnv } from '../../../../reducer/modules/project';
import { DragDropContext } from 'react-dnd';
import AceEditor from 'client/components/AceEditor/AceEditor';
import * as Table from 'reactabular-table';
import * as dnd from 'reactabular-dnd';
import * as resolve from 'table-resolver';
import axios from 'axios';
import CaseReport from './CaseReport.js';
import _ from 'underscore';
import produce from 'immer';
import {InsertCodeMap} from 'client/components/Postman/Postman.js'


const {
  handleParams,
  handleCurrDomain,
  crossRequest,
  checkNameIsExistInArray
} = require('common/postmanLib.js');
const { handleParamsValue, json_parse, ArrayToObject } = require('common/utils.js');
import CaseEnv from 'client/components/CaseEnv';
import Label from '../../../../components/Label/Label.js';
const Option = Select.Option;
const createContext = require('common/createContext')

import copy from 'copy-to-clipboard';
import {findStorageKeysFromScript} from "../../../../../common/utils";

const defaultModalStyle = {
  top: 10
}

@connect(
  state => {
    return {
      interfaceColList: state.interfaceCol.interfaceColList,
      currColId: state.interfaceCol.currColId,
      currCaseId: state.interfaceCol.currCaseId,
      isShowCol: state.interfaceCol.isShowCol,
      isRander: state.interfaceCol.isRander,
      currCaseList: state.interfaceCol.currCaseList,
      currProject: state.project.currProject,
      token: state.project.token,
      envList: state.interfaceCol.envList,
      curProjectRole: state.project.currProject.role,
      projectEnv: state.project.projectEnv,
      curUid: state.user.uid
    };
  },
  {
    fetchInterfaceColList,
    fetchCaseList,
    setColData,
    getToken,
    getEnv,
    fetchCaseEnvList
  }
)
@withRouter
@DragDropContext(HTML5Backend)
class InterfaceColContent extends Component {
  static propTypes = {
    match: PropTypes.object,
    interfaceColList: PropTypes.array,
    fetchInterfaceColList: PropTypes.func,
    fetchCaseList: PropTypes.func,
    setColData: PropTypes.func,
    history: PropTypes.object,
    currCaseList: PropTypes.array,
    currColId: PropTypes.number,
    currCaseId: PropTypes.number,
    isShowCol: PropTypes.bool,
    isRander: PropTypes.bool,
    currProject: PropTypes.object,
    getToken: PropTypes.func,
    token: PropTypes.string,
    curProjectRole: PropTypes.string,
    getEnv: PropTypes.func,
    projectEnv: PropTypes.object,
    fetchCaseEnvList: PropTypes.func,
    envList: PropTypes.array,
    curUid: PropTypes.number
  };

  constructor(props) {
    super(props);
    this.reports = {};
    this.records = {};
    this.state = {
      isLoading: false,
      rows: [],
      allRowsChecked: true,
      allRowsIndeterminate: false,
      unCheckedColCaseIdArray: [],
      reports: {},
      visible: false,
      curCaseid: null,
      advVisible: false,
      curScript: '',
      enableScript: false,
      autoVisible: false,
      mode: 'html',
      email: false,
      download: false,
      descendants:false,
      uncheckedCase: false,
      currColEnvObj: {},
      collapseKey: '1',
      commonSettingModalVisible: false,
      repeatedExecuteModalVisible: false,
      repeatedRunTimes: 1,
      commonSetting: {
        checkHttpCodeIs200: false,
        checkResponseField: {
          name: 'code',
          value: '0',
          enable: false
        },
        checkResponseSchema: false,
        checkScript: {
          enable: false,
          content: ''
        }
      }
    };
    this.onRow = this.onRow.bind(this);
    this.onMoveRow = this.onMoveRow.bind(this);
    this.cancelSourceSet = new Set();
  }

  /**
   * 取消上一次的请求
   */
  cancelRequestBefore = () => {
    this.cancelSourceSet.forEach(v => {
      v.cancel();
    });
    this.cancelSourceSet.clear();
  }

  async handleColIdChange(newColId){
    this.props.setColData({
      currColId: +newColId,
      isShowCol: true,
      isRander: false
    });

    this.setState({
      isLoading: true
    });

    this.cancelRequestBefore();
    let cancelSource = axios.CancelToken.source();
    this.cancelSourceSet.add(cancelSource);
    let resArr = await Promise.all([
      this.props.fetchCaseList(newColId, {
        cancelToken: cancelSource.token
      }),
      this.props.fetchCaseEnvList(newColId, {
        cancelToken: cancelSource.token
      })
    ]);
    this.cancelSourceSet.delete(cancelSource);
    if (resArr.some(res => axios.isCancel(res.payload))) return;

    const [result] = resArr;
    if (result.payload && result.payload.data.errcode === 0) {
      this.reports = result.payload.data.test_report;
    //  console.log({"reports":JSON.parse(JSON.stringify(this.reports))});
      this.setState({
        commonSetting:{
          ...this.state.commonSetting
        }
      })
    }
    this.setState({
      isLoading: false
    });
    this.changeCollapseClose();
    this.handleColdata(this.props.currCaseList);
  }

  async componentWillMount() {
    let cancelSource = axios.CancelToken.source();
    this.cancelSourceSet.add(cancelSource);
    const resArr = await Promise.all([
      this.props.fetchInterfaceColList(this.props.match.params.id, {
        cancelToken: cancelSource.token
      }),
      this.props.getToken(this.props.match.params.id, {
        cancelToken: cancelSource.token
      })
    ]);
    this.cancelSourceSet.delete(cancelSource);
    if (resArr.some(res => axios.isCancel(res.payload))) return;

    const [result] = resArr;

    let { currColId } = this.props;
    const params = this.props.match.params;
    const { actionId } = params;
    this.currColId = currColId = +actionId || result.payload.data.data[0]._id;

    let curColObj = this.getColObjByKey(result.payload.data.data, currColId);
    this.setState({ unCheckedColCaseIdArray: curColObj.unCheckedColCase ? curColObj.unCheckedColCase : []});
    this.props.history.push('/project/' + params.id + '/interface/col/' + currColId);
    if (currColId && currColId != 0) {
      await this.handleColIdChange(currColId)
    }
  }

  componentWillUnmount() {
    this.cancelRequestBefore();
    console.log('col unmount');
    clearInterval(this._crossRequestInterval);
  }

  // 更新分类简介
  handleChangeInterfaceCol = (desc, name) => {
    let params = {
      col_id: this.props.currColId,
      name: name,
      desc: desc
    };

    axios.post('/api/col/up_col', params).then(async res => {
      if (res.data.errcode) {
        return message.error(res.data.errmsg);
      }
      let project_id = this.props.match.params.id;
      await this.props.fetchInterfaceColList(project_id);
      message.success('接口集合简介更新成功');
    });
  };

  // 整合header信息
  handleReqHeader = (project_id, req_header, case_env) => {
    let envItem = _.find(this.props.envList, item => {
      return item._id === project_id;
    });

    let currDomain = handleCurrDomain(envItem && envItem.env, case_env);
    let header = currDomain.header;
    header.forEach(item => {
      if (!checkNameIsExistInArray(item.name, req_header)) {
        // item.abled = true;
        item = {
          ...item,
          abled: true
        };
        req_header.push(item);
      }
    });
    return req_header;
  };

  // 根据 colKey 获取 col 对象
  getColObjByKey = (colArray, colKey) => {
    for (let i = 0; i < colArray.length; i++) {
      if (colArray[i]._id === colKey) {
        return colArray[i];
      }

      if (colArray[i].children && colArray[i].children.length > 0) {
        let result = this.getColObjByKey(colArray[i].children, colKey);
        if (result) {
          return result;
        }
      }
    }
  }

  handleColdata = (rows, currColEnvObj = {}) => {
  //  console.log({'rows':JSON.parse(JSON.stringify(rows))});
    let that = this;
    let unCheckedColCaseIdArray = this.state.unCheckedColCaseIdArray;
    let newRows = produce(rows, draftRows => {
      draftRows.map(item => {
        item.id = item._id;
        item._test_status = item.test_status;
        if (currColEnvObj[item.project_id]){
          item.case_env = currColEnvObj[item.project_id];
        }
        item.req_headers = that.handleReqHeader(item.project_id, item.req_headers, item.case_env);
        //赋值isRun
        item.isRun = unCheckedColCaseIdArray.indexOf(item.id) == -1 ? true : false;
        return item;
      });
    });
    this.setState({ rows: newRows });
    //更改是否选中header的状态 
    this.changeGlobalCheckboxStatus(newRows);
  };



  executeTestsinserver = async () => {
    for (let i = 0, l = this.state.rows.length, newRows, curitem; i < l; i++) {
      let { rows } = this.state;

      let envItem = _.find(this.props.envList, item => {
        return item._id === rows[i].project_id;
      });
      curitem = Object.assign(
        {},
        {caseitme:rows[i]},
        {
          env: envItem.env,
          pre_script: this.props.currProject.pre_script,
          after_script: this.props.currProject.after_script
        },
        {token:this.props.token},
        {project_id: envItem._id}
      );
      curitem.caseitme.test_status='loading'
      newRows = [].concat([], rows);
      newRows[i] = curitem.caseitme;
      this.setState({ rows: newRows });
      let status = 'error',
        result;
      try {
       // console.log({curitem});
        result = await axios.post('/api/open/run_case', {params:curitem});
        result=result.data.data;
        if (result.code === 400) {
          status = 'error';
        } else if (result.code === 0) {
          status = 'ok';
        } else if (result.code === 1) {
          status = 'invalid';
        }
      } catch (e) {
        console.error(e);
        status = 'error';
        result = e;
      }
      console.log({['用例：'+curitem.caseitme.casename+'执行结果']:result})

      //result.body = result.data;
      this.reports[curitem.caseitme._id] = result;
      this.records[curitem.caseitme._id] = {
        status: result.status,
        params: result.params,
        body: result.res_body
      };

      curitem = Object.assign({}, rows[i], { test_status: status });
      newRows = [].concat([], rows);
      newRows[i] = curitem;
      //console.log({newRows});
      this.setState({ rows: newRows });
    }
    await axios.post('/api/col/up_col', {
      col_id: this.props.currColId,
      test_report: JSON.stringify(this.reports)
    });
  };

  openRepeatedExecuteModal = () => {
    this.setState({
      repeatedExecuteModalVisible: true
    })
  }

  cancelRepeatedExecute = () => {
    this.setState({
      repeatedExecuteModalVisible: false
    })
  }

  handleRepeatedExecute = async () => {
    this.setState({
      repeatedExecuteModalVisible: false
    });
    for (let i = 0; i < this.state.repeatedRunTimes; i++) {
      await this.executeTests();
    }
  }

  changeRepeatedTimes = (times) => {
    this.setState({ repeatedRunTimes: times });
  }


  executeTests = async () => {
    for (let i = 0, l = this.state.rows.length, newRows, curitem; i < l; i++) {
      let { rows } = this.state;

      if (rows[i].isRun == false) {
        continue;
      }

      let envItem = _.find(this.props.envList, item => {
        return item._id === rows[i].project_id;
      });
      curitem = Object.assign(
        {},
        rows[i],
        {
          env: envItem.env,
          pre_script: this.props.currProject.pre_script,
          after_script: this.props.currProject.after_script
        },
        { test_status: 'loading' }
      );
      newRows = [].concat([], rows);
      newRows[i] = curitem;
      this.setState({ rows: newRows });
      let status = 'error',
        result;
      try {
        result = await this.handleTest(curitem);

        if (result.code === 400) {
          status = 'error';
        } else if (result.code === 0) {
          status = 'ok';
        } else if (result.code === 1) {
          status = 'invalid';
        }
      } catch (e) {
        console.error(e);
        status = 'error';
        result = e;
      }

      //result.body = result.data;
      this.reports[curitem._id] = result;
      this.records[curitem._id] = {
        status: result.status,
        params: result.params,
        body: result.res_body
      };

      curitem = Object.assign({}, rows[i], { test_status: status });
      newRows = [].concat([], rows);
      newRows[i] = curitem;
      this.setState({ rows: newRows });
    }
    await axios.post('/api/col/up_col', {
      col_id: this.props.currColId,
      test_report: JSON.stringify(this.reports)
    });
  };

  handleTest = async interfaceData => {
    let requestParams = {};
    let options = handleParams(interfaceData, this.handleValue, requestParams);
    let result = {
      code: 400,
      msg: '数据异常',
      validRes: []
    };
    try {
      let data = await crossRequest(options, interfaceData.pre_script, interfaceData.after_script,interfaceData.case_pre_script,interfaceData.case_post_script, createContext(
        this.props.curUid,
        this.props.match.params.id,
        interfaceData.interface_id
      ));
      options.taskId = this.props.curUid;
      let res = (data.res.body = json_parse(data.res.body));
      result = {
        ...options,
        ...result,
        res_header: data.res.header,
        res_body: res,
        status: data.res.status,
        statusText: data.res.statusText
      };

      if (options.data && typeof options.data === 'object') {
        requestParams = {
          ...requestParams,
          ...options.data
        };
      }

      let validRes = [];

      let responseData = Object.assign(
        {},
        {
          status: data.res.status,
          body: res,
          header: data.res.header,
          statusText: data.res.statusText
        }
      );
      let errcode = 0;
      if (interfaceData && interfaceData.enable_script == true && interfaceData.test_script && interfaceData.test_script.length > 0) {
        // 断言测试
        errcode = await this.handleScriptTest(interfaceData, responseData, validRes, requestParams);
      } else {
        validRes.push({ message: '验证通过' });
      }

      result.code = errcode == 0 ? 0 : 1;
      result.validRes = validRes;
    } catch (data) {
      result = {
        ...options,
        ...result,
        res_header: data.header,
        res_body: data.body || data.message,
        status: 0,
        statusText: data.message,
        code: 400,
        validRes: [
          {
            message: data.message
          }
        ]
      };
    }

    result.params = requestParams;
    return result;
  };

  //response, validRes
  // 断言测试
  handleScriptTest = async (interfaceData, response, validRes, requestParams) => {
    let currDomain = handleCurrDomain(interfaceData.env, interfaceData.case_env);
    // 是否启动断言
    try {
      const {
        preScript = '', afterScript = '',case_pre_script = '',case_post_script = ''
      } = interfaceData;
      const allScriptStr = preScript + afterScript + case_pre_script + case_post_script;
      const storageKeys = findStorageKeysFromScript(allScriptStr);
      const storageDict = {};
      storageKeys.forEach(key => {
        storageDict[key] = localStorage.getItem(key);
      });

      let test = await axios.post('/api/col/run_script', {
        response: response,
        records: this.records,
        script: interfaceData.test_script,
        params: requestParams,
        col_id: this.props.currColId,
        interface_id: interfaceData.interface_id,
        project_id: interfaceData.project_id,
        env_id: currDomain._id,
        storageDict,
        taskId: this.props.curUid
      });
      if (test.data.errcode == 0) {
        validRes.push({ message: '验证通过' });
      }
      test.data.data.logs.forEach(item => {
        validRes.push({ message: item });
      });
      return test.data.errcode;
    } catch (err) {
      validRes.push({
        message: 'Error: ' + err.message
      });
      return -1;
    }
  };

  handleValue = (val, global) => {
    let globalValue = ArrayToObject(global);
    let context = Object.assign({}, { global: globalValue }, this.records);
    return handleParamsValue(val, context);
  };

  arrToObj = (arr, requestParams) => {
    arr = arr || [];
    const obj = {};
    arr.forEach(item => {
      if (item.name && item.enable && item.type !== 'file') {
        obj[item.name] = this.handleValue(item.value);
        if (requestParams) {
          requestParams[item.name] = obj[item.name];
        }
      }
    });
    return obj;
  };


  onRow(row) {
    return { rowId: row.id, onMove: this.onMoveRow, onDrop: this.onDrop };
  }

  onDrop = () => {
    let changes = [];
    this.state.rows.forEach((item, index) => {
      changes.push({ id: item._id, index: index });
    });
    axios.post('/api/col/up_case_index', changes).then(() => {
      this.props.fetchInterfaceColList(this.props.match.params.id);
    });
  };
  onMoveRow({ sourceRowId, targetRowId }) {
    let rows = dnd.moveRows({ sourceRowId, targetRowId })(this.state.rows);

    if (rows) {
      this.setState({ rows });
    }
  }

  onChangeTest = d => {

    this.setState({
      commonSetting: {
        ...this.state.commonSetting,
        checkScript: {
          ...this.state.commonSetting.checkScript,
          content: d.text
        }
      }
    });
  };

  handleInsertCode = code => {
    this.aceEditor.editor.insertCode(code);
  };

  async componentWillReceiveProps(nextProps) {
    let newColId = !isNaN(nextProps.match.params.actionId) ? +nextProps.match.params.actionId : 0;

    if ((newColId && this.currColId && newColId !== this.currColId) || nextProps.isRander) {
      this.currColId = newColId;
        this.setState(
          {
            descendants:false
          }
        );
      let curColObj = this.getColObjByKey(nextProps.interfaceColList, newColId);
      this.setState({ unCheckedColCaseIdArray: curColObj.unCheckedColCase? curColObj.unCheckedColCase : []});
      this.handleColIdChange(newColId)
    }
  }

  // 测试用例环境面板折叠
  changeCollapseClose = key => {
    if (key) {
      this.setState({
        collapseKey: key
      });
    } else {
      this.setState({
        collapseKey: '1',
        currColEnvObj: {}
      });
    }
  };

  openReport = id => {
    if (!this.reports[id]) {
      return message.warn('还没有生成报告');
    }
    this.setState({ visible: true, curCaseid: id });
  };

  // openAdv = id => {
  //   let findCase = _.find(this.props.currCaseList, item => item.id === id);
  //
  //   this.setState({
  //     enableScript: findCase.enable_script,
  //     curScript: findCase.test_script,
  //     advVisible: true,
  //     curCaseid: id
  //   });
  // };

  handleScriptChange = d => {
    this.setState({ curScript: d.text });
  };

  handleAdvCancel = () => {
    this.setState({ advVisible: false });
  };

  handleAdvOk = async () => {
    const { curCaseid, enableScript, curScript } = this.state;
    const res = await axios.post('/api/col/up_case', {
      id: curCaseid,
      test_script: curScript,
      enable_script: enableScript
    });
    if (res.data.errcode === 0) {
      message.success('更新成功');
    }
    this.setState({ advVisible: false });
    let currColId = this.currColId;
    this.props.setColData({
      currColId: +currColId,
      isShowCol: true,
      isRander: false
    });
    await this.props.fetchCaseList(currColId);

    this.handleColdata(this.props.currCaseList);
  };

  handleCancel = () => {
    this.setState({ visible: false });
  };

  currProjectEnvChange = (envName, project_id) => {
    let currColEnvObj = {
      ...this.state.currColEnvObj,
      [project_id]: envName
    };
    this.setState({ currColEnvObj });
   // this.handleColdata(this.props.currCaseList, envName, project_id);
   this.handleColdata(this.props.currCaseList,currColEnvObj);
  };

  autoTests = () => {
    this.setState({ autoVisible: true, currColEnvObj: {}, collapseKey: '' });
  };

  handleAuto = () => {
    this.setState({
      autoVisible: false,
      email: false,
      download: false,
      //descendants:false,
      uncheckedCase: false,
      mode: 'html',
      currColEnvObj: {},
      collapseKey: ''
    });
  };

  copyUrl = url => {
    copy(url);
    message.success('已经成功复制到剪切板');
  };

  modeChange = mode => {
    this.setState({ mode });
  };

  emailChange = email => {
    this.setState({ email });
  };

  downloadChange = download => {
    this.setState({ download });
  };


  handleColEnvObj = envObj => {
    let str = '';
    for (let key in envObj) {
      str += envObj[key] ? `&env_${key}=${envObj[key]}` : '';
    }
    return str;
  };

  handleCommonSetting = ()=>{
    let setting = this.state.commonSetting;

    let params = {
      col_id: this.props.currColId,
      ...setting

    };
  //  console.log(params)

    axios.post('/api/col/up_col', params).then(async res => {
      if (res.data.errcode) {
        return message.error(res.data.errmsg);
      }
      message.success('配置测试集成功');
    });

    this.setState({
      commonSettingModalVisible: false
    })
  }

  cancelCommonSetting = ()=>{
    this.setState({
      commonSettingModalVisible: false
    })
  }

  openCommonSetting = ()=>{
    this.setState({
      commonSettingModalVisible: true
    })
  }

  changeCommonFieldSetting = (key)=>{
    return (e)=>{
      let value = e;
      if(typeof e === 'object' && e){
        value = e.target.value;
      }
      let {checkResponseField} = this.state.commonSetting;
      this.setState({
        commonSetting: {
          ...this.state.commonSetting,
          checkResponseField: {
            ...checkResponseField,
            [key]: value
          }
        }
      })
    }
  }

  changeCheck = (_index, e) => {
    let newRows = [].concat([], this.state.rows);
    let curitem = Object.assign({}, newRows[_index], { isRun: e.target.checked });
    newRows[_index] = curitem;
    this.setState({
      rows: newRows
    });

    //更改是否选中header的状态 
    this.changeGlobalCheckboxStatus(newRows);
  }

  changeGlobalCheckboxStatus = (newRows) => {
    //更改是否选中header的状态 
    let noCheckedLength = 0;
    for (let i = 0, len = newRows.length; i < len; i++) {
      let item = newRows[i];
      if (item.isRun == false) {
        noCheckedLength++;
      }
    }
    if (noCheckedLength == 0) {
      this.setState({
        allRowsChecked: true
      });
    } else {
      this.setState({
        allRowsChecked: false
      });
    }

    if (noCheckedLength == newRows.length || noCheckedLength == 0) {
      this.setState({
        allRowsIndeterminate: false
      });
    } else {
      this.setState({
        allRowsIndeterminate: true
      });
    }
  }

  changeAllCheck = (e) => {
    let newRows = [].concat([], this.state.rows);
    this.state.rows.forEach((item, _index) => {
      let curitem = Object.assign({}, item, { isRun: e.target.checked });
      newRows[_index] = curitem;
    });

    this.setState({
      allRowsChecked: e.target.checked,
      rows: newRows,
      allRowsIndeterminate: false
    });
  }

  //保存未选中的测试用例
  saveUnCheckedColCase = () => {
    let unCheckedColCaseIdArray = [];
    this.state.rows.forEach(item => {
      if (item.isRun == false) {
        unCheckedColCaseIdArray.push(item._id);
      }
    });
    let params = {
      col_id: this.props.currColId,
      unCheckedColCase: unCheckedColCaseIdArray
    };

    axios.post('/api/col/up_col', params).then(async res => {
      if (res.data.errcode) {
        return message.error(res.data.errmsg);
      }
      let project_id = this.props.match.params.id;
      await this.props.fetchInterfaceColList(project_id);
      message.success('接口集合运行列表更新成功');
    });
  }

  onChangeCheckbox = async e => {
    await this.flushdescendants(e.target.checked,  e.target.allChilds)
  };

  //descendants
  descendants = async (descendants,e) => {
    console.log({descendants,'e.target.dataset':e.target.dataset})
    await this.flushdescendants(descendants, e.target.dataset.allchilds+'');
  };

  uncheckedCase = async(unchecked) => {
    this.setState({
      uncheckedCase: unchecked
    })
  }

  flushdescendants = async (descendants,allChilds) => {
    let childscol = this.props.currColId;
    this.setState({
      descendants
    });
    //   console.log({"state":this.state,e,"props":this.props});
    if (descendants) {
      childscol = allChilds;
    }
    if (descendants)
      console.log("pre id:" + childscol);
    await this.props.fetchCaseList(childscol);
    if (descendants)
      console.log("after id:" + childscol);
    await this.props.fetchCaseEnvList(childscol);
    this.changeCollapseClose();
    this.handleColdata(this.props.currCaseList);
  };

  getSummaryText = () => {
    const { rows } = this.state;
    let totalCount = rows.length || 0;
    let passCount = 0; // 测试通过
    let errorCount = 0; // 请求异常
    let failCount = 0; // 测试失败
    let loadingCount = 0; // 测试中
    rows.forEach(rowData => {
      let id = rowData._id;
      let code = this.reports[id] ? this.reports[id].code : 0;
      if (rowData.test_status === 'loading') {
        loadingCount += 1;
        return;
      }
      switch (code) {
        case 0:
          passCount += 1;
          break;
        case 400:
          errorCount += 1;
          break;
        case 1:
          failCount += 1;
          break;
        default:
          passCount += 1;
          break;
    }});
    return `用例共 (${totalCount}) 个,其中：["Pass: ${passCount} 个 ", "Loading: ${loadingCount} 个 ", "请求异常: ${errorCount} 个", "验证失败: ${failCount} 个"]`
  };


  render() {
    const currProjectId = this.props.currProject._id;
    const columns = [
      {
        property: 'casename',
        header: {
          label: '用例名称'
        },
        props: {
          style: {
            width: '250px'
          }
        },
        cell: {
          formatters: [
            (text, { rowData }) => {
           // console.log({rowData});
              let record = rowData;
              return (
                <Link to={'/project/' + currProjectId + '/interface/case/' + record._id}>
                  {record.casename.length > 23
                    ? record.casename.substr(0, 20) + '...'
                    : record.casename}
                </Link>
              );
            }
          ]
        }
      },
      //add
      {
        header: {
          formatters: [
            () => {
              return (
                <span><Checkbox checked={this.state.allRowsChecked} indeterminate={this.state.allRowsIndeterminate} onChange={this.changeAllCheck} />&nbsp;是否运行</span>
              );
            }
          ]
        },
        property: 'selected',
        cell: {
          formatters: [
            (text, { rowData }) => {
              let record = rowData;
              return (
                <Checkbox checked={record.isRun == null ? true : record.isRun} onChange={this.changeCheck.bind(this, record._index)} />
              );
            }
          ]
        }
      },
      // add end
      {
        header: {
          label: 'key',
          formatters: [
            () => {
              return (
                <Tooltip
                  title={
                    <span>
                      {' '}
                      每个用例都有唯一的key，用于获取所匹配接口的响应数据，例如使用{' '}
                      <a
                        href="doc/documents/case.html#%E7%AC%AC%E4%BA%8C%E6%AD%A5%EF%BC%8C%E7%BC%96%E8%BE%91%E6%B5%8B%E8%AF%95%E7%94%A8%E4%BE%8B"
                        className="link-tooltip"
                        target="blank"
                      >
                        {' '}
                        变量参数{' '}
                      </a>{' '}
                      功能{' '}
                    </span>
                  }
                >
                  Key
                </Tooltip>
              );
            }
          ]
        },
        props: {
          style: {
            width: '100px'
          }
        },
        cell: {
          formatters: [
            (value, { rowData }) => {
              return <span>{rowData._id}</span>;
            }
          ]
        }
      },
      {
        property: 'test_status',
        header: {
          label: '状态'
        },
        props: {
          style: {
            width: '100px'
          }
        },
        cell: {
          formatters: [
            (value, { rowData }) => {
              let id = rowData._id;
              let code = this.reports[id] ? this.reports[id].code : 0;
              if (rowData.isRun != null && rowData.isRun == false) {
                return (
                  <div>
                    <Tooltip title="Pass">
                      <Icon
                        style={{
                          color: 'grey'
                        }}
                        type="minus-circle"
                      />
                    </Tooltip>
                  </div>
                );
              }

              if (rowData.test_status === 'loading') {
                return (
                  <div>
                    <Spin />
                  </div>
                );
              }

              switch (code) {
                case 0:
                  return (
                    <div>
                      <Tooltip title="Pass">
                        <Icon
                          style={{
                            color: '#00a854'
                          }}
                          type="check-circle"
                        />
                      </Tooltip>
                    </div>
                  );
                case 400:
                  return (
                    <div>
                      <Tooltip title="请求异常">
                        <Icon
                          type="info-circle"
                          style={{
                            color: '#f04134'
                          }}
                        />
                      </Tooltip>
                    </div>
                  );
                case 1:
                  return (
                    <div>
                      <Tooltip title="验证失败">
                        <Icon
                          type="exclamation-circle"
                          style={{
                            color: '#ffbf00'
                          }}
                        />
                      </Tooltip>
                    </div>
                  );
                default:
                  return (
                    <div>
                      <Icon
                        style={{
                          color: '#00a854'
                        }}
                        type="check-circle"
                      />
                    </div>
                  );
              }
            }
          ]
        }
      },
      {
        property: 'path',
        header: {
          label: '接口路径'
        },
        cell: {
          formatters: [
            (text, { rowData }) => {
              let record = rowData;
              return (
                <Tooltip title="跳转到对应接口">
                  <Link to={`/project/${record.project_id}/interface/api/${record.interface_id}`}>
                    {record.path.length > 23 ? record.path + '...' : record.path}
                  </Link>
                </Tooltip>
              );
            }
          ]
        }
      },
      {
        header: {
          label: '测试报告'
        },
        props: {
          style: {
            width: '200px'
          }
        },
        cell: {
          formatters: [
            (text, { rowData }) => {
              let reportFun = () => {
                if (!this.reports[rowData.id]) {
                  return null;
                }
                return <Button onClick={() => this.openReport(rowData.id)}>测试报告</Button>;
              };
              return <div className="interface-col-table-action">{reportFun()}</div>;
            }
          ]
        }
      }
    ];
    const { rows } = this.state;
    const components = {
      header: {
        cell: dnd.Header
      },
      body: {
        row: dnd.Row
      }
    };
    const resolvedColumns = resolve.columnChildren({ columns });
    const resolvedRows = resolve.resolve({ columns: resolvedColumns, method: resolve.nested })(
      rows
    );

    const localUrl =
      location.protocol +
      '//' +
      location.hostname +
      (location.port !== '' ? ':' + location.port : '');
    let currColEnvObj = this.handleColEnvObj(this.state.currColEnvObj);
    const autoTestsUrl = `/api/open/run_auto_test?id=${this.props.currColId}&token=${
      this.props.token
    }${currColEnvObj ? currColEnvObj : ''}&mode=${this.state.mode}&email=${
      this.state.email
    }&download=${this.state.download}&descendants=${this.state.descendants}&runCheckedCase=${this.state.uncheckedCase}`;

    let col_name = '';
    let col_desc = '';
      let allChilds=[];

    if (this.props.interfaceColList) {
      let me = findMeInTree(this.props.interfaceColList, this.props.currColId);
      col_name = me?me.name:'';
      col_desc = me?me.desc:'';
      allChilds = me ? me.childs : '';
    }

    return (
      <div className="interface-col">
        <Modal
          title="配置运行次数"
          visible={this.state.repeatedExecuteModalVisible}
          onOk={this.handleRepeatedExecute}
          onCancel={this.cancelRepeatedExecute}
          width={'500px'}
          style={{top:150}}
        >
          <div>
            <Row>
              <Col span={20}>
                <span style={{fontSize: '15px'}}>重复运行次数：</span>&nbsp;
                <InputNumber precision={0} autoFocus={true} defaultValue={1} onChange={this.changeRepeatedTimes} min={0} max={500}  />
              </Col>
            </Row>
          </div>
        </Modal>
        <Modal
            title="通用规则配置"
            visible={this.state.commonSettingModalVisible}
            onOk={this.handleCommonSetting}
            onCancel={this.cancelCommonSetting}
            width={'1000px'}
            style={defaultModalStyle}
          >
          <div className="common-setting-modal">
            <Row className="setting-item">
              <Col className="col-item" span={4}>
                <label>检查HttpCode:&nbsp;<Tooltip title={'检查 http code 是否为 200'}>
                  <Icon type="question-circle-o" style={{ width: '10px' }} />
                </Tooltip></label>
              </Col>
              <Col className="col-item" span={18}>
                <Switch onChange={e=>{
                  let {commonSetting} = this.state;
                  this.setState({
                    commonSetting :{
                      ...commonSetting,
                      checkHttpCodeIs200: e
                    }
                  })
                }} checked={this.state.commonSetting.checkHttpCodeIs200}  checkedChildren="开" unCheckedChildren="关" />
              </Col>
            </Row>

            <Row className="setting-item">
              <Col className="col-item"  span={4}>
                <label>检查返回json:&nbsp;<Tooltip title={'检查接口返回数据字段值，比如检查 code 是不是等于 0'}>
                  <Icon type="question-circle-o" style={{ width: '10px' }} />
                </Tooltip></label>
              </Col>
              <Col  className="col-item" span={6}>
                <Input value={this.state.commonSetting.checkResponseField.name} onChange={this.changeCommonFieldSetting('name')} placeholder="字段名"  />
              </Col>
              <Col  className="col-item" span={6}>
                <Input  onChange={this.changeCommonFieldSetting('value')}  value={this.state.commonSetting.checkResponseField.value}   placeholder="值"  />
              </Col>
              <Col  className="col-item" span={6}>
                <Switch  onChange={this.changeCommonFieldSetting('enable')}  checked={this.state.commonSetting.checkResponseField.enable}  checkedChildren="开" unCheckedChildren="关"  />
              </Col>
            </Row>

            <Row className="setting-item">
              <Col className="col-item" span={4}>
                <label>检查返回数据结构:&nbsp;<Tooltip title={'只有 response 基于 json-schema 方式定义，该检查才会生效'}>
                  <Icon type="question-circle-o" style={{ width: '10px' }} />
                </Tooltip></label>
              </Col>
              <Col className="col-item"  span={18}>
                <Switch onChange={e=>{
                  let {commonSetting} = this.state;
                  this.setState({
                    commonSetting :{
                      ...commonSetting,
                      checkResponseSchema: e
                    }
                  })
                }} checked={this.state.commonSetting.checkResponseSchema}  checkedChildren="开" unCheckedChildren="关" />
              </Col>
            </Row>

            <Row className="setting-item">
              <Col className="col-item  " span={4}>
                <label>全局测试脚本:&nbsp;<Tooltip title={'在跑自动化测试时，优先调用全局脚本，只有全局脚本通过测试，才会开始跑case自定义的测试脚本'}>
                  <Icon type="question-circle-o" style={{ width: '10px' }} />
                </Tooltip></label>
              </Col>
              <Col className="col-item"  span={14}>
                <div><Switch onChange={e=>{
                  let {commonSetting} = this.state;
                  this.setState({
                    commonSetting :{
                      ...commonSetting,
                      checkScript: {
                        ...this.state.checkScript,
                        enable: e
                      }
                    }
                  })
                }} checked={this.state.commonSetting.checkScript.enable}  checkedChildren="开" unCheckedChildren="关"  /></div>
                <AceEditor
                  onChange={this.onChangeTest}
                  className="case-script"
                  data={this.state.commonSetting.checkScript.content}
                  ref={aceEditor => {
                    this.aceEditor = aceEditor;
                  }}
                />
              </Col>
              <Col span={6}>
                <div className="insert-code">
                  {InsertCodeMap.map(item => {
                    return (
                      <div
                        style={{ cursor: 'pointer' }}
                        className="code-item"
                        key={item.title}
                        onClick={() => {
                          this.handleInsertCode('\n' + item.code);
                        }}
                      >
                        {item.title}
                      </div>
                    );
                  })}
                </div>
              </Col>
            </Row>


          </div>
        </Modal>
        <Row type="flex" justify="center" align="top">
          <Col span={5}>
            <h2
              className="interface-title"
              style={{
                display: 'inline-block',
                margin: '8px 20px 16px 0px'
              }}
            >
              测试集合&nbsp;<a
                target="_blank"
                rel="noopener noreferrer"
                href="/doc/documents/case.html"
              >
                <Tooltip title="点击查看文档">
                  <Icon type="question-circle-o" />
                </Tooltip>
              </a>
            </h2>
            <div>
              {(
                <Checkbox
                  allChilds={allChilds}
                  checked={this.state.descendants}
                  onChange={this.onChangeCheckbox}
                >包含子集合用例</Checkbox>)}
            </div>
          </Col>
          <Col span={10}>
            <CaseEnv
              envList={this.props.envList}
              currProjectEnvChange={this.currProjectEnvChange}
              envValue={this.state.currColEnvObj}
              collapseKey={this.state.collapseKey}
              changeClose={this.changeCollapseClose}
            />
          </Col>
          <Col span={9}>
            {(
              <div
                style={{
                  float: 'right',
                  paddingTop: '8px'
                }}
              >
                {this.props.curProjectRole !== 'guest' && (
                  <Tooltip title="在 YApi 服务端跑自动化测试，测试环境不能为私有网络，请确保 YApi 服务器可以访问到自动化测试环境domain">
                    <Button
                      style={{
                        marginRight: '8px'
                      }}
                      onClick={this.autoTests}
                    >
                      服务端测试
                    </Button>
                  </Tooltip>
                )}
                <Button onClick={this.openCommonSetting} style={{
                        marginRight: '8px'
                      }} >通用规则配置</Button>
                <Button style={{marginRight:'8px'}} onClick={this.openRepeatedExecuteModal}>
                  测试N次
                </Button>
                <Button type="primary" onClick={this.executeTests}>
                  开始测试
                </Button>
                
              </div>
            )}
          </Col>
        </Row>
        <Row>
          <Col span={10}>
            <div className="component-label-wrapper">
              <div style={{display:"inline-block",marginTop:'40px'}}><Label onChange={val => this.handleChangeInterfaceCol(val, col_name)} desc={col_desc} /></div>
              <Button type="primary" onClick={this.saveUnCheckedColCase}>
                保存勾选记录
              </Button>
            </div>
          </Col>
        </Row>
        

        <div className="component-label-wrapper">
          <Label onChange={val => this.handleChangeInterfaceCol(val, col_name)} desc={col_desc} />
        </div>
        <Spin spinning={this.state.isLoading}>
          <h3 className="interface-title">
            {this.getSummaryText()}
          </h3>
          <Table.Provider
            components={components}
            columns={resolvedColumns}
            style={{
              width: '100%',
              borderCollapse: 'collapse'
            }}
          >
            <Table.Header
              className="interface-col-table-header"
              headerRows={resolve.headerRows({ columns })}
            />

            <Table.Body
              className="interface-col-table-body"
              rows={resolvedRows}
              rowKey="id"
              onRow={this.onRow}
            />
          </Table.Provider>
        </Spin>
        <Modal
          title="测试报告"
          width="900px"
          style={{
            minHeight: '500px'
          }}
          visible={this.state.visible}
          onCancel={this.handleCancel}
          footer={null}
        >
          <CaseReport {...this.reports[this.state.curCaseid]} />
        </Modal>

        {this.state.autoVisible && (
          <Modal
            title="服务端自动化测试"
            width="780px"
            style={{
              minHeight: '500px'
            }}
            visible={this.state.autoVisible}
            onCancel={this.handleAuto}
            className="autoTestsModal"
            footer={null}
          >
            <Row type="flex" justify="space-around" className="row" align="top">
              <Col span={3} className="label" style={{ paddingTop: '16px' }}>
                选择环境
                <Tooltip title="默认使用测试用例选择的环境">
                  <Icon type="question-circle-o" />
                </Tooltip>
                &nbsp;：
              </Col>
              <Col span={21}>
                <CaseEnv
                  envList={this.props.envList}
                  currProjectEnvChange={this.currProjectEnvChange}
                  envValue={this.state.currColEnvObj}
                  collapseKey={this.state.collapseKey}
                  changeClose={this.changeCollapseClose}
                />
              </Col>
            </Row>
            <Row type="flex" justify="space-around" className="row" align="middle">
              <Col span={3} >
                输出格式：
              </Col>
              <Col span={3}>
                <Select value={this.state.mode} onChange={this.modeChange}>
                  <Option key="html" value="html">
                    html
                  </Option>
                  <Option key="json" value="json">
                    json
                  </Option>
                </Select>
              </Col>

              <Col span={3} >
                邮件通知
                <Tooltip title={'测试不通过时，会给项目组成员发送邮件'}>
                  <Icon
                    type="question-circle-o"
                    style={{
                      width: '10px'
                    }}
                  />
                </Tooltip>
                &nbsp;：
              </Col>
              <Col span={3}>
                <Switch
                  checked={this.state.email}
                  checkedChildren="开"
                  unCheckedChildren="关"
                  onChange={this.emailChange}
                />
              </Col>

              <Col span={3} >
                下载数据
                <Tooltip title={'开启后，测试数据将被下载到本地'}>
                  <Icon
                    type="question-circle-o"
                    style={{
                      width: '10px'
                    }}
                  />
                </Tooltip>
                &nbsp;：
              </Col>
              <Col span={3}>
                <Switch
                  checked={this.state.download}
                  checkedChildren="开"
                  unCheckedChildren="关"
                  onChange={this.downloadChange}
                />
              </Col>
              <Col span={3} >
                含子集合
                <Tooltip title={'开启后，将同时执行子集合所有用例'}>
                  <Icon
                    type="question-circle-o"
                    style={{
                      width: '10px'
                    }}
                  />
                </Tooltip>
                &nbsp;：
              </Col>
              <Col span={3}>
                <Switch
                  checked={this.state.descendants}
                  data-allChilds={allChilds}
                  checkedChildren="开"
                  unCheckedChildren="关"
                  onChange={this.descendants}
                />
              </Col>
            </Row>
            <Row type="flex" justify="start" className="row" align="middle">
              <Col span={3} >
                  只运行勾选中的用例
                <Tooltip title={'开启后，将不执行取消勾选的测试用例'}>
                  <Icon
                    type="question-circle-o"
                    style={{
                      width: '10px'
                    }}
                  />
                </Tooltip>
                  &nbsp;：
              </Col>
              <Col span={3}>
                <Switch
                    checked={this.state.uncheckedCase}
                    checkedChildren="开"
                    unCheckedChildren="关"
                    onChange={this.uncheckedCase}
                  />
              </Col>
            </Row>
            <Row type="flex" justify="space-around" className="row" align="middle">
              <Col span={21} className="autoTestUrl">
                <a
                  target="_blank"
                  rel="noopener noreferrer"
                  href={localUrl + autoTestsUrl} >
                  {autoTestsUrl}
                </a>
              </Col>
              <Col span={3}>
                <Button className="copy-btn" onClick={() => this.copyUrl(localUrl + autoTestsUrl)}>
                  复制
                </Button>
              </Col>
            </Row>
            <div className="autoTestMsg">
              注：访问该URL，可以测试所有用例，请确保YApi服务器可以访问到环境配置的 domain
            </div>
          </Modal>
        )}
      </div>
    );
  }
}

export default InterfaceColContent;
