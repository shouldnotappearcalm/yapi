const Mock = require('mockjs');

function generateErrorMax(obj) {
    if (obj && obj.type && obj.type === 'object') {
        generateErrorMax(obj.properties);
    } else {
        for (let prop in obj) {
            // string 类型
            if (obj[prop].type === 'string') {
                if (!obj[prop].minLength) {
                    obj[prop].minLength = 1;
                }
                if (!obj[prop].maxLength) {
                    // 根据公司的规范
                    obj[prop].maxLength = 300;
                }

                // 生成异常测试用例
                obj[prop].minLength = obj[prop].maxLength + 1;
                obj[prop].maxLength = obj[prop].maxLength + 100;
            }
            // integer 或者1number 类型
            if (obj[prop].type === 'number' || obj[prop].type === 'integer') {
                if (!obj[prop].minimum) {
                    obj[prop].minimum = 1;
                }
                if (!obj[prop].maximum) {
                    // 根据公司的规范
                    obj[prop].maximum = 10;
                }

                // 生成异常测试用例
                obj[prop].minimum = obj[prop].maximum + 1;
                obj[prop].maximum = obj[prop].maximum + 100;
            }
            // array 类型
            if (obj[prop].type === 'array') {
                if (!obj[prop].minItems) {
                    obj[prop].minItems = 1;
                }
                if (!obj[prop].maxItems) {
                    // 根据公司的规范
                    obj[prop].maxItems = 10;
                }

                // 生成异常测试用例
                obj[prop].minItems = obj[prop].maxItems + 1;
                obj[prop].maxItems = obj[prop].maxItems + 10;
            }


            if (obj[prop].type === 'object') {
                generateErrorMax(obj[prop].properties);
            }
        }
    }
}


function generateRegExpMock(obj) {
    if (obj && obj.type && obj.type === 'object') {
        generateRegExpMock(obj.properties);
    } else {
        for (let prop in obj) {

            if (obj[prop].type === 'array') {
            }

            if (obj[prop].type === 'object') {
                generateRegExpMock(obj[prop].properties);
            }
            // 如入果有正则表达式的情况
            if (obj[prop].mock && obj[prop].mock.mock && obj[prop].mock.mock.indexOf('@regexp') != -1) {
                
            }
        }
    }
}
 
function generateErrorMin(obj) {
    if (obj && obj.type && obj.type === 'object') {
        generateErrorMin(obj.properties);
    } else {
        for (let prop in obj) {
            if (obj[prop].type === 'string') {
                if (!obj[prop].minLength) {
                    obj[prop].minLength = 1;
                }
                if (!obj[prop].maxLength) {
                    // 根据公司的规范
                    obj[prop].maxLength = 300;
                }

                // 生成异常测试用例
                obj[prop].maxLength = (obj[prop].minLength - 1 > 0) ? obj[prop].minLength - 1 > 0 : 0;
                obj[prop].minLength = (obj[prop].maxLength - 10 > 0) ? obj[prop].maxLength - 10 > 0 : 0;
            }

            if (obj[prop].type === 'number' || obj[prop].type === 'integer') {
                if (!obj[prop].minimum) {
                    obj[prop].minimum = 1;
                }
                if (!obj[prop].maximum) {
                    // 根据公司的规范
                    obj[prop].maximum = 10;
                }

                // 生成异常测试用例
                obj[prop].maximum = obj[prop].minimum - 1;
                obj[prop].minimum = obj[prop].maximum - 10;
            }

            if (obj[prop].type === 'array') {
                if (!obj[prop].minItems) {
                    obj[prop].minItems = 1;
                }
                if (!obj[prop].maxItems) {
                    // 根据公司的规范
                    obj[prop].maxItems = 10;
                }

                // 生成异常测试用例
                obj[prop].maxItems = (obj[prop].minItems - 1 > 0) ? obj[prop].minItems - 1 > 0 : 0;
                obj[prop].minItems = (obj[prop].maxItems - 10 > 0) ? obj[prop].maxItems - 10 > 0 : 0;
            }

            if (obj[prop].type === 'object') {
                generateErrorMin(obj[prop].properties);
            }
        }
    }
}

// 生成 null 的对象
function generateErrorNull(obj) {
    for (let prop in obj) {
        if (typeof (obj[prop]) === 'object') {
            generateErrorNull(obj[prop]);
        } else {
            obj[prop] = null;
        }
    }
}

const regExp = [];

exports.generateErrorMax = generateErrorMax;
exports.generateErrorMin = generateErrorMin;
exports.generateErrorNull = generateErrorNull;