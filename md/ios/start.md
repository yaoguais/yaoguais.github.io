## IOS开发之准备工作

为什么这下要学习IOS开发了呢,一方面是因为自己要做什么好玩的东西,就不用求人了;另一方面是因为我开发的聊天框架
[Jegarn](https://jegarn.com/)当前已经支持Android/PHP/JS等客户端了,不支持IOS总觉得不完美.
所以会花一点时间整理IOS相关的东西,以达到拿到一个项目,能快速梳理结构并能二次开发的程度.

题外话,因为公司很多业务会用Golang来拆分重构,所以Golang以后是我加强的重心,更多的时间会花在Go上面.

目录:

1. 学习资料
    - 视频资料
    - 书籍资料
    - 牛人博客
2. 开发环境
    - 基础环境配置
    - IDE的选择
    - 快捷键使用
    - 依赖管理
3. 语言基础
    - 基本数据类型
    - 变量与常量申明与初始化
    - 常见的复杂数据类型
    - 控制流语句
    - 函数申明与实现
    - 类Interface的属性与方法
    - 类别Category
    - 协议Protocol
    - 代码块Block
    - 委托
    - 内存管理
    - 字符串处理
    - 文件处理
    - 网络处理
4. 简单应用
5. 总结





### 学习资料

学习一门新的语言,我比较喜欢看别人的视频教程,一方面可以在比较放松的状态下听,另一方面可以看看别人对IDE的应用,
不好地方就是学习时间会比看书长很多,然后视频资源也不好找.

一般周末闲的时候,看看别人的视频放松放松.平时上下班就看看文档电子书之类的,也比较方面.





#### 视频资料

这里推荐一个不需要任何语言基础的视频教程,[征战Objective-C](http://www.imooc.com/view/218),
这个特别基础,作者完全是当你没有任何编程经验的.但是这个视频涉及OC的知识不够全面,仅够编程入门.

然后推荐一个比较全面的视频教程,[初始Objective-C](http://www.maiziedu.com/course/ios/495-6443/),
这个手机网页端有限制,手机客户端跟电脑端不是很清楚,电脑端暂时没有遇到.





#### 书籍文档

然后是书籍,这里是我找到的几个感觉还不错的.

如果你会其他语言,可以参照
[Y分钟学会IOS分钟](https://learnxinyminutes.com/docs/objective-c/)
快速浏览一下OC的语法.

但是OC的语法跟其他语言不太一样,可以查看这本翻译书籍
[禅与Objective-C编程艺术](http://objc-zen-book.books.yourtion.com/index.html),
了解OC比较特别的地方.

个人喜欢笔记式的讲解,比如[Objective-C学习笔记](http://blog.csdn.net/CHENYUFENG1991/article/category/5655905/6),
内容还是挺多的,涉及的知识点都比较全面.

[cocoschina](http://www.cocoachina.com/)也是不错的平台,可以了解下最新的资讯.





#### 牛人博客

* [唐巧的博客](http://blog.devtang.com/)
* [王巍的博客](https://onevcat.com/#blog)





### 开发环境

开发苹果的东西,一定是要用MAC操作系统的,不管是虚拟机安装/双系统安装,还是直接使用苹果的电脑.





#### 基础环境搭建

苹果开发环境搭建比较简单,因为苹果已经帮助你完成了,所以这一步是不用自己动手的.





#### IDE的选择

目前支持IOS开发的继承开发环境比较出名的有苹果自家的Xcode,还有就是JetBrains的AppCode.

当前大都数开发者使用的仍然是Xcode,所有我这里也使用Xcode,但是目前其他系的IDE,我基本都是使用的JetBrains家的.

我这里直接使用App Store安装Xcode,版本是7.2.1.





#### 快捷键使用

然后主要记录下IDE快捷键, 可以从网上随便下载一个项目亲自试验下,如果发现问题好及时调整.

Xcode的快捷键:

[来自Jimmy.Yang的整理](http://www.cnblogs.com/yjmyzz/archive/2011/01/25/1944325.html)
[来自Story of My Life的整理](http://www.cnblogs.com/mystory/archive/2013/01/31/2888163.html)

快速跳转:

* 前进后退: control + command + → 或 ←
* 跳转至申明与实现(类/方法/函数/协议等): command + 鼠标左键 (可连续点击)

光标操作:

* 将光标移至行首/行尾: command + → 或 ←
* 将光标移至文件开始/结束: command + ↑ 或 ↓
* 将光标移至上/下一个单词: option + → 或 ←
* 将光标移至当前段落开始/结束: option + ↑ 或 ↓

选中文本:

* 选中当前单词: 双击单词
* 选中当前行: 三击当前行
* 选中任意文本: shift + ↑↓←→

操作:

* 剪切: command + x
* 复制: command + c
* 粘贴: command + v
* 撤销: command + z
* 重做: command + shift + z
* 保存: command + s

注释:

* 单行注释/取消注释: command + / 
* 多行注释/取消注释: 选中多行, command + /
* 多行注释/取消注释: 开头结尾分别添加/* */

当前行:

* 下移当前行: option + command + [
* 下移当前行: option + command + ]
* 删除当前行之前内容: command + delete
* 删除当前行之后内容: control + k
* 删除当前行: 选中当前行,再按delete

重命名:

* 重命名变量: 点击该变量,出现下划虚线,然后command+control+E激活所有相同变量,然后进行修改.
* 重命名(类/方法/变量等): 单词上control + 鼠标左键, 然后选择reactor > rename, 进行重命名.

查找:

* 在文件中查找,command + F,输入关键字,command + G跳至下一个,command + shift + G跳至上一个,esc结束查找.
* 在项目中查找, command + shift + F, 输入关键字.

替换:

* 在文件中替换, option + command + F
* 在项目中替换, option + command + shift + F

缩进:

* 左缩进: command + [
* 右缩进: command + ]

格式化代码:

* 调整缩进: control + i

调试:

* 添加/移除断点: command + \
* 运行: command + R
* Step Over: F6
* Step Into: F7
* Step Out: F8
* Continue: control + command + Y
* 结束调试: 通过Xcode的自定义快捷键设置为 control + shift + D





#### 依赖管理

当前开发IOS一般使用CocoaPods进行依赖管理,
我们可以从[这里](http://blog.devtang.com/2014/05/25/use-cocoapod-to-manage-ios-lib-dependency/)找到基本的使用方式.

我们通过gem安装cocoapods,gem是一个ruby的脚本,那么我先更新gem.

    sudo gem update --system
    sudo gem install cocoapods

然后因为gem的下载源是被墙了的,所有我们换成一些国内的源.

    gem sources --remove https://rubygems.org/
    gem sources -a https://ruby.taobao.org/
    gem sources -l

由于pod是通过git进行管理Specs项目来完成依赖的,所以我们先下载这个项目.

    pod repo remove master
    pod repo add master https://gitcafe.com/akuandev/Specs.git
    pod repo update

这里选择源是很坑的,好多在我的电脑都是不能使用的,我这里选择的是coding.net,这里也列举一下其他的下载源.

    https://gitcafe.com/akuandev/Specs.git
    http://git.oschina.net/akuandev/Specs.git
    https://git.coding.net/hging/Specs.git
    https://github.com/CocoaPods/Specs.git

然后我们构建pod并安装更新.

    pod setup

然后我们通过Xcode新建一个测试项目,并在项目文件下创建pod的配置文件,并执行安装命令.

    vim Podfile
    /*
    platform :ios
    pod 'JSONKit',       '~> 1.4'
    pod 'Reachability',  '~> 3.0.0'
    pod 'ASIHTTPRequest'
    pod 'RegexKitLite'
    */
    pod install

成功执行install后,控制台会显示如下信息,这个过程可能要花一两分钟,稍作等待.

    Updating local specs repositories

    CocoaPods 1.0.0.beta.8 is available.
    To update use: `gem install cocoapods --pre`
    [!] This is a test version we'd love you to try.

    For more information see http://blog.cocoapods.org
    and the CHANGELOG for this version http://git.io/BaH8pQ.

    Analyzing dependencies
    Downloading dependencies
    Installing ASIHTTPRequest (1.8.2)
    Installing JSONKit (1.4)
    Installing Reachability (3.0.0)
    Installing RegexKitLite (4.0)
    Generating Pods project
    Integrating client project

    [!] Please close any current Xcode sessions and use `minions.xcworkspace` for this project from now on.
    Sending stats
    Pod installation complete! There are 4 dependencies from the Podfile and 4 total
    pods installed.

它的意思是以后我们打开ios的工程,就使用"minions.xcworkspace"这个文件了,而不使用Xcode给我们创建的"minions.xcodeproj"文件.

最后,如果有修改pod的配置文件,我们可以通过执行 pod update 来更新依赖.





### 语言基础

xxx







### 简单应用

xxx





### 总结

xxx




