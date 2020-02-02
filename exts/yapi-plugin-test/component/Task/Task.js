import React, { Component } from 'react';
import PropTypes from 'prop-types';
import './index.scss';
import { Icon, Layout, Tooltip, message, Row, Popconfirm } from 'antd';
const { Content, Sider } = Layout;
import TaskContent from '../TaskContent/TaskContent.js';
import { connect } from 'react-redux';

@connect(
  state => {
    return {
      projectMsg: state.project.currProject
    };
  }
)
class RunTask extends Component {
  static propTypes = {
    projectId: PropTypes.number,
    projectMsg: PropTypes.object,
    onOk: PropTypes.func
  };

  constructor(props) {
    super(props);
    this.state = {
      env: [],
      _id: null,
      currentEnvMsg: {},
      delIcon: null,
      currentKey: -2
    };
  }

  initState(curdata, id) {
    let newValue = {};
    newValue['env'] = [].concat(curdata);
    newValue['_id'] = id;
    this.setState({
      ...this.state,
      ...newValue
    });
  }

  async componentWillMount() {
    this._isMounted = true;
    await this.getProject(this.props.projectId);
    const { _id } = this.props.projectMsg;
    this.initState(this.state.env, _id);
    this.handleClick(0, this.state.env[0]);
  }

  componentWillUnmount() {
    this._isMounted = false;
  }

  handleClick = (key) => {
    // 设置当前的任务
    this.setState({
      curTaskData: this.state.env[key]
    })

  };

  // 增加环境变量项
  addParams = (name, data) => {
    data = { name: '新任务', domain: '', header: [] };
    let envList = [].concat(data, this.state.env);
    this.setState({
      env: envList
    });
    this.handleClick(0, data);
  };

  // 删除提示信息
  showConfirm(key, name) {
    let assignValue = this.delParams(key, name);
    this.onSave(assignValue);
  }

  // 删除环境变量项
  delParams = (key, name) => {
    let curValue = this.state.env;
    let newValue = {};
    newValue[name] = curValue.filter((val, index) => {
      return index !== key;
    });
    this.setState(newValue);
    this.handleClick(0, newValue[name][0]);
    newValue['_id'] = this.state._id;
    return newValue;
  };

  enterItem = key => {
    this.setState({ delIcon: key });
  };

  // 保存设置
  async onSave(assignValue) {
    await this
      .updateEnv(assignValue)
      .then(res => {
        if (res.payload.data.errcode == 0) {
          this.getProject(this.props.projectId);
          this.getEnv(this.props.projectId);
          message.success('修改成功! ');
          if(this._isMounted) {
            this.setState({ ...assignValue });
          }
        }
      })
      .catch(() => {
        message.error('环境设置不成功 ');
      });
  }

  //  提交保存信息
  onSubmit = (value, index) => {
    let assignValue = {};
    assignValue['env'] = [].concat(this.state.env);
    assignValue['env'].splice(index, 1, value['env']);
    assignValue['_id'] = this.state._id;
    this.onSave(assignValue);
    this.props.onOk && this.props.onOk(assignValue['env'], index);
  };

  // 动态修改环境名称
  handleInputChange = (value, currentKey) => {
    let newValue = [].concat(this.state.env);
    newValue[currentKey].name = value || '新环境';
    this.setState({ env: newValue });
  };

  render() {
    const { env, currentKey } = this.state;

    const envSettingItems = env.map((item, index) => {
      return (
        <Row
          key={index}
          className={'menu-item ' + (index === currentKey ? 'menu-item-checked' : '')}
          onClick={() => this.handleClick(index, item)}
          onMouseEnter={() => this.enterItem(index)}
        >
          <span className="env-icon-style">
            <span className="env-name" style={{ color: item.name === '新任务' && '#2395f1' }}>
              {item.name}
            </span>
            <Popconfirm
              title="您确认删除此任务?"
              onConfirm={e => {
                e.stopPropagation();
                this.showConfirm(index, 'env');
              }}
              okText="确定"
              cancelText="取消"
            >
              <Icon
                type="delete"
                className="interface-delete-icon"
                style={{
                  display: 'block'
                }}
              />
            </Popconfirm>
          </span>
        </Row>
      );
    });

    return (
      <div className="m-env-panel">
        <Layout className="project-env">
          <Sider width={195} style={{ background: '#fff' }}>
            <div style={{ height: '100%', borderRight: 0 }}>
              <Row className="first-menu-item menu-item">
                <div className="env-icon-style">
                  <h3>
                    测试任务列表&nbsp;<Tooltip placement="top" title="在这里添加项目的测试任务">
                      <Icon type="question-circle-o" />
                    </Tooltip>
                  </h3>
                  <Tooltip title="添加测试任务">
                    <Icon type="plus" onClick={() => this.addParams('env')} />
                  </Tooltip>
                </div>
              </Row>
              {envSettingItems}
            </div>
          </Sider>
          <Layout className="env-content">
            <Content style={{ background: '#fff', padding: 24, margin: 0, minHeight: 280 }}>
              {this.state.curTaskData ?
                <TaskContent
                  taskData={this.state.curTaskData}
                  projectMsg={this.props.projectMsg}
                  onSubmit={e => this.onSubmit(e, currentKey)}
                  handleEnvInput={e => this.handleInputChange(e, currentKey)}
                />
              :''}
            </Content>
          </Layout>
        </Layout>
      </div>
    );
  }
}

export default RunTask;
