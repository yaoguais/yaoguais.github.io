# 压力测试

## gatling

安装:
```
打开http://gatling.io并下载gatling安装包
$ wget "https://repo1.maven.org/maven2/io/gatling/highcharts/gatling-charts-highcharts-bundle/2.2.3/gatling-charts-highcharts-bundle-2.2.3-bundle.zip"
解压
$ zip gatling-charts-highcharts-bundle-2.2.3-bundle.zip
$ cd gatling-charts-highcharts-bundle-2.2.3
安装JAVA, 并设置JAVA_HOME和CLASSPATH
```

使用:
```
$ cd user-files/simulations/computerdatabase
$ cp BasicSimulation.scala FamelySimulation.scala
$ vim FamelySimulation.scala
package computerdatabase

import io.gatling.core.Predef._
import io.gatling.http.Predef._
import scala.concurrent.duration._

class FamelySimulation extends Simulation {

  val httpConf = http
    .baseURL("http://nihao.com") // Here is the root for all relative URLs
    .acceptHeader("text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8") // Here are the common headers
    .doNotTrackHeader("1")
    .acceptLanguageHeader("en-US,en;q=0.5")
    .acceptEncodingHeader("gzip, deflate")
    .userAgentHeader("Mozilla/5.0 (Macintosh; Intel Mac OS X 10.8; rv:16.0) Gecko/20100101 Firefox/16.0")

  val headers_10 = Map("Content-Type" -> "application/x-www-form-urlencoded") // Note the headers specific to a given request

  val scn = scenario("Scenario Name") // A scenario is a chain of requests and pauses
    .exec(http("request_1")
      .get("/discover"))

  setUp(scn.inject(atOnceUsers(1000)).protocols(httpConf))
}

$ cd -
$ bin/gatling.sh
根据提示选择FamelySimulation, 并输入测试名称，描述。
测试结束后会在results目录生成html文件，直接在浏览器中打开即可查看详细统计。
```

