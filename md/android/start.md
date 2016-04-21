## Android开发之准备工作

目录:

1. 学习资料
2. 开发环境
3. 语言基础
4. 简单应用
5. 总结





### 学习资料

xxx





### 开发环境

配置开发环境大致有4步:

* 下载Android Studio
* 下载Java SDK
* 下载Android SDK
* 同步项目并实体机测试

IDE使用的是Android Studio, 可以从[安卓官网](http://developer.android.com/intl/zh-cn/sdk/index.html)下载,
[我这里下载Mac版的](https://dl.google.com/dl/android/studio/install/2.0.0.20/android-studio-ide-143.2739321-mac.dmg).
双击安装文件,打开Android Studio后会提示你找不到Java-SDK,然后引导我们去下载Java.

注意下载的是Java-SDK,而不是Java-JRE.Android Studio给我的连接版本是1.6的,而Android Studio最低也要Java7,
所以我们自己从[Java官网下载Java7](http://www.oracle.com/technetwork/java/javase/downloads/jdk7-downloads-1880260.html)
并安装.注意低版本的Android-SDK可能不支持Java8,所以我们选择Java7.

下载Android-SDK文件才是国内开发者的痛,不过好在有同学整理的[镜像](http://mirrors.neusoft.edu.cn/android/repository/),
我们首先从这里下载[常用管理工具](https://dl.google.com/android/android-sdk_r23.0.1-macosx.zip),
然后我们再到镜像下载[API-Level-23](http://mirrors.neusoft.edu.cn/android/repository/android-23_r02.zip),
然后下载[编译工具](http://mirrors.neusoft.edu.cn/android/repository/build-tools_r23.0.1-macosx.zip),
最后下载[调试工具](http://mirrors.neusoft.edu.cn/android/repository/platform-tools_r23.0.1-macosx.zip).
将android-sdk-macosx重命名为~/workspace/android-sdk,将android-6.0拷贝至~/workspace/android-sdk/platforms/下,
将android-6.0 2移动到~/workspace/android-sdk/build-tools/下,将platform-tools拷贝至~/workspace/android-sdk/下.

至此最基本需要下载的SDK已经下载完毕了.然后我们配置环境变量.

    sudo vim /etc/profile
    /*
    JAVA_HOME=/Library/Java/JavaVirtualMachines/jdk1.7.0_79.jdk/Contents/Home
    CLASSPATH=".:$JAVA_HOME/lib/dt.jar:$JAVA_HOME/lib/tools.jar"
    ANDROID_HOME=/Users/liuyong/workspace/android-sdk
    PATH="$JAVA_HOME/bin:$JAVA_HOME/jre/bin:$ANDROID_HOME/platform:$ANDROID_HOME/tools:$PATH"
    export JAVA_HOME CLASSPATH ANDROID_HOME PATH
    */
    source /etc/profile

如果IDE不能识别正确的JAVA_HOME,可以在IDE中强制设置一下就行了.

然后同步项目, git clone git@github.com:Yaoguais/jegarn.git,打开IDE并添加jegarn目录下的android-chat-system项目.
根据IDE右上角的提示"同步gradle",这样可以下载依赖的库,然后进行build,这个项目目前是能顺利编译通过的.

然后我们打开手机的开发者模式跟调试模式,用USB连接线把手机连上电脑,并运行项目,不出意外的话,可以看到应用成功的安装到手机上,
然后输入帐号密码,就能登录并聊天了.





### 语言基础

xxx





### 简单应用

xxx





### 总结

xxx




