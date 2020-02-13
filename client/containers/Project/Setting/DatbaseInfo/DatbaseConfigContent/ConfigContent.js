import React, { Component } from 'react';
import PropTypes from 'prop-types';
import './index.scss';
import { Form, Input, Button, Row, Col, InputNumber, Select } from 'antd';
const FormItem = Form.Item;
const { Option } = Select;

// layout
const formItemLayout = {
  labelCol: {
    lg: { span: 4 },
    xs: { span: 7 },
    sm: { span: 7 }
  },
  wrapperCol: {
    lg: { span: 17 },
    xs: { span: 16 },
    sm: { span: 16 }
  },
  className: 'form-item'
};

class ConfigContent extends Component {
  static propTypes = {
    projectId: PropTypes.number,
    envMsg: PropTypes.object,
    configData: PropTypes.object,
    form: PropTypes.object,
    onSubmit: PropTypes.func,
    handleEnvInput: PropTypes.func
  };

  constructor(props) {
    super(props);
    this.state = {
      config_data: {}
    };
  }

  handleInit(data) {
    this.props.form.resetFields();
    this.setState({
      config_data: data
    });
  }

  componentWillReceiveProps(nextProps) {
    let curEnvName = this.props.envMsg.name;
    let nextEnvName = nextProps.envMsg.name;
    if (curEnvName !== nextEnvName) {
      this.handleInit(nextProps.configData);
    }
  }

  handleOk = e => {
    e.preventDefault();
    const { form, onSubmit, envMsg } = this.props;
    form.validateFields((err, values) => {
      if (!err) {
        let assignValue = this.state.config_data;
        values.config_data.env_id = envMsg._id;
        assignValue = Object.assign(assignValue, values.config_data);
        onSubmit(assignValue);
      }
    });
  };

  render() {
    const { envMsg } = this.props;
    const { getFieldDecorator } = this.props.form;
    const envTpl = data => {
      return (
        <div>
          <Row gutter={1}>
            <Col span={10}>
              <FormItem required={true} label="环境名称"
                {...formItemLayout}>
                {getFieldDecorator('config_data.env_name', {
                  validateTrigger: ['onChange', 'onBlur'],
                  initialValue: data.name === '新环境' ? '' : data.name || ''
                })(
                  <Input
                    disabled
                    placeholder="请输入环境名称"
                  />
                )}
              </FormItem>
            </Col>
          </Row>
          
          <Row gutter={1}>
            <Col span={10}>
              <FormItem {...formItemLayout} label={
                <span>数据库类型
                </span>
                }>
                {getFieldDecorator('config_data.database_type', {
                  rules: [
                    {
                      required: true,
                      message: '请选择数据库类型'
                    }
                  ],
                  validateTrigger: 'onBlur',
                  initialValue: this.state.config_data.database_type
                })(
                  <Select defaultValue={this.state.config_data.database_type} style={{ width: 150 }}>
                    <Option value="PostgreSQL">PostgreSQL</Option>
                    <Option value="ArteryBase">ArteryBase</Option>
                    <Option value="MySQL">MySQL</Option>
                    <Option value="Sybase">Sybase</Option>
                    <Option value="Oracle">Oracle</Option>
                    <Option value="DaMeng">DaMeng</Option>
                    <Option value="SQLServer">SQLServer</Option>
                    <Option value="KingBase">人大金仓</Option>
                  </Select>
                )}
              </FormItem>
            </Col>
            <Col span={10}>
              <FormItem {...formItemLayout} label={
                <span>数据库IP
                </span>
                }>
                {getFieldDecorator('config_data.database_host', {
                  rules: [
                    {
                      required: true,
                      message: '请输入数据库IP'
                    }
                  ],
                  validateTrigger: 'onBlur',
                  initialValue: this.state.config_data.database_host
                })(<Input />)}
              </FormItem>
            </Col>
          </Row>

          <Row gutter={1}>
            <Col span={10}>
              <FormItem {...formItemLayout} label={
                <span>数据库端口
                </span>
                }>
                {getFieldDecorator('config_data.database_port', {
                  rules: [
                    {
                      required: true,
                      message: '请输入数据库端口'
                    }
                  ],
                  validateTrigger: 'onBlur',
                  initialValue: this.state.config_data.database_port
                })(<InputNumber />)}
              </FormItem>
            </Col>
            <Col span={10}>
              <FormItem {...formItemLayout} label={
                <span>数据库名
                </span>
                }>
                {getFieldDecorator('config_data.database_name', {
                  rules: [
                    {
                      required: true,
                      message: '请输入数据库名'
                    }
                  ],
                  validateTrigger: 'onBlur',
                  initialValue: this.state.config_data.database_name
                })(<Input />)}
              </FormItem>
            </Col>
          </Row>

          <Row gutter={1}>
            <Col span={10}>
              <FormItem {...formItemLayout} label={
                <span>数据库用户名
                </span>
                }>
                {getFieldDecorator('config_data.database_user', {
                  rules: [
                    {
                      required: true,
                      message: '请输入数据库用户名'
                    }
                  ],
                  validateTrigger: 'onBlur',
                  initialValue: this.state.config_data.database_user
                })(<Input />)}
              </FormItem>
            </Col>
            <Col span={10}>
              <FormItem {...formItemLayout} label={
                <span>数据库密码
                </span>
                }>
                {getFieldDecorator('config_data.database_password', {
                  rules: [
                    {
                      required: true,
                      message: '请输入数据库密码'
                    }
                  ],
                  validateTrigger: 'onBlur',
                  initialValue: this.state.config_data.database_password
                })(<Input.Password />)}
              </FormItem>
            </Col>
          </Row>
        </div>
      );
    };

    return (
      <div>
        {envTpl(envMsg)}
        <Row>
          <Col span={21}>
            <div className="btnwrap-changeproject">
              <Button
                className="m-btn btn-save"
                icon="save"
                type="primary"
                size="large"
                onClick={this.handleOk}
              >
                保 存
              </Button>
            </div>
          </Col>
        </Row>
      </div>
    );
  }
}
export default Form.create()(ConfigContent);
