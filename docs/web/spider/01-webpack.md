---
id: spider-webpack
slug: /spider-webpack
title: webpack加载器
authors: develop
---

# webpack

webpack加载器主要作用的加载js模块运行

形式分为以下两种！

- 列表传参
  - 函数(形参)\{加载器\}([   ])
- 对象传参
  - 函数(形参)\{加载器\}({   })

```js showLineNumbers
// 加载器，所有模块从这个函数加载执行
(function(e){
  var t={}
  function d(n){
    if (t[n])
      return t[n].exports;
    console.log(n)
    var r = t[n] = {
      i:n,
      l:!1,
      exports:{}
    };
    return e[n].call(r.exports, r,r.exports, d),
      r.l = !0;
    r.exports
  }
 
  d("func1")//	使用加载器调用func1模块执行
}(
  {
    //	模块以数组形式组成
    func1:function (){
      console.log("function1")
    },
    func2:function (){
      console.log("function2")
    }
  }
)
);
```

