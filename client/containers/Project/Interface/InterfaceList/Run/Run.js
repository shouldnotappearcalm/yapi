import React, { PureComponent as Component } from 'react';
import PropTypes from 'prop-types';
import { connect } from 'react-redux';
import { withRouter } from 'react-router';
import axios from 'axios';
import { message } from 'antd';
import { Postman } from '../../../../../components';
import AddColModal from './AddColModal';
import json5 from 'json5';
const boundaryUtils = require('../../../../../../common/boundary.js')

// import {
// } from '../../../reducer/modules/group.js'

import './Run.scss';


@connect(state => ({
  currInterface: state.inter.curdata,
  currProject: state.project.currProject,
  curUid: state.user.uid,
  token: state.project.token
}))
@withRouter
export default class Run extends Component {
  static propTypes = {
    currProject: PropTypes.object,
    currInterface: PropTypes.object,
    match: PropTypes.object,
    curUid: PropTypes.number,
    token: PropTypes.string
  };

  state = {};

  constructor(props) {
    super(props);
  }

   componentWillMount() {
  }

  componentWillReceiveProps() {}

  savePostmanRef = postman => {
    this.postman = postman;
  };

  saveBoundaryCase = async (colId, caseName) => {
    const project_id = this.props.match.params.id;
    const interface_id = this.props.currInterface._id;

    let currInterface = json5.parse(json5.stringify(this.props.currInterface));
    const { req_body_other, req_body_type, req_body_is_json_schema } = currInterface;
    let body = req_body_other;

    let bodyArray = [];
    if (req_body_type === 'json' && req_body_other && req_body_is_json_schema) {
      
      // 生成各种边界 schema
      let schemaArray = [];
      // 生成 超长 string 的 schema
      let maxJson = {
        name: caseName + '-max',
        data: json5.parse(body)
      };
      boundaryUtils.generateErrorMax(maxJson.data);
      schemaArray.push(maxJson);

      // 生成短 string 的 schema
      let minStringJson = {
        name: caseName + '-min',
        data: json5.parse(body)
      };
      boundaryUtils.generateErrorMin(minStringJson.data);
      schemaArray.push(minStringJson);

      // 生成

      for (let i = 0; i < schemaArray.length; i++) {
        let result = await axios.post('/api/interface/schema2json', {
          schema: schemaArray[i].data,
          required: true
        });
        bodyArray.push({
          name: schemaArray[i].name, 
          data: JSON.stringify(result.data)
        });
      }

      // 生成 null 的data
      let nullObj = {
        name: caseName + '-null',
        data: JSON.parse(bodyArray[0].data)
      };
      boundaryUtils.generateErrorNull(nullObj.data);
      nullObj.data = JSON.stringify(nullObj.data);
      bodyArray.push(nullObj);

    } else {
      bodyArray.push({
        name: caseName,
        data: body
      });
    }

    // 保存 case
    const {
      case_env,
      req_params,
      req_query,
      req_headers,
      req_body_form
    } = this.postman.state;

    let params = {
      interface_id,
      casename: caseName,
      col_id: colId,
      project_id,
      case_env,
      req_params,
      req_query,
      req_headers,
      req_body_type,
      req_body_form,
      req_body_other: body
    };

    if (params.test_res_body && typeof params.test_res_body === 'object') {
      params.test_res_body = JSON.stringify(params.test_res_body, null, '   ');
    }

    let res;
    for (let i = 0; i < bodyArray.length; i++) {
      params.req_body_other = bodyArray[i].data;
      params.casename = bodyArray[i].name;
      res = await axios.post('/api/col/add_case', params);
    }

    
    if (res.data.errcode) {
      message.error(res.data.errmsg);
    } else {
      message.success('添加成功');
      this.setState({ saveBoundaryCaseModalVisible: false });
    }

  }


  saveCase = async (colId, caseName) => {
    const project_id = this.props.match.params.id;
    const interface_id = this.props.currInterface._id;
    const {
      case_env,
      req_params,
      req_query,
      req_headers,
      req_body_type,
      req_body_form,
      req_body_other
    } = this.postman.state;


    let params = {
      interface_id,
      casename: caseName,
      col_id: colId,
      project_id,
      case_env,
      req_params,
      req_query,
      req_headers,
      req_body_type,
      req_body_form,
      req_body_other
    };

    if (params.test_res_body && typeof params.test_res_body === 'object') {
      params.test_res_body = JSON.stringify(params.test_res_body, null, '   ');
    }

    const res = await axios.post('/api/col/add_case', params);
    if (res.data.errcode) {
      message.error(res.data.errmsg);
    } else {
      message.success('添加成功');
      this.setState({ saveCaseModalVisible: false });
    }
  };

  render() {
    const { currInterface, currProject } = this.props;
    const data = Object.assign({}, currInterface, {
      env: currProject.env,
      pre_script: currProject.pre_script,
      after_script: currProject.after_script
    });
    data.path = currProject.basepath + currInterface.path;
    return (
      <div>
        <Postman
          data={data}
          id={currProject._id}
          type="inter"
          saveTip="保存到集合"
          save={() => this.setState({ saveCaseModalVisible: true })}
          boundaryCaseSave={() => this.setState({ saveBoundaryCaseModalVisible: true })}
          ref={this.savePostmanRef}
          interfaceId={currInterface._id}
          projectId={currInterface.project_id}
          projectToken={this.props.token}
          curUid={this.props.curUid}
        />
        <AddColModal
          visible={this.state.saveCaseModalVisible}
          caseName={currInterface.title}
          onCancel={() => this.setState({ saveCaseModalVisible: false })}
          onOk={this.saveCase}
        />
        <AddColModal
          visible={this.state.saveBoundaryCaseModalVisible}
          caseName={currInterface.title}
          onCancel={() => this.setState({ saveBoundaryCaseModalVisible: false })}
          onOk={this.saveBoundaryCase}
        />
      </div>
    );
  }
}
