const yapi = require('../yapi.js');
const baseController = require('./base.js');
const databaseInfoModel = require('../models/databaseInfo.js');
const axios = require('axios');
const sqlRunnerHost = 'http://localhost:3111';

class databaseInfoController extends baseController {

    constructor(ctx) {
        super(ctx);
        this.databaseInfoModel = yapi.getInst(databaseInfoModel);
    }

    /**
    * 保存数据库连接信息
    * @interface /database_info/save
    * @method POST
    * @returns {Object}
    * @example
    */
    async saveDatabaseInfo(ctx) {
        try {
            let databaseInfo = ctx.request.body;
            if (!databaseInfo.project_id) {
                return (ctx.body = yapi.commons.resReturn(null, 408, '缺少项目Id'));
            }
            if (!databaseInfo.env_id) {
                return (ctx.body = yapi.commons.resReturn(null, 408, '缺少环境Id'));
            }
            // 校验数据库连接是否正常
            await this.connectDatabase(databaseInfo);

            let existDatabaseInfoData = await this.databaseInfoModel.getByProjectIdAndEnvId(databaseInfo.project_id, databaseInfo.env_id);
            let result;
            if (existDatabaseInfoData) {
                result = await this.databaseInfoModel.upById(existDatabaseInfoData._id, databaseInfo);
            } else {
                result = await this.databaseInfoModel.save(databaseInfo);
            }

            return (ctx.body = yapi.commons.resReturn(result));
        } catch (e) {
            return (ctx.body = yapi.commons.resReturn(null, 402, e.message));
        }
    }

    /**
    * 获取配置的数据库连接信息
    * @param {*} ctx 请求上下文
    * @method GET
    * @returns {Object}
    * @example
    */
    async getDatabaseInfo(ctx) {
        let projectId = ctx.query.project_id;
        let envId = ctx.query.env_id;
        if (!projectId) {
            return (ctx.body = yapi.commons.resReturn(null, 408, '缺少项目Id'));
        }
        if (!envId) {
            return (ctx.body = yapi.commons.resReturn(null, 408, '缺少环境Id'));
        }

        let result = await this.databaseInfoModel.getByProjectIdAndEnvId(projectId, envId);
        return (ctx.body = yapi.commons.resReturn(result));
    }

    /**
     * 获取一个项目的数据库连接信息
     * @param {*} ctx 请求上下文
     * @method GET
     * @returns {Object}
     * @example
     */
    async getAllDatabaseInfoByProjectId(ctx) {
        let projectId = ctx.query.project_id;
        if (!projectId) {
            return (ctx.body = yapi.commons.resReturn(null, 408, '缺少项目Id'));
        }

        let projectAllDatabaseInfo = await this.databaseInfoModel.getByProjectId(projectId);
        return (ctx.body = yapi.commons.resReturn(projectAllDatabaseInfo));
    }

    /**
     * 校验数据库连接信息是否有效
     * @param {*} ctx 请求上下文
     */
    async validateDatabaseInfo(ctx) {
        try {
            let databaseInfo = ctx.request.body;
            // TODO 增加校验代码
            return (ctx.body = yapi.commons.resReturn(databaseInfo));
        } catch (e) {
            return (ctx.body = yapi.commons.resReturn(null, 402, e.message));
        }
    }

    /**
     * 测试连接数据库
     * @param {*} databaseInfo 数据库连接信息对象 
     */
    async connectDatabase(databaseInfo) {
        let databaseInfoCopy = JSON.parse(JSON.stringify(databaseInfo));
        this.changeObjKeytoHump(databaseInfoCopy);
        try {
            let response = await axios({
                method: "POST",
                url: sqlRunnerHost + '/api/v1/database/actions/connect',
                data: JSON.stringify(databaseInfoCopy),
                headers: {
                    'Content-Type': 'application/json'
                }
            })
            if (response.status != 200) {
                throw new Error(`http status "${response.status}"` + '测试连接数据库失败')
            }
        } catch (e) {
            let response = e.response || {status: e.message || 'error'};
            throw new Error(`http status "${response.status}"`+ '测试连接数据库失败')
        }
        
    }

    /**
     * 将对象的数据库信息对象 key 下划线转换为驼峰命名
     * @param {*} databaseInfo 
     */
    changeObjKeytoHump(databaseInfo) {
        for (let key in databaseInfo) {
            let humpKey = this.toHump(key);
            databaseInfo[humpKey] = databaseInfo[key];
            delete databaseInfo[key];
        }
    }

    /**
     * 下划线转换为驼峰命名
     * @param {*} name key 的名字
     */
    toHump(name) {
        return name.replace(/\_(\w)/g, function(all, letter){
            return letter.toUpperCase();
        });
    }

}

module.exports = databaseInfoController;