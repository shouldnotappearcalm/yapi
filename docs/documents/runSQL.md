# `YAPI` 断言执行 `SQL`

## `SQL-Runner` 平台使用

[SQL Runner 平台地址](http://172.25.17.59:7111/html/login.html)

为什么有一个这样的平台呢，主要是因为考虑到大家后期会在断言里面执行 `SQL` 并且用返回结果进行一些操作，但是不熟悉 `SQL` 结果的话使用起来可能会有很多误解，

## 登录注册

这个就不用详加解释了，有帐号的直接登录，没有帐号的先注册再登录

## 数据库连接页面

保存你的数据库连接

## 测试执行 `SQL` 页面

可以看到我们执行的 `SQL` 返回值是 `JSON` 格式的

- `row`： 当前 `SQL` 执行后的返回行数，如果是 `insert`、`update`、`delete` 就是影响的行数
- `dataArray`: 当前 `SQL` 执行后的返回结果，用于 `select` 语句，数组形式

![image.png](http://bed.thunisoft.com:9000/ibed/2020/02/14/9KieJUzJo.png)

## `YAPI` 端的使用

[YAPI 平台地址](http://yapi.thunisoft.com/)

### 配置项目环境的数据库连接地址

设置 -> 数据库连接配置

- 环境列表： 环境列表对应环境配置中的多个环境，一个环境对应一个数据库地址
- 数据库类型：
  - PostgreSQL
  - ArteryBase
  - MySQL
  - Sybase
  - Oracle
  - 达梦
  - SQL Server
  - 人大金仓
- 数据库 `IP`： 数据库的主机地址
- 数据库端口
- 数据库名： 你要连接的数据库名字
- 数据库用户名
- 数据库密码

![image.png](http://bed.thunisoft.com:9000/ibed/2020/02/14/9Kilck83N.png)

### 在断言中执行 `SQL`

#### 1.首先确定你选择的运行环境是否已经存在对应的数据库环境

![image.png](http://bed.thunisoft.com:9000/ibed/2020/02/14/9Kiqn98RF.png)

#### 2.测试用例的断言

##### 如何执行自己的 `SQL

![image.png](http://bed.thunisoft.com:9000/ibed/2020/02/14/9KlHLKS9I.png)

- 下面的断言中执行的 `SQL` 为 `select * from db_lottery.t_lottery_config where c_id = '12122121221'`, `c_id` 的值为当前测试用例返回值的 `id` 属性，所以为 `body.id`。
- `defaultUtil.format("select * from db_lottery.t_lottery_config where c_id='%s'", body.id)`，这句代码就是一个替换占位符的操作，使用 `body.id` 值替换 `SQL` 语句中的占位符，`defaultUtil` 是默认引入的一个对象，更多的方法使用请参考 [文档](https://nodejs.org/api/util.html)
- `await execSQL()`，这句代码就是在你配置的数据库中去执行 `SQL`，方法名就是 `execSQL`，同时必须使用 `await` 关键字阻塞等待 `SQL` 的执行完成

```JavaScript
let res = await execSQL(defaultUtil.format("select * from db_lottery.t_lottery_config where c_id='%s'", body.id))
```

##### 如何使用数据库结果的返回值

如上文所示我们拿到了自己的 `SQL` 执行后的结果，如果知道返回的数据结果格式和怎么使用呢，前文提到的 `SQL Runner` 就可以让我们知道返回的格式。

```json
{
  "row": 1,
  "dataArray": [
    {
      "dt_create_time": "2019-11-28T09:44:08.000+0000",
      "c_value": "2020-1-12 13:20:00",
      "c_id": "f56ea50a8dca4e6baab51b8962f31078",
      "dt_update_time": "2019-11-28T09:44:10.000+0000",
      "c_key": "lottery.registration.end",
      "c_description": "测试描述"
    }
  ]
}
```

![image.png](http://bed.thunisoft.com:9000/ibed/2020/02/14/9KldxuP3I.png)

前面定义了 `let res = await execSQL(xxxxx)`，`res` 变量就保存了我们的返回结果,断言就可以像下面这样写

```JavaScript
// 获取行数
let row = res.row;

// 判断行数是不是 1
assert.equal(row, 1)

// 获取 c_id
let cId= res.dataArray[0].c_id;

// 判断 c_id 是不是测试用例返回值的 id
assert.equal(body.id, cId)

```

> 断言中 `assert` 的更多用法请参考 [文档](http://nodejs.cn/api/assert.html)

> 更多默认对象使用请参考 [文档](http://172.16.16.66:9999/documents/case.html#%e6%96%ad%e8%a8%80%e8%84%9a%e6%9c%ac%e5%85%ac%e5%85%b1%e5%8f%98%e9%87%8f)，其中重点使用参数
>
>- `params`： `http request params`, 合并了 `query` 和 `body`, `path` 中的变量也在其中
>- `body`： 返回 `response body`
>- `header`： 返回 `response header`
>- `records`： 记录的 `http` 请求信息，假设需要获取 `key` 为 `555` 的接口参数或者响应数据，可通过 `records[555].params` 或 `records[555].body` 获取

## 更多使用示例

### 1. 使用请求路径中的 `path` 变量

这里我 `path` 中有一个变量名为 `id` 的变量，就可以使用 `params.id` 进行获取变量进行使用

![image.png](http://bed.thunisoft.com:9000/ibed/2020/02/14/9KouoPkUj.png)

### 2. 使用请求的 `QUERY PARAMETERS` 中的变量

![image.png](http://bed.thunisoft.com:9000/ibed/2020/02/14/9KoyiE8VF.png)

### 3. 使用 `Request Body` 中的变量

![image.png](http://bed.thunisoft.com:9000/ibed/2020/02/14/9Kp1xr2sz.png)

### 4. 使用上一个用例的请求参数

找到你需要的用例的唯一标识 `Key`，我这里打算选取第一个用例 `4831` 的 `Request Params` 中的变量 `id2` 作为下一个用例断言的变量值

![image.png](http://bed.thunisoft.com:9000/ibed/2020/02/14/9KpB1vhi5.png)

在第二个用例的断言中使用

```JavaScript
records[4831].params.id2)
```

![image.png](http://bed.thunisoft.com:9000/ibed/2020/02/14/9KpEdAoCn.png)

#### 3.更多

目前 `YAPI` 的断言如果 `assert` 等如果都成功了，测试报告中的验证结果就不会打出来更多的日志，所以我测试 `SQL` 的时候写的 `assert.equal(status, 220)`，这样会在报告中看到我们执行的 sql 内容。

![image.png](http://bed.thunisoft.com:9000/ibed/2020/02/14/9KpHoBWwD.png)