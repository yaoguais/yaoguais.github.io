## iOS路上的点点滴滴

-- 为什么要学习iOS开发, first commit on 17 May.

为什么这下要学习iOS开发了呢, 一方面是因为自己要做什么好玩的东西, 就不用求人了; 另一方面是因为我开发的聊天框架
[Jegarn](https://jegarn.com/)当前已经支持Android/PHP/JS等客户端了, 不支持iOS总觉得不完美.
所以会花一点时间整理iOS相关的东西, 以达到拿到一个项目, 能快速梳理结构并能二次开发的程度.




-- 合格iOS程序员需要掌握那些技能, commit on 07 Oct.

作为一个不务正业的后端程序员, 已经在客户端的路上越走越远了. 无论哪门语言, 在当今的状况下,
几乎可能完成其他任何一门语言的所有功能, 只有你想不到的, 没有大神做不到的. 可能而知, 深刻的掌握
一门语言需要花费多少的时间和精力, 而一个人的精力毕竟有限.

我在iOS开发这方面的要求就像开始之初说的那样,
达到"拿到一个项目, 能快速梳理结构并能二次开发"的程度就够了.

但是自己要做出美好的东西, 光达到这种程度肯定是不够的, 所以整理了"合格iOS程序员需要掌握那些技能"这部分的内容,
以备在空闲的时候持续充电.





目录:

1. 学习资料
    - 视频资料
    - 书籍资料
    - 牛人博客
    - 扩展知识
2. 开发环境
    - 基础环境配置
    - IDE的选择
    - 快捷键使用
    - 依赖管理
3. 语言基础
4. 简单应用
5. 合格iOS程序员需要掌握那些技能
6. 总结





### 学习资料

学习一门新的语言,我比较喜欢看别人的视频教程,一方面可以在比较放松的状态下听,另一方面可以看看别人对IDE的应用,
不好地方就是学习时间会比看书长很多,然后视频资源也不好找.

一般周末闲的时候,看看别人的视频放松放松.平时上下班就看看文档电子书之类的,也比较方便.





#### 视频资料

这里推荐一个不需要任何语言基础的视频教程,[征战Objective-C](http://www.imooc.com/view/218),
这个特别基础,作者完全是当你没有任何编程经验的.但是这个视频涉及OC的知识不够全面,仅够编程入门.

然后推荐一个比较全面的视频教程,[初始Objective-C](http://www.maiziedu.com/course/ios/495-6443/),
这个手机网页端有限制,手机客户端跟电脑端不是很清楚,电脑端暂时没有遇到.





#### 书籍文档

然后是书籍,这里是我找到的几个感觉还不错的.

如果你会其他语言,可以参照
[Y分钟学会iOS](https://learnxinyminutes.com/docs/objective-c/)
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

唐巧的播客到现在也基本刷完了, 而且感觉随着他年龄的增长和工作的原因, 内容也以整理和人生感悟为主了, 以前的文章偏技术较多些.
多接触这样的人, 也更利于多方位发展些, 思考才是进步最高效的工具嘛.




#### 扩展知识

* [MVVM架构简介](http://objccn.io/issue-13-1/)
* [为iPhone6设计自适应布局](http://www.devtalking.com/articles/adaptive-layout-for-iphone6-1/)
* [底部四格导航实现](https://github.com/robbdimitrov/RDVTabBarController)
* [Cocoa框架结构与类图](http://blog.csdn.net/totogo2010/article/details/8081253)
* [LLDB在Xcode中的使用](http://southpeak.github.io/blog/2015/01/25/tool-lldb/)
* [有关View的几个基础知识点-iOS开发](http://blog.csdn.net/iukey/article/details/7083165)
* [深入探究frame和bounds的区别](http://www.cocoachina.com/ios/20140925/9755.html)
* [@select原理与使用总结](http://blog.csdn.net/fengsh998/article/details/8612969)
* [深入浅出iOS事件机制](http://zhoon.github.io/ios/2015/04/12/ios-event.html)
* [iOS事件机制](http://ryantang.me/blog/2013/12/07/ios-event-dispatch-1/)
* [iOS各应用组件学习](http://blog.csdn.net/column/details/xyzlmnios.html)
* [关于iOS状态栏(UIStatusBar)的若干问题](http://www.cnblogs.com/alby/p/4859537.html)




### 开发环境

开发苹果的东西,一定是要用MAC操作系统的,不管是虚拟机安装/双系统安装,还是直接使用苹果的电脑.





#### 基础环境搭建

苹果开发环境搭建比较简单,因为苹果已经帮助你完成了,所以这一步是不用自己动手的.





#### IDE的选择

目前支持iOS开发的继承开发环境比较出名的有苹果自家的Xcode,还有就是JetBrains的AppCode.

当前大都数开发者使用的仍然是Xcode,所有我这里也使用Xcode,但是目前其他系的IDE,我基本都是使用的JetBrains家的.

我这里直接使用App Store安装Xcode,版本是7.2.1.

update:

Xcode实在太难用了, 我都已经换成AppCode了.




#### 快捷键使用

然后主要记录下IDE快捷键, 可以从网上随便下载一个项目亲自试验下,如果发现问题好及时调整.

Xcode的快捷键:

* [来自Jimmy.Yang的整理](http://www.cnblogs.com/yjmyzz/archive/2011/01/25/1944325.html)
* [来自Story of My Life的整理](http://www.cnblogs.com/mystory/archive/2013/01/31/2888163.html)

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

当前开发iOS一般使用CocoaPods进行依赖管理,
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

语言可以从"Y分钟学会X语言"的Objective-C篇快速的了解OC的语法.

然后买一本书细细看下.




### 简单应用

在开头中说的一样, 我会完成"Jegarn"iOS端SDK的开发, 经过这近5个月断断续续的学习, 终于在10月2号的时候完成了.

其项目地址为[聊天框架Jegarn iOS端SDK](https://github.com/Yaoguais/ios-on-the-way/tree/master/minions).




### 合格iOS程序员需要掌握那些技能

在这之前我也一直在看别人写的文章, 别人的播客, 平时也在跟进, 看看别人都在思考着什么.

在iOS这方面, 唐巧的播客中的文章, 基本都看过了.

然后Google了一下, 一个合格的iOS程序员需要掌握那些技能, 总结如下:

| 阶段                        | 技能点                | 涵盖内容                   |
| ---                        | ---                   | ---                      |
| 基础                        | C语言                 | 语言基础 数据结构 算法 文件 内存管理等 |
| 基础                        | Objective-C语言       | 语言基础 面向对象等 |
| 基础                        | iOS基础               | UIKit MVC 代理模式等 |
| 进阶                        | iOS进阶               | 内存管理 Block 多线程 KVC/KVO等 |
| 进阶                        | iOS进阶               | 绘图 数据存取 网络 媒体 系统服务等 |
| 进阶                        | 游戏开发              | C++ cocos2d-x OpenGL等 |

上面的点都比较大, 下面给出一张细一点的表:

| 分类                        | 涵盖内容                                  |
| ---                        | ---                                      |
| 绘图                        | 2D绘图 CALayer图层 Core Animation         |
| 数据存取                    | Plist Preference NSKeyedArchiver SQLite3 Core Data |
| 多线程                      | pthreads NSThread NSOperationQueue GCD |
| 网络                        | NSURLConnection CFNetwork AFNetworking |
| 多媒体                      | 音频 视频 相机 相册 流媒体                |
| 系统服务                    | iCloud 推送 内购 Game Center 广告 蓝牙 电话 短信 通讯录 邮件 位置 |
| 常见技术                    | 地图 支付 二维码 即时通讯 |
| 产品                        | Sketch App发布 |

这些内容看起来挺多的, 其实大多没有什么难度, 更多的是经验上的积淀.

最后, 我们也可以通过一些面试题来检验自己是否掌握了这些知识点. 下面是我找到的一些整理:

- [招聘一个靠谱的 iOS](https://github.com/ChenYilong/iOSInterviewQuestions)


### 总结

总结就是keep learning, keep moving.