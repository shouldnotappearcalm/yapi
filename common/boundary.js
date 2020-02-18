function generateErrorMaxString(obj) {
    if (obj && obj.type && obj.type === 'object') {
        generateErrorMaxString(obj.properties);
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
                obj[prop].minLength = obj[prop].maxLength + 1;
                obj[prop].maxLength = obj[prop].maxLength + 100;
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
                obj[prop].minimum = obj[prop].maximum + 1;
                obj[prop].maximum = obj[prop].maximum + 100;
            }

            if (obj[prop].type === 'object') {
                generateErrorMaxString(obj[prop].properties);
            }
        }
    }
}

function generateErrorMinString(obj) {
    if (obj && obj.type && obj.type === 'object') {
        generateErrorMinString(obj.properties);
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
            if (obj[prop].type === 'object') {
                generateErrorMinString(obj[prop].properties);
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

exports.generateErrorMaxString = generateErrorMaxString;
exports.generateErrorMinString = generateErrorMinString;
exports.generateErrorNull = generateErrorNull;