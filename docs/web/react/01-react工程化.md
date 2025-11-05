---
id: react-project
slug: /react-project
title: react工程化
authors: develop
---

# 代码仓库
React代码仓库 [Gitee](https://gitee.com/qixiangyang/react.git)。


# React工程化

## React脚手架
:::
帮助程序员用于创建react模板项目
React+Webpack+ES6+EsLint
模块化、组件化、工程化 
:::

### 创建项目并启动

- 全局安装
  - npm i create-react-app -g
- 创建目录 先切换到目标目录             
  - create-react-app react_staging
  - ![创建脚手架](https://gitee.com/qixiangyang/pictures/raw/master/images/2025/11/20251105172518778.png)
- 切换到工程目录
  - cd react_staging 
- 启动脚手架
  - yarn start 
- 打包
  - yarn build 
- 把所有的webpack的文件都暴露出来
  - yarn eject





# Diff算法
```js showLineNumbers
 /**
     * key作用：
     * 1.虚拟DOM中key的作用：
     *  key是虚拟DOM对象的标识
     *  1.当状态中的数据发生变化时，react会根据【新数据】生成【新的虚拟DOM】，
     *       随后React进行【新虚拟DOM】与【旧虚拟DOM】的diff比较，比较规则如下：
     *  （1）旧虚拟DOM中找到了与新虚拟DOM相同的key：
     *          （1）若内容相同，则直接复用此节点，更新属性
     *          （2）若内容不同，则生成新的真实DOM，随后替换掉旧的真实DOM
     *  （2）旧虚拟DOM中未找到与新虚拟DOM相同的key：
     *      创建新的真实DOM，挂载到页面上
     *  （3）新虚拟DOM中未找到与旧虚拟DOM相同的key：
     *      将旧真实DOM删除
     */

    /*
    使用index作为key
    数据：
       {id: 1,name: '张三',age: 18},
       {id: 2,name: '里斯',age: 19}
    初始化的虚拟dom
        <li key=0>张三 --- 18</li>
        <li key=1>里斯 --- 19</li>
    更新后的数据
       {id: 3,name: '小王',age: 20},
       {id: 1,name: '张三',age: 18},
       {id: 2,name: '里斯',age: 19},
    更新后的虚拟dom
        <li key=0>小王 --- 20</li> 对比 发现不同 转成真实dom放到页面上
        <li key=1>张三 --- 18</li> 对比 发现不同 转成真实dom放到页面上
        <li key=2>里斯 --- 19</li> 对比 发现不同 转成真实dom放到页面上
        张三和里斯都应该可复用的，但是索引值被打乱了 进行了三次虚拟dom的更新 导致了两次li的索引值被更新了
    
    所以根据每条数据的id作为索引值，这样效果是最佳的

    */

    /*
        用index作为key可能会引发的问题
        1.若对数据进行你需添加、逆序删除等破坏顺序的操作 会产生没有必要的dom更新，界面效果没有问题 但是效率会变低
        2.如果结构中会包含输入类的dom【选择器、输入框、checkbox】，会产生错误的dom更新，界面就会有问题 数据错乱
        3.如果不存在对数据的逆序添加、逆序删除等破坏顺序性操作。仅渲染列表作为提示 那么使用index是没有任何问题的
    */
```